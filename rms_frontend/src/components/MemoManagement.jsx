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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[95dvh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border/50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-foreground">New Memo</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Official administrative communication</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Subject *</label>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Memo subject..."
              className="w-full border border-border/60 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Message *</label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Write the memo content here..."
              rows={7}
              className="w-full border border-border/60 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white resize-none"
            />
          </div>

          {/* Routing */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Send To</label>

            {isPublisher && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTargetMode('dept')}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${targetMode === 'dept' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted'}`}
                >
                  Specific Department
                </button>
                <button
                  onClick={() => setTargetMode('publish')}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${targetMode === 'publish' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-border/60 text-muted-foreground hover:bg-muted'}`}
                >
                  <Globe size={13} /> Publish to All
                </button>
              </div>
            )}

            {(targetMode === 'dept' || !isPublisher) && (
              <div>
                {!isPublisher ? (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
                    This memo will be sent to <strong>HR Department</strong> for review and publishing.
                  </div>
                ) : targetOptions.length > 0 ? (
                  <select
                    value={targetDeptId}
                    onChange={e => setTargetDeptId(e.target.value)}
                    className="w-full border border-border/60 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-white"
                  >
                    <option value="">— Select department —</option>
                    {targetOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-muted/50 border border-border/30 text-xs text-muted-foreground">
                    No specific departments available. Use "Publish to All" instead.
                  </div>
                )}
              </div>
            )}

            {targetMode === 'publish' && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs font-semibold text-emerald-800">
                <Globe size={14} className="shrink-0 text-emerald-600" />
                This memo will be broadcast to ALL departments immediately.
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-border/50 flex gap-3 shrink-0">
          <button onClick={onClose} className="py-3 px-5 rounded-xl border border-border/60 text-sm font-bold text-muted-foreground hover:bg-muted transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-black disabled:opacity-50 shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : (targetMode === 'publish' ? <Globe size={16} /> : <Send size={16} />)}
            {targetMode === 'publish' ? 'Publish to All Departments' : 'Send Memo'}
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
    <div className="space-y-5 animate-in fade-in duration-300">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-muted"
      >
        <ArrowLeft size={14} /> Back to Memos
      </button>

      <div className="glass bg-white/95 rounded-3xl border border-border/40 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border/40 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${statusColors[memo.status] || statusColors.pending}`}>
              {alreadyPublished ? 'Published' : memo.status}
            </span>
            {alreadyPublished && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-500 text-white flex items-center gap-1">
                <Globe size={9} /> Broadcast to All
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-foreground">{memo.title}</h2>
          <p className="text-[11px] text-muted-foreground font-mono">
            From: <strong>{memo.department}</strong> · #{memo.id} · {new Date(memo.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="bg-muted/20 rounded-2xl p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap border border-border/30">
            {memo.description}
          </div>
        </div>

        {/* Actions */}
        {!loading && isIncoming && !alreadyPublished && (
          <div className="p-5 border-t border-border/40 space-y-4">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Actions</p>

            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Add a note or remarks (optional)..."
              rows={3}
              className="w-full border border-border/60 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-white"
            />

            <div className="flex flex-wrap gap-3">
              {/* Publish to All */}
              {isPublisher && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50 shadow-md transition-all"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                  Publish to All Departments
                </button>
              )}

              {/* Forward */}
              {fwdOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={fwdDeptId}
                    onChange={e => setFwdDeptId(e.target.value)}
                    className="border border-border/60 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-white"
                  >
                    <option value="">Forward to...</option>
                    {fwdOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button
                    onClick={handleForward}
                    disabled={forwarding || !fwdDeptId}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black disabled:opacity-50 transition-all"
                  >
                    {forwarding ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightCircle size={13} />}
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

  if (selectedMemo) {
    return (
      <Layout user={user} currentView="memos" onViewChange={onViewChange}>
        <div className="max-w-3xl mx-auto pb-20 px-2">
          <MemoDetailView
            memo={selectedMemo}
            user={user}
            departments={departments}
            onBack={() => setSelectedMemo(null)}
            onRefresh={loadMemos}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} currentView="memos" onViewChange={onViewChange}>
      {showCreate && (
        <MemoCreateForm
          user={user}
          departments={departments}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadMemos(); }}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-slide-up px-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest w-fit flex items-center gap-1">
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
              Internal Communications
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tighter">
              Memo <span className="text-primary italic font-serif">Centre</span>
            </h1>
            <p className="text-[12px] text-muted-foreground font-medium">
              Create and track official memos across departments.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="group bg-primary hover:bg-primary/90 text-white font-black py-3 px-7 rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center gap-3 w-fit active:scale-95"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
            <span className="text-[11px] uppercase tracking-widest">New Memo</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-2xl w-fit">
          {[
            { key: 'all', label: 'All Memos' },
            { key: 'incoming', label: 'Incoming' },
            { key: 'published', label: 'Published' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all ${tab === t.key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Memo List */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground animate-pulse text-xs font-mono">Loading memos...</div>
        ) : filteredMemos.length === 0 ? (
          <div className="glass bg-white/60 rounded-3xl border border-border/50 p-12 text-center">
            <FileText size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-bold text-foreground">No memos found</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {tab === 'incoming' ? 'No memos have been sent to your department.' :
               tab === 'published' ? 'No memos have been published yet.' :
               'Create your first memo using the button above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMemos.map(memo => {
              const isIncoming = user?.deptId && memo.targetDepartmentId === user.deptId;
              const isPublished = memo.finalApprovalStatus === 'published';
              return (
                <div
                  key={memo.id}
                  onClick={() => setSelectedMemo(memo)}
                  className="glass bg-white/70 rounded-2xl border border-border/50 p-5 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[9px] font-black text-primary tracking-widest">#{memo.id}</span>
                        <div className="flex items-center gap-1">
                          {statusIcon[memo.status]}
                          <span className="text-[9px] font-bold uppercase text-muted-foreground">
                            {isPublished ? 'Published' : memo.status}
                          </span>
                        </div>
                        {isIncoming && !isPublished && (
                          <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[8px] font-black uppercase">Incoming</span>
                        )}
                        {isPublished && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black uppercase flex items-center gap-1">
                            <Globe size={8} /> All Depts
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground truncate">{memo.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{memo.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-mono uppercase">
                        <span>{memo.department}</span>
                        <span>·</span>
                        <span>{new Date(memo.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MemoManagement;
