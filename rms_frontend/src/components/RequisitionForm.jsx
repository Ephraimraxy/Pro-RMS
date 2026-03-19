import React, { useState } from 'react';
import { X, Upload, Send, Save, CreditCard, Package, FileText } from 'lucide-react';
import { addRequisition } from '../lib/store';

const RequisitionForm = ({ isOpen, onClose, user }) => {
  const [type, setType] = useState('cash'); // cash, material, memo
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    department: user?.role === 'department' ? user.name : 'General',
    notes: '',
    urgency: 'normal'
  });
  const [files, setFiles] = useState([]);

  if (!isOpen) return null;

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    const typeMap = { cash: 'Cash', material: 'Material', memo: 'Memo' };
    await addRequisition({ ...formData, type: typeMap[type], isDraft, createdBy: user?.name || 'Administrator' });
    setFormData({ description: '', amount: '', department: user?.role === 'department' ? user.name : 'General', notes: '', urgency: 'normal' });
    setType('cash');
    onClose();
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
            {[
              { id: 'cash', label: 'Cash', icon: CreditCard, color: 'emerald' },
              { id: 'material', label: 'Material', icon: Package, color: 'primary' },
              { id: 'memo', label: 'Memo', icon: FileText, color: 'amber' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setType(item.id)}
                className={`p-4 rounded-2xl border transition-all flex flex-col items-center space-y-2 ${
                  type === item.id 
                  ? `bg-${item.color}/10 border-${item.color}/50 text-${item.color} shadow-lg shadow-${item.color}/10` 
                  : 'bg-white/50 border-border/50 text-muted-foreground hover:border-border'
                }`}
              >
                <item.icon size={24} />
                <span className="text-xs font-bold uppercase tracking-tight">{item.label}</span>
              </button>
            ))}
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
              {type === 'cash' && (
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
                <input
                  type="text"
                  value={formData.department}
                  readOnly={user?.role === 'department'}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                  className={`w-full bg-white/80 border border-border rounded-2xl p-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${user?.role === 'department' ? 'opacity-70 cursor-not-allowed bg-muted/20' : ''}`}
                />
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
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Supporting Documents (FIRS Compliant)</label>
              <div className="border-2 border-dashed border-border/50 bg-white/40 rounded-2xl p-8 flex flex-col items-center justify-center space-y-3 hover:bg-white/80 transition-all cursor-pointer group">
                <div className="p-3 bg-muted rounded-full text-muted-foreground group-hover:text-primary transition-colors">
                  <Upload size={24} />
                </div>
                <div className="text-center">
                  <p className="text-sm text-foreground font-medium">Click to upload or drag & drop</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase">PDF, JPG, PNG, DOC (Max 10MB)</p>
                </div>
              </div>
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
