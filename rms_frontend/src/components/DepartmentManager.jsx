import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Trash2, Building2, Briefcase, Search, ChevronDown, ChevronRight,
  Eye, EyeOff, Pencil, X, Save, Loader2, KeyRound,
  CheckCircle2, RotateCcw, Info, User, Mail, Phone, MapPin, BadgeCheck, Download,
  Printer, ArrowRight, FileText, Clock, ShieldCheck, Sparkles
} from 'lucide-react';
import { getDepartments, addDepartment, deleteDepartment } from '../lib/store';
import { deptAPI, settingsAPI, adminAPI } from '../lib/api';
import { useAIFeatures } from '../context/AIFeaturesContext';
import { toast } from 'react-hot-toast';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';

// ── Auto-generated Department Seal SVG ────────────────────────────────────────
const DepartmentSeal = ({ name, id = '' }) => {
  const cx = 125, cy = 125;
  const color = '#1a5c1a';
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).toUpperCase();

  const uid = id ? `${id}` : name.replace(/[^a-zA-Z0-9]/g, '_');
  const arcR = 93;
  const topId = `sealTop_${uid}`;
  const botId = `sealBot_${uid}`;

  const len = name.length;
  const fontSize = len <= 14 ? 12.5 : len <= 22 ? 11 : 9.5;
  const letterSpacing = len <= 14 ? 2 : len <= 22 ? 1.2 : 0.8;

  return (
    <svg viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        {/* Top arc: sweep=1 → path goes over the top, text reads left-to-right outward */}
        <path id={topId} d={`M ${cx - arcR},${cy} a ${arcR},${arcR} 0 0,1 ${arcR * 2},0`} />
        {/* Bottom arc: sweep=0 → path goes under the bottom, text reads left-to-right inward */}
        <path id={botId} d={`M ${cx - arcR},${cy} a ${arcR},${arcR} 0 0,0 ${arcR * 2},0`} />
      </defs>

      {/* White background */}
      <circle cx={cx} cy={cy} r={120} fill="white" />

      {/* Outer double rings */}
      <circle cx={cx} cy={cy} r={116} fill="none" stroke={color} strokeWidth="4.5" />
      <circle cx={cx} cy={cy} r={107} fill="none" stroke={color} strokeWidth="1.5" />

      {/* Inner ring */}
      <circle cx={cx} cy={cy} r={72} fill="none" stroke={color} strokeWidth="1.5" />

      {/* Department name on top arc */}
      <text fontSize={fontSize} fontWeight="bold" fontFamily="Arial, sans-serif"
        letterSpacing={letterSpacing} fill={color}>
        <textPath href={`#${topId}`} startOffset="50%" textAnchor="middle">
          {name.toUpperCase()}
        </textPath>
      </text>

      {/* "DEPARTMENT" on bottom arc */}
      <text fontSize="10" fontWeight="bold" fontFamily="Arial, sans-serif"
        letterSpacing="2.5" fill={color}>
        <textPath href={`#${botId}`} startOffset="50%" textAnchor="middle">
          DEPARTMENT
        </textPath>
      </text>

      {/* Diamond separators at equator */}
      <text x={cx - arcR - 4} y={cy + 4} fontSize="8" fill={color} textAnchor="middle">◆</text>
      <text x={cx + arcR + 4} y={cy + 4} fontSize="8" fill={color} textAnchor="middle">◆</text>

      {/* CSS Farms logo centered */}
      <image href="/CSS_Group.png" x={cx - 45} y={cy - 32} width="90" height="50"
        preserveAspectRatio="xMidYMid meet" />

      {/* Thin divider below logo */}
      <line x1={cx - 44} y1={cy + 22} x2={cx + 44} y2={cy + 22} stroke={color} strokeWidth="0.8" />

      {/* Date below divider */}
      <text x={cx} y={cy + 35} textAnchor="middle" fontSize="8" fontFamily="Arial, sans-serif"
        fontWeight="bold" letterSpacing="1" fill={color}>{date}</text>
    </svg>
  );
};

// ── Seal View Modal ────────────────────────────────────────────────────────────
const SealViewModal = ({ dept, onClose }) => {
  const handleDownload = async () => {
    const svgEl = document.getElementById('seal-svg-export');
    if (!svgEl) return;

    // Inline CSS_Group.png as base64 so the downloaded SVG is self-contained
    let logoDataUrl = null;
    try {
      const res = await fetch('/CSS_Group.png');
      const blob = await res.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch { /* logo unavailable — download without it */ }

    const clone = svgEl.cloneNode(true);
    if (logoDataUrl) {
      const imgEl = clone.querySelector('image');
      if (imgEl) imgEl.setAttribute('href', logoDataUrl);
    }

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const dlBlob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(dlBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dept.name.replace(/\s+/g, '_')}_Seal.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/30">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Department Seal</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{dept.name} · Auto-generated · Live Date</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Seal preview */}
        <div className="p-8 flex items-center justify-center">
          <div id="seal-svg-export" className="w-60 h-60 drop-shadow-xl">
            <DepartmentSeal name={dept.name} id={String(dept.id)} />
          </div>
        </div>

        {/* Info strip */}
        <div className="mx-6 mb-4 p-3 bg-primary/5 rounded-xl flex items-start gap-2">
          <Info size={12} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] text-primary/80 font-medium leading-relaxed">
            This seal is auto-generated for <strong>{dept.name}</strong>. The date shown is always today's date. It appears as a watermark on official PDF documents from this department.
          </p>
        </div>

        {/* Download button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/30 text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary/5 transition-all active:scale-[0.98]"
          >
            <Download size={14} />
            Download Seal (SVG)
          </button>
        </div>
      </div>
    </div>
  );
};


// ── Edit Department Modal ─────────────────────────────────────────────────────
const EditDeptModal = ({ dept, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: dept.name || '',
    type: dept.type || 'Operational',
    headName: dept.headName || '',
    headTitle: dept.headTitle || '',
    headEmail: dept.headEmail || '',
    phone: dept.phone || '',
    address: dept.address || '',
  });
  const [newCode, setNewCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingCode, setResettingCode] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Department name is required.'); return; }
    setSaving(true);
    try {
      await deptAPI.updateDepartment(dept.id, form);
      toast.success(`${form.name} updated successfully.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update department.');
    } finally { setSaving(false); }
  };

  const handleResetCode = async () => {
    if (!newCode.trim() || newCode.trim().length < 4) {
      toast.error('New access code must be at least 4 characters.');
      return;
    }
    setResettingCode(true);
    try {
      await deptAPI.resetAccessCode(dept.id, newCode.trim());
      toast.success(`Access code reset for ${dept.name}. The department will need to log in with the new code.`);
      setNewCode('');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to reset access code.');
    } finally { setResettingCode(false); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl px-6 pt-6 pb-4 border-b border-border/30 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Edit Department</h3>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">{dept.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em]">Basic Information</p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Department Name</label>
              <input value={form.name} onChange={set('name')} className="w-full border border-border/50 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['Operational', 'Strategic'].map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`py-2.5 rounded-xl border text-xs font-bold uppercase tracking-tight transition-all ${form.type === t ? 'bg-primary/10 border-primary/50 text-primary' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Head Info */}
          <div className="space-y-4">
            <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em]">Head Official</p>
            {[
              { key: 'headName', label: 'Full Name', icon: User, placeholder: 'Dr. John Doe' },
              { key: 'headTitle', label: 'Designation / Title', icon: BadgeCheck, placeholder: 'General Manager' },
              { key: 'headEmail', label: 'Official Email', icon: Mail, placeholder: 'head@cssgroup.internal', type: 'email' },
              { key: 'phone', label: 'Contact Phone', icon: Phone, placeholder: '+234 800 000 0000' },
              { key: 'address', label: 'Office Address', icon: MapPin, placeholder: 'Floor 3, CSS Tower...' },
            ].map(({ key, label, icon: Icon, placeholder, type }) => (
              <div key={key} className="relative">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">{label}</label>
                <div className="flex items-center border border-border/50 rounded-xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 bg-white">
                  <Icon size={14} className="text-muted-foreground ml-3 shrink-0" />
                  <input value={form[key]} onChange={set(key)} type={type || 'text'} placeholder={placeholder}
                    className="flex-1 px-3 py-3 text-sm font-medium bg-transparent outline-none" />
                </div>
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-95">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Department'}
          </button>
        </form>

        {/* Access Code Reset */}
        <div className="px-6 pb-6">
          <div className="border-t border-border/30 pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound size={14} className="text-amber-500" />
              <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em]">Reset Access Code</p>
              {dept.codeChangedByDept && (
                <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Dept-modified
                </span>
              )}
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-700 font-medium leading-relaxed flex items-start gap-2">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>
                {dept.codeChangedByDept
                  ? `This department has changed their access code from the original. Resetting here will override their custom code.`
                  : `Enter a new access code to replace the current one. The department will use this new code on their next login.`}
              </span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center border border-border/50 rounded-xl focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/10 bg-white">
                <KeyRound size={14} className="text-muted-foreground ml-3 shrink-0" />
                <input
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  type={showCode ? 'text' : 'password'}
                  placeholder="New access code (min 4 chars)"
                  className="flex-1 px-3 py-3 text-sm font-mono bg-transparent outline-none"
                />
                <button type="button" onClick={() => setShowCode(v => !v)} className="px-3 text-muted-foreground hover:text-foreground">
                  {showCode ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleResetCode}
                disabled={resettingCode || !newCode.trim()}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40 shrink-0 shadow-md shadow-amber-500/20"
              >
                {resettingCode ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Deleted Record Detail Modal ───────────────────────────────────────────────
const DeletedRecordModal = ({ rec, onClose }) => {
  const s = rec.snapshot || {};
  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';
  const fmtMoney = (v) => v != null ? `₦${Number(v).toLocaleString()}` : null;

  const typeColor = s.type === 'Cash' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : s.type === 'Memo' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-blue-700 bg-blue-50 border-blue-200';

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const trail = (s.forwardEvents || []).map(e => `
      <tr>
        <td>${new Date(e.createdAt).toLocaleString()}</td>
        <td style="text-transform:uppercase;font-weight:700">${e.action}</td>
        <td>${e.fromDepartment?.name || '—'}</td>
        <td>${e.toDepartment?.name || 'N/A'}</td>
        <td>${e.actorName || '—'}</td>
        <td>${e.note || '—'}</td>
      </tr>`).join('');
    const approvals = (s.approvals || []).map(a => `
      <tr>
        <td>${a.stage?.name || '—'}</td>
        <td style="color:${a.action==='approved'?'green':'red'};font-weight:700;text-transform:uppercase">${a.action}</td>
        <td>${a.user?.name || '—'}</td>
        <td>${a.remarks || '—'}</td>
        <td>${new Date(a.createdAt).toLocaleString()}</td>
        <td>${a.signature?.verificationCode || '—'}</td>
      </tr>`).join('');
    const vetting = (s.vettingEvents || []).map(v => `
      <tr>
        <td>${new Date(v.createdAt).toLocaleString()}</td>
        <td>${v.deptName || '—'}</td>
        <td style="font-weight:700;text-transform:uppercase">${v.action}</td>
        <td>${v.actorName || '—'}</td>
        <td>${v.comment || '—'}</td>
      </tr>`).join('');
    const atts = (s.attachments || []).map(a => `
      <tr>
        <td>${a.filename}</td>
        <td>${a.fileType || '—'}</td>
        <td>${a.stageName || '—'}</td>
        <td>${a.size ? (a.size / 1024).toFixed(1) + ' KB' : '—'}</td>
        <td>${new Date(a.createdAt).toLocaleString()}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>Deleted Record #${rec.originalId}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;font-size:12px}
      h1{font-size:20px;font-weight:900;margin-bottom:4px}
      h2{font-size:13px;font-weight:800;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.12em;border-bottom:1px solid #ddd;padding-bottom:4px}
      .badge{display:inline-block;padding:2px 10px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:12px}
      .label{font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.1em}
      .val{font-size:12px;font-weight:600;color:#111}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#f5f5f5;padding:6px 8px;font-weight:700;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #ddd}
      td{padding:5px 8px;border-bottom:1px solid #eee}
      .del-box{background:#fff3f3;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin-top:24px;font-size:11px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>Deleted Record #${rec.originalId}</h1>
    <span class="badge" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5">${s.type || 'Record'}</span>
    &nbsp;&nbsp;<span style="font-size:11px;color:#666">Archived on ${fmtDate(rec.deletedAt)} by ${rec.deletedByName || 'Unknown'}</span>
    <h2>Record Details</h2>
    <div class="grid">
      <div><p class="label">Title</p><p class="val">${s.title || '—'}</p></div>
      <div><p class="label">Amount</p><p class="val">${fmtMoney(s.amount) || 'Non-financial'}</p></div>
      <div><p class="label">Origin Department</p><p class="val">${s.department?.name || '—'}</p></div>
      <div><p class="label">Target Department</p><p class="val">${s.targetDepartment?.name || '—'}</p></div>
      <div><p class="label">Status at Deletion</p><p class="val">${s.status || '—'} / ${s.finalApprovalStatus || 'none'}</p></div>
      <div><p class="label">Urgency</p><p class="val">${s.urgency || 'normal'}</p></div>
      <div><p class="label">Creator</p><p class="val">${s.creator?.name || '—'} (${s.creator?.email || '—'})</p></div>
      <div><p class="label">Created At</p><p class="val">${fmtDate(s.createdAt)}</p></div>
    </div>
    ${s.description ? `<p class="label">Description / Content</p><p style="font-size:12px;color:#333;white-space:pre-wrap;border:1px solid #eee;border-radius:4px;padding:10px;background:#fafafa">${s.description}</p>` : ''}
    ${trail ? `<h2>Processing Trail (Forward Events)</h2>
    <table><thead><tr><th>Date/Time</th><th>Action</th><th>From</th><th>To</th><th>Actor</th><th>Note</th></tr></thead><tbody>${trail}</tbody></table>` : ''}
    ${approvals ? `<h2>Approvals / Stage Records</h2>
    <table><thead><tr><th>Stage</th><th>Decision</th><th>Officer</th><th>Remarks</th><th>Date/Time</th><th>Sig. Code</th></tr></thead><tbody>${approvals}</tbody></table>` : ''}
    ${vetting ? `<h2>Vetting Events</h2>
    <table><thead><tr><th>Date/Time</th><th>Department</th><th>Action</th><th>Actor</th><th>Comment</th></tr></thead><tbody>${vetting}</tbody></table>` : ''}
    ${atts ? `<h2>Attachments (files purged — metadata only)</h2>
    <table><thead><tr><th>Filename</th><th>Type</th><th>Stage</th><th>Size</th><th>Uploaded</th></tr></thead><tbody>${atts}</tbody></table>` : ''}
    <div class="del-box">
      <strong>⚠ Deletion Record</strong><br/>
      Deleted by <strong>${rec.deletedByName || 'Unknown'}</strong> from <strong>${rec.departmentName || '—'}</strong> on ${fmtDate(rec.deletedAt)}.
      This is an archived copy stored only in the super admin bin. All active records and file data have been permanently removed from the system.
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-3xl border border-border/50 shadow-2xl w-full max-w-4xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
              <FileText size={18} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground tracking-tight">
                Archived Record <span className="text-red-500">#{rec.originalId}</span>
              </h2>
              <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5">
                Deleted by {rec.deletedByName || '—'} · {new Date(rec.deletedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 shadow-md"
            >
              <Printer size={13} />
              Print Record
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
          {/* Basic Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-muted/20 rounded-2xl border border-border/30">
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Type</p>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${typeColor}`}>{s.type || '—'}</span>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Title</p>
              <p className="text-sm font-bold text-foreground leading-tight">{s.title || '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Amount</p>
              <p className="text-sm font-black text-foreground font-mono">{fmtMoney(s.amount) || <span className="text-muted-foreground/50 text-xs italic font-normal">Non-financial</span>}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Origin Dept</p>
              <p className="text-[11px] font-bold text-foreground uppercase">{s.department?.name || rec.departmentName || '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Target Dept</p>
              <p className="text-[11px] font-bold text-foreground uppercase">{s.targetDepartment?.name || '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Urgency</p>
              <p className={`text-[10px] font-black uppercase ${s.urgency === 'critical' ? 'text-red-600' : s.urgency === 'urgent' ? 'text-orange-600' : 'text-muted-foreground'}`}>{s.urgency || 'Normal'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Status at Deletion</p>
              <p className="text-[10px] font-bold text-foreground uppercase">{s.status || '—'} / {s.finalApprovalStatus || 'none'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Creator</p>
              <p className="text-[11px] font-bold text-foreground">{s.creator?.name || '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Created</p>
              <p className="text-[10px] font-mono text-muted-foreground">{fmtDate(s.createdAt)}</p>
            </div>
          </div>

          {s.description && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-2">Description / Content</p>
              <p className="text-sm text-foreground leading-relaxed bg-muted/20 border border-border/30 rounded-xl p-4 whitespace-pre-wrap">{s.description}</p>
            </div>
          )}

          {/* Processing Trail */}
          {(s.forwardEvents || []).length > 0 && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ArrowRight size={12} /> Processing Trail ({s.forwardEvents.length} events)
              </p>
              <div className="space-y-2">
                {s.forwardEvents.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${e.action === 'forwarded' ? 'bg-blue-50 border-blue-200 text-blue-700' : e.action === 'created' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{e.action}</span>
                        <span className="text-[10px] font-bold text-foreground">{e.fromDepartment?.name || '—'}</span>
                        {e.toDepartment?.name && <><ArrowRight size={10} className="text-muted-foreground/40" /><span className="text-[10px] font-black text-primary">{e.toDepartment.name}</span></>}
                        {e.actorName && <span className="text-[9px] text-muted-foreground/70 ml-auto">by {e.actorName}</span>}
                      </div>
                      {e.note && <p className="text-[10px] text-muted-foreground/80 mt-1 italic">"{e.note}"</p>}
                      <p className="text-[9px] font-mono text-muted-foreground/50 mt-1">{fmtDate(e.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approvals */}
          {(s.approvals || []).length > 0 && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ShieldCheck size={12} /> Stage Approvals ({s.approvals.length})
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">
                      <th className="pb-2 px-3">Stage</th><th className="pb-2 px-3">Decision</th><th className="pb-2 px-3">Officer</th><th className="pb-2 px-3">Remarks</th><th className="pb-2 px-3">Date</th><th className="pb-2 px-3">Sig. Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.approvals.map((a, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 bg-muted/20 border-y border-l border-border/20 rounded-l-lg text-[10px] font-bold text-foreground">{a.stage?.name || '—'}</td>
                        <td className="py-2 px-3 bg-muted/20 border-y border-border/20">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${a.action === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{a.action}</span>
                        </td>
                        <td className="py-2 px-3 bg-muted/20 border-y border-border/20 text-[10px] font-medium text-foreground">{a.user?.name || '—'}</td>
                        <td className="py-2 px-3 bg-muted/20 border-y border-border/20 text-[10px] text-muted-foreground max-w-[140px] truncate">{a.remarks || '—'}</td>
                        <td className="py-2 px-3 bg-muted/20 border-y border-border/20 text-[9px] font-mono text-muted-foreground/70">{fmtDate(a.createdAt)}</td>
                        <td className="py-2 px-3 bg-muted/20 border-y border-r border-border/20 rounded-r-lg text-[9px] font-mono text-primary/70">{a.signature?.verificationCode || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vetting Events */}
          {(s.vettingEvents || []).length > 0 && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock size={12} /> Vetting Events ({s.vettingEvents.length})
              </p>
              <div className="space-y-2">
                {s.vettingEvents.map((v, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/40 border border-purple-100/60">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-purple-100 border border-purple-200 text-purple-700">{v.action}</span>
                        <span className="text-[10px] font-bold text-foreground">{v.deptName || '—'}</span>
                        {v.actorName && <span className="text-[9px] text-muted-foreground/70 ml-auto">by {v.actorName}</span>}
                      </div>
                      {v.comment && <p className="text-[10px] text-muted-foreground/80 mt-1 italic">"{v.comment}"</p>}
                      <p className="text-[9px] font-mono text-muted-foreground/50 mt-1">{fmtDate(v.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {(s.attachments || []).length > 0 && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-2 flex items-center gap-2">
                <BadgeCheck size={12} /> Attachments — metadata only, files purged ({s.attachments.length})
              </p>
              <div className="space-y-1.5">
                {s.attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/20">
                    <FileText size={12} className="text-muted-foreground/50 shrink-0" />
                    <span className="text-[11px] font-bold text-foreground flex-1 truncate">{a.filename}</span>
                    <span className="text-[9px] text-muted-foreground/60">{a.fileType || '—'}</span>
                    {a.stageName && <span className="text-[9px] px-2 py-0.5 rounded-lg bg-muted border border-border/40 text-muted-foreground">{a.stageName}</span>}
                    {a.size && <span className="text-[9px] font-mono text-muted-foreground/50">{(a.size / 1024).toFixed(1)} KB</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deletion Footer */}
          <div className="flex items-start gap-3 p-4 bg-red-50/60 border border-red-200/60 rounded-2xl">
            <Trash2 size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-black text-red-700 uppercase tracking-widest">Archived by Department Deletion</p>
              <p className="text-[10px] text-red-600/80 mt-0.5">
                Deleted by <strong>{rec.deletedByName || '—'}</strong> ({rec.departmentName || '—'}) on {fmtDate(rec.deletedAt)}.
                All active records and file data have been permanently removed from the system.
                This snapshot exists only in the super admin bin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const DepartmentManager = ({ onViewChange }) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDept, setPendingDept] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [sealDept, setSealDept] = useState(null);
  const [newDeptData, setNewDeptData] = useState({ name: '', type: 'Operational', accessCode: '' });

  const [showAccessCode, setShowAccessCode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Chairman/CEO routing access control
  const [chairmanAllowedIds, setChairmanAllowedIds] = useState([]);
  const [savingChairman, setSavingChairman] = useState(false);

  // AI Features toggle
  const { aiEnabled, refreshAI } = useAIFeatures();
  const [aiToggle, setAiToggle] = useState(true);
  const [savingAI, setSavingAI] = useState(false);

  // Deleted Records Bin (hidden from departments — super admin only)
  const [deletedRecords, setDeletedRecords] = useState([]);
  const [loadingBin, setLoadingBin] = useState(false);
  const [purgingId, setPurgingId] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);

  const loadDeletedRecords = async () => {
    setLoadingBin(true);
    try {
      const data = await adminAPI.getDeletedRecords();
      setDeletedRecords(Array.isArray(data) ? data : data?.data || []);
    } catch { setDeletedRecords([]); }
    finally { setLoadingBin(false); }
  };

  const handlePurgeRecord = async (id) => {
    if (!window.confirm('Permanently delete this record from the bin? This cannot be undone.')) return;
    setPurgingId(id);
    try {
      await adminAPI.purgeDeletedRecord(id);
      toast.success('Record permanently purged.');
      setDeletedRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to purge record.');
    } finally { setPurgingId(null); }
  };

  const loadDepts = async () => {
    const data = await getDepartments();
    setDepartments(data);
    setLoading(false);
  };

  const loadChairmanSetting = async () => {
    try {
      const res = await settingsAPI.get('chairman_ceo_allowed_depts');
      if (res?.value) setChairmanAllowedIds(JSON.parse(res.value));
    } catch { /* no setting yet — default empty */ }
  };

  const loadAISetting = async () => {
    try {
      const res = await settingsAPI.get('ai_features_enabled');
      setAiToggle(res?.value !== 'false');
    } catch { /* default on */ }
  };

  const saveAISetting = async () => {
    setSavingAI(true);
    try {
      await settingsAPI.set('ai_features_enabled', aiToggle ? 'true' : 'false');
      await refreshAI(); // propagate immediately in this session
      toast.success(`AI features ${aiToggle ? 'enabled' : 'disabled'} for all departments.`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save AI setting.');
    } finally { setSavingAI(false); }
  };

  const saveChairmanSetting = async () => {
    setSavingChairman(true);
    try {
      await settingsAPI.set('chairman_ceo_allowed_depts', JSON.stringify(chairmanAllowedIds));
      toast.success('Chairman/CEO routing access saved.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save setting.');
    } finally { setSavingChairman(false); }
  };

  const toggleChairmanDept = (deptId) => {
    setChairmanAllowedIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  useEffect(() => { loadDepts(); loadChairmanSetting(); loadAISetting(); loadDeletedRecords(); }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newDeptData.name || !newDeptData.accessCode) {
      toast.error('Department name and access code are required.');
      return;
    }
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 400));
    await addDepartment(newDeptData);
    await loadDepts();
    setIsProcessing(false);
    setIsAddModalOpen(false);
    setNewDeptData({ name: '', type: 'Operational', accessCode: '' });
    toast.success(`${newDeptData.name} Department added`);
  };

  const confirmDelete = async () => {
    if (!pendingDept) return;
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 400));
    await deleteDepartment(pendingDept.id);
    await loadDepts();
    setIsProcessing(false);
    setIsDeleteModalOpen(false);
    toast.error(`${pendingDept.name} Department removed`);
    setPendingDept(null);
  };

  const strategic = departments.filter(d => d.type === 'Strategic');
  const operational = departments.filter(d => d.type === 'Operational');
  const filteredS = strategic.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredO = operational.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <Briefcase size={24} className="animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-bold text-primary tracking-widest uppercase animate-pulse">Syncing Corporate Hierarchy</p>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
              <Briefcase className="text-primary" />
              <span>Department <span className="text-primary">Manager</span></span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium">
              Manage operational units and strategic control departments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search departments..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-white/80 border border-border/50 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-56 shadow-sm"
              />
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-5 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 text-sm"
            >
              <Plus size={17} />
              Add Department
            </button>
          </div>
        </div>

        {/* Info box — seal vs signature */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl">
            <Eye size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Department Seal (Auto-generated)</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-relaxed">
                Each department gets a unique seal generated automatically with their name and today's date. Click the <strong>eye icon</strong> on any department card to view or download it. It is embedded as a watermark on official PDF documents.
              </p>
            </div>
          </div>
          <div className="flex-1 flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
            <BadgeCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Head Officer Signature</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-relaxed">
                The handwritten signature of the department head — uploaded by the department themselves via their <strong>Dept Profile</strong> page. It auto-embeds above the signature line on PDFs.
              </p>
            </div>
          </div>
        </div>

        {/* Unified Corporate Hierarchy Table */}
        <div className="glass bg-white/70 rounded-3xl border border-border/50 p-6 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-5 px-1">
            <div>
              <h3 className="text-base font-bold text-foreground">Corporate Hierarchy & Credentials</h3>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Manage all units, their access codes, and official signatures in one centralized directory.
              </p>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{departments.length} Units Synchronized</span>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse border-separate border-spacing-0">
              <thead>
                <tr className="bg-muted/30 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="py-4 px-4 rounded-tl-xl border-y border-l">Unit Name</th>
                  <th className="py-4 px-4 border-y">Category</th>
                  <th className="py-4 px-4 border-y">Login Code</th>
                  <th className="py-4 px-4 border-y">Head Official</th>
                  <th className="py-4 px-4 border-y">Official Email</th>
                  <th className="py-4 px-4 border-y">Contact Phone</th>
                  <th className="py-4 px-4 border-y">Office Address</th>
                  <th className="py-4 px-4 rounded-tr-xl border-y border-r text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {departments
                  .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((dept) => {
                    const displayCode = dept.accessCodeLabel || dept.accessCode || null;
                    return (
                      <tr key={dept.id} className="hover:bg-primary/[0.02] transition-colors group">
                        <td className="py-4 px-4 text-xs font-bold text-foreground border-l border-border/10">{dept.name}</td>
                        <td className="py-4 px-4">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${dept.type === 'Strategic' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {dept.type}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {displayCode ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-mono font-bold ${dept.codeChangedByDept ? 'line-through text-muted-foreground/40 decoration-red-400 decoration-2' : 'text-foreground'}`}>
                                {displayCode}
                              </span>
                              {dept.codeChangedByDept && (
                                <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Modified</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] text-muted-foreground/40 italic">Not set</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs text-muted-foreground font-medium">{dept.headName || '—'}</td>
                        <td className="py-4 px-4 text-xs text-primary font-medium">{dept.headEmail || '—'}</td>
                        <td className="py-4 px-4 text-xs text-muted-foreground font-medium">{dept.phone || '—'}</td>
                        <td className="py-4 px-4 text-xs text-muted-foreground/60 font-medium truncate max-w-[150px]" title={dept.address}>{dept.address || '—'}</td>
                        <td className="py-4 px-4 border-r border-border/10">
                          <div className="flex items-center justify-center space-x-1">
                            <button onClick={() => setEditingDept(dept)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-all" title="Edit Unit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setSealDept(dept)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all" title="View Seal">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => { setPendingDept(dept); setIsDeleteModalOpen(true); }} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all" title="Delete Unit">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {departments.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
               <div className="py-20 text-center">
                  <p className="text-sm text-muted-foreground italic">No departments match your search criteria.</p>
               </div>
            )}
          </div>
        </div>

        {/* Settings Section (Grid for side-by-side on large screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Chairman/CEO Routing Access ── */}
          <div className="glass bg-white/70 rounded-3xl border border-border/50 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Chairman / CEO Routing Access</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Control direct routing capability.</p>
                </div>
              </div>
              <button
                onClick={saveChairmanSetting}
                disabled={savingChairman}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 shadow-md shadow-amber-200 active:scale-[0.98]"
              >
                {savingChairman ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </div>

            <div className="flex-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {departments.filter(d => !/ceo|chairman/i.test(d.name)).map(dept => {
                const allowed = chairmanAllowedIds.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    onClick={() => toggleChairmanDept(dept.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${allowed
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-border/40 text-muted-foreground hover:border-amber-200'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${allowed ? 'bg-amber-500 border-amber-500' : 'border-border'}`}>
                      {allowed && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    <span className="text-[11px] font-bold truncate">{dept.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── AI Features Toggle ── */}
          <div className="glass bg-white/70 rounded-3xl border border-border/50 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">AIGC Features</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Control organization-wide AI tools.</p>
                </div>
              </div>
              <button
                onClick={saveAISetting}
                disabled={savingAI}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 shadow-md shadow-purple-200 active:scale-[0.98]"
              >
                {savingAI ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/40 bg-white shadow-inner">
                <div className="space-y-1">
                  <p className="text-xs font-black text-foreground uppercase tracking-tight">
                    {aiToggle ? 'Neural Engines Active' : 'Neural Engines Suspended'}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {aiToggle
                      ? 'AI Refinement and Voice Dictation are enabled across the entire hierarchy.'
                      : 'Organization-wide AI capabilities have been restricted.'}
                  </p>
                </div>
                <button
                  onClick={() => setAiToggle(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none shadow-inner ${aiToggle ? 'bg-purple-600' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${aiToggle ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="p-4 bg-muted/20 rounded-xl border border-border/10 flex items-start gap-3">
                <Info size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground/80 font-medium italic">
                  Changes to AI status propogate to all active department sessions within seconds and do not require a system reboot.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Deleted Records Bin (super admin eyes only) ────────────────────── */}
      <div className="glass bg-white/70 rounded-3xl border border-red-200/50 p-6 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <Trash2 size={16} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Deleted Records Bin</h3>
              <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5">Records removed by departments — invisible to them. Permanently purge or retain for audit.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[10px] font-black text-red-600 uppercase tracking-widest">
              {deletedRecords.length} record{deletedRecords.length !== 1 ? 's' : ''}
            </span>
            <button onClick={loadDeletedRecords} disabled={loadingBin} className="p-2 rounded-xl border border-border/50 hover:bg-muted transition-all text-muted-foreground disabled:opacity-40">
              <RotateCcw size={13} className={loadingBin ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loadingBin ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-muted-foreground/40" />
          </div>
        ) : deletedRecords.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground/50 font-medium">Bin is empty — no department deletions recorded.</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-separate border-spacing-y-1.5">
              <thead>
                <tr className="text-muted-foreground text-[9px] font-black uppercase tracking-[0.18em]">
                  <th className="pb-3 px-3">Orig. ID</th>
                  <th className="pb-3 px-3">Type</th>
                  <th className="pb-3 px-3">Title</th>
                  <th className="pb-3 px-3">Department</th>
                  <th className="pb-3 px-3">Deleted By</th>
                  <th className="pb-3 px-3">Deleted At</th>
                  <th className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {deletedRecords.map(rec => (
                  <tr key={rec.id} className="group">
                    <td className="py-2.5 px-3 bg-red-50/40 border-y border-l border-red-100/60 rounded-l-xl text-[10px] font-black text-red-600 tracking-widest">#{rec.originalId}</td>
                    <td className="py-2.5 px-3 bg-red-50/40 border-y border-red-100/60">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${rec.recordType === 'Cash' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : rec.recordType === 'Memo' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                        {rec.recordType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 bg-red-50/40 border-y border-red-100/60 max-w-[180px]">
                      <p className="text-[11px] font-bold text-foreground truncate">{rec.title || '—'}</p>
                    </td>
                    <td className="py-2.5 px-3 bg-red-50/40 border-y border-red-100/60">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{rec.departmentName || '—'}</span>
                    </td>
                    <td className="py-2.5 px-3 bg-red-50/40 border-y border-red-100/60">
                      <span className="text-[10px] font-medium text-muted-foreground/80">{rec.deletedByName || '—'}</span>
                    </td>
                    <td className="py-2.5 px-3 bg-red-50/40 border-y border-red-100/60">
                      <span className="text-[9px] font-mono text-muted-foreground/70">{new Date(rec.deletedAt).toLocaleString()}</span>
                    </td>
                    <td className="py-2.5 px-3 bg-red-50/40 border-y border-r border-red-100/60 rounded-r-xl text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => setViewingRecord(rec)}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary hover:text-white text-primary text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5 ml-auto"
                        >
                          <Eye size={10} />
                          View
                        </button>
                        <button
                          onClick={() => handlePurgeRecord(rec.id)}
                          disabled={purgingId === rec.id}
                          className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5 ml-auto"
                        >
                          {purgingId === rec.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deleted Record Detail Modal */}
      {viewingRecord && (
        <DeletedRecordModal rec={viewingRecord} onClose={() => setViewingRecord(null)} />
      )}

      {/* Seal View Modal */}
      {sealDept && (
        <SealViewModal dept={sealDept} onClose={() => setSealDept(null)} />
      )}

      {/* Edit Modal */}
      {editingDept && (
        <EditDeptModal
          dept={editingDept}
          onClose={() => setEditingDept(null)}
          onSaved={() => { loadDepts(); setEditingDept(null); }}
        />
      )}

      {/* Add Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Department" size="xl"
        footer={(
          <>
            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-all">Cancel</button>
            <button onClick={handleAddSubmit} disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isProcessing ? <><Loader2 size={14} className="animate-spin" /><span>Creating…</span></> : <span>Create Department</span>}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Department Name</label>
            <input type="text" value={newDeptData.name} onChange={e => setNewDeptData(d => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Finance & Accounts"
              className="w-full bg-muted/30 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Login Access Code</label>
            <div className="relative">
              <input type={showAccessCode ? 'text' : 'password'} value={newDeptData.accessCode}
                onChange={e => setNewDeptData(d => ({ ...d, accessCode: e.target.value }))}
                placeholder="e.g. HATCH-2026"
                className="w-full bg-muted/30 border border-border/50 rounded-xl p-4 pr-12 focus:ring-2 focus:ring-primary/20 outline-none font-mono" />
              <button type="button" onClick={() => setShowAccessCode(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary">
                {showAccessCode ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['Operational', 'Strategic'].map(type => (
              <button key={type} type="button" onClick={() => setNewDeptData(d => ({ ...d, type }))}
                className={`p-4 rounded-xl border transition-all text-xs font-bold uppercase ${newDeptData.type === type ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-white border-border/50 text-muted-foreground hover:border-border'}`}>
                {type}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete}
        isProcessing={isProcessing} title="Delete Department"
        message={`Are you sure you want to permanently delete "${pendingDept?.name}"? This action cannot be undone.`} />
    </>
  );
};

export default DepartmentManager;
