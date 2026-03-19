import React, { useState } from 'react';
import { X, Upload, Send, Save, CreditCard, Package, FileText } from 'lucide-react';

const RequisitionForm = ({ isOpen, onClose, user }) => {
  const [type, setType] = useState('cash'); // cash, material, memo
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    department: user?.department_id?.[1] || 'General',
    notes: ''
  });
  const [files, setFiles] = useState([]);

  if (!isOpen) return null;

  const handleSubmit = (e, isDraft = false) => {
    e.preventDefault();
    console.log("Submitting Requisition:", { ...formData, type, isDraft, files });
    // TODO: Odoo RPC to create css.rms.requisition
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="glass w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">New Requisition</h2>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Originating Dept: {user?.department_id?.[1] || 'CSS Group'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Type Selector */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'cash', label: 'Cash', icon: CreditCard, color: 'emerald' },
              { id: 'material', label: 'Material', icon: Package, color: 'blue' },
              { id: 'memo', label: 'Memo', icon: FileText, color: 'amber' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setType(item.id)}
                className={`p-4 rounded-2xl border transition-all flex flex-col items-center space-y-2 ${
                  type === item.id 
                  ? `bg-${item.color}-500/10 border-${item.color}-500/50 text-${item.color}-400 shadow-lg shadow-${item.color}-500/10` 
                  : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'
                }`}
              >
                <item.icon size={24} />
                <span className="text-xs font-bold uppercase tracking-tight">{item.label}</span>
              </button>
            ))}
          </div>

          <form className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Purpose / Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Briefly describe the requirement..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px] transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {type === 'cash' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Requested Amount (₦)</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-lg"
                    required
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Urgency Level</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer transition-all">
                  <option value="normal" className="bg-zinc-900">Normal</option>
                  <option value="urgent" className="bg-zinc-900">Urgent</option>
                  <option value="critical" className="bg-zinc-900 text-red-400">Critical / Emergency</option>
                </select>
              </div>
            </div>

            {/* File Upload Area */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Supporting Documents (FIRS Compliant)</label>
              <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center space-y-3 hover:bg-white/5 transition-all cursor-pointer group">
                <div className="p-3 bg-white/5 rounded-full text-zinc-500 group-hover:text-blue-400 transition-colors">
                  <Upload size={24} />
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-300 font-medium">Click to upload or drag & drop</p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase">PDF, JPG, PNG, DOC (Max 10MB)</p>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 flex items-center space-x-4 bg-white/[0.02]">
          <button 
            onClick={e => handleSubmit(e, true)}
            className="flex-1 border border-white/10 hover:bg-white/5 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center space-x-2"
          >
            <Save size={18} />
            <span>Save as Draft</span>
          </button>
          <button 
            onClick={e => handleSubmit(e, false)}
            className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2"
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
