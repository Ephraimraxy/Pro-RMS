import React, { useState } from 'react';
import { X, Upload, Send, Save, CreditCard, Package, FileText } from 'lucide-react';
import { addRequisition, getDepartments, getRequisitionTypes, uploadAttachments } from '../lib/store';
import { useNetwork } from '../App';
import { useEffect, useRef } from 'react';

const RequisitionForm = ({ isOpen, onClose, user }) => {
  const { isOnline } = useNetwork();
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    departmentId: user?.deptId || '',
    notes: '',
    urgency: 'normal'
  });
  const [departments, setDepartments] = useState([]);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetch = async () => {
      const [allDepts, allTypes] = await Promise.all([
        getDepartments(),
        getRequisitionTypes()
      ]);
      setDepartments(allDepts);
      setTypes(allTypes);
      if (allTypes.length > 0) setSelectedType(allTypes[0]);
      
      if (user?.role !== 'department' && !formData.departmentId && allDepts.length > 0) {
        setFormData(prev => ({ ...prev, departmentId: allDepts[0].id }));
      }
    };
    fetch();
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    if (!selectedType) return;
    
    try {
      const result = await addRequisition({ 
        ...formData, 
        typeId: selectedType.id,
        type: selectedType.name,
        isDraft, 
        createdBy: user?.name || 'Administrator' 
      });

      // If there are files and creation was successful, upload them
      if (result && result.length > 0 && files.length > 0) {
        const reqId = result[0].id;
        await uploadAttachments(reqId, files);
      }
      
      setFormData({ description: '', amount: '', departmentId: user?.deptId || '', notes: '', urgency: 'normal' });
      setFiles([]);
      onClose();
    } catch (err) {
      console.error("Submission failed:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="glass bg-white/80 w-full max-w-2xl rounded-3xl border border-border/50 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">New Requisition</h2>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Originating Dept: {user?.department_id?.[1] || 'CSS Group'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Type Selector */}
          <div className="grid grid-cols-3 gap-3">
            {types.map(t => {
              const Icon = t.name.toLowerCase().includes('material') ? Package : (t.name.toLowerCase().includes('memo') ? FileText : CreditCard);
              const color = t.name.toLowerCase().includes('material') ? 'primary' : (t.name.toLowerCase().includes('memo') ? 'amber' : 'emerald');
              
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`p-4 rounded-2xl border transition-all flex flex-col items-center space-y-2 ${
                    selectedType?.id === t.id 
                    ? `bg-${color}/10 border-${color}/50 text-${color} shadow-lg shadow-${color}/10` 
                    : 'bg-white/50 border-border/50 text-muted-foreground hover:border-border'
                  }`}
                >
                  <Icon size={24} />
                  <span className="text-[10px] font-bold uppercase tracking-tight line-clamp-1">{t.name}</span>
                </button>
              );
            })}
          </div>

          <form className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Purpose / Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Briefly describe the requirement..."
                className="w-full bg-white/80 border border-border rounded-2xl p-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px] transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedType?.name.toLowerCase().includes('cash') && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Requested Amount (₦)</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                    className="w-full bg-white/80 border border-border rounded-2xl p-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-lg"
                    required
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Assigned Unit / Dept</label>
                {user?.role === 'department' ? (
                  <input
                    type="text"
                    value={user.name}
                    readOnly
                    className="w-full bg-muted/20 border border-border rounded-2xl p-4 text-foreground opacity-70 cursor-not-allowed transition-all"
                  />
                ) : (
                  <select
                    value={formData.departmentId}
                    onChange={e => setFormData({...formData, departmentId: parseInt(e.target.value)})}
                    className="w-full bg-white/80 border border-border rounded-2xl p-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Urgency Level</label>
                <select 
                   value={formData.urgency}
                   onChange={e => setFormData({...formData, urgency: e.target.value})}
                   className="w-full bg-white/80 border border-border rounded-2xl p-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer transition-all"
                >
                  <option value="normal" className="bg-background">Normal</option>
                  <option value="urgent" className="bg-background">Urgent</option>
                  <option value="critical" className="bg-background text-destructive">Critical / Emergency</option>
                </select>
              </div>
            </div>


            {/* File Upload Area */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Supporting Documents (FIRS Compliant)</label>
              <input 
                type="file" 
                multiple 
                className="hidden" 
                ref={fileInputRef} 
                onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files)])} 
                disabled={!isOnline}
              />
              <div 
                onClick={() => isOnline && fileInputRef.current.click()}
                className={`border-2 border-dashed border-border/50 rounded-2xl p-8 flex flex-col items-center justify-center space-y-3 transition-all group ${
                  isOnline ? 'bg-white/40 hover:bg-white/80 cursor-pointer' : 'bg-muted/30 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="p-3 bg-muted rounded-full text-muted-foreground group-hover:text-primary transition-colors">
                  <Upload size={24} />
                </div>
                <div className="text-center">
                  <p className="text-sm text-foreground font-medium">Click to upload or drag & drop</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase">PDF, JPG, PNG, DOC (Max 10MB)</p>
                  {!isOnline && (
                    <p className="text-[10px] text-destructive mt-1 uppercase">Attachments require online connection</p>
                  )}
                </div>
              </div>

              {files.length > 0 && (
                <div className="grid grid-cols-1 gap-2 mt-4">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/60 rounded-xl border border-border/40 text-xs shadow-sm">
                      <div className="flex items-center space-x-3 truncate">
                        <FileText size={14} className="text-primary shrink-0" />
                        <span className="font-medium truncate">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border/50 flex items-center space-x-4 bg-muted/20">
          <button 
            onClick={e => handleSubmit(e, true)}
            className="flex-1 border border-border bg-white hover:bg-muted text-foreground font-bold py-4 rounded-2xl transition-all flex items-center justify-center space-x-2 shadow-sm"
          >
            <Save size={18} />
            <span>Save as Draft</span>
          </button>
          <button 
            onClick={e => handleSubmit(e, false)}
            className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center space-x-2"
          >
            <Send size={18} />
            <span>Submit for Review</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequisitionForm;
