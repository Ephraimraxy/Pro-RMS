import React, { useState, useEffect } from 'react';
import { Plus, X, Send, Loader2, ChevronDown, ArrowLeft } from 'lucide-react';
import { addRequisition, getDepartments } from '../lib/store';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const CashRequestForm = ({ type = 'Cash', isOpen, onClose }) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [subject, setSubject] = useState('');
  const [comment, setComment] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [items, setItems] = useState([{ qty: 1, description: '', amount: '' }]);
  const [submitting, setSubmitting] = useState(false);

  // ── Creator role ──────────────────────────────────────────────────────────
  const creatorName = user?.name || '';
  const isChairmanCreator = /ceo|chairman/i.test(creatorName);
  const isGMCreator       = /general\s*manager|\bgm\b/i.test(creatorName);
  const isHRCreator       = /\bhr\b|human\s*resource/i.test(creatorName);
  const isExecutiveCreator = isChairmanCreator || isGMCreator || isHRCreator;

  // Privileged depts that regular creators cannot address directly at creation time.
  // They are only reachable after the request has passed through HR.
  const isPrivilegedDept = (name = '') =>
    /general\s*manager|\bgm\b|ceo|chairman|\bicc\b|integrity|compliance|audit|account/i.test(name);

  // Allowed targets when creating:
  // • Chairman → anywhere
  // • HR/GM    → any dept except ICC/Audit/Account (those come via vetting chain, not routing)
  // • Regular dept → any dept EXCEPT GM, Chairman, ICC, Audit, Account
  //                  (must reach those via HR first; can freely route among peer depts)
  const allowedTargets = departments.filter(d => {
    if (d.id === user?.deptId) return false;
    const isVettingOrAccount = /\bicc\b|integrity|compliance|audit|account/i.test(d.name);
    if (isChairmanCreator) return !isVettingOrAccount;        // Chairman: not vetting at creation
    if (isGMCreator || isHRCreator) return !isVettingOrAccount; // HR/GM: not vetting at creation
    return !isPrivilegedDept(d.name);                         // Regular: exclude privileged depts
  });

  useEffect(() => {
    if (!isOpen) return;
    getDepartments().then(d => {
      const all = d.filter(dept => dept.id !== user?.deptId);
      setDepartments(all);
    });
    setSubject(''); setComment(''); setItems([{ qty: 1, description: '', amount: '' }]); setTargetDeptId(''); setUrgency('normal');
  }, [isOpen]);

  if (!isOpen) return null;

  const total = items.reduce((s, i) => s + (parseFloat(i.qty || 0) * parseFloat(i.amount || 0)), 0);

  const addItem = () => setItems(p => [...p, { qty: 1, description: '', amount: '' }]);
  const removeItem = i => setItems(p => p.filter((_, j) => j !== i));
  const updateItem = (i, field, val) => setItems(p => p.map((item, j) => j === i ? { ...item, [field]: val } : item));

  const handleSubmit = async (isDraft = false) => {
    if (!subject.trim()) { toast.error('Please enter a subject/purpose'); return; }

    // Validation
    const validItems = items.filter(i => i.description.trim());
    if (type === 'Cash' && !validItems.length) {
      toast.error('Please add at least one item'); return;
    }
    if (type === 'Material' && !comment.trim()) {
      toast.error('Please describe material needs in the description box'); return;
    }

    setSubmitting(true);
    try {
      const content = type === 'Cash'
        ? JSON.stringify({
          itemized: true,
          comment: comment.trim(), // small comment
          items: validItems.map(i => ({
            qty: parseFloat(i.qty) || 1,
            description: i.description.trim(),
            amount: parseFloat(i.amount) || 0,
            lineTotal: (parseFloat(i.qty) || 1) * (parseFloat(i.amount) || 0)
          })),
          total
        })
        : JSON.stringify({
          itemized: false,
          description: comment.trim()
        });

      // For payload description field, combine subject + comment loosely or just use subject
      const reqDescription = type === 'Material' ? comment.trim() : subject;

      await addRequisition({
        title: subject,
        description: reqDescription,
        type,
        urgency,
        isDraft,
        content,
        ...(type === 'Cash' && total > 0 && { amount: total }),
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
    <div className="animate-in slide-in-from-right-4 duration-300 w-full min-h-full flex flex-col space-y-6 max-w-7xl mx-auto pb-10">

      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-wider shadow-sm group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Directory
        </button>
      </div>

      <div className="glass bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-border/40 shadow-xl overflow-hidden flex flex-col">
        {/* Title Bar */}
        <div className="p-6 lg:p-10 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-white/50">
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter leading-tight flex items-center space-x-3">
              <Send size={28} className="text-primary" />
              <span>New {type} Request</span>
            </h2>
            <div className="flex items-center space-x-2 pt-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                {type === 'Cash' ? 'Itemized Financial Requisition' : 'Material & Supply Requisition'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 lg:p-10 space-y-8 bg-zinc-50/50">

          {/* Total at top — only for Cash */}
          {type === 'Cash' && (
            <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Grand Total</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">{items.filter(i => i.description).length} item(s)</p>
              </div>
              <span className="text-4xl font-black font-mono text-foreground tracking-tighter">
                ₦{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Subject / Purpose *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={`Purpose of this ${type.toLowerCase()} request...`}
              className="w-full bg-white border border-border/60 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
            />
          </div>

          {/* Material vs Cash specifics */}
          {type === 'Material' ? (
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Description / Needs *</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Describe your material needs, specifications, or comments..."
                rows={8}
                className="w-full bg-white border border-border/60 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm resize-none transition-all"
              />
            </div>
          ) : (
            <>
              {/* Cash small comment */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Additional Comments </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Provide context or briefly describe the need before listing items..."
                  rows={2}
                  className="w-full bg-white border border-border/60 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm resize-none transition-all"
                />
              </div>

              {/* Cash Items Table */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-2">Itemized List *</label>
                  <button onClick={addItem} className="flex items-center gap-1.5 text-[10px] font-black text-primary px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-all active:scale-95 shadow-sm">
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[60px_1fr_130px_40px] gap-3 px-2">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center">Qty</span>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Description</span>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-right">Unit Price (₦)</span>
                  <span />
                </div>

                <div className="space-y-3">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[60px_1fr_130px_40px] gap-3 items-center animate-in fade-in slide-in-from-top-1 duration-200">
                      <input
                        type="number" min="1"
                        value={item.qty}
                        onChange={e => updateItem(i, 'qty', e.target.value)}
                        className="bg-white border border-border/60 rounded-xl p-3.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm w-full transition-all"
                      />
                      <input
                        value={item.description}
                        onChange={e => updateItem(i, 'description', e.target.value)}
                        placeholder="Item description or size..."
                        className="bg-white border border-border/60 rounded-xl p-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm w-full transition-all"
                      />
                      <input
                        type="number" min="0" step="0.01"
                        value={item.amount}
                        onChange={e => updateItem(i, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="bg-white border border-border/60 rounded-xl p-3.5 text-sm font-bold text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm w-full transition-all"
                      />
                      <button
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl disabled:opacity-20 transition-all shadow-sm border border-transparent hover:border-red-100 active:scale-95"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Line totals summary */}
                {items.some(i => parseFloat(i.amount) > 0 && parseFloat(i.qty) > 0) && (
                  <div className="mt-6 p-5 rounded-2xl bg-muted/30 border border-border/40 space-y-3 shadow-inner">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/40 pb-2 mb-2">Line Summary</p>
                    {items.filter(i => i.description && parseFloat(i.amount) > 0).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span className="truncate max-w-[250px]">{item.description} × {item.qty}</span>
                        <span className="font-mono font-bold text-foreground">
                          ₦{((parseFloat(item.qty) || 1) * (parseFloat(item.amount) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Target dept + Urgency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border/40">
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Send To</label>
              <div className="relative group">
                <select
                  value={targetDeptId}
                  onChange={e => setTargetDeptId(e.target.value)}
                  className="w-full bg-white border border-border/60 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 shadow-sm transition-all cursor-pointer group-hover:border-primary/40"
                >
                  <option value="">— Internal Processing —</option>
                  {allowedTargets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              {!isExecutiveCreator && (
                <p className="text-[10px] text-muted-foreground/70 italic pl-1 mt-1">
                  GM, Chairman, Audit, ICC, and Account are not available here — this request must reach them through HR.
                </p>
              )}
            </div>
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Priority</label>
              <div className="relative group">
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value)}
                  className="w-full bg-white border border-border/60 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 shadow-sm transition-all cursor-pointer group-hover:border-primary/40"
                >
                  <option value="normal" className="text-muted-foreground">Normal Priority</option>
                  <option value="urgent" className="text-amber-600">Urgent</option>
                  <option value="critical" className="text-red-600">Critical</option>
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform group-hover:translate-y-0" />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 lg:p-8 border-t border-border/50 flex flex-col-reverse sm:flex-row gap-4 shrink-0 bg-white">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="py-4 px-8 rounded-2xl border-2 border-border/60 text-sm font-black text-muted-foreground hover:bg-muted hover:text-foreground transition-all disabled:opacity-50 active:scale-95"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white text-sm font-black transition-all disabled:opacity-50 shadow-xl shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/40 active:scale-95"
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            Submit {type} Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashRequestForm;
