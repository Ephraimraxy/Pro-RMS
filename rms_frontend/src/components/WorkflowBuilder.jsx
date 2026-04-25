import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Shield, ArrowDown, Settings2, Info, FileText, Users, ChevronRight, Save, Loader2 } from 'lucide-react';

const WorkflowStage = ({ stage, onUpdate, onDelete, isFirst }) => {
  return (
    <div className="relative flex flex-col items-center w-full">
      {!isFirst && (
        <div className="h-8 w-px bg-border flex items-center justify-center">
           <ArrowDown size={14} className="text-muted-foreground" />
        </div>
      )}
      
      <div className="glass bg-white/60 w-full max-w-md p-5 rounded-2xl border border-border/50 relative group hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shadow-sm">
                {stage.sequence}
             </div>
             <input 
                type="text" 
                value={stage.name}
                onChange={(e) => onUpdate({ ...stage, name: e.target.value })}
                className="bg-transparent border-none text-foreground font-bold text-sm focus:outline-none focus:ring-0 w-32"
                placeholder="Stage Name"
             />
          </div>
          <button onClick={onDelete} className="p-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Authorized Role</label>
          <div className="flex items-center space-x-2 bg-white/80 rounded-lg px-3 py-2 border border-border/50 shadow-sm">
            <Shield size={12} className="text-muted-foreground" />
            <select
              value={stage.role}
              onChange={(e) => onUpdate({ ...stage, role: e.target.value })}
              className="bg-transparent border-none text-xs text-foreground focus:outline-none w-full cursor-pointer"
            >
              <option value="Admin" className="bg-background">Admin</option>
              <option value="Audit" className="bg-background">Audit</option>
              <option value="Procurement" className="bg-background">Procurement</option>
              <option value="Finance" className="bg-background">Finance</option>
              <option value="GM" className="bg-background">General Manager</option>
              <option value="Chairman" className="bg-background">Chairman</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

import { getWorkflows, updateWorkflows, getRequisitionTypes, addRequisitionType, deleteRequisitionType } from '../lib/store';
import { settingsAPI } from '../lib/api';
import { toast } from 'react-hot-toast';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';

const DEFAULT_THRESHOLDS = { hr_ceiling: 50000, chairman_min: 100000 };

const WorkflowBuilder = ({ onViewChange }) => {
  const { user } = useAuth();
  const [stages, setStages] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stages'); // 'stages' | 'types' | 'authority'
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState(null);
  const [pendingType, setPendingType] = useState(null);
  const [newTypeName, setNewTypeName] = useState('');

  // ── Authority threshold state ──────────────────────────────────────────────
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [savingThresholds, setSavingThresholds] = useState(false);

  // ── Record access state ────────────────────────────────────────────────────
  const [recordDepts, setRecordDepts]       = useState([]);
  const [recordDeptOptions, setRecordDeptOptions] = useState([]);
  const [savingRecord, setSavingRecord]     = useState(false);

  // ── Feature flags ──────────────────────────────────────────────────────────
  const [studioEnabled, setStudioEnabled]     = useState(true);
  const [hrPortalEnabled, setHrPortalEnabled] = useState(true);
  const [savingFeatures, setSavingFeatures]   = useState(false);

  const loadData = async () => {
    const [workflowData, typeData] = await Promise.all([
      getWorkflows(),
      getRequisitionTypes()
    ]);
    setStages(workflowData);
    setTypes(typeData);
    setLoading(false);
  };

  const loadRecordAccess = async (allDepts = []) => {
    // Only HR, GM, Audit, ICC are configurable — Account/Chairman always have access
    const configurable = allDepts.filter(d =>
      /\bhr\b|human\s*resource|general\s*manager|\bgm\b|\bicc\b|integrity|compliance|audit/i.test(d.name)
    );
    setRecordDeptOptions(configurable);
    try {
      const res = await settingsAPI.get('record_visibility_depts');
      if (res?.value) {
        try { setRecordDepts(JSON.parse(res.value)); } catch {}
      }
    } catch {}
  };

  const saveRecordAccess = async () => {
    setSavingRecord(true);
    try {
      await settingsAPI.set('record_visibility_depts', JSON.stringify(recordDepts));
      toast.success('Record visibility settings saved.');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally { setSavingRecord(false); }
  };

  const toggleRecordDept = (id) => {
    setRecordDepts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const loadFeatureFlags = async () => {
    try {
      const [studioRes, hrRes] = await Promise.allSettled([
        settingsAPI.get('document_studio_enabled'),
        settingsAPI.get('hr_portal_enabled'),
      ]);
      if (studioRes.status === 'fulfilled' && studioRes.value?.value !== undefined)
        setStudioEnabled(studioRes.value.value !== 'false');
      if (hrRes.status === 'fulfilled' && hrRes.value?.value !== undefined)
        setHrPortalEnabled(hrRes.value.value !== 'false');
    } catch {}
  };

  const saveFeatureFlags = async () => {
    setSavingFeatures(true);
    try {
      await Promise.all([
        settingsAPI.set('document_studio_enabled', String(studioEnabled)),
        settingsAPI.set('hr_portal_enabled', String(hrPortalEnabled)),
      ]);
      toast.success('Feature settings saved.');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally { setSavingFeatures(false); }
  };

  const loadThresholds = async () => {
    try {
      const res = await settingsAPI.get('approval_thresholds');
      if (res?.value) {
        try { setThresholds({ ...DEFAULT_THRESHOLDS, ...JSON.parse(res.value) }); } catch {}
      }
    } catch {}
  };

  const saveThresholds = async () => {
    // Basic validation: hr_ceiling must be less than chairman_min
    if (thresholds.hr_ceiling >= thresholds.chairman_min) {
      toast.error('HR Ceiling must be less than the Chairman / CEO floor.');
      return;
    }
    setSavingThresholds(true);
    try {
      await settingsAPI.set('approval_thresholds', JSON.stringify(thresholds));
      toast.success('Authority thresholds saved successfully.');
    } catch {
      toast.error('Failed to save thresholds. Please try again.');
    } finally { setSavingThresholds(false); }
  };

  useEffect(() => {
    (async () => {
      const { getDepartments } = await import('../lib/store');
      const [, , depts] = await Promise.all([
        loadData(),
        loadThresholds(),
        getDepartments()
      ]);
      await Promise.all([
        loadRecordAccess(Array.isArray(depts) ? depts : []),
        loadFeatureFlags()
      ]);
    })();
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);

  const addStage = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 600));
    const newStage = {
      id: Date.now(),
      sequence: stages.length + 1,
      name: 'New Stage',
      role: 'Admin',
      threshold: 0
    };
    const updated = [...stages, newStage];
    setStages(updated);
    await updateWorkflows(updated);
    setIsProcessing(false);
    toast.success('New stage added to workflow');
  };

  const updateStage = async (updatedStage) => {
    const updated = stages.map(s => s.id === updatedStage.id ? updatedStage : s);
    setStages(updated);
    await updateWorkflows(updated);
  };

  const confirmDelete = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 600));
    
    if (activeTab === 'stages' && pendingStage) {
      const updated = stages.filter(s => s.id !== pendingStage.id).map((s, idx) => ({ ...s, sequence: idx + 1 }));
      setStages(updated);
      await updateWorkflows(updated);
      toast.error('Stage removed');
    } else if (activeTab === 'types' && pendingType) {
      await deleteRequisitionType(pendingType.id);
      setTypes(types.filter(t => t.id !== pendingType.id));
    }
    
    setIsProcessing(false);
    setIsDeleteModalOpen(false);
    setPendingStage(null);
    setPendingType(null);
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    if (!newTypeName) return;
    setIsProcessing(true);
    const result = await addRequisitionType({ name: newTypeName });
    if (result) {
        setTypes([...types, result]);
        setNewTypeName('');
    }
    setIsProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <Settings2 size={24} className="animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-bold text-primary tracking-widest uppercase animate-pulse">Syncing Approval Chain</p>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
              <Settings2 className="text-primary" />
              <span>Studio <span className="text-primary">Configuration</span></span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium italic">
              "Zero-Hardcoding" Hub: Define the rules and types of your organisation.
            </p>
          </div>
          
          <div className="flex bg-muted/40 p-1.5 rounded-2xl border border-border/50 shadow-inner">
            <button
              onClick={() => setActiveTab('stages')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'stages' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[0.98]' : 'text-muted-foreground hover:bg-muted/80'}`}
            >
              Approval Workflow
            </button>
            <button
              onClick={() => setActiveTab('types')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'types' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[0.98]' : 'text-muted-foreground hover:bg-muted/80'}`}
            >
              Unit Types
            </button>
            <button
              onClick={() => setActiveTab('authority')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'authority' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[0.98]' : 'text-muted-foreground hover:bg-muted/80'}`}
            >
              Authority Bands
            </button>
            <button
              onClick={() => setActiveTab('record')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'record' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[0.98]' : 'text-muted-foreground hover:bg-muted/80'}`}
            >
              Record Access
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'features' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[0.98]' : 'text-muted-foreground hover:bg-muted/80'}`}
            >
              Features
            </button>
          </div>
        </div>

        {activeTab === 'authority' ? (
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="glass bg-white/60 p-8 rounded-[2.5rem] border border-border/50 shadow-xl space-y-8">
              <div>
                <h3 className="text-lg font-black text-foreground tracking-tight">Approval Authority Bands</h3>
                <p className="text-sm text-muted-foreground mt-1 font-medium leading-relaxed">
                  Define the two amount boundaries that split requisitions across the three signatory tiers.
                  Changes take effect immediately for all new approvals.
                </p>
              </div>

              {/* Live band preview */}
              <div className="space-y-2">
                {/* Band 1 – HR */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border border-blue-200">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-blue-800 uppercase tracking-widest">Band 1 — HR</p>
                    <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                      ₦0 – ₦{Number(thresholds.hr_ceiling).toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-blue-400 shrink-0" />
                </div>

                {/* Band 2 – GM (derived) */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                    <Shield size={18} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Band 2 — General Manager</p>
                    <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                      ₦{Number(thresholds.hr_ceiling + 1).toLocaleString()} – ₦{Number(thresholds.chairman_min - 1).toLocaleString()}
                      <span className="ml-2 text-[10px] italic opacity-60">(auto-calculated)</span>
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-amber-400 shrink-0" />
                </div>

                {/* Band 3 – Chairman */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Settings2 size={18} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">Band 3 — Chairman / CEO</p>
                    <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                      ₦{Number(thresholds.chairman_min).toLocaleString()} and above
                    </p>
                  </div>
                </div>
              </div>

              {/* Input controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-border/40">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    HR Ceiling (₦)
                  </label>
                  <p className="text-[10px] text-muted-foreground/60 italic -mt-1">
                    HR can approve amounts up to and including this value
                  </p>
                  <input
                    type="number"
                    min="1"
                    value={thresholds.hr_ceiling}
                    onChange={e => setThresholds(prev => ({ ...prev, hr_ceiling: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white border border-border/50 rounded-xl px-4 py-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Chairman / CEO Floor (₦)
                  </label>
                  <p className="text-[10px] text-muted-foreground/60 italic -mt-1">
                    Chairman must approve amounts from this value upwards
                  </p>
                  <input
                    type="number"
                    min="1"
                    value={thresholds.chairman_min}
                    onChange={e => setThresholds(prev => ({ ...prev, chairman_min: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white border border-border/50 rounded-xl px-4 py-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                  />
                </div>
              </div>

              {thresholds.hr_ceiling >= thresholds.chairman_min && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                  <Info size={14} className="shrink-0" />
                  HR Ceiling must be strictly less than the Chairman / CEO Floor.
                </div>
              )}

              <button
                onClick={saveThresholds}
                disabled={savingThresholds || thresholds.hr_ceiling >= thresholds.chairman_min}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20 text-xs uppercase tracking-widest disabled:opacity-50 active:scale-[0.98]"
              >
                {savingThresholds ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savingThresholds ? 'Saving…' : 'Save Thresholds'}
              </button>
            </div>
          </div>
        ) : activeTab === 'record' ? (
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="glass bg-white/60 p-8 rounded-[2.5rem] border border-border/50 shadow-xl space-y-6">
              <div>
                <h3 className="text-lg font-black text-foreground tracking-tight">Record Visibility Access</h3>
                <p className="text-sm text-muted-foreground mt-1 font-medium leading-relaxed">
                  By default, full records are visible to the <strong>Creator Department, Super Admin, Account,</strong> and <strong>Chairman/CEO</strong>.
                  Toggle additional departments below to extend access.
                </p>
              </div>

              {/* Always-on badges */}
              <div className="flex flex-wrap gap-2">
                {['Creator Dept', 'Super Admin', 'Account', 'Chairman / CEO'].map(label => (
                  <span key={label} className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    {label} — Always
                  </span>
                ))}
              </div>

              <div className="border-t border-border/40 pt-5 space-y-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Configurable Departments</p>
                {recordDeptOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No configurable departments found. Make sure HR, GM, Audit, and ICC departments exist in the system.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recordDeptOptions.map(d => {
                      const checked = recordDepts.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          onClick={() => toggleRecordDept(d.id)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${checked ? 'border-primary bg-primary/5' : 'border-border/50 bg-white/80 hover:border-primary/30'}`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-primary border-primary' : 'border-border'}`}>
                            {checked && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                          </div>
                          <div>
                            <p className={`text-xs font-black uppercase tracking-widest ${checked ? 'text-primary' : 'text-foreground'}`}>{d.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{checked ? 'Full record access granted' : 'Access restricted'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={saveRecordAccess}
                disabled={savingRecord}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20 text-xs uppercase tracking-widest disabled:opacity-50 active:scale-[0.98]"
              >
                {savingRecord ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savingRecord ? 'Saving…' : 'Save Access Settings'}
              </button>
            </div>
          </div>
        ) : activeTab === 'features' ? (
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="glass bg-white/60 p-8 rounded-[2.5rem] border border-border/50 shadow-xl space-y-6">
              <div>
                <h3 className="text-lg font-black text-foreground tracking-tight">Feature Controls</h3>
                <p className="text-sm text-muted-foreground mt-1 font-medium leading-relaxed">
                  Enable or disable system features for all users. Changes take effect immediately.
                </p>
              </div>

              <div className="space-y-4">
                {/* Document Studio toggle */}
                <div className="flex items-center justify-between p-5 rounded-2xl border-2 border-border/50 bg-white/80 hover:border-primary/30 transition-all">
                  <div className="space-y-0.5">
                    <p className="text-sm font-black text-foreground">Document Studio</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Allows all users to access the Document Studio for printing and PDF generation.
                      When disabled the Studio tab is hidden from the sidebar.
                    </p>
                  </div>
                  <button
                    onClick={() => setStudioEnabled(v => !v)}
                    className={`relative ml-6 shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${studioEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${studioEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* HR Portal toggle */}
                <div className="flex items-center justify-between p-5 rounded-2xl border-2 border-border/50 bg-white/80 hover:border-primary/30 transition-all">
                  <div className="space-y-0.5">
                    <p className="text-sm font-black text-foreground">HR Portal</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Grants the HR department access to the HR management portal (employees, leave, attendance, payroll, recruitment).
                      When disabled the HR Portal button is hidden from the sidebar.
                    </p>
                  </div>
                  <button
                    onClick={() => setHrPortalEnabled(v => !v)}
                    className={`relative ml-6 shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${hrPortalEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${hrPortalEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${studioEnabled ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <p className="text-xs text-muted-foreground font-medium">
                    Document Studio is currently <strong className={studioEnabled ? 'text-emerald-600' : 'text-red-500'}>{studioEnabled ? 'enabled' : 'disabled'}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${hrPortalEnabled ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <p className="text-xs text-muted-foreground font-medium">
                    HR Portal is currently <strong className={hrPortalEnabled ? 'text-emerald-600' : 'text-red-500'}>{hrPortalEnabled ? 'enabled' : 'disabled'}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={saveFeatureFlags}
                disabled={savingFeatures}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20 text-xs uppercase tracking-widest disabled:opacity-50 active:scale-[0.98]"
              >
                {savingFeatures ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savingFeatures ? 'Saving…' : 'Save Feature Settings'}
              </button>
            </div>
          </div>
        ) : activeTab === 'stages' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-end">
              <button 
                onClick={addStage}
                disabled={isProcessing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                   <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                ) : (
                   <Plus size={18} />
                )}
                <span>{isProcessing ? 'Adding...' : 'Add Stage'}</span>
              </button>
            </div>
            
            <div className="flex flex-col items-center space-y-0">
              {stages.map((stage, idx) => (
                <WorkflowStage 
                  key={stage.id} 
                  stage={stage} 
                  onUpdate={updateStage}
                  onDelete={() => { setPendingStage(stage); setIsDeleteModalOpen(true); }}
                  isFirst={idx === 0}
                />
              ))}

              <div className="flex flex-col items-center mt-4">
                 <div className="h-8 w-px bg-border"></div>
                 <div className="glass p-4 rounded-2xl border border-emerald-500/20 bg-emerald-50 text-emerald-600 font-bold text-xs uppercase tracking-[0.2em] shadow-sm">
                    Finance Processing (Final)
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="glass bg-white/60 p-8 rounded-[2.5rem] border border-border/50 shadow-xl overflow-hidden relative">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/40">
                    <h3 className="text-xl font-bold text-foreground">Manage Requisition Types</h3>
                    <form onSubmit={handleAddType} className="flex items-center space-x-3">
                        <input 
                            type="text" 
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            placeholder="New Type (e.g. Petty Cash)"
                            className="bg-muted/30 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none w-64"
                        />
                        <button type="submit" disabled={isProcessing} className="bg-primary p-3 rounded-xl text-primary-foreground hover:scale-105 transition-all shadow-lg shadow-primary/20 active:scale-95">
                           <Plus size={20} />
                        </button>
                    </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {types.map(type => (
                        <div key={type.id} className="p-5 rounded-2xl border border-border/40 bg-white/40 group hover:border-primary/20 transition-all flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                   <FileText size={20} />
                                </div>
                                <span className="font-bold text-foreground">{type.name}</span>
                            </div>
                            <button 
                                onClick={() => { setPendingType(type); setIsDeleteModalOpen(true); }}
                                className="p-2 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        size="lg"
        isProcessing={isProcessing}
        title={activeTab === 'stages' ? "Delete Workflow Stage" : "Delete Requisition Type"}
        message={activeTab === 'stages' 
          ? `Are you sure you want to delete the "${pendingStage?.name}" stage? This will re-sequence the approval chain.`
          : `Are you sure you want to delete the "${pendingType?.name}" requisition type? This cannot be undone.`
        }
      />
    </>
  );
};

export default WorkflowBuilder;
