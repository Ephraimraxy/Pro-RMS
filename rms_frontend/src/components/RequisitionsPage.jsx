import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import ApprovalTimeline from './ApprovalTimeline';
import ApprovalActionPanel from './ApprovalActionPanel';
import { useAuth } from '../context/AuthContext';
import { getRequisitions, getRequisitionDetail, updateRequisitionStatus, downloadSignedPdf, getDepartments } from '../lib/store';
import { forwardAPI } from '../lib/api';
import { toast } from 'react-hot-toast';
import {
  Search, Plus, Eye, FileText as FileIcon, X,
  ChevronRight, Paperclip, ShieldCheck, Clock,
  ArrowRightCircle, CornerDownLeft, Loader2, Send
} from 'lucide-react';

const statusColors = {
  pending:  'bg-amber-50 border-amber-200 text-amber-700',
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  rejected: 'bg-red-50 border-red-200 text-red-700',
  draft:    'bg-muted border-border text-muted-foreground',
};

const urgencyColors = {
  normal:   'text-muted-foreground',
  urgent:   'text-amber-600 font-bold',
  critical: 'text-red-600 font-bold',
};

function buildTimeline(approvals = [], currentStage = null, reqStatus = '') {
  const completed = approvals.map(a => ({
    id:      `approval-${a.id}`,
    label:   a.stage?.name || 'Stage',
    role:    `${a.user?.name || 'Approver'} (${a.stage?.role || ''})`,
    status:  a.action,
    date:    new Date(a.createdAt).toLocaleString(),
    comment: a.remarks || null,
  }));
  if (reqStatus === 'pending' && currentStage) {
    completed.push({
      id:      `pending-${currentStage.id}`,
      label:   currentStage.name,
      role:    currentStage.role,
      status:  'pending',
      date:    null,
      comment: null,
    });
  }
  return completed;
}

// ── Respond Panel (for target dept to forward or return) ──────────────────
const RespondPanel = ({ req, detail, departments, onDone }) => {
  const [mode, setMode]         = useState(null); // 'forward' | 'return'
  const [targetId, setTargetId] = useState('');
  const [note, setNote]         = useState('');
  const [acting, setActing]     = useState(false);

  const forwardDepts = departments.filter(d =>
    d.id !== req.departmentId && d.id !== detail?.targetDepartmentId
  );

  const submit = async () => {
    if (mode === 'forward' && !targetId) {
      toast.error('Please select a department to forward to.'); return;
    }
    setActing(true);
    try {
      await forwardAPI.forward(req.id, {
        targetDepartmentId: mode === 'forward' ? parseInt(targetId) : null,
        note,
        returnToSender: mode === 'return'
      });
      toast.success(mode === 'return' ? 'Requisition returned to sender.' : 'Requisition forwarded successfully.');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Action failed');
    } finally { setActing(false); }
  };

  if (!mode) {
    return (
      <div className="space-y-3">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Your Response</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('forward')}
            className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-sm transition-all"
          >
            <ArrowRightCircle size={18} /> Forward
          </button>
          <button
            onClick={() => setMode('return')}
            className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm transition-all"
          >
            <CornerDownLeft size={18} /> Return to Sender
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-border/50 rounded-2xl p-4 bg-white/60">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-foreground uppercase tracking-widest">
          {mode === 'forward' ? 'Forward To' : 'Return to Sender'}
        </p>
        <button onClick={() => setMode(null)} className="text-muted-foreground hover:text-foreground text-xs">
          Cancel
        </button>
      </div>

      {mode === 'forward' && (
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          className="w-full bg-white border border-border rounded-xl p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
        >
          <option value="">— Select department —</option>
          {forwardDepts.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}

      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder={mode === 'return' ? 'Reason for returning (required for clarity)…' : 'Note for next department (optional)…'}
        className="w-full bg-white border border-border rounded-xl p-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[70px] resize-none"
      />

      <button
        onClick={submit}
        disabled={acting || (mode === 'forward' && !targetId)}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition-all disabled:opacity-50 text-sm"
      >
        {acting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {acting ? 'Processing…' : mode === 'return' ? 'Return to Sender' : 'Forward'}
      </button>
    </div>
  );
};

// ── Detail Modal ─────────────────────────────────────────────────────────────
const RequisitionDetailModal = ({ req, user, departments, onClose, onAction }) => {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRequisitionDetail(req.id).then(d => {
      if (!cancelled) { setDetail(d); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [req.id]);

  // Is this an incoming (target dept) requisition for the current user?
  const isIncoming = user?.deptId && detail?.targetDepartmentId === user.deptId;
  // Can current user take approval action (not dept user, requisition is pending)
  const canApprove = user?.role !== 'department' && req.status === 'pending';

  const handleApprove = async (remarks) => {
    setActing(true);
    try {
      await updateRequisitionStatus(req.id, 'approved', remarks);
      onAction();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Approval failed');
    } finally { setActing(false); }
  };

  const handleReject = async (remarks) => {
    if (!remarks?.trim()) { toast.error('Please state a reason for rejection.'); return; }
    setActing(true);
    try {
      await updateRequisitionStatus(req.id, 'rejected', remarks);
      onAction();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Rejection failed');
    } finally { setActing(false); }
  };

  const handleEscalate = () =>
    toast('Use Reject with remarks to escalate manually.', { icon: 'ℹ️' });

  const timeline    = detail ? buildTimeline(detail.approvals || [], detail.currentStage, detail.status) : [];
  const attachments = detail?.attachments || [];
  const verCode     = detail?.approvals?.slice(-1)[0]?.signature?.verificationCode;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />

      <div className="glass bg-white/95 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-border/50 shadow-2xl relative flex flex-col max-h-[92vh] sm:max-h-[88vh]">

        {/* Header */}
        <div className="p-5 border-b border-border/50 flex items-start justify-between shrink-0">
          <div className="space-y-1 flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">#{req.id}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusColors[req.status]}`}>
                {req.status}
              </span>
              {isIncoming && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 border border-blue-200 text-blue-700 animate-pulse">
                  Incoming
                </span>
              )}
              {req.urgency && req.urgency !== 'normal' && (
                <span className={`text-[10px] font-black uppercase ${urgencyColors[req.urgency] || ''}`}>
                  ⚡ {req.urgency}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-foreground leading-tight">{req.title}</h2>
            <p className="text-xs text-muted-foreground">
              From: <strong>{req.department}</strong>
              {detail?.targetDepartment?.name && (
                <> → To: <strong>{detail.targetDepartment.name}</strong></>
              )}
              {' · '}{req.type}
              {req.amount ? ` · ₦${Number(req.amount).toLocaleString()}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full text-muted-foreground shrink-0 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">

          {/* Description */}
          {req.description && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Description</p>
              <p className="text-sm text-foreground leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/40">
                {req.description}
              </p>
            </div>
          )}

          {/* Forward note (if any) */}
          {detail?.forwardNote && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <ArrowRightCircle size={13} className="shrink-0 mt-0.5 text-blue-600" />
              <span><strong>Note:</strong> {detail.forwardNote}</span>
            </div>
          )}

          {/* Current Stage Banner */}
          {req.status === 'pending' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Clock size={16} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-black text-amber-800">
                  Awaiting: {req.currentStageName || detail?.currentStage?.name || 'Approval'}
                </p>
                {detail?.currentStage?.role && (
                  <p className="text-[10px] text-amber-700">Role required: {detail.currentStage.role}</p>
                )}
              </div>
            </div>
          )}

          {/* Approval Timeline */}
          <div className="space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Approval Trail</p>
            {loading ? (
              <div className="text-xs text-muted-foreground animate-pulse py-4 text-center">Loading history…</div>
            ) : timeline.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center bg-muted/20 rounded-xl border border-border/30">
                No approvals recorded yet.
              </div>
            ) : (
              <ApprovalTimeline stages={timeline} />
            )}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Paperclip size={10} /> Attachments ({attachments.length})
              </p>
              <div className="space-y-1.5">
                {attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border border-border/30 text-xs">
                    <FileIcon size={12} className="text-primary shrink-0" />
                    <span className="truncate text-foreground font-medium flex-1">{a.filename}</span>
                    <span className="text-muted-foreground shrink-0">
                      {a.size ? `${(a.size / 1024).toFixed(0)} KB` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification code */}
          {verCode && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              <span className="text-emerald-800 font-mono font-bold">{verCode}</span>
              <span className="text-emerald-700 ml-1">— Cryptographic Verification Code</span>
            </div>
          )}

          {/* Download signed PDF */}
          {req.status === 'approved' && req.signedPdfKey && (
            <button
              onClick={() => downloadSignedPdf(req.id)}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 text-sm"
            >
              <FileIcon size={16} /> Download Signed PDF Voucher
            </button>
          )}

          {/* ── INCOMING: Respond Panel (forward / return) ── */}
          {isIncoming && req.status === 'pending' && !loading && (
            <RespondPanel
              req={req}
              detail={detail}
              departments={departments}
              onDone={() => { onAction(); }}
            />
          )}

          {/* ── APPROVAL PANEL (for admin/approver roles) ── */}
          {canApprove && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <ChevronRight size={10} /> Your Decision
              </p>
              <div className={acting ? 'opacity-60 pointer-events-none' : ''}>
                <ApprovalActionPanel
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onEscalate={handleEscalate}
                />
              </div>
              {acting && (
                <p className="text-xs text-center text-muted-foreground animate-pulse">Processing…</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/30 shrink-0 bg-muted/10">
          <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground font-bold transition-colors py-1">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const RequisitionsPage = ({ onViewChange }) => {
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [departments, setDepartments]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isFormOpen, setIsFormOpen]     = useState(false);
  const [selectedReq, setSelectedReq]   = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [data, depts] = await Promise.all([getRequisitions(), getDepartments()]);
    setRequisitions(data);
    setDepartments(depts);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = requisitions.filter(r => {
    const matchSearch  = r.title?.toLowerCase().includes(search.toLowerCase()) || String(r.id).includes(search);
    const matchStatus  = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const isIncoming = (r) => user?.deptId && r.targetDepartmentId === user.deptId;

  return (
    <Layout user={user} currentView="requisitions" onViewChange={onViewChange}>
      <RequisitionForm isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); loadData(); }} />

      {selectedReq && (
        <RequisitionDetailModal
          req={selectedReq}
          user={user}
          departments={departments}
          onClose={() => setSelectedReq(null)}
          onAction={() => { setSelectedReq(null); loadData(); }}
        />
      )}

      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              All <span className="text-primary italic">Requisitions</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} records found</p>
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 w-fit"
          >
            <Plus size={18} /> New Requisition
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID or title…"
              className="w-full bg-white/80 border border-border/50 rounded-xl py-2.5 pl-12 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'approved', 'rejected', 'draft'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  filterStatus === s
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'bg-white/50 border-border/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse font-mono text-xs">
            Loading requisitions…
          </div>
        ) : (
          <div className="glass rounded-3xl border border-border/50 overflow-hidden shadow-sm bg-white/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                    <th className="py-4 px-5">Ref ID</th>
                    <th className="py-4 px-5">Type</th>
                    <th className="py-4 px-5">Title</th>
                    <th className="py-4 px-5">Amount</th>
                    <th className="py-4 px-5">From → To</th>
                    <th className="py-4 px-5">Stage</th>
                    <th className="py-4 px-5">Status</th>
                    <th className="py-4 px-5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/50 hover:bg-muted/50 transition-colors ${
                        isIncoming(r) ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-4 px-5">
                        <span className="text-xs font-bold text-primary">#{r.id}</span>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                        {isIncoming(r) && (
                          <span className="text-[9px] font-black text-blue-600 uppercase">Incoming</span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            r.type === 'Cash' ? 'bg-emerald-500'
                            : r.type === 'Material' ? 'bg-primary'
                            : 'bg-amber-500'
                          }`} />
                          <span className="text-sm font-semibold text-foreground">{r.type}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 max-w-[180px]">
                        <p className="text-sm text-foreground line-clamp-1">{r.title}</p>
                        {r.urgency && r.urgency !== 'normal' && (
                          <span className={`text-[9px] font-black uppercase ${urgencyColors[r.urgency]}`}>
                            ⚡ {r.urgency}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-sm font-bold font-mono">
                        {r.amount ? `₦${Number(r.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-4 px-5 text-xs text-muted-foreground">
                        <span>{r.department}</span>
                        {r.targetDepartment?.name && (
                          <>
                            <span className="mx-1 text-muted-foreground/40">→</span>
                            <span className="text-primary font-bold">{r.targetDepartment.name}</span>
                          </>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        {r.status === 'pending' && r.currentStageName ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {r.currentStageName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${statusColors[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => setSelectedReq(r)}
                          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-all"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-muted-foreground text-sm">
                        No requisitions match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default RequisitionsPage;
