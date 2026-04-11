import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import ApprovalTimeline from './ApprovalTimeline';
import ApprovalActionPanel from './ApprovalActionPanel';
import ConfirmModal from './ConfirmModal';
import VoiceDictation from './VoiceDictation';
import { useAuth } from '../context/AuthContext';
import { getRequisitions, getRequisitionDetail, updateRequisitionStatus, downloadSignedPdf, downloadDynamicPdf, getDepartments } from '../lib/store';
import { forwardAPI } from '../lib/api';
import { toast } from 'react-hot-toast';
import {
  Search, Plus, Eye, FileText, X,
  ChevronRight, Paperclip, ShieldCheck, Clock,
  ArrowRightCircle, CornerDownLeft, Loader2, Send, Trash2, Printer,
  Building2, ArrowRight, History, Download
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
      <div className="flex items-center justify-start pb-1 pt-1 border-b border-border/40">
        <VoiceDictation onTranscript={(text) => setNote(prev => prev + (prev ? ' ' : '') + text)} />
      </div>

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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start p-2 sm:p-4 overflow-y-auto safe-p-top pt-[3vh] pb-10 bg-background/40 backdrop-blur-md custom-scrollbar">
      <div className="fixed inset-0 bg-background/40 backdrop-blur-sm -z-10" onClick={onClose} />

      <div className="glass bg-white/95 w-full lg:max-w-[92rem] rounded-[3rem] border border-border/40 shadow-[0_30px_100px_rgba(0,0,0,0.2)] relative flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden min-h-[85vh]">


        {/* Header */}
        <div className="p-6 lg:p-8 border-b border-border/50 flex items-start justify-between shrink-0 bg-white/50">
          <div className="space-y-2 flex-1 pr-6">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                Neural Sync Active
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border shadow-sm ${statusColors[req.status]}`}>
                {req.status}
              </span>
              {isIncoming && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-500 border border-blue-600 text-white shadow-lg shadow-blue-500/20">
                  Incoming Action
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight leading-tight">{req.title}</h2>
            <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
               <span className="flex items-center gap-1.5"><Building2 size={12}/> {req.department}</span>
               {detail?.targetDepartment?.name && (
                 <span className="flex items-center gap-1.5"><ArrowRight size={12}/> {detail.targetDepartment.name}</span>
               )}
               <span className="px-2 py-0.5 rounded-md bg-muted font-mono">{req.id}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
             <div className="text-right">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Total Amount</p>
                <p className="text-2xl font-mono font-bold text-foreground">₦{Number(req.amount || 0).toLocaleString()}</p>
             </div>
             <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const toastId = toast.loading('Generating PDF...');
                    try {
                      await downloadDynamicPdf(req.id);
                      toast.success('Report downloaded successfully!', { id: toastId });
                    } catch (err) {
                      toast.error('Failed to generate report.', { id: toastId });
                    }
                  }}
                  title="Generate Stage Report (PDF)"
                  className="p-2.5 bg-background hover:bg-muted text-foreground rounded-xl transition-all border border-border shadow-sm flex items-center gap-2"
                >
                  <Printer size={18} />
                   <span className="text-xs font-bold hidden sm:inline">Print</span>
                </button>
                <button onClick={onClose} className="p-2 bg-muted hover:bg-muted/80 rounded-xl text-muted-foreground transition-all">
                  <X size={20} />
                </button>
             </div>
          </div>
        </div>

        {/* Body Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full grid lg:grid-cols-[1fr_350px] divide-x divide-border/50">
            {/* Left Content Column */}
            <div className="overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-10">
              
              {/* Description Section */}
              {req.description && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                     <FileText size={14} className="text-primary" />
                     <p className="text-[11px] font-black text-foreground uppercase tracking-[0.1em]">Requisition Brief</p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed bg-[#FAF9F6]/50 p-6 rounded-[1.5rem] border border-border/40 shadow-inner italic">
                    {req.description}
                  </p>
                </div>
              )}

              {/* Action Panels */}
              {isIncoming && req.status === 'pending' && !loading && (
                <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                   <RespondPanel
                     req={req}
                     detail={detail}
                     departments={departments}
                     onDone={() => { onAction(); }}
                   />
                </div>
              )}

              {canApprove && (
                <div className="space-y-4 pt-6 border-t border-border/50">
                  <div className="flex items-center space-x-2">
                     <ShieldCheck size={14} className="text-primary" />
                     <p className="text-[11px] font-black text-foreground uppercase tracking-[0.1em]">Administrative Decision</p>
                  </div>
                  <div className={acting ? 'opacity-60 pointer-events-none' : ''}>
                    <ApprovalActionPanel
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onEscalate={handleEscalate}
                    />
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              {attachments.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-border/50">
                  <div className="flex items-center space-x-2">
                     <Paperclip size={14} className="text-primary" />
                     <p className="text-[11px] font-black text-foreground uppercase tracking-[0.1em]">Enclosures ({attachments.length})</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attachments.map(a => (
                      <div key={a.id} className="flex items-center gap-3 p-4 bg-muted/20 rounded-[1rem] border border-border/30 text-xs hover:border-primary/20 transition-all group">
                        <FileText size={14} className="text-primary shrink-0" />
                        <div className="flex-1 truncate">
                           <p className="truncate text-foreground font-bold">{a.filename}</p>
                           <p className="text-[9px] text-muted-foreground uppercase">{a.size ? `${(a.size / 1024).toFixed(0)} KB` : 'N/A'}</p>
                        </div>
                        <Download size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:text-primary" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar Column */}
            <div className="bg-muted/10 overflow-y-auto custom-scrollbar p-6 space-y-8 flex flex-col">
              
              {/* Status & Alerts */}
              <div className="space-y-4">
                 <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.1em]">Current Status</p>
                 {req.status === 'pending' ? (
                   <div className="p-4 rounded-[1.25rem] bg-amber-500/10 border border-amber-500/20 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
                           <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-700">Awaiting Approval</p>
                          <p className="text-[10px] text-amber-600/80 font-medium">{req.currentStageName || detail?.currentStage?.name}</p>
                        </div>
                      </div>
                      {detail?.currentStage?.role && (
                        <div className="text-[9px] font-black uppercase text-amber-800 tracking-widest px-2 py-1 bg-amber-500/20 rounded-md inline-block">
                          REQUIRED: {detail.currentStage.role}
                        </div>
                      )}
                   </div>
                 ) : req.status === 'approved' ? (
                   <div className="p-4 rounded-[1.25rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-700">
                      <ShieldCheck size={18} />
                      <span className="text-xs font-bold">Document Fully Authenticated</span>
                   </div>
                 ) : (
                   <div className="p-4 rounded-[1.25rem] bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive">
                      <ShieldAlert size={18} />
                      <span className="text-xs font-bold">Requisition Terminated</span>
                   </div>
                 )}
              </div>

              {/* Timeline (Approval Trail) */}
              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.1em]">Approval Trail</p>
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                    {timeline.length}
                  </div>
                </div>
                {loading ? (
                  <div className="space-y-4 animate-pulse">
                     {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/40 rounded-xl" />)}
                  </div>
                ) : (
                  <div className="relative pl-1">
                     <ApprovalTimeline stages={timeline} />
                  </div>
                )}
              </div>

              {/* Identity & Verification */}
              {verCode && (
                <div className="p-4 rounded-[1.25rem] bg-emerald-500/5 border border-emerald-500/10 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-600">
                     <Fingerprint size={14} />
                     <p className="text-[9px] font-black uppercase tracking-widest">Digital Fingerprint</p>
                  </div>
                  <p className="font-mono text-xs font-bold text-emerald-800 break-all bg-white p-2 rounded-lg text-center border border-emerald-500/10 shadow-sm">
                    {verCode}
                  </p>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-4 mt-auto border-t border-border/50">
                 {req.status === 'approved' && req.signedPdfKey && (
                    <button
                      onClick={() => downloadSignedPdf(req.id)}
                      className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-[1.25rem] transition-all shadow-xl shadow-primary/20 text-xs uppercase tracking-widest"
                    >
                      <Download size={16} /> Sign Voucher
                    </button>
                 )}
                 <button onClick={onClose} className="w-full text-[10px] text-muted-foreground hover:text-foreground font-black uppercase tracking-[0.2em] transition-colors py-4">
                  Close Document
                 </button>
              </div>
            </div>
          </div>
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

      <div className="max-w-[90rem] mx-auto space-y-10 pb-20 animate-slide-up">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-4">
          <div className="space-y-1">
             <div className="flex items-center gap-2 mb-1">
              <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                Administrative Registry
              </div>
            </div>
            <h1 className="text-4xl font-black text-foreground tracking-tighter">
              Requisition <span className="text-primary italic font-serif">Directory</span>
            </h1>
            <p className="text-muted-foreground text-[13px] font-medium tracking-tight">Managing {filtered.length} synchronized governance records.</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <button
                onClick={showBulkDeleteConfirm}
                disabled={deleting}
                className="bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/20 font-black py-4 px-6 rounded-2xl transition-all shadow-lg flex items-center gap-3 active:scale-95"
              >
                {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                <span className="uppercase tracking-widest text-[10px]">Purge {selectedIds.length} Units</span>
              </button>
            )}
            <button
              onClick={() => setIsFormOpen(true)}
              className="bg-foreground hover:bg-foreground/90 text-background font-black py-4 px-8 rounded-2xl transition-all shadow-2xl shadow-black/10 flex items-center gap-3 w-fit active:scale-95"
            >
              <Plus size={20} />
              <span className="uppercase tracking-widest text-[10px]">Raise New Requisition</span>
            </button>
          </div>
        </div>

        {/* Unified Main Card */}
        <div className="glass bg-white/70 backdrop-blur-3xl rounded-[3rem] border border-border/40 p-1 lg:p-2 shadow-2xl shadow-primary/5 overflow-hidden">
          <div className="bg-[#FAF9F6]/30 rounded-[2.8rem] p-6 lg:p-10 space-y-8">
            {/* Filters Row */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-6 border-b border-border/20 pb-8">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Query by ID, title, or department payload…"
                  className="w-full bg-white border border-border/50 rounded-2xl py-4 pl-14 pr-4 text-sm font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0 custom-scrollbar whitespace-nowrap">
                {['all', 'pending', 'approved', 'rejected', 'draft'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
                      filterStatus === s
                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                        : 'bg-white border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Directory Table */}
            {loading ? (
              <div className="py-32 flex flex-col items-center justify-center space-y-4">
                <Loader2 size={40} className="text-primary animate-spin opacity-20" />
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest animate-pulse">Syncing Directory Access...</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                      <th className="pb-4 px-6 w-10">
                        <input type="checkbox" className="rounded-md border-border/50 text-primary focus:ring-primary" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleAll} />
                      </th>
                      <th className="pb-4 px-6">Reference</th>
                      <th className="pb-4 px-6">Module Type</th>
                      <th className="pb-4 px-6">Registry Item</th>
                      <th className="pb-4 px-6">Payload</th>
                      <th className="pb-4 px-6">Authorization Trail</th>
                      <th className="pb-4 px-6">State</th>
                      <th className="pb-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedReq(r)}
                        className="group cursor-pointer transition-all"
                      >
                        <td className="py-5 px-6 bg-white/50 border-y border-l border-border/30 rounded-l-2xl group-hover:bg-white transition-colors" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded-md border-border/50 text-primary focus:ring-primary" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                        </td>
                        <td className="py-5 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-primary tracking-widest">#{r.id}</span>
                            <span className="text-[10px] text-muted-foreground/60 font-mono italic">{new Date(r.createdAt).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                              r.type === 'Cash' ? 'bg-emerald-500 shadow-emerald-500/20'
                              : r.type === 'Material' ? 'bg-primary shadow-primary/20'
                              : 'bg-amber-500 shadow-amber-500/20'
                            } shadow-lg`} />
                            <span className="text-xs font-black text-foreground uppercase tracking-widest">{r.type}</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground max-w-xs truncate">{r.title}</p>
                            {r.urgency && r.urgency !== 'normal' && (
                              <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase ${urgencyColors[r.urgency]}`}>
                                <div className={`w-1 h-1 rounded-full ${r.urgency === 'critical' ? 'bg-red-500' : 'bg-amber-500'} animate-pulse`} />
                                {r.urgency} Priority
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-5 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <span className="text-sm font-black text-foreground font-mono">₦{Number(r.amount || 0).toLocaleString()}</span>
                        </td>
                        <td className="py-5 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-bold text-muted-foreground opacity-60 uppercase">{r.department}</span>
                            {r.targetDepartment?.name && (
                              <>
                                <ArrowRight size={10} className="text-muted-foreground/30" />
                                <span className="font-black text-primary uppercase tracking-tight">{r.targetDepartment.name}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-5 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="flex flex-col gap-1.5">
                            <span className={`w-fit px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border tracking-widest ${statusColors[r.status]}`}>
                              {r.status}
                            </span>
                            {r.status === 'pending' && r.currentStageName && (
                              <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter truncate max-w-[100px]">At: {r.currentStageName}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-5 px-6 bg-white/50 border-y border-r border-border/30 rounded-r-2xl group-hover:bg-white transition-colors text-right">
                          <div className="flex justify-end gap-2">
                             <button className="p-2.5 bg-background shadow-inner rounded-xl text-primary transition-all active:scale-90 border border-primary/10">
                               <Eye size={18} />
                             </button>
                             {(isAdmin || r.status === 'draft') && (
                              <button onClick={e => { e.stopPropagation(); showSingleDeleteConfirm(r.id, e); }} className="p-2.5 bg-red-50 shadow-inner rounded-xl text-red-500 transition-all active:scale-90 border border-red-200/50">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="py-32 text-center space-y-4 bg-white/20 rounded-[2rem] border border-dashed border-border/50">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground/30">
                      <Inbox size={32} />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground">Empty Registry. Direct matches not found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RequisitionsPage;
