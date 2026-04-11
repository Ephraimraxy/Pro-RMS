import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Send, Save, CreditCard, Package, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { addRequisition, getDepartments, getRequisitionTypes, uploadAttachments } from '../lib/store';
import { deptAPI, aiAPI } from '../lib/api';
import { useNetwork } from '../App';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Departments whose members may route to Super Admin
const SUPER_ADMIN_PRIVILEGED_CODES = ['GMR', 'CEO', 'HRD'];

const RequisitionForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [types, setTypes]               = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [departments, setDepartments]   = useState([]);
  const [files, setFiles]               = useState([]);
  const [submitting, setSubmitting]     = useState(false);
  const [refining, setRefining]         = useState(false);
  const [aiPreview, setAiPreview]       = useState(null);

  // Activation check state for target department
  const [activation, setActivation]     = useState(null);   // null | { activated, headName }
  const [checkingActivation, setCheckingActivation] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    urgency: 'normal',
    targetDepartmentId: ''
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      const [allDepts, allTypes] = await Promise.all([getDepartments(), getRequisitionTypes()]);
      setDepartments(allDepts);
      setTypes(allTypes);
      if (allTypes.length > 0) setSelectedType(allTypes[0]);
    };
    load();
    // reset form when opened
    setFormData({ description: '', amount: '', urgency: 'normal', targetDepartmentId: '' });
    setFiles([]);
    setActivation(null);
    setSubmitting(false);
    setRefining(false);
    setAiPreview(null);
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine which departments are selectable as "Send To" targets
  const senderCode = user?.deptCode || '';
  const isPrivileged = SUPER_ADMIN_PRIVILEGED_CODES.includes(senderCode) || user?.role === 'global_admin';

  // Filter: exclude the sender's own dept from the target list; Super Admin is shown but restricted
  const targetableDepts = departments.filter(d => {
    if (d.id === user?.deptId) return false; // can't send to yourself
    return true;
  });

  const isSuperAdmin = (dept) => dept?.name?.toLowerCase() === 'super admin';

  const handleTargetChange = async (deptIdStr) => {
    setFormData(prev => ({ ...prev, targetDepartmentId: deptIdStr }));
    setActivation(null);
    if (!deptIdStr) return;

    const deptId = parseInt(deptIdStr);
    setCheckingActivation(true);
    try {
      const result = await deptAPI.checkActivation(deptId);
      setActivation(result);
    } catch {
      setActivation(null);
    } finally {
      setCheckingActivation(false);
    }
  };

  const handleRefine = async (e) => {
    e.preventDefault();
    if (!formData.description.trim() || formData.description.length < 5) {
      toast.error('Please enter a longer description to refine.');
      return;
    }
    setRefining(true);
    try {
      const res = await aiAPI.refineDraft(formData.description);
      
      const newTypeStr = res.documentType?.toLowerCase() || 'cash';
      const matchedType = types.find(t => 
        newTypeStr === 'memo' ? t.name.toLowerCase().includes('memo') : t.name.toLowerCase().includes('cash')
      ) || types[0];

      setSelectedType(matchedType);

      setAiPreview({
        description: res.refinedDescription,
        amount: res.totalAmount,
        typeLabel: matchedType?.name || 'Requisition'
      });
      toast.success('AI refinement complete. Please review the details.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'AI refinement failed.');
    } finally {
      setRefining(false);
    }
  };

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    if (!selectedType || submitting) return;

    if (!formData.description.trim()) {
      toast.error('Please enter a purpose / description.');
      return;
    }

    // Block if target department chosen but not activated (and not draft) - Bypass for Global Admin
    const isGlobalAdmin = user?.role === 'global_admin';
    if (!isDraft && formData.targetDepartmentId && activation && !activation.activated && !isGlobalAdmin) {
      toast.error('Selected target department has not activated their dashboard. Please choose another.');
      return;
    }

    setSubmitting(true);
    try {
      const finalDesc = aiPreview ? aiPreview.description : formData.description;
      const finalAmount = aiPreview ? aiPreview.amount : 0;

      const payload = {
        description:        finalDesc,
        title:              finalDesc, // Or a subset, for simplicity we trust backend/ui limits
        type:               selectedType.name,
        amount:             finalAmount,
        departmentId:       user?.deptId || undefined,
        urgency:            formData.urgency,
        isDraft,
        targetDepartmentId: formData.targetDepartmentId ? parseInt(formData.targetDepartmentId) : undefined
      };

      const result = await addRequisition(payload);

      // Upload attachments if created successfully
      if (result && result.length > 0 && files.length > 0) {
        try {
          await uploadAttachments(result[0].id, files);
        } catch {
          toast.error('Requisition created but file upload failed. You can add files later.');
        }
      }

      toast.success(isDraft ? 'Draft saved.' : 'Requisition submitted successfully.');
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Submission failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={!submitting ? onClose : undefined} />

      <div className="glass bg-white/90 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-border/50 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="p-5 border-b border-border/50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">New Requisition</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
              Originating Dept: {user?.name || user?.department || 'CSS Group'}
            </p>
          </div>
          <button
            onClick={!submitting ? onClose : undefined}
            disabled={submitting}
            className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-all disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Type selector (Removed - Handled by AI) */}

          {/* Description */}
          {!aiPreview ? (
            <div className="space-y-1.5 border-b border-border/50 pb-6">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                Rough Draft (What do you need?) *
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="E.g., I need 2 laptops at 250k each and a 50k router..."
                disabled={submitting || refining}
                className="w-full bg-white border border-border rounded-2xl p-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] transition-all disabled:opacity-60 resize-none shadow-inner"
                required
              />
            </div>
          ) : (
            <div className="space-y-4 border border-primary/20 bg-primary/5 rounded-2xl p-5 relative">
              <div className="absolute top-4 right-4 text-[10px] uppercase font-black text-primary tracking-widest px-2 py-1 bg-primary/10 rounded-full flex items-center gap-1">
                <CheckCircle2 size={12} /> AI Classified as: {aiPreview.typeLabel}
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Professional Request
                </label>
                <div className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                  {aiPreview.description}
                </div>
              </div>
              <div className="pt-3 border-t border-primary/10 flex justify-between items-center">
                <div className="space-y-0.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Automatically Calculated Total
                  </label>
                  <p className="text-xl font-mono font-bold text-foreground">
                    ₦ {aiPreview.amount.toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAiPreview(null)}
                  disabled={submitting}
                  className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
                >
                  Edit Draft
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Removed Manual Amount input block */}

            {/* Urgency */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                Urgency Level
              </label>
              <select
                value={formData.urgency}
                onChange={e => setFormData(p => ({ ...p, urgency: e.target.value }))}
                disabled={submitting}
                className="w-full bg-white/80 border border-border rounded-2xl p-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer transition-all disabled:opacity-60"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical / Emergency</option>
              </select>
            </div>
          </div>

          {/* ── Send To Department ── */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
              Send To Department (optional)
            </label>
            <select
              value={formData.targetDepartmentId}
              onChange={e => handleTargetChange(e.target.value)}
              disabled={submitting}
              className="w-full bg-white/80 border border-border rounded-2xl p-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer transition-all disabled:opacity-60"
            >
              <option value="">— Route through normal workflow —</option>
              {targetableDepts.map(d => {
                const superAdmin = isSuperAdmin(d);
                const blocked    = superAdmin && !isPrivileged;
                return (
                  <option
                    key={d.id}
                    value={d.id}
                    disabled={blocked}
                    className={blocked ? 'text-muted-foreground' : ''}
                  >
                    {d.name}{d.type === 'Strategic' ? ' ★' : ''}
                    {superAdmin ? ' (Admin — restricted)' : ''}
                  </option>
                );
              })}
            </select>

            {/* Activation feedback */}
            {checkingActivation && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse px-1">
                <Loader2 size={12} className="animate-spin" />
                Checking department status…
              </div>
            )}
            {!checkingActivation && formData.targetDepartmentId && activation !== null && (
              activation.activated ? (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    <strong>{activation.headName || 'Department'}</strong> is activated and will receive an email notification.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    This department <strong>has not activated</strong> their dashboard yet (no head email configured).
                    Please ask them to complete their profile, or choose another department.
                  </span>
                </div>
              )
            )}
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
              Supporting Documents (FIRS Compliant)
            </label>
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])}
              disabled={!isOnline || submitting}
            />
            <div
              onClick={() => isOnline && !submitting && fileInputRef.current?.click()}
              className={`border-2 border-dashed border-border/50 rounded-2xl p-6 flex flex-col items-center justify-center space-y-2 transition-all ${
                isOnline && !submitting
                  ? 'bg-white/40 hover:bg-white/80 cursor-pointer'
                  : 'bg-muted/30 opacity-50 cursor-not-allowed'
              }`}
            >
              <Upload size={22} className="text-muted-foreground" />
              <p className="text-xs text-foreground font-medium text-center">Click to upload · PDF, JPG, PNG, DOC (max 10 MB)</p>
              {!isOnline && (
                <p className="text-[10px] text-destructive uppercase font-bold">Attachments require online connection</p>
              )}
            </div>

            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-white/60 rounded-xl border border-border/40 text-xs">
                    <FileText size={12} className="text-primary shrink-0" />
                    <span className="font-medium truncate flex-1">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-border/50 flex items-center gap-3 bg-muted/10 shrink-0">
          <button
            type="button"
            onClick={e => handleSubmit(e, true)}
            disabled={submitting || refining || !selectedType}
            className="flex-1 border border-border bg-white hover:bg-muted text-foreground font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Draft
          </button>
          
          {!aiPreview ? (
            <button
              type="button"
              onClick={handleRefine}
              disabled={refining || !selectedType || !formData.description}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refining ? (
                <><Loader2 size={16} className="animate-spin" /> AI Analyzing…</>
              ) : (
                <>✨ Refine with AI</>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={e => handleSubmit(e, false)}
              disabled={submitting || (formData.targetDepartmentId && activation && !activation.activated)}
              className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Submitting…</>
              ) : (
                <><Send size={16} /> Confirm & Submit Request</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequisitionForm;
