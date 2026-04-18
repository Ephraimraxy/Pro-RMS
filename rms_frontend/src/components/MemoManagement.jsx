import { useState, useEffect, useCallback } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { getRequisitions, getDepartments, getRequisitionDetail } from '../lib/store';
import { forwardAPI, memoAPI } from '../lib/api';
import { toast } from 'react-hot-toast';
import {
  FileText, Send, Clock, CheckCircle2, Plus, X,
  ArrowRightCircle, Globe, ChevronRight, Loader2,
  ArrowLeft
} from 'lucide-react';

const statusColors = {
  pending:  'bg-amber-50 border-amber-200 text-amber-700',
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  rejected: 'bg-red-50 border-red-200 text-red-700',
  draft:    'bg-muted border-border text-muted-foreground',
};

// ── Memo Create Form ──────────────────────────────────────────────────────────
const MemoCreateForm = ({ user, departments, onClose, onCreated }) => {
  const deptName = user?.name || '';
  const isHR  = /\bhr\b|human\s*resource/i.test(deptName);
  const isGM  = /general\s*manager|\bgm\b/i.test(deptName);
  const isCEO = /ceo|chairman/i.test(deptName);
  const isPublisher = isHR || isGM || isCEO;

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [targetMode, setTargetMode] = useState('dept'); // 'dept' | 'publish'
  const [targetDeptId, setTargetDeptId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter target options per routing rules
  const targetOptions = departments.filter(d => {
    if (d.id === user?.deptId) return false;
    if (!isPublisher) return /\bhr\b|human\s*resource/i.test(d.name); // regular → HR only
    if (isHR)  return /general\s*manager|\bgm\b|ceo|chairman/i.test(d.name);
    if (isGM)  return /ceo|chairman/i.test(d.name);
    return false; // CEO/Chairman can only publish
  });

  // Auto-select if only one target available
  useEffect(() => {
    if (!isPublisher && targetOptions.length === 1 && !targetDeptId) {
      setTargetDeptId(String(targetOptions[0].id));
    }
  }, [departments]);

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!message.trim()) { toast.error('Message body is required'); return; }
    if (targetMode === 'dept' && !targetDeptId && !isCEO) {
      toast.error('Please select a target department'); return;
    }
    setSubmitting(true);
    try {
      const { addRequisition } = await import('../lib/store');
      const result = await addRequisition({
        title: subject, description: message, type: 'Memo',
        ...(user?.deptId != null && { departmentId: user.deptId }),
        ...(targetMode === 'dept' && targetDeptId ? { targetDepartmentId: parseInt(targetDeptId) } : {}),
      });

      // If publishing directly, call the publish endpoint
      if (targetMode === 'publish') {
        const createdId = Array.isArray(result) ? result[0]?.id : result?.id;
        if (createdId) {
          try { await memoAPI.publish(createdId); toast.success('Memo published to all departments!'); }
          catch (e) { toast.success('Memo created. You can publish from the detail view.'); }
        }
      } else {
        toast.success('Memo submitted successfully.');
      }
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create memo');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="animate-in slide-in-from-right-4 duration-300 w-full min-h-full flex flex-col space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <button 
          onClick={onClose} 
          className="px-4 py-2 bg-white border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-wider shadow-sm group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Memos
        </button>
      </div>

      <div className="glass bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-border/40 shadow-xl overflow-hidden flex flex-col">
        <div className="p-6 lg:p-10 border-b border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 bg-white/50">
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter leading-tight flex items-center space-x-3">
              <Send size={28} className="text-primary" />
              <span>New Memo</span>
            </h2>
            <div className="flex items-center space-x-2 pt-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">Official Administrative Communication</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 lg:p-10 space-y-8 bg-zinc-50/50">
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Subject *</label>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Memo subject..."
              className="w-full bg-white border border-border/60 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Message *</label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Write the memo content here..."
              rows={10}
              className="w-full bg-white border border-border/60 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm resize-none transition-all"
            />
          </div>

          {/* Routing */}
          <div className="space-y-4 pt-4 border-t border-border/40">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Send To</label>

            {isPublisher && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTargetMode('dept')}
                  className={`py-4 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${targetMode === 'dept' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted'}`}
                >
                  Specific Department
                </button>
                <button
                  onClick={() => setTargetMode('publish')}
                  className={`py-4 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${targetMode === 'publish' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-border/60 text-muted-foreground hover:bg-muted'}`}
                >
                  <Globe size={16} /> Broadcast to All
                </button>
              </div>
            )}

            {(targetMode === 'dept' || !isPublisher) && (
              <div className="animate-in fade-in duration-300">
                {!isPublisher ? (
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 shadow-sm">
                    This memo will be routed to the <strong>HR Department</strong> for review and executive publishing.
                  </div>
                ) : targetOptions.length > 0 ? (
                  <div className="relative group">
                    <select
                      value={targetDeptId}
                      onChange={e => setTargetDeptId(e.target.value)}
                      className="w-full bg-white border border-border/60 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 shadow-sm transition-all cursor-pointer group-hover:border-primary/40"
                    >
                      <option value="">— Select Target Department —</option>
                      {targetOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform group-hover:rotate-45" />
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/30 text-xs text-muted-foreground italic">
                    No individual departments available for direct routing. Use "Broadcast to All" to reach the entire group.
                  </div>
                )}
              </div>
            )}

            {targetMode === 'publish' && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs font-bold text-emerald-800 animate-in slide-in-from-top-2 duration-200">
                <Globe size={18} className="shrink-0 text-emerald-600" />
                This communication will be broadcast to ALL departments instantly across the RMS neural network.
              </div>
            )}
          </div>
        </div>

        <div className="p-6 lg:p-8 border-t border-border/50 flex flex-col-reverse sm:flex-row gap-4 shrink-0 bg-white">
          <button onClick={onClose} className="py-4 px-8 rounded-2xl border-2 border-border/60 text-sm font-black text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white text-sm font-black disabled:opacity-50 shadow-xl shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/40 active:scale-95 transition-all"
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : (targetMode === 'publish' ? <Globe size={20} /> : <Send size={20} />)}
            {targetMode === 'publish' ? 'Broadcast Memo to All' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Memo Detail View ──────────────────────────────────────────────────────────
const MemoDetailView = ({ memo, user, departments, onBack, onRefresh }) => {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote]       = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [fwdDeptId, setFwdDeptId]   = useState('');

  const deptName  = user?.name || '';
  const isHR      = /\bhr\b|human\s*resource/i.test(deptName);
  const isGM      = /general\s*manager|\bgm\b/i.test(deptName);
  const isCEO     = /ceo|chairman/i.test(deptName);
  const isPublisher = isHR || isGM || isCEO || user?.role === 'global_admin';

  const isIncoming = user?.deptId && detail?.targetDepartmentId === user.deptId;
  const alreadyPublished = detail?.finalApprovalStatus === 'published';

  useEffect(() => {
    getRequisitionDetail(memo.id).then(d => { setDetail(d); setLoading(false); });
  }, [memo.id]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await memoAPI.publish(memo.id);
      toast.success('Memo published to all departments!');
      onRefresh();
      onBack();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to publish memo');
    } finally { setPublishing(false); }
  };

  const handleForward = async () => {
    if (!fwdDeptId) { toast.error('Select a department to forward to'); return; }
    setForwarding(true);
    try {
      await forwardAPI.forward(memo.id, { targetDepartmentId: parseInt(fwdDeptId), note });
      toast.success('Memo forwarded successfully.');
      onRefresh(); onBack();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Forward failed');
    } finally { setForwarding(false); }
  };

  // Forward options based on role
  const fwdOptions = departments.filter(d => {
    if (d.id === user?.deptId) return false;
    if (isHR)  return /general\s*manager|\bgm\b|ceo|chairman/i.test(d.name);
    if (isGM)  return /ceo|chairman/i.test(d.name);
    return false;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full max-w-7xl mx-auto pb-10">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-foreground transition-all px-4 py-2 rounded-xl bg-white border border-border/50 shadow-sm uppercase tracking-wider group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Back to Memos
      </button>

      <div className="glass bg-white/95 rounded-[2.5rem] border border-border/40 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 lg:p-10 border-b border-border/40 space-y-4 bg-white/50">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border tracking-widest ${statusColors[memo.status] || statusColors.pending}`}>
              {alreadyPublished ? 'Published' : memo.status}
            </span>
            {alreadyPublished && (
              <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-500/20">
                <Globe size={12} /> Broadcast
              </span>
            )}
          </div>
          <h2 className="text-3xl font-black text-foreground tracking-tighter leading-tight">{memo.title}</h2>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-black uppercase tracking-widest opacity-80">
            <span>From: <strong className="text-foreground">{memo.department}</strong></span>
            <span>·</span>
            <span>Ref: <strong className="text-foreground font-mono">#{memo.id}</strong></span>
            <span>·</span>
            <span>{new Date(memo.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 lg:p-10 bg-zinc-50/50">
          <div className="bg-white rounded-[2rem] p-8 text-base font-medium text-foreground leading-relaxed whitespace-pre-wrap border border-border/30 shadow-inner min-h-[300px]">
            {memo.description}
          </div>
        </div>

        {/* Actions */}
        {!loading && isIncoming && !alreadyPublished && (
          <div className="p-6 lg:p-10 border-t border-border/40 space-y-6 bg-white">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-2">Executive Review & Route</p>

            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Add internal observations or remarks..."
              rows={4}
              className="w-full bg-zinc-50 border border-border/60 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all shadow-inner"
            />

            <div className="flex flex-wrap items-center gap-4">
              {/* Publish to All */}
              {isPublisher && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  {publishing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  Broadcast to all Units
                </button>
              )}

              {/* Forward */}
              {fwdOptions.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <select
                      value={fwdDeptId}
                      onChange={e => setFwdDeptId(e.target.value)}
                      className="border border-border/60 rounded-xl p-4 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-white pr-10 min-w-[200px]"
                    >
                      <option value="">Route to...</option>
                      {fwdOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                  <button
                    onClick={handleForward}
                    disabled={forwarding || !fwdDeptId}
                    className="flex items-center gap-2 px-6 py-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-primary/20"
                  >
                    {forwarding ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightCircle size={16} />}
                    Forward
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const MemoManagement = ({ onViewChange }) => {
  const { user } = useAuth();
  const [memos, setMemos]         = useState([]);
  const [departments, setDepts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [tab, setTab]             = useState('all'); // 'all' | 'incoming' | 'published'

  const loadMemos = useCallback(async () => {
    setLoading(true);
    const [all, depts] = await Promise.all([getRequisitions(), getDepartments()]);
    setMemos(all.filter(r => r.type === 'Memo' || r.type === 'memo'));
    setDepts(depts);
    setLoading(false);
  }, []);

  useEffect(() => { loadMemos(); }, [loadMemos]);

  const filteredMemos = memos.filter(m => {
    if (tab === 'incoming') return user?.deptId && m.targetDepartmentId === user.deptId;
    if (tab === 'published') return m.finalApprovalStatus === 'published';
    return true;
  });

  const statusIcon = {
    pending:  <Clock size={13} className="text-amber-500" />,
    approved: <CheckCircle2 size={13} className="text-emerald-500" />,
    rejected: <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />,
    draft:    <FileText size={13} className="text-muted-foreground" />,
  };

  return (
    <Layout user={user} currentView="memos" onViewChange={onViewChange}>
      <div className="w-full mx-auto pb-20 px-1 animate-slide-up">
        {showCreate ? (
          <MemoCreateForm
            user={user}
            departments={departments}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); loadMemos(); }}
          />
        ) : selectedMemo ? (
          <MemoDetailView
            memo={selectedMemo}
            user={user}
            departments={departments}
            onBack={() => setSelectedMemo(null)}
            onRefresh={loadMemos}
          />
        ) : (
          <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest w-fit flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  Internal Registry
                </div>
                <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
                  Memo <span className="text-primary italic font-serif">Exchange</span>
                </h1>
                <p className="text-sm text-muted-foreground font-medium max-w-lg">
                  Orchestrate and monitor official communications across the CSS Group modular network.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="group bg-primary hover:bg-primary/90 text-white font-black py-4 px-8 rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center gap-3 w-fit active:scale-95"
              >
                <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                <span className="text-xs uppercase tracking-widest font-black">Generate Memo</span>
              </button>
            </div>

            {/* Unified Search & Filters Row */}
            <div className="flex items-center gap-1.5 p-1.5 bg-muted/40 rounded-[1.25rem] w-fit">
              {[
                { key: 'all', label: 'All Comm' },
                { key: 'incoming', label: 'Incoming' },
                { key: 'published', label: 'Broadcasts' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === t.key ? 'bg-white text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Memo List Cards */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-50">
                <Loader2 size={32} className="text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synchronizing Records...</p>
              </div>
            ) : filteredMemos.length === 0 ? (
              <div className="glass bg-white/60 rounded-[3rem] border border-border/50 p-20 text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText size={32} className="text-muted-foreground/30" />
                </div>
                <h3 className="text-xl font-black text-foreground tracking-tight">Registry Empty</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto font-medium">
                  {tab === 'incoming' ? 'No incoming communications detected for your unit.' :
                   tab === 'published' ? 'No official broadcasts have been released yet.' :
                   'Start an official communication thread above.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredMemos.map(memo => {
                  const isIncoming = user?.deptId && memo.targetDepartmentId === user.deptId;
                  const isPublished = memo.finalApprovalStatus === 'published';
                  return (
                    <div
                      key={memo.id}
                      onClick={() => setSelectedMemo(memo)}
                      className="glass bg-white/70 rounded-[2.5rem] border border-border/40 p-6 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full"
                    >
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-primary tracking-[0.2em]">#{memo.id}</span>
                          <div className="flex items-center gap-2">
                             {isIncoming && !isPublished && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-500 text-white text-[8px] font-black uppercase shadow-sm">Incoming</span>
                            )}
                            {isPublished && (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[8px] font-black uppercase flex items-center gap-1 shadow-sm">
                                <Globe size={8} /> Broadcast
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              {statusIcon[memo.status]}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-lg font-black text-foreground tracking-tight line-clamp-2 leading-tight group-hover:text-primary transition-colors">{memo.title}</h3>
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 font-medium leading-relaxed">{memo.description}</p>
                        </div>
                      </div>

                      <div className="mt-6 pt-5 border-t border-border/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">
                              {memo.department.charAt(0)}
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-foreground uppercase tracking-wider leading-none">{memo.department}</span>
                              <span className="text-[9px] text-muted-foreground font-medium mt-1 uppercase tracking-tighter">{new Date(memo.createdAt).toLocaleDateString()}</span>
                           </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white border border-border/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all transform group-hover:scale-110 shadow-sm">
                           <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MemoManagement;
