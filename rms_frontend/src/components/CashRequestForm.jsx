import React, { useState, useEffect } from 'react';
import { Plus, X, Send, Loader2, ChevronDown } from 'lucide-react';
import { addRequisition, getDepartments } from '../lib/store';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const CashRequestForm = ({ type = 'Cash', isOpen, onClose }) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [subject, setSubject] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [items, setItems] = useState([{ qty: 1, description: '', amount: '' }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getDepartments().then(d => setDepartments(d.filter(dept => dept.id !== user?.deptId)));
    setSubject(''); setItems([{ qty: 1, description: '', amount: '' }]); setTargetDeptId(''); setUrgency('normal');
  }, [isOpen]);

  if (!isOpen) return null;

  const total = items.reduce((s, i) => s + (parseFloat(i.qty || 0) * parseFloat(i.amount || 0)), 0);

  const addItem = () => setItems(p => [...p, { qty: 1, description: '', amount: '' }]);
  const removeItem = i => setItems(p => p.filter((_, j) => j !== i));
  const updateItem = (i, field, val) => setItems(p => p.map((item, j) => j === i ? { ...item, [field]: val } : item));

  const handleSubmit = async (isDraft = false) => {
    if (!subject.trim()) { toast.error('Please enter a subject/purpose'); return; }
    const validItems = items.filter(i => i.description.trim());
    if (!validItems.length) { toast.error('Please add at least one item'); return; }
    setSubmitting(true);
    try {
      const content = JSON.stringify({
        itemized: true,
        items: validItems.map(i => ({
          qty: parseFloat(i.qty) || 1,
          description: i.description.trim(),
          amount: parseFloat(i.amount) || 0,
          lineTotal: (parseFloat(i.qty) || 1) * (parseFloat(i.amount) || 0)
        })),
        total
      });
      await addRequisition({
        title: subject, description: subject, type, urgency, isDraft, content,
        ...(total > 0 && { amount: total }),
        ...(user?.deptId != null && { departmentId: user.deptId }),
        ...(targetDeptId && { targetDepartmentId: parseInt(targetDeptId) }),
      });
      toast.success(isDraft ? 'Draft saved.' : `${type} request submitted successfully.`);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Submission failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[95dvh] overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-border/50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-foreground">New {type} Request</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">List all items with quantities and amounts</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Total at top — always visible */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm">
            <div>
              <p className="text-[9px] font-black text-primary uppercase tracking-widest">Grand Total</p>
              <p className="text-[10px] text-muted-foreground">{items.filter(i=>i.description).length} item(s)</p>
            </div>
            <span className="text-2xl font-black font-mono text-foreground">
              ₦{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Subject / Purpose *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={`Purpose of this ${type.toLowerCase()} request...`}
              className="w-full border border-border/60 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Items *</label>
              <button onClick={addItem} className="flex items-center gap-1 text-[10px] font-black text-primary px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-all">
                <Plus size={12} /> Add Item
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[52px_1fr_110px_32px] gap-2 px-1">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center">Qty</span>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Description</span>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-right">Unit Price (₦)</span>
              <span />
            </div>

            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[52px_1fr_110px_32px] gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-200">
                <input
                  type="number" min="1"
                  value={item.qty}
                  onChange={e => updateItem(i, 'qty', e.target.value)}
                  className="border border-border/60 rounded-lg p-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white w-full"
                />
                <input
                  value={item.description}
                  onChange={e => updateItem(i, 'description', e.target.value)}
                  placeholder="Item description..."
                  className="border border-border/60 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white w-full"
                />
                <input
                  type="number" min="0" step="0.01"
                  value={item.amount}
                  onChange={e => updateItem(i, 'amount', e.target.value)}
                  placeholder="0.00"
                  className="border border-border/60 rounded-lg p-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white w-full"
                />
                <button
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 disabled:opacity-20 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {/* Line totals summary */}
            {items.some(i => parseFloat(i.amount) > 0 && parseFloat(i.qty) > 0) && (
              <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
                {items.filter(i => i.description && parseFloat(i.amount) > 0).map((item, i) => (
                  <div key={i} className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[200px]">{item.description} × {item.qty}</span>
                    <span className="font-mono font-bold text-foreground">
                      ₦{((parseFloat(item.qty)||1) * (parseFloat(item.amount)||0)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Target dept + Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Send To (Optional)</label>
              <div className="relative">
                <select
                  value={targetDeptId}
                  onChange={e => setTargetDeptId(e.target.value)}
                  className="w-full border border-border/60 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-white pr-8"
                >
                  <option value="">— Select department —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Priority</label>
              <div className="relative">
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value)}
                  className="w-full border border-border/60 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-white pr-8"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border/50 flex gap-3 shrink-0 bg-muted/5">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="py-3 px-5 rounded-xl border border-border/60 text-sm font-bold text-muted-foreground hover:bg-muted transition-all disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-black transition-all disabled:opacity-50 shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Submit {type} Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashRequestForm;
