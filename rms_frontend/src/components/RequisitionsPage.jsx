import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import ApprovalTimeline from './ApprovalTimeline';
import ApprovalActionPanel from './ApprovalActionPanel';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { getRequisitions, getRequisitionDetail, updateRequisitionStatus, downloadSignedPdf, getDepartments } from '../lib/store';
import { forwardAPI } from '../lib/api';
import { toast } from 'react-hot-toast';
import {
  Search, Plus, Eye, FileText as FileIcon, X,
  ChevronRight, Paperclip, ShieldCheck, Clock,
  ArrowRightCircle, CornerDownLeft, Loader2, Send, Trash2, Printer
} from 'lucide-react';
import { reqAPI } from '../lib/api';

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
  const [mode, setMode]         = useState(null); // 'forward' | null
  const [targetId, setTargetId] = useState('');
  const [note, setNote]         = useState('');
  const [acting, setActing]     = useState(false);

  const forwardDepts = departments.filter(d =>
    d.id !== req.departmentId && d.id !== detail?.targetDepartmentId
  );

  const submit = async (actionMode) => {
    if (actionMode === 'forward' && !targetId) {
      setMode('forward'); // Open forward selector
      return;
    }
    if (actionMode === 'return' && !note.trim()) {
      toast.error('Please add a review or note explaining why you are returning this.');
      return;
    }
    
    setActing(true);
    try {
      await forwardAPI.forward(req.id, {
        targetDepartmentId: actionMode === 'forward' ? parseInt(targetId) : null,
        note,
        returnToSender: actionMode === 'return'
      });
      toast.success(actionMode === 'return' ? 'Requisition returned to sender.' : 'Requisition forwarded successfully.');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Action failed');
    } finally { setActing(false); }
  };

  return (
    <div className="space-y-4 border border-border/50 rounded-2xl p-5 bg-white/60 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/30" />
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
        Add Review / Comment
      </p>
      
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Enter your official response, review, or note here (required for returning)..."
        className="w-full bg-white border border-border rounded-xl p-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[90px] resize-none shadow-inner"
      />

      {mode === 'forward' && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
          <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center justify-between">
            <span>Select Target Department</span>
            <button onClick={() => setMode(null)} className="text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-black/5">Cancel</button>
          </label>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full bg-white border border-border rounded-xl p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none shadow-sm"
          >
            <option value="">— Select department to forward to —</option>
            {forwardDepts.map(d => (
             <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={() => submit('forward')}
            disabled={!targetId || acting}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 text-sm shadow-md"
          >
            {acting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Confirm Forward
          </button>
        </div>
      )}

      {mode !== 'forward' && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => submit('forward')}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-sm transition-all shadow-sm"
          >
            <ArrowRightCircle size={20} />
            <span>Forward...</span>
          </button>
          
          <button
            onClick={() => submit('return')}
            disabled={acting}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm transition-all disabled:opacity-50 shadow-sm"
          >
            {acting ? <Loader2 size={20} className="animate-spin" /> : <CornerDownLeft size={20} />}
            <span>Return to Sender</span>
          </button>
        </div>
      )}
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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 sm:pt-[5vh] overflow-hidden sm:overflow-y-auto safe-p-top">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />

      <div className="glass bg-white/95 w-full sm:max-w-2xl mt-auto sm:my-auto rounded-t-3xl sm:rounded-3xl border border-border/50 shadow-2xl relative flex flex-col max-h-[95vh] sm:max-h-[90vh]">

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const token = localStorage.getItem('rms_token');
                const baseUrl = import.meta.env.VITE_API_URL || '/api';
                window.open(`${baseUrl}/requisitions/${req.id}/dynamic-pdf?token=${token}`, '_blank');
              }}
              title="Generate Stage Report (PDF)"
              className="p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all flex items-center gap-2 border border-primary/20 shadow-sm"
            >
              <Printer size={18} />
              <span className="text-xs font-bold hidden sm:inline">Print Report</span>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full text-muted-foreground shrink-0 transition-all">
              <X size={18} />
            </button>
          </div>
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
  const [selectedIds, setSelectedIds]   = useState([]);
  const [deleting, setDeleting]         = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePendingAction, setDeletePendingAction] = useState(null); // { type: 'single' | 'bulk', id: number | null }

  const loadData = async () => {
    setLoading(true);
    const [data, depts] = await Promise.all([getRequisitions(), getDepartments()]);
    setRequisitions(data);
    setDepartments(depts);
    setLoading(false);

    // Check for deep link after data loads
    const pendingId = localStorage.getItem('rms_pending_requisition_id');
    if (pendingId) {
      localStorage.removeItem('rms_pending_requisition_id');
      const req = data.find(r => r.id === parseInt(pendingId));
      if (req) {
        setSelectedReq(req);
      } else {
        // Fetch specific if not in list
        getRequisitionDetail(pendingId).then(setSelectedReq).catch(() => {});
      }
    }
  };

  useEffect(() => { loadData(); }, []);

  // Listen for custom event so it works even if already on this page
  useEffect(() => {
    const handleOpenReq = async (e) => {
      const id = e.detail;
      const cached = requisitions.find(r => r.id === parseInt(id));
      if (cached) {
        setSelectedReq(cached);
      } else {
        try {
          const fetched = await reqAPI.getRequisition(id);
          setSelectedReq(fetched);
        } catch(err) {}
      }
    };
    window.addEventListener('openRequisition', handleOpenReq);
    return () => window.removeEventListener('openRequisition', handleOpenReq);
  }, [requisitions]);

  const filtered = requisitions.filter(r => {
    const matchSearch  = r.title?.toLowerCase().includes(search.toLowerCase()) || String(r.id).includes(search);
    const matchStatus  = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const isIncoming = (r) => user?.deptId && r.targetDepartmentId === user.deptId;
  const isAdmin = user?.role === 'global_admin';

  const toggleSelect = (id) => {
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(r => r.id));
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      await reqAPI.deleteMultipleRequisitions(selectedIds);
      toast.success('Records fully purged from the entire system!');
      setSelectedIds([]);
      await loadData();
    } catch (err) {
      toast.error('Failed to purge selected records. You might lack permissions.');
    } finally {
      setDeleting(false);
      setIsDeleteModalOpen(false);
      setDeletePendingAction(null);
    }
  };

  const handleSingleDelete = async () => {
    if (!deletePendingAction?.id) return;
    setDeleting(true);
    try {
      await reqAPI.deleteRequisition(deletePendingAction.id);
      toast.success(`Record #${deletePendingAction.id} purged globally!`);
      await loadData();
    } catch (err) {
      toast.error('Deletion restricted or failed.');
    } finally {
      setDeleting(false);
      setIsDeleteModalOpen(false);
      setDeletePendingAction(null);
    }
  };

  const showBulkDeleteConfirm = () => {
    setDeletePendingAction({ type: 'bulk' });
    setIsDeleteModalOpen(true);
  };

  const showSingleDeleteConfirm = (id, e) => {
    e.stopPropagation();
    setDeletePendingAction({ type: 'single', id });
    setIsDeleteModalOpen(true);
  };

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

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={deletePendingAction?.type === 'bulk' ? handleBulkDelete : handleSingleDelete}
        isProcessing={deleting}
        title={deletePendingAction?.type === 'bulk' ? "Bulk Purge System Records" : `Delete Record #${deletePendingAction?.id}`}
        message={deletePendingAction?.type === 'bulk' 
          ? `Are you sure you want to permanently delete ${selectedIds.length} selected records? This cannot be undone and will remove them from all logs.`
          : `Are you sure you want to permanently delete Requisition #${deletePendingAction?.id}? This action is immutable.`
        }
      />

      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              All <span className="text-primary italic">Requisitions</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} records found</p>
          </div>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={showBulkDeleteConfirm}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg flex items-center gap-2"
              >
                {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Purge {selectedIds.length} Selected
              </button>
            )}
            <button
              onClick={() => setIsFormOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 w-fit"
            >
              <Plus size={18} /> New Requisition
            </button>
          </div>
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
                    <th className="py-4 px-3 w-10">
                      <input type="checkbox" className="rounded" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleAll} />
                    </th>
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
                      <td className="py-4 px-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                      </td>
                      <td className="py-4 px-5 cursor-pointer" onClick={() => setSelectedReq(r)}>
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
                      <td className="py-4 px-5 text-right w-24">
                        <div className="flex justify-end gap-3 items-center">
                          <button onClick={() => setSelectedReq(r)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all">
                            <Eye size={18} />
                          </button>
                          {(isAdmin || r.status === 'draft') && (
                            <button onClick={e => showSingleDeleteConfirm(r.id, e)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-muted-foreground text-sm">
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
