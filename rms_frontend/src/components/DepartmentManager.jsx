import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Trash2, Building2, Briefcase, Search, ChevronDown, ChevronRight,
  Eye, EyeOff, Pencil, X, Save, Loader2, KeyRound,
  CheckCircle2, RotateCcw, Info, User, Mail, Phone, MapPin, BadgeCheck, Download
} from 'lucide-react';
import { getDepartments, addDepartment, deleteDepartment } from '../lib/store';
import { deptAPI } from '../lib/api';
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
      <image href="/logo.jpg" x={cx - 45} y={cy - 32} width="90" height="50"
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

    // Inline logo.jpg as base64 so the downloaded SVG is self-contained
    let logoDataUrl = null;
    try {
      const res = await fetch('/logo.jpg');
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

// ── DeptItem ──────────────────────────────────────────────────────────────────
const DeptItem = ({ dept, onDelete, onViewSeal, onEdit }) => {
  return (
    <div className="glass bg-white/80 p-3 lg:p-4 rounded-2xl border border-border/50 flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
      <div className="flex items-center space-x-4 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          dept.type === 'Strategic' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted border border-border/50 text-muted-foreground'
        }`}>
          <Building2 size={18} />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-foreground truncate">{dept.name}</h4>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            <p className="text-[9px] text-muted-foreground uppercase font-mono">{dept.type}</p>
            {dept.headName && (
              <span className="text-[9px] text-muted-foreground/70 italic truncate max-w-[120px]">{dept.headName}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2">
        <button
          onClick={onEdit}
          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
          title="Edit Department"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onViewSeal}
          className="p-2 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
          title="View Department Seal"
        >
          <Eye size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all"
          title="Delete Department"
        >
          <Trash2 size={14} />
        </button>
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

  const [isStrategicOpen, setIsStrategicOpen] = useState(true);
  const [isOperationalOpen, setIsOperationalOpen] = useState(true);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadDepts = async () => {
    const data = await getDepartments();
    setDepartments(data);
    setLoading(false);
  };

  useEffect(() => { loadDepts(); }, []);

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

  const strategic   = departments.filter(d => d.type === 'Strategic');
  const operational = departments.filter(d => d.type === 'Operational');
  const filteredS   = strategic.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredO   = operational.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
    <Layout user={user} currentView="department_manager" onViewChange={onViewChange}>
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

        {/* Dept Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Strategic */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <button onClick={() => setIsStrategicOpen(v => !v)} className="flex items-center space-x-2 text-base font-bold hover:text-primary transition-colors group">
                {isStrategicOpen ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} />}
                <span>Strategic Control</span>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{strategic.length} Total</span>
                <button onClick={() => { setNewDeptData({ name: '', type: 'Strategic', accessCode: '' }); setIsAddModalOpen(true); }}
                  className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all">
                  <Plus size={13} />
                  <span className="text-[9px] font-bold uppercase">Add</span>
                </button>
              </div>
            </div>
            {isStrategicOpen && (
              <div className="space-y-2.5 animate-in fade-in duration-300">
                {filteredS.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-4 text-center">No strategic units found</p>
                ) : filteredS.map(dept => (
                  <DeptItem
                    key={dept.id}
                    dept={dept}
                    onEdit={() => setEditingDept(dept)}
                    onDelete={() => { setPendingDept(dept); setIsDeleteModalOpen(true); }}
                    onViewSeal={() => setSealDept(dept)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Operational */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <button onClick={() => setIsOperationalOpen(v => !v)} className="flex items-center space-x-2 text-base font-bold hover:text-primary transition-colors group">
                {isOperationalOpen ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} />}
                <span>Operational Units</span>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{operational.length} Total</span>
                <button onClick={() => { setNewDeptData({ name: '', type: 'Operational', accessCode: '' }); setIsAddModalOpen(true); }}
                  className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all">
                  <Plus size={13} />
                  <span className="text-[9px] font-bold uppercase">Add</span>
                </button>
              </div>
            </div>
            {isOperationalOpen && (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar animate-in fade-in duration-300">
                {filteredO.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-4 text-center">No operational units found</p>
                ) : filteredO.map(dept => (
                  <DeptItem
                    key={dept.id}
                    dept={dept}
                    onEdit={() => setEditingDept(dept)}
                    onDelete={() => { setPendingDept(dept); setIsDeleteModalOpen(true); }}
                    onViewSeal={() => setSealDept(dept)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Access Codes Table */}
        <div className="glass bg-white/70 rounded-3xl border border-border/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-foreground">Department Access Credentials</h3>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                A strikethrough means the department changed their own code. Click <strong>Edit</strong> to reset it for them.
              </p>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{departments.length} Total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-border/50">
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Login Code (Original)</th>
                  <th className="py-3 px-4">Head</th>
                  <th className="py-3 px-4">Seal</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  // Show accessCodeLabel (admin set); fall back to legacy accessCode if label not yet set
                  const displayCode = dept.accessCodeLabel || dept.accessCode || null;
                  return (
                    <tr key={dept.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors group">
                      <td className="py-3 px-4 text-xs font-bold text-foreground">{dept.name}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${dept.type === 'Strategic' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {dept.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {displayCode ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono font-bold ${dept.codeChangedByDept ? 'line-through text-muted-foreground/40 decoration-red-400 decoration-2' : 'text-foreground'}`}>
                              {displayCode}
                            </span>
                            {dept.codeChangedByDept && (
                              <span className="text-[8px] font-black bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                                Code Changed
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[9px] text-muted-foreground/40 italic">Not recorded</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{dept.headName || '—'}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSealDept(dept)}
                          className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Seal"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setEditingDept(dept)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
    </Layout>
  );
};

export default DepartmentManager;
