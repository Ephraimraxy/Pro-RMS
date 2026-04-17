import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import ApprovalTimeline from './ApprovalTimeline';
import ApprovalActionPanel from './ApprovalActionPanel';
import ConfirmModal from './ConfirmModal';
import VoiceDictation from './VoiceDictation';
import { useAuth } from '../context/AuthContext';
import { getRequisitions, getRequisitionDetail, updateRequisitionStatus, downloadSignedPdf, downloadDynamicPdf, getDepartments } from '../lib/store';
import { forwardAPI, aiAPI, settingsAPI, vettingAPI } from '../lib/api';
import { useAIFeatures } from '../context/AIFeaturesContext';
import { toast } from 'react-hot-toast';
import {
  Search, Plus, Eye, FileText, X,
  ChevronRight, Paperclip, ShieldCheck, Clock,
  ArrowRightCircle, CornerDownLeft, Loader2, Send, Trash2, Printer,
  Building2, ArrowRight, ArrowLeft, History, Download, AlertTriangle,
  ExternalLink, ArrowDownToLine, MessageSquare, RotateCcw, Forward as ForwardIcon,
  CheckCircle2, Award, ChevronDown, Gavel
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

// ── Processing Chain Timeline (for inter-department forward/return) ──────
const ProcessingChain = ({ events = [] }) => {
  if (!events.length) return null;

  const actionConfig = {
    created:   { icon: Send,           color: 'bg-primary',     label: 'Sent' },
    forwarded: { icon: ArrowRightCircle, color: 'bg-blue-500',   label: 'Forwarded' },
    returned:  { icon: RotateCcw,      color: 'bg-amber-500',   label: 'Returned' },
  };

  return (
    <div className="space-y-0">
      {events.map((evt, idx) => {
        const cfg = actionConfig[evt.action] || actionConfig.created;
        const Icon = cfg.icon;
        const isLast = idx === events.length - 1;
        return (
          <div key={evt.id} className="relative pl-8 pb-5 last:pb-0">
            {!isLast && (
              <div className={`absolute left-[11px] top-6 bottom-0 w-[2px] ${evt.action === 'returned' ? 'bg-amber-300/50' : 'bg-primary/30'}`} />
            )}
            <div className={`absolute left-0 top-0 w-6 h-6 rounded-full ${cfg.color} flex items-center justify-center z-10 shadow-sm`}>
              <Icon size={12} className="text-white" />
            </div>
            <div className={`p-3 rounded-xl border ${evt.action === 'returned' ? 'bg-amber-50/50 border-amber-200/60' : 'bg-white/70 border-border/50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-black uppercase tracking-widest ${evt.action === 'returned' ? 'text-amber-700' : 'text-primary'}`}>
                  {cfg.label}
                </span>
                <span className="text-[9px] text-muted-foreground font-mono">{new Date(evt.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">
                {evt.fromDepartment?.name && <span>{evt.fromDepartment.name}</span>}
                {evt.toDepartment?.name && <span> → <strong className="text-foreground">{evt.toDepartment.name}</strong></span>}
              </div>
              {evt.actorName && <div className="text-[10px] text-muted-foreground/70 mt-0.5">By: {evt.actorName}</div>}
              {evt.note && (
                <div className="flex items-start gap-1.5 mt-2 p-2 bg-muted/40 rounded-lg text-[11px] text-foreground/80 italic">
                  <MessageSquare size={10} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <p className="leading-relaxed">{evt.note}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};


// ── File Preview Modal ────────────────────────────────────────────────────
const FilePreviewModal = ({ attachment, onClose }) => {
  const [textContent, setTextContent] = useState(null);
  const [textLoading, setTextLoading] = useState(false);

  if (!attachment) return null;

  const token = localStorage.getItem('rms_token');
  const previewUrl = `/api/attachments/${attachment.id}/preview?token=${token}`;
  const downloadUrl = `/api/attachments/${attachment.id}/download?token=${token}`;

  const mime = attachment.mimeType || '';
  const name = attachment.filename || '';

  const isImage     = /^image\/(png|jpe?g|gif|webp|svg)/.test(mime) || /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
  const isPdf       = mime === 'application/pdf' || /\.pdf$/i.test(name);
  const isText      = /^text\//.test(mime) || /\.(txt|csv|log|md|json|xml|html?)$/i.test(name);
  const isOfficeDoc = /\.(docx?|xlsx?|pptx?)$/i.test(name) ||
    ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(mime);

  // Fetch plain text for text files
  React.useEffect(() => {
    if (!isText) return;
    setTextLoading(true);
    fetch(previewUrl)
      .then(r => r.text())
      .then(t => setTextContent(t))
      .catch(() => setTextContent('Unable to load file content.'))
      .finally(() => setTextLoading(false));
  }, [attachment.id]);

  // Detect mobile
  const isMobile = window.innerWidth < 768;

  const openInNewTab = () => window.open(previewUrl, '_blank', 'noopener,noreferrer');

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      {/* Full screen on mobile, modal on desktop */}
      <div
        className="bg-white w-full sm:rounded-2xl sm:max-w-4xl sm:mx-4 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: isMobile ? '95dvh' : '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText size={15} className="text-primary shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-foreground truncate">{name}</span>
            {attachment.size && (
              <span className="text-[9px] text-muted-foreground shrink-0">
                {(attachment.size / 1024).toFixed(0)} KB
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {/* Open in new tab — works for all types, especially useful on mobile */}
            <button
              onClick={openInNewTab}
              title="Open in new tab"
              className="p-2 hover:bg-muted rounded-lg text-primary transition-colors"
            >
              <ExternalLink size={15} />
            </button>
            <a href={downloadUrl} download title="Download" className="p-2 hover:bg-muted rounded-lg text-primary transition-colors">
              <ArrowDownToLine size={15} />
            </a>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto bg-muted/10 flex flex-col">
          {isImage && (
            <div className="flex-1 flex items-center justify-center p-4">
              <img
                src={previewUrl}
                alt={name}
                className="max-w-full max-h-full rounded-lg shadow-md object-contain"
                style={{ maxHeight: 'calc(90vh - 80px)' }}
              />
            </div>
          )}

          {isPdf && (
            isMobile ? (
              /* On mobile: iframe PDFs often fail — show a prominent open button instead */
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-red-50 border border-red-200 flex items-center justify-center">
                  <FileText size={36} className="text-red-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-foreground">PDF Document</p>
                  <p className="text-xs text-muted-foreground">Tap below to view the PDF in your browser or download it.</p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button
                    onClick={openInNewTab}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md"
                  >
                    <ExternalLink size={16} /> Open PDF
                  </button>
                  <a href={downloadUrl} download className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-border text-foreground rounded-xl font-bold text-sm hover:bg-muted transition-all">
                    <ArrowDownToLine size={16} /> Download
                  </a>
                </div>
              </div>
            ) : (
              <iframe
                src={previewUrl}
                className="w-full flex-1 border-0"
                title={name}
                style={{ minHeight: '500px' }}
              />
            )
          )}

          {isOfficeDoc && (
            /* Office docs can't be embedded in iframe behind auth — show clear message */
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                <FileText size={36} className="text-blue-500" />
              </div>
              <div className="space-y-2 max-w-sm">
                <p className="text-sm font-bold text-foreground">Office Document</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Word/Excel files must be downloaded to view. Tap Download to open in your Office app.
                </p>
              </div>
              <a
                href={downloadUrl}
                download
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md"
              >
                <ArrowDownToLine size={16} /> Download &amp; Open
              </a>
            </div>
          )}

          {isText && (
            <div className="flex-1 overflow-auto p-4">
              {textLoading ? (
                <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : (
                <pre className="text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap break-words bg-white border border-border/30 rounded-xl p-4 shadow-inner">
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {!isImage && !isPdf && !isOfficeDoc && !isText && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center">
                <FileText size={36} className="text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">No preview available</p>
                <p className="text-xs text-muted-foreground">This file type cannot be previewed. Download it to open.</p>
              </div>
              <a href={downloadUrl} download className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md">
                <ArrowDownToLine size={16} /> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Print Stage Selector Modal ────────────────────────────────────────────
const PrintStageModal = ({ req, detail, onClose }) => {
  const [selectedStage, setSelectedStage] = useState('all');
  const [generating, setGenerating] = useState(false);

  const attachments = detail?.attachments || [];

  // Build printable stages from forward events and approvals
  const stages = [];
  if (detail?.forwardEvents?.length) {
    detail.forwardEvents.forEach(evt => {
      stages.push({
        id: `fwd-${evt.id}`,
        label: `${evt.action === 'created' ? 'Created' : evt.action === 'forwarded' ? 'Forwarded' : 'Returned'}: ${evt.fromDepartment?.name || 'Dept'} → ${evt.toDepartment?.name || 'Sender'}`,
        date: new Date(evt.createdAt).toLocaleString(),
        rawDate: evt.createdAt,
        type: 'forward'
      });
    });
  }
  if (detail?.approvals?.length) {
    detail.approvals.forEach(a => {
      stages.push({
        id: `app-${a.id}`,
        label: `${a.stage?.name || 'Approval'}: ${a.action} by ${a.user?.name || 'User'}`,
        date: new Date(a.createdAt).toLocaleString(),
        rawDate: a.createdAt,
        type: 'approval'
      });
    });
  }

  // Compute which attachments belong to each scope
  const getRelevantAttachments = (stageId) => {
    if (stageId === 'all') return attachments;
    // Filter by stageKey match first (tagged uploads)
    const byKey = attachments.filter(a => a.stageKey === stageId);
    if (byKey.length > 0) return byKey;
    // Fallback: attachments uploaded up to this stage's timestamp
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return attachments;
    const cutoff = new Date(stage.rawDate).getTime();
    return attachments.filter(a => new Date(a.createdAt).getTime() <= cutoff);
  };

  const relevantAttachments = getRelevantAttachments(selectedStage);

  // Trigger browser download for a single attachment
  const triggerAttachmentDownload = (a) => {
    const token = localStorage.getItem('rms_token');
    const link = document.createElement('a');
    link.href = `/api/attachments/${a.id}/download?token=${token}`;
    link.download = a.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const toastId = toast.loading('Generating report package...');
    try {
      const stageParam = selectedStage === 'all' ? null : selectedStage;
      await downloadDynamicPdf(req.id, stageParam);

      // Download relevant attachments alongside the PDF
      if (relevantAttachments.length > 0) {
        // Stagger downloads slightly to avoid browser blocking
        for (let i = 0; i < relevantAttachments.length; i++) {
          await new Promise(r => setTimeout(r, i * 300));
          triggerAttachmentDownload(relevantAttachments[i]);
        }
        toast.success(`Report + ${relevantAttachments.length} attachment(s) downloaded.`, { id: toastId });
      } else {
        toast.success('Report downloaded successfully!', { id: toastId });
      }
      onClose();
    } catch (err) {
      toast.error('Failed to generate report.', { id: toastId });
    } finally { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Printer size={18} className="text-primary" />
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Generate Report</h3>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={16} /></button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Select a scope — the PDF and any matching attachments will download together.</p>
        </div>
        <div className="p-5 max-h-[50vh] overflow-y-auto space-y-2">
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedStage === 'all' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30'}`}>
            <input type="radio" name="stage" value="all" checked={selectedStage === 'all'} onChange={() => setSelectedStage('all')} className="text-primary" />
            <div className="flex-1">
              <span className="text-xs font-bold text-foreground">Full Report (All Stages)</span>
              <p className="text-[10px] text-muted-foreground">Complete document including all actions and signatures</p>
            </div>
            {attachments.length > 0 && (
              <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                +{attachments.length} file{attachments.length > 1 ? 's' : ''}
              </span>
            )}
          </label>
          {stages.map(s => {
            const stageFiles = getRelevantAttachments(s.id);
            return (
              <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedStage === s.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30'}`}>
                <input type="radio" name="stage" value={s.id} checked={selectedStage === s.id} onChange={() => setSelectedStage(s.id)} className="text-primary" />
                <div className="flex-1">
                  <span className="text-xs font-bold text-foreground">{s.label}</span>
                  <p className="text-[10px] text-muted-foreground">{s.date}</p>
                </div>
                {stageFiles.length > 0 && (
                  <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    +{stageFiles.length} file{stageFiles.length > 1 ? 's' : ''}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {relevantAttachments.length > 0 && (
          <div className="px-5 pb-3">
            <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 max-h-32 overflow-y-auto">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Attachments included in this download</p>
              {relevantAttachments.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-[10px]">
                  <FileText size={10} className="text-primary shrink-0" />
                  <span className="flex-1 truncate text-foreground font-medium">{a.filename}</span>
                  {a.uploaderDept && <span className="text-muted-foreground/60 shrink-0 font-bold">{a.uploaderDept}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="p-5 border-t border-border/50 bg-muted/10">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-foreground hover:bg-foreground/90 text-background font-bold py-3 rounded-xl transition-all disabled:opacity-50 text-xs uppercase tracking-widest"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {relevantAttachments.length > 0
              ? `Download Report + ${relevantAttachments.length} Attachment${relevantAttachments.length > 1 ? 's' : ''}`
              : 'Download Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Respond Panel (for target dept to forward or return) ──────────────────
const RespondPanel = ({ req, detail, departments, onDone }) => {
  const [mode, setMode]         = useState(null); // 'forward' | null
  const [targetId, setTargetId] = useState('');
  const [note, setNote]         = useState('');
  const [acting, setActing]     = useState(false);
  const [refining, setRefining] = useState(false);

  const { user: currentUser } = useAuth();
  const { aiEnabled } = useAIFeatures();
  const [chairmanAllowedIds, setChairmanAllowedIds] = useState([]);

  useEffect(() => {
    settingsAPI.get('chairman_ceo_allowed_depts').then(res => {
      if (res?.value) setChairmanAllowedIds(JSON.parse(res.value));
    }).catch(() => {});
  }, []);

  const canRouteToChairman = chairmanAllowedIds.includes(currentUser?.deptId);

  const forwardDepts = departments.filter(d => {
    if (d.id === req.departmentId || d.id === detail?.targetDepartmentId) return false;
    if (/ceo|chairman/i.test(d.name) && !canRouteToChairman) return false;
    return true;
  });

  // Work out who "Return to Sender" will actually send to by reading the
  // forwardEvents chain — it's whoever LAST sent the document to the current holder,
  // NOT necessarily the original creator. This prevents ISAC → ISAC loops.
  const forwardEvents = detail?.forwardEvents || [];
  const currentDeptId = detail?.targetDepartmentId;
  const lastInbound = [...forwardEvents]
    .reverse()
    .find(e => e.toDeptId === currentDeptId && e.fromDeptId !== currentDeptId);
  const returnTarget = lastInbound
    ? departments.find(d => d.id === lastInbound.fromDeptId)
    : departments.find(d => d.id === req.departmentId);
  const returnLabel = returnTarget ? `Return to ${returnTarget.name}` : 'Return to Sender';

  const handleRefineNote = async () => {
    if (note.trim().length < 5) return;
    setRefining(true);
    try {
      const res = await aiAPI.refineDraft(note, 'review');
      if (res.blocked) {
        toast.error(res.validationMessage || 'Your note was not recognised as a valid response. Please write a clear, professional review.', { duration: 6000 });
        return;
      }
      setNote(res.refinedDescription || note);
      toast.success(res.actionReason ? `AI refined — ${res.actionReason}` : 'Note professionally refined by AI.', { duration: 5000 });
    } catch (err) {
      const msg = err?.response?.data?.validationMessage || err?.response?.data?.error || 'AI refinement failed. Please try again.';
      toast.error(msg, { duration: 5000 });
    } finally { setRefining(false); }
  };

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
      toast.success(actionMode === 'return' ? `Requisition returned to ${returnTarget?.name || 'sender'}.` : 'Requisition forwarded successfully.');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'This action could not be completed. Please try again.');
    } finally { setActing(false); }
  };

  return (
    <div className="space-y-3 border border-border/50 rounded-2xl p-4 bg-white/60 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/30" />
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
        Add Review / Comment
      </p>
      
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Enter your official response, review, or note here (required for returning)..."
        disabled={refining}
        className="w-full bg-white border border-border rounded-xl p-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px] resize-none shadow-inner disabled:opacity-60"
      />
      {aiEnabled && (
        <div className="flex items-center justify-between pb-1 pt-1 border-b border-border/40">
          <VoiceDictation
            disabled={refining}
            onTranscript={(text) => setNote(prev => prev + (prev ? ' ' : '') + text)}
          />
          {note.trim().length >= 5 && (
            <button
              type="button"
              onClick={handleRefineNote}
              disabled={refining}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {refining ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
              {refining ? 'Refining…' : 'AI Refine'}
            </button>
          )}
        </div>
      )}

      {mode === 'forward' && (
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2">
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
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition-all disabled:opacity-50 text-sm shadow-md"
          >
            {acting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Confirm Forward
          </button>
        </div>
      )}

      {mode !== 'forward' && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => submit('forward')}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-sm transition-all shadow-sm"
          >
            <ArrowRightCircle size={18} />
            <span>Forward...</span>
          </button>
          
          <button
            onClick={() => submit('return')}
            disabled={acting}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm transition-all disabled:opacity-50 shadow-sm"
          >
            {acting ? <Loader2 size={18} className="animate-spin" /> : <CornerDownLeft size={18} />}
            <span>{returnLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ── Final Approve Panel ───────────────────────────────────────────────────────
const FinalApprovePanel = ({ req, detail, user, departments, onApproved }) => {
  const [note, setNote]         = useState('');
  const [acting, setActing]     = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Determine this dept's authority level
  const deptName = user?.name || '';
  const amount   = parseFloat(req.amount || 0);
  const isChairman = /ceo|chairman/i.test(deptName);
  const isGM       = /general\s*manager|\bgm\b/i.test(deptName);
  const isHR       = /\bhr\b|human\s*resource/i.test(deptName);

  let authorityLabel = null;
  if (isChairman)               authorityLabel = 'Chairman / CEO Authority';
  else if (isGM && amount >= 50000)  authorityLabel = 'GM Authority (₦50k+)';
  else if (isHR && amount < 50000)   authorityLabel = 'HR Authority (< ₦50k)';

  if (!authorityLabel) return null; // Not authorised

  // Don't show if already finally approved
  if (detail?.finalApprovalStatus && detail.finalApprovalStatus !== 'none') return null;

  const handleApprove = async () => {
    setActing(true);
    try {
      await vettingAPI.finalApprove(req.id, note);
      toast.success('Requisition finally approved!');
      setShowModal(true);
      onApproved();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Final approval failed. Please try again.');
    } finally { setActing(false); }
  };

  return (
    <>
      <div className="space-y-3 border border-emerald-200 rounded-2xl p-4 bg-emerald-50/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
        <div className="flex items-center gap-2 pl-1">
          <Gavel size={14} className="text-emerald-700" />
          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Final Approval</p>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-[9px] font-black text-emerald-700 uppercase">{authorityLabel}</span>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional approval note or remarks..."
          className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-300 min-h-[60px] resize-none shadow-inner"
        />
        <button
          onClick={handleApprove}
          disabled={acting}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 text-sm shadow-md shadow-emerald-500/20"
        >
          {acting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {acting ? 'Processing…' : 'Final Approve'}
        </button>
      </div>

      {showModal && (
        <VettingSelectionModal
          reqId={req.id}
          departments={departments}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); onApproved(); }}
        />
      )}
    </>
  );
};

// ── Vetting Selection Modal ────────────────────────────────────────────────────
const VettingSelectionModal = ({ reqId, departments, onClose, onDone }) => {
  const [selectedId, setSelectedId] = useState('');
  const [acting, setActing]         = useState(false);

  // Only show ICC, Audit, Account depts
  const vettingDepts = departments.filter(d => {
    const n = (d.name || '').toLowerCase();
    return /\bicc\b|integrity|compliance|audit|account/i.test(n);
  });

  const handleSend = async () => {
    if (!selectedId) { toast.error('Please select a department.'); return; }
    setActing(true);
    try {
      await vettingAPI.sendToVetting(reqId, parseInt(selectedId));
      toast.success('Requisition sent to vetting department!');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to send to vetting.');
    } finally { setActing(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <Award size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Send to Vetting</h3>
            <p className="text-xs text-muted-foreground">Select the first department to vet this approved requisition</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-semibold">
          Vetting chain: <strong>ICC → Audit → Account</strong>. The first selected dept will receive the requisition and forward it along the chain.
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">First Vetting Department</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full bg-white border border-border rounded-xl p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none shadow-sm"
          >
            <option value="">— Select department —</option>
            {vettingDepts.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
            {vettingDepts.length === 0 && <option disabled>No ICC/Audit/Account depts found</option>}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-all"
          >
            Skip for Now
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedId || acting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20"
          >
            {acting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send to Vetting
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Vetting Panel (for ICC / Audit / Account) ─────────────────────────────────
const VettingPanel = ({ req, detail, user, departments, onDone }) => {
  const [comment, setComment]   = useState('');
  const [file, setFile]         = useState(null);
  const [acting, setActing]     = useState(false);
  const [mode, setMode]         = useState(null); // 'forward' | 'treated'
  const [nextDeptId, setNextDeptId] = useState('');
  const fileRef = React.useRef(null);

  const deptName = user?.name || '';
  const isChairman = /ceo|chairman/i.test(deptName);
  const currentVettingDeptId = detail?.currentVettingDeptId ? parseInt(detail.currentVettingDeptId) : null;
  const isCurrentVetter = user?.deptId && currentVettingDeptId === user.deptId;
  const finalApprovalStatus = detail?.finalApprovalStatus;

  // Chairman can always treat; vetting dept can forward or treat
  const canTreat = isChairman || isCurrentVetter;
  const canForward = isCurrentVetter;

  if (!canTreat && !canForward) return null;
  if (!finalApprovalStatus || finalApprovalStatus === 'none') return null;
  if (finalApprovalStatus === 'treated') return null;

  // Filter next vetting depts: ICC → Audit → Account
  const getChainIndex = (name) => {
    const n = (name || '').toLowerCase();
    if (/\bicc\b|integrity|compliance/i.test(n)) return 0;
    if (/audit/i.test(n)) return 1;
    if (/account/i.test(n)) return 2;
    return -1;
  };
  const myChainIdx = getChainIndex(deptName);
  const nextDepts = departments.filter(d => {
    const idx = getChainIndex(d.name);
    return idx > myChainIdx && idx >= 0;
  });

  const submit = async (action) => {
    if (action === 'forward' && !nextDeptId) {
      setMode('forward');
      return;
    }
    setActing(true);
    try {
      await vettingAPI.vettingAction(req.id, {
        action,
        comment: comment || undefined,
        nextDeptId: action === 'forward' ? parseInt(nextDeptId) : undefined,
        file: file || undefined
      });
      toast.success(action === 'treated' ? 'Requisition marked as treated!' : 'Forwarded to next vetting department.');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Action failed. Please try again.');
    } finally { setActing(false); }
  };

  return (
    <div className="space-y-3 border border-blue-200 rounded-2xl p-4 bg-blue-50/50 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
      <div className="flex items-center gap-2 pl-1">
        <Award size={14} className="text-blue-700" />
        <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Vetting Review</p>
        {finalApprovalStatus === 'vetting' && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 border border-blue-300 text-[9px] font-black text-blue-700 uppercase">In Vetting</span>
        )}
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Your vetting comment or observations (optional)..."
        className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[72px] resize-none shadow-inner"
      />

      {/* File attach */}
      <div>
        <input type="file" ref={fileRef} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        {file ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 rounded-xl border border-blue-200">
            <FileText size={13} className="text-blue-600 shrink-0" />
            <span className="flex-1 truncate text-[11px] font-bold text-foreground">{file.name}</span>
            <button onClick={() => setFile(null)} className="p-0.5 text-muted-foreground hover:text-destructive rounded shrink-0"><X size={12} /></button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-[11px] font-bold text-blue-700 hover:text-blue-900 transition-colors px-2 py-1 rounded-lg hover:bg-blue-100"
          >
            <Paperclip size={13} /> Attach supporting document
          </button>
        )}
      </div>

      {/* Forward dept selector */}
      {mode === 'forward' && (
        <div className="p-3 bg-white border border-blue-200 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2">
          <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center justify-between">
            <span>Forward to next vetting dept</span>
            <button onClick={() => setMode(null)} className="text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-black/5 text-[10px] normal-case font-normal">Cancel</button>
          </label>
          <select
            value={nextDeptId}
            onChange={e => setNextDeptId(e.target.value)}
            className="w-full bg-white border border-border rounded-xl p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none shadow-sm"
          >
            <option value="">— Select next department —</option>
            {nextDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            {nextDepts.length === 0 && <option disabled>No further departments in chain</option>}
          </select>
          <button
            onClick={() => submit('forward')}
            disabled={!nextDeptId || acting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 text-sm"
          >
            {acting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Confirm Forward
          </button>
        </div>
      )}

      {mode !== 'forward' && (
        <div className={`grid gap-2 pt-1 ${canForward && nextDepts.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canForward && nextDepts.length > 0 && (
            <button
              onClick={() => submit('forward')}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm transition-all shadow-sm"
            >
              <ArrowRightCircle size={18} />
              <span>Forward to Next</span>
            </button>
          )}
          {canTreat && (
            <button
              onClick={() => submit('treated')}
              disabled={acting}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm transition-all disabled:opacity-50 shadow-sm"
            >
              {acting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              <span>Mark Treated</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Detail Modal ─────────────────────────────────────────────────────────────
const RequisitionDetailModal = ({ req, user, departments, onClose, onAction }) => {
  const [detail, setDetail]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [printModal, setPrintModal] = useState(false);
  const [newFiles, setNewFiles]     = useState([]);
  const [uploading, setUploading]   = useState(false);
  const fileInputRef                = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRequisitionDetail(req.id).then(d => {
      if (!cancelled) { setDetail(d); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [req.id]);

  const handleAttachFiles = async (stageCtx) => {
    if (!newFiles.length) return;
    setUploading(true);
    try {
      const { uploadAttachments } = await import('../lib/store');
      await uploadAttachments(req.id, newFiles, stageCtx);
      const updated = await getRequisitionDetail(req.id);
      setDetail(updated);
      setNewFiles([]);
      toast.success(`${newFiles.length} file(s) attached successfully.`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'File upload failed. Please try again.');
    } finally { setUploading(false); }
  };

  // Is this an incoming (target dept) requisition for the current user?
  const isIncoming = user?.deptId && detail?.targetDepartmentId === user.deptId;
  // Is this a direct inter-department request (no admin workflow)?
  const isInterDept = detail?.targetDepartmentId && !detail?.currentStageId;
  // Can current user take approval action (not dept user, requisition is pending)
  const canApprove = user?.role !== 'department' && req.status === 'pending' && !isInterDept;
  // Is the request financial?
  const isFinancial = req.type === 'Cash' || (req.amount && req.amount > 0);

  // Latest return event (if returned)
  const latestReturn = detail?.forwardEvents?.filter(e => e.action === 'returned').slice(-1)[0];

  const handleApprove = async (remarks) => {
    setActing(true);
    try {
      await updateRequisitionStatus(req.id, 'approved', remarks);
      onAction();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Approval could not be processed. Please try again.');
    } finally { setActing(false); }
  };

  const handleReject = async (remarks) => {
    if (!remarks?.trim()) { toast.error('Please state a reason for rejection.'); return; }
    setActing(true);
    try {
      await updateRequisitionStatus(req.id, 'rejected', remarks);
      onAction();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Rejection could not be processed. Please try again.');
    } finally { setActing(false); }
  };

  const handleEscalate = () =>
    toast('Use Reject with remarks to escalate manually.', { icon: 'ℹ️' });

  const timeline    = detail ? buildTimeline(detail.approvals || [], detail.currentStage, detail.status) : [];
  const attachments = detail?.attachments || [];
  const forwardEvents = detail?.forwardEvents || [];
  const verCode     = detail?.approvals?.slice(-1)[0]?.signature?.verificationCode;

  return (
    <div className="w-full flex flex-col gap-5 animate-in fade-in duration-500 pb-10">
      
      {/* Top Header / Back Button Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onClose} 
          className="px-4 py-2 bg-white border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-wider shadow-sm group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Directory
        </button>

        <button
          onClick={() => setPrintModal(true)}
          title="Print Stage Report"
          className="px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
        >
          <Printer size={16} />
          Print Record
        </button>
      </div>

      <div className="glass bg-white/95 w-full rounded-[2rem] border border-border/40 shadow-[0_4px_40px_rgba(0,0,0,0.03)] relative flex flex-col overflow-hidden min-h-[85vh]">

        {/* Header */}
        <div className="p-5 lg:p-7 border-b border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 bg-white/50">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                Neural Sync Active
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border shadow-sm ${statusColors[req.status]}`}>
                {req.status}
              </span>
              {isIncoming && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-blue-500 border border-blue-600 text-white shadow-lg shadow-blue-500/20">
                  Incoming Action
                </span>
              )}
              {detail?.finalApprovalStatus === 'approved' && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-500 border border-emerald-600 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Finally Approved
                </span>
              )}
              {detail?.finalApprovalStatus === 'vetting' && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-purple-500 border border-purple-600 text-white shadow-lg shadow-purple-500/20 flex items-center gap-1">
                  <Award size={10} /> In Vetting
                </span>
              )}
              {detail?.finalApprovalStatus === 'treated' && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-teal-500 border border-teal-600 text-white shadow-lg shadow-teal-500/20 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Treated
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter leading-tight">{req.title}</h2>
            <div className="flex items-center gap-4 text-xs tracking-wide text-muted-foreground font-semibold">
               <span className="flex items-center gap-1.5"><Building2 size={13}/> {req.department}</span>
               {detail?.targetDepartment?.name && (
                 <span className="flex items-center gap-1.5"><ArrowRight size={13}/> {detail.targetDepartment.name}</span>
               )}
               <span className="px-2 py-0.5 rounded-md bg-muted font-mono text-[10px] tracking-widest">#{req.id}</span>
            </div>
          </div>
          
          {isFinancial && (
             <div className="sm:text-right bg-white border border-border/40 p-4 rounded-xl shadow-sm min-w-[200px]">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Amount</p>
                <p className="text-2xl font-mono font-black text-foreground">₦{Number(req.amount || 0).toLocaleString()}</p>
             </div>
          )}
        </div>

        {/* Return Warning Banner */}
        {latestReturn && detail?.targetDepartmentId === detail?.departmentId && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-800 uppercase tracking-wide">Returned — Action Required</p>
              <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                {latestReturn.note || 'This request was returned for clarification. Please review and re-submit.'}
              </p>
              <p className="text-[10px] text-amber-600/70 mt-1">
                Returned by: {latestReturn.fromDepartment?.name || 'Department'} — {new Date(latestReturn.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Body Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full grid lg:grid-cols-[1fr_300px] divide-x divide-border/50">
            {/* Left Content Column */}
            <div className="overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-6">
              
              {/* Description Section */}
              {req.description && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                     <FileText size={15} className="text-primary" />
                     <p className="text-xs font-black text-foreground uppercase tracking-[0.1em]">Requisition Brief</p>
                  </div>
                  <p className="text-base font-semibold text-foreground leading-relaxed bg-[#FAF9F6]/50 p-4 rounded-xl border border-border/40 shadow-inner">
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
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="flex items-center space-x-2">
                     <ShieldCheck size={13} className="text-primary" />
                     <p className="text-[10px] font-black text-foreground uppercase tracking-[0.1em]">Administrative Decision</p>
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

              {/* Final Approve Panel — for dept users (Chairman/CEO, GM, HR) */}
              {user?.role === 'department' && detail && !loading && (
                <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                  <FinalApprovePanel
                    req={req}
                    detail={detail}
                    user={user}
                    departments={departments}
                    onApproved={() => {
                      getRequisitionDetail(req.id).then(d => setDetail(d));
                      onAction();
                    }}
                  />
                </div>
              )}

              {/* Vetting Panel — for ICC, Audit, Account and Chairman */}
              {user?.role === 'department' && detail && !loading &&
               detail.finalApprovalStatus && detail.finalApprovalStatus !== 'none' &&
               detail.finalApprovalStatus !== 'treated' && (
                <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                  <VettingPanel
                    req={req}
                    detail={detail}
                    user={user}
                    departments={departments}
                    onDone={() => {
                      getRequisitionDetail(req.id).then(d => setDetail(d));
                      onAction();
                    }}
                  />
                </div>
              )}

              {/* Attachments Section */}
              {/* ── Enclosures (existing attachments) ── */}
              {attachments.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="flex items-center space-x-2">
                     <Paperclip size={13} className="text-primary" />
                     <p className="text-[10px] font-black text-foreground uppercase tracking-[0.1em]">Enclosures ({attachments.length})</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {attachments.map(a => (
                      <div key={a.id} className="flex items-center gap-2 p-3 bg-muted/20 rounded-xl border border-border/30 text-xs hover:border-primary/20 transition-all group">
                        <FileText size={13} className="text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                           <p className="truncate text-foreground font-bold text-[11px]">{a.filename}</p>
                           <div className="flex items-center gap-2 flex-wrap mt-0.5">
                             <span className="text-[9px] text-muted-foreground font-mono">{a.size ? `${(a.size / 1024).toFixed(0)} KB` : 'N/A'}</span>
                             {(a.uploadedBy?.name || a.uploaderDept) && (
                               <span className="text-[9px] text-primary/70 font-bold uppercase tracking-wide">
                                 {a.uploaderDept || a.uploadedBy?.department?.name || ''}
                                 {a.uploadedBy?.name ? ` · ${a.uploadedBy.name}` : ''}
                               </span>
                             )}
                             {a.stageName && (
                               <span className="text-[9px] text-muted-foreground/60 italic">{a.stageName}</span>
                             )}
                             {a.createdAt && (
                               <span className="text-[9px] text-muted-foreground/50 font-mono">{new Date(a.createdAt).toLocaleDateString()}</span>
                             )}
                           </div>
                        </div>
                        <button
                          onClick={() => setPreviewFile(a)}
                          title="Preview"
                          className="p-1.5 text-muted-foreground hover:text-primary transition-all rounded-lg hover:bg-primary/5 shrink-0"
                        >
                          <Eye size={14} />
                        </button>
                        <a
                          href={`/api/attachments/${a.id}/download?token=${localStorage.getItem('rms_token')}`}
                          download
                          title="Download"
                          className="p-1.5 text-muted-foreground hover:text-primary transition-all rounded-lg hover:bg-primary/5 shrink-0"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Post-Creation Attachment Upload ── */}
              {(() => {
                // Compute stage context for tagging
                const fwdEvents = detail?.forwardEvents || [];
                const approvals = detail?.approvals || [];
                const latestFwd = fwdEvents[fwdEvents.length - 1];
                const latestApp = approvals[approvals.length - 1];
                let stageName, stageKey;
                if (latestFwd) {
                  stageName = `${latestFwd.toDepartment?.name || 'Department'} Review`;
                  stageKey  = `fwd-${latestFwd.id}`;
                } else if (detail?.currentStage) {
                  stageName = detail.currentStage.name;
                  stageKey  = `app-${detail.currentStage.id}`;
                } else if (latestApp) {
                  stageName = latestApp.stage?.name || 'Approval Stage';
                  stageKey  = `app-${latestApp.id}`;
                } else {
                  stageName = 'Initial Submission';
                  stageKey  = 'submission';
                }
                const uploaderDept = user?.name || '';

                return (
                  <div className="space-y-3 pt-4 border-t border-dashed border-border/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ArrowDownToLine size={13} className="text-primary" />
                        <p className="text-[10px] font-black text-foreground uppercase tracking-[0.1em]">Attach Documents</p>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground/60 italic truncate max-w-[120px]" title={stageName}>
                        Stage: {stageName}
                      </span>
                    </div>

                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      className="hidden"
                      accept="*/*"
                      onChange={e => setNewFiles(prev => {
                        const added = Array.from(e.target.files);
                        const names = new Set(prev.map(f => f.name));
                        return [...prev, ...added.filter(f => !names.has(f.name))];
                      })}
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/40 rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <Paperclip size={18} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                        <p className="text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                          Click to select files
                        </p>
                        <p className="text-[9px] text-muted-foreground/50">PDF, images, Word, Excel — any format</p>
                      </div>
                    </div>

                    {newFiles.length > 0 && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {newFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
                            <FileText size={12} className="text-primary shrink-0" />
                            <span className="flex-1 truncate text-[11px] font-bold text-foreground">{f.name}</span>
                            <span className="text-[9px] font-mono text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                            <button
                              onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))}
                              className="p-0.5 text-muted-foreground hover:text-destructive rounded transition-colors shrink-0"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleAttachFiles({ stageName, stageKey, uploaderDept })}
                          disabled={uploading}
                          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-2.5 px-4 rounded-xl text-[11px] uppercase tracking-widest transition-all hover:bg-primary/90 disabled:opacity-50 shadow-md shadow-primary/20 active:scale-95"
                        >
                          {uploading ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />}
                          {uploading ? 'Uploading...' : `Attach ${newFiles.length} File${newFiles.length > 1 ? 's' : ''}`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Right Sidebar Column */}
            <div className="bg-muted/10 overflow-y-auto custom-scrollbar p-4 space-y-5 flex flex-col">
              
              {/* Status & Alerts */}
              <div className="space-y-3">
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]">Current Status</p>
                 {req.status === 'pending' ? (
                   isInterDept ? (
                     <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600">
                             <Building2 size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-blue-700">Department Review</p>
                            <p className="text-[10px] text-blue-600/80 font-medium">{detail?.targetDepartment?.name || 'Target Department'}</p>
                          </div>
                        </div>
                     </div>
                   ) : (
                     <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
                             <Clock size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-amber-700">Awaiting Approval</p>
                            <p className="text-[10px] text-amber-600/80 font-medium">{req.currentStageName || detail?.currentStage?.name}</p>
                          </div>
                        </div>
                        {detail?.currentStage?.role && (
                          <div className="text-[9px] font-black uppercase text-amber-800 tracking-widest px-2 py-0.5 bg-amber-500/20 rounded-md inline-block">
                            REQUIRED: {detail.currentStage.role}
                          </div>
                        )}
                     </div>
                   )
                 ) : req.status === 'approved' ? (
                   <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-700">
                      <ShieldCheck size={16} />
                      <span className="text-xs font-bold">Document Fully Authenticated</span>
                   </div>
                 ) : (
                   <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive">
                      <AlertTriangle size={16} />
                      <span className="text-xs font-bold">Requisition Terminated</span>
                   </div>
                 )}
              </div>

              {/* Processing Chain (for inter-dept) OR Approval Trail */}
              <div className="space-y-3 flex-1">
                {isInterDept && forwardEvents.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]">Processing Chain</p>
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[9px] font-bold">
                        {forwardEvents.length}
                      </div>
                    </div>
                    <ProcessingChain events={forwardEvents} />
                  </>
                ) : timeline.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]">Approval Trail</p>
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[9px] font-bold">
                        {timeline.length}
                      </div>
                    </div>
                    {loading ? (
                      <div className="space-y-3 animate-pulse">
                         {[1,2,3].map(i => <div key={i} className="h-14 bg-muted/40 rounded-xl" />)}
                      </div>
                    ) : (
                      <div className="relative pl-1">
                         <ApprovalTimeline stages={timeline} />
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Vetting Chain History */}
              {detail?.vettingEvents?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]">Vetting History</p>
                  <div className="space-y-2">
                    {detail.vettingEvents.map((ev, i) => (
                      <div key={ev.id || i} className="flex gap-2 p-2.5 bg-white rounded-xl border border-border/30 shadow-sm">
                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Award size={11} className="text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black text-foreground truncate">{ev.deptName || 'Dept'}</span>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                              ev.action === 'treated' ? 'bg-teal-100 text-teal-700' :
                              ev.action === 'forward' ? 'bg-blue-100 text-blue-700' :
                              'bg-muted text-muted-foreground'
                            }`}>{ev.action?.replace(/_/g, ' ')}</span>
                          </div>
                          {ev.comment && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{ev.comment}</p>}
                          {ev.attachmentName && (
                            <p className="text-[9px] text-primary/70 mt-0.5 flex items-center gap-1">
                              <Paperclip size={9} /> {ev.attachmentName}
                            </p>
                          )}
                          <p className="text-[8px] text-muted-foreground/50 mt-0.5 font-mono">
                            {ev.actorName && `${ev.actorName} · `}{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Identity & Verification */}
              {verCode && (
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-600">
                     <ShieldCheck size={12} />
                     <p className="text-[9px] font-black uppercase tracking-widest">Digital Fingerprint</p>
                  </div>
                  <p className="font-mono text-xs font-bold text-emerald-800 break-all bg-white p-2 rounded-lg text-center border border-emerald-500/10 shadow-sm">
                    {verCode}
                  </p>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-3 mt-auto border-t border-border/50">
                 {req.status === 'approved' && req.signedPdfKey && (
                    <button
                      onClick={() => downloadSignedPdf(req.id)}
                      className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition-all shadow-xl shadow-primary/20 text-xs uppercase tracking-widest"
                    >
                      <Download size={14} /> Sign Voucher
                    </button>
                 )}
                 <button onClick={onClose} className="w-full text-[9px] text-muted-foreground hover:text-foreground font-black uppercase tracking-[0.2em] transition-colors py-3">
                  Close Document
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && <FilePreviewModal attachment={previewFile} onClose={() => setPreviewFile(null)} />}
      {/* Print Stage Modal */}
      {printModal && <PrintStageModal req={req} detail={detail} onClose={() => setPrintModal(false)} />}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const RequisitionsPage = ({ onViewChange, initialReqId, onDeepLinkConsumed }) => {
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
  const [deletePendingAction, setDeletePendingAction] = useState(null);

  const openReqById = async (id, allReqs) => {
    const list = allReqs || requisitions;
    const cached = list.find(r => r.id === parseInt(id));
    if (cached) {
      setSelectedReq(cached);
    } else {
      try {
        const fetched = await reqAPI.getRequisition(id);
        setSelectedReq(fetched);
      } catch(err) {}
    }
  };

  const loadData = async () => {
    setLoading(true);
    const [data, depts] = await Promise.all([getRequisitions(), getDepartments()]);
    setRequisitions(data);
    setDepartments(depts);
    setLoading(false);

    // Check for deep link after data loads (localStorage fallback)
    const pendingId = localStorage.getItem('rms_pending_requisition_id');
    if (pendingId) {
      localStorage.removeItem('rms_pending_requisition_id');
      await openReqById(pendingId, data);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Deep link via prop (from Dashboard eye button)
  useEffect(() => {
    if (!initialReqId || loading) return;
    openReqById(initialReqId);
    onDeepLinkConsumed?.();
  }, [initialReqId, loading]);

  // Listen for custom event so it works even if already on this page
  useEffect(() => {
    const handleOpenReq = async (e) => {
      await openReqById(e.detail);
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
      toast.error(err?.response?.data?.error || 'Could not delete the selected records. Please try again.');
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
      toast.error(err?.response?.data?.error || 'Could not delete this record. Please try again.');
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
      {isFormOpen ? (
        <RequisitionForm isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); loadData(); }} />
      ) : selectedReq ? (
        <RequisitionDetailModal
          req={selectedReq}
          user={user}
          departments={departments}
          onClose={() => setSelectedReq(null)}
          onAction={() => { setSelectedReq(null); loadData(); }}
        />
      ) : (
      <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2">
          <div className="space-y-1">
             <div className="flex items-center gap-2 mb-1">
              <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                Administrative Registry
              </div>
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tighter">
              Requisition <span className="text-primary italic font-serif">Directory</span>
            </h1>
            <p className="text-muted-foreground text-[12px] font-medium tracking-tight">Managing {filtered.length} synchronized governance records.</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={showBulkDeleteConfirm}
                disabled={deleting}
                className="bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/20 font-black py-3 px-5 rounded-2xl transition-all shadow-lg flex items-center gap-2 active:scale-95"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span className="uppercase tracking-widest text-[10px]">Purge {selectedIds.length} Units</span>
              </button>
            )}
            <button
              onClick={() => setIsFormOpen(true)}
              className="bg-foreground hover:bg-foreground/90 text-background font-black py-3 px-6 rounded-2xl transition-all shadow-2xl shadow-black/10 flex items-center gap-2 w-fit active:scale-95"
            >
              <Plus size={18} />
              <span className="uppercase tracking-widest text-[10px]">Raise New Requisition</span>
            </button>
          </div>
        </div>

        {/* Unified Main Card */}
        <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 p-1 shadow-2xl shadow-primary/5 overflow-hidden">
          <div className="bg-[#FAF9F6]/30 rounded-[1.8rem] p-4 lg:p-6 space-y-5">
            {/* Filters Row */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4 border-b border-border/20 pb-5">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Query by ID, title, or department payload…"
                  className="w-full bg-white border border-border/50 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 custom-scrollbar whitespace-nowrap">
                {['all', 'pending', 'approved', 'rejected', 'draft'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
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
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <Loader2 size={32} className="text-primary animate-spin opacity-20" />
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest animate-pulse">Syncing Directory Access...</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-muted-foreground text-[9px] font-black uppercase tracking-[0.2em]">
                      <th className="pb-3 px-4 w-8">
                        <input type="checkbox" className="rounded-md border-border/50 text-primary focus:ring-primary" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleAll} />
                      </th>
                      <th className="pb-3 px-4">Reference</th>
                      <th className="pb-3 px-4">Module Type</th>
                      <th className="pb-3 px-4">Registry Item</th>
                      <th className="pb-3 px-4">Payload</th>
                      <th className="pb-3 px-4">Authorization Trail</th>
                      <th className="pb-3 px-4">State</th>
                      <th className="pb-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const isMoneyReq = r.type === 'Cash' || (r.amount && r.amount > 0);
                      return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedReq(r)}
                        className="group cursor-pointer transition-all"
                      >
                        <td className="py-3 px-4 bg-white/50 border-y border-l border-border/30 rounded-l-xl group-hover:bg-white transition-colors" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded-md border-border/50 text-primary focus:ring-primary" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                        </td>
                        <td className="py-3 px-4 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-primary tracking-widest">#{r.id}</span>
                            <span className="text-[9px] text-muted-foreground/60 font-mono italic">{new Date(r.createdAt).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              r.type === 'Cash' ? 'bg-emerald-500 shadow-emerald-500/20'
                              : r.type === 'Material' ? 'bg-primary shadow-primary/20'
                              : 'bg-amber-500 shadow-amber-500/20'
                            } shadow-lg`} />
                            <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{r.type}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="space-y-0.5">
                            <p className="text-[12px] font-bold text-foreground max-w-xs truncate">{r.title}</p>
                            {r.urgency && r.urgency !== 'normal' && (
                              <div className={`flex items-center gap-1 text-[9px] font-black uppercase ${urgencyColors[r.urgency]}`}>
                                <div className={`w-1 h-1 rounded-full ${r.urgency === 'critical' ? 'bg-red-500' : 'bg-amber-500'} animate-pulse`} />
                                {r.urgency} Priority
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          {isMoneyReq ? (
                            <span className="text-[12px] font-black text-foreground font-mono">₦{Number(r.amount || 0).toLocaleString()}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50 italic">Non-financial</span>
                          )}
                        </td>
                        <td className="py-3 px-4 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="font-bold text-muted-foreground opacity-60 uppercase">{r.department}</span>
                            {r.targetDepartment?.name && (
                              <>
                                <ArrowRight size={9} className="text-muted-foreground/30" />
                                <span className="font-black text-primary uppercase tracking-tight">{r.targetDepartment.name}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <div className="flex flex-col gap-1">
                            <span className={`w-fit px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${statusColors[r.status]}`}>
                              {r.status}
                            </span>
                            {r.status === 'pending' && r.currentStageName && (
                              <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter truncate max-w-[100px]">At: {r.currentStageName}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 bg-white/50 border-y border-r border-border/30 rounded-r-xl group-hover:bg-white transition-colors text-right">
                          <div className="flex justify-end gap-1.5">
                             <button className="p-2 bg-background shadow-inner rounded-lg text-primary transition-all active:scale-90 border border-primary/10">
                               <Eye size={16} />
                             </button>
                             {(isAdmin || r.status === 'draft') && (
                              <button onClick={e => { e.stopPropagation(); showSingleDeleteConfirm(r.id, e); }} className="p-2 bg-red-50 shadow-inner rounded-lg text-red-500 transition-all active:scale-90 border border-red-200/50">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="py-20 text-center space-y-3 bg-white/20 rounded-2xl border border-dashed border-border/50">
                    <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground/30">
                      <FileText size={28} />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground">Empty Registry. Direct matches not found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </Layout>
  );
};

export default RequisitionsPage;
