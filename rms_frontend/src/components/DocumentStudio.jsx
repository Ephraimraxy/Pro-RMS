import React, { useState, useRef, useCallback, useEffect } from 'react';
import Layout from './Layout';
import DOMPurify from 'dompurify';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import localforage from 'localforage';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { templates } from '../lib/templates';
import { 
  addRequisition, 
  getDepartments, 
  logActivity,
  uploadAttachments
} from '../lib/store';
import { aiAPI, deptAPI } from '../lib/api';
import { toast } from 'react-hot-toast';
import VoiceDictation from './VoiceDictation';
import { useAIFeatures } from '../context/AIFeaturesContext';

import { 
  FileText, Table, Download, Plus, Trash2, Save, 
  FileSpreadsheet, FileImage, File, ChevronDown,
  CloudOff, Cloud, Clock, X, HardDrive, AlertCircle, 
  FolderOpen, Edit3, Presentation, MonitorPlay, ChevronLeft, ChevronRight, Maximize, Send,
  Paperclip, AlertTriangle, Zap, CheckCircle2, 
  Image as ImageIcon, Loader2, ArrowLeft
} from 'lucide-react';

localforage.config({ name: 'CSS_RMS_Offline', storeName: 'drafts' });
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5MB max offline storage per department

const getObjectSize = (obj) => {
  try { return new Blob([JSON.stringify(obj)]).size; } catch(e) { return 0; }
};

const applyMemoFields = (html, fields) => {
  if (!html) return html;
  const replaceField = (key, value) => {
    const pattern = new RegExp(`(<span\\s+data-memo-${key}[^>]*>)([\\s\\S]*?)(</span>)`, 'i');
    return html.replace(pattern, `$1${value}$3`);
  };
  let nextHtml = html;
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      nextHtml = replaceField(key, value);
    }
  });
  return nextHtml;
};

const resolveDeptCode = (deptInfo, fallbackLabel) => {
  if (deptInfo?.code) return deptInfo.code;
  const name = (deptInfo?.name || fallbackLabel || '').toLowerCase();
  if (name.includes('isac')) return 'ISC';
  return (deptInfo?.name || fallbackLabel || 'CSS').slice(0, 3);
};

const formatMemoRef = (deptCode) => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const code = (deptCode || 'CSS').toUpperCase();
  return `CSSG/${code}/MO/${dd}/${mm}/${yyyy}/01`;
};

const formatMemoDate = () => {
  const d = new Date();
  return `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}.`;
};

// ── Tab Button ──
const TabButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
      active 
        ? 'bg-primary/20 text-primary border border-primary/20 shadow-lg shadow-primary/10' 
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
    }`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

// ── Export Menu ──
const ExportMenu = ({ onExport, formats }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-50">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center space-x-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-primary/20"
      >
        <Download size={16} />
        <span>Export</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 glass bg-white/90 border border-border/50 rounded-2xl p-2 z-50 shadow-xl">
          {formats.map(f => (
            <button
              key={f.type}
              onClick={() => { onExport(f.type); setOpen(false); }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm text-foreground hover:bg-muted hover:text-primary transition-all"
            >
              <f.icon size={16} className="text-primary" />
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Save Indicator ──
const SaveIndicator = ({ saving, lastSaved, error }) => (
  <div className={`flex items-center space-x-2 text-[10px] font-mono font-bold px-3 py-1.5 rounded-full ${error ? 'bg-destructive/10 text-destructive' : 'bg-muted/30 text-muted-foreground'}`}>
    {error ? (
      <>
        <AlertCircle size={12} />
        <span>{error}</span>
      </>
    ) : saving ? (
      <>
        <CloudOff size={12} className="animate-pulse" />
        <span>Saving Draft Locally...</span>
      </>
    ) : (
      <>
        <Cloud size={12} className="text-emerald-500" />
        <span>Saved Securely Locally</span>
      </>
    )}
  </div>
);

// ══════════════════════════════════════════════
// ── RICH TEXT EDITOR (Docs / Memos) ──────────
// ══════════════════════════════════════════════
const RichTextEditor = ({ loadedDraft, onAutosave, onSend }) => {
  const [title, setTitle] = useState(loadedDraft?.title || 'Untitled Document');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);
  const { aiEnabled } = useAIFeatures();

  useEffect(() => {
    setTitle(loadedDraft?.title || 'Untitled Document');
    if (editorRef.current && loadedDraft?.data) {
      const clean = DOMPurify.sanitize(loadedDraft.data);
      if (editorRef.current.innerHTML !== clean) {
        editorRef.current.innerHTML = clean;
      }
    } else if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  }, [loadedDraft]);

  const handleInput = () => {
    setSaving(true);
    if (window.docAutoSaveTimer) clearTimeout(window.docAutoSaveTimer);
    window.docAutoSaveTimer = setTimeout(() => {
      onAutosave({ title, data: editorRef.current.innerHTML });
      setSaving(false);
    }, 1500);
  };

  useEffect(() => {
    setSaving(true);
    if (window.docTitleTimer) clearTimeout(window.docTitleTimer);
    window.docTitleTimer = setTimeout(() => {
      if (editorRef.current) {
        onAutosave({ title, data: editorRef.current.innerHTML });
      }
      setSaving(false);
    }, 1500);
  }, [title]);

  const handleExport = useCallback(async (type) => {
    const contentHtml = editorRef.current?.innerHTML || '';
    if (type === 'html') {
      const blob = new Blob([`<html><head><title>${title}</title><meta charset="utf-8"></head><body style="padding:20px;">${contentHtml}</body></html>`], { type: 'text/html' });
      const link = document.createElement('a');
      link.download = `${title}.html`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  }, [title]);

  const execCmd = (cmd, arg = null) => {
    document.execCommand(cmd, false, arg);
    editorRef.current.focus();
    handleInput();
  };

  const FONT_FAMILIES = [
    { label: 'Standard (Inter)', value: "'Inter', sans-serif" },
    { label: 'Times New Roman', value: "'Times New Roman', serif" },
    { label: 'Playfair Display', value: "'Playfair Display', serif" },
    { label: 'Montserrat', value: "'Montserrat', sans-serif" },
    { label: 'Roboto', value: "'Roboto', sans-serif" },
    { label: 'Lora', value: "'Lora', serif" },
    { label: 'Courier Mono', value: "'Courier Prime', monospace" },
  ];

  const FONT_SIZES = ['8', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36'];

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2 w-full max-w-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl lg:text-2xl font-black text-foreground bg-transparent outline-none border-b-2 border-transparent focus:border-primary/50 transition-all pb-1 w-full"
            placeholder="Document Title..."
          />
          <SaveIndicator saving={saving} />
        </div>
        <div className="flex items-center space-x-2 lg:space-x-4">
          {aiEnabled && (
            <div className="hidden lg:block">
              <VoiceDictation onTranscript={(text) => {
                if (editorRef.current) {
                  editorRef.current.innerHTML += ' ' + text;
                  handleInput();
                }
              }} />
            </div>
          )}
          <button
            onClick={onSend}
            className="flex-1 lg:flex-none flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs lg:text-sm px-6 py-3.5 rounded-2xl transition-all shadow-xl shadow-amber-600/20"
          >
            <Send size={18} />
            <span className="uppercase tracking-widest">Send to Workflow</span>
          </button>
          <ExportMenu onExport={handleExport} formats={[{ type: 'html', label: 'Export as HTML', icon: FileText }]} />
        </div>
      </div>

      <div className="glass bg-slate-100 rounded-2xl shadow-sm relative z-10 flex flex-col border border-border/50 overflow-hidden">
        {/* Advanced MS Word Style Toolbar */}
        <div className="bg-white border-b border-border/40 px-3 py-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar sticky top-0 z-20">
          
          {/* Font Controls */}
          <select 
            onChange={(e) => execCmd('fontName', e.target.value)}
            className="h-8 bg-muted/50 border border-border/40 rounded px-1.5 text-[10px] font-bold outline-none hover:bg-muted"
          >
            {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          <select 
            onChange={(e) => execCmd('fontSize', e.target.value)}
            className="h-8 bg-muted/50 border border-border/40 rounded px-1.5 text-[10px] font-bold outline-none hover:bg-muted"
          >
            <option value="">Size</option>
            {FONT_SIZES.map(s => <option key={s} value={s}>{s}pt</option>)}
          </select>

          <div className="w-px h-6 bg-border/40 mx-1 shrink-0"></div>

          {/* Basic Styles */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button title="Bold" onClick={() => execCmd('bold')} className="p-1.5 hover:bg-muted font-black rounded w-8 h-8 flex items-center justify-center">B</button>
            <button title="Italic" onClick={() => execCmd('italic')} className="p-1.5 hover:bg-muted italic rounded w-8 h-8 flex items-center justify-center font-serif">I</button>
            <button title="Underline" onClick={() => execCmd('underline')} className="p-1.5 hover:bg-muted underline rounded w-8 h-8 flex items-center justify-center">U</button>
          </div>

          <div className="w-px h-6 bg-border/40 mx-1 shrink-0"></div>

          {/* Color Pickers */}
          <div className="flex items-center space-x-2 shrink-0 px-1">
            <div className="flex flex-col items-center">
              <input type="color" onChange={(e) => execCmd('foreColor', e.target.value)} className="w-5 h-5 p-0 border-none bg-transparent cursor-pointer" />
              <span className="text-[8px] font-black uppercase opacity-60">Text</span>
            </div>
            <div className="flex flex-col items-center">
              <input type="color" onChange={(e) => execCmd('hiliteColor', e.target.value)} className="w-5 h-5 p-0 border-none bg-transparent cursor-pointer" />
              <span className="text-[8px] font-black uppercase opacity-60">Highlight</span>
            </div>
          </div>

          <div className="w-px h-6 bg-border/40 mx-1 shrink-0"></div>

          {/* Alignment */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => execCmd('justifyLeft')} className="p-1.5 hover:bg-muted rounded w-8 h-8 flex items-center justify-center"><i className="text-[10px] font-black">L</i></button>
            <button onClick={() => execCmd('justifyCenter')} className="p-1.5 hover:bg-muted rounded w-8 h-8 flex items-center justify-center"><i className="text-[10px] font-black">C</i></button>
            <button onClick={() => execCmd('justifyRight')} className="p-1.5 hover:bg-muted rounded w-8 h-8 flex items-center justify-center"><i className="text-[10px] font-black">R</i></button>
            <button onClick={() => execCmd('justifyFull')} className="p-1.5 hover:bg-muted rounded w-8 h-8 flex items-center justify-center"><i className="text-[10px] font-black">J</i></button>
          </div>

          <div className="w-px h-6 bg-border/40 mx-1 shrink-0"></div>

          {/* Lists */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button title="Bullet List" onClick={() => execCmd('insertUnorderedList')} className="p-1.5 hover:bg-muted rounded w-8 h-8 flex items-center justify-center">●</button>
            <button title="Number List" onClick={() => execCmd('insertOrderedList')} className="p-1.5 hover:bg-muted rounded w-8 h-8 flex items-center justify-center">1.</button>
          </div>

          <div className="w-px h-6 bg-border/40 mx-1 shrink-0"></div>

          {/* History */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button title="Undo" onClick={() => execCmd('undo')} className="p-1.5 hover:bg-muted rounded w-8 h-8 flex items-center justify-center">↶</button>
            <button title="Redo" onClick={() => execCmd('redo')} className="p-1.5 hover:bg-muted rounded w-8 h-8 flex items-center justify-center">↷</button>
          </div>
        </div>
        
        {/* Native HTML Editor - Mobile Optimized */}
        <div className="editor-outer-shell">
          <div 
            ref={editorRef}
            contentEditable={true}
            onInput={handleInput}
            suppressContentEditableWarning={true}
            className="editor-paper"
          />
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// ── SPREADSHEET EDITOR ───────────────────────
// ══════════════════════════════════════════════
const SpreadsheetEditor = ({ loadedDraft, onAutosave }) => {
  const [title, setTitle] = useState(loadedDraft?.title || 'Untitled Spreadsheet');
  const [saving, setSaving] = useState(false);
  const rawSheetData = loadedDraft?.data;
  const sheetData = useRef(Array.isArray(rawSheetData) && rawSheetData.length > 0
    ? rawSheetData
    : [{ name: "Sheet1", celldata: [] }]);

  const handleSheetChange = (data) => {
    sheetData.current = data;
    setSaving(true);
    if (window.sheetAutoSaveTimer) clearTimeout(window.sheetAutoSaveTimer);
    window.sheetAutoSaveTimer = setTimeout(() => {
      onAutosave({ title, data: sheetData.current });
      setSaving(false);
    }, 1500);
  };

  useEffect(() => {
    // Hook up title change autosave
    setSaving(true);
    if (window.sheetTitleTimer) clearTimeout(window.sheetTitleTimer);
    window.sheetTitleTimer = setTimeout(() => {
      onAutosave({ title, data: sheetData.current });
      setSaving(false);
    }, 1500);
  }, [title]);

  const exportFormats = [
    { type: 'xlsx', label: 'Export as Excel (Not Implemented)', icon: FileSpreadsheet }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2 w-full max-w-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-black text-foreground bg-transparent outline-none border-b-2 border-transparent focus:border-primary/50 transition-all pb-1 w-full max-w-lg"
            placeholder="Spreadsheet Title..."
          />
          <SaveIndicator saving={saving} />
        </div>
        <ExportMenu onExport={() => alert('Excel export coming soon!')} formats={exportFormats} />
      </div>

      <div className="glass bg-white/70 border border-border/50 rounded-2xl overflow-hidden shadow-sm h-[600px] w-full relative">
        <Workbook data={sheetData.current} onChange={handleSheetChange} />
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// ── PRESENTATION EDITOR (PowerPoint) ─────────
// ══════════════════════════════════════════════
const PresentationEditor = ({ loadedDraft, onAutosave }) => {
  const [title, setTitle] = useState(loadedDraft?.title || 'Untitled Presentation');
  const [saving, setSaving] = useState(false);
  const [slides, setSlides] = useState(loadedDraft?.data || [{ id: Date.now(), html: '<h1 class="ql-align-center">New Slide</h1>' }]);
  const [activeSlideId, setActiveSlideId] = useState(slides[0]?.id || Date.now());
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);

  const editorRef = useRef(null);
  const quillInstance = useRef(null);
  const presentAreaRef = useRef(null);

  // Initialize Quill
  useEffect(() => {
    if (!editorRef.current || quillInstance.current || presenting) return;
    
    quillInstance.current = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'align': [] }],
          ['image', 'video'],
          ['clean']
        ]
      }
    });

    quillInstance.current.on('text-change', () => {
      const html = quillInstance.current.root.innerHTML;
      setSlides(prev => prev.map(s => s.id === activeSlideId ? { ...s, html } : s));
    });
  }, [activeSlideId, presenting]);

  // Load active slide content into quill
  useEffect(() => {
    if (quillInstance.current) {
      const currentSlide = slides.find(s => s.id === activeSlideId);
      if (currentSlide && quillInstance.current.root.innerHTML !== currentSlide.html) {
        quillInstance.current.root.innerHTML = DOMPurify.sanitize(currentSlide.html || '');
      }
    }
  }, [activeSlideId]);

  // Autosave
  useEffect(() => {
    if (presenting) return; // Don't autosave while presenting to avoid lag
    setSaving(true);
    const timer = setTimeout(() => {
      onAutosave({ title, data: slides });
      setSaving(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [slides, title]);

  const addSlide = () => {
    const newSlide = { id: Date.now(), html: '<h2 class="ql-align-center">New Slide</h2>' };
    setSlides([...slides, newSlide]);
    setActiveSlideId(newSlide.id);
  };
  
  const removeSlide = (id) => {
    if (slides.length === 1) return;
    const remaining = slides.filter(s => s.id !== id);
    setSlides(remaining);
    if (activeSlideId === id) setActiveSlideId(remaining[0].id);
  };

  // Fullscreen Presentation Logic
  const startPresentation = () => {
    setPresentIndex(slides.findIndex(s => s.id === activeSlideId) || 0);
    setPresenting(true);
    setTimeout(() => {
      if (presentAreaRef.current) {
        presentAreaRef.current.requestFullscreen().catch(err => console.error("Fullscreen err:", err));
      }
    }, 100);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    const handleKeyDown = (e) => {
      if (!presenting) return;
      if (e.key === 'ArrowRight' || e.key === ' ') setPresentIndex(i => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setPresentIndex(i => Math.max(i - 1, 0));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [presenting, slides.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2 w-full max-w-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-black text-foreground bg-transparent outline-none border-b-2 border-transparent focus:border-primary/50 transition-all pb-1 w-full max-w-lg"
            placeholder="Presentation Title..."
          />
          <SaveIndicator saving={saving} />
        </div>
        <button onClick={startPresentation} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20">
          <MonitorPlay size={16} />
          <span>Present</span>
        </button>
      </div>

      <div className="glass bg-white/70 border border-border/50 rounded-2xl flex overflow-hidden shadow-sm h-[600px] relative">
        {/* Left Sidebar: Slides */}
        <div className="w-56 bg-muted/10 border-r border-border/50 flex flex-col z-20">
          <div className="p-3 border-b border-border/50">
            <button onClick={addSlide} className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-muted border border-border/60 shadow-sm text-foreground font-bold text-xs py-2 rounded-lg transition-all">
              <Plus size={14} /> <span>New Slide</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {slides.map((s, idx) => (
              <div 
                key={s.id}
                onClick={() => setActiveSlideId(s.id)}
                className={`relative group cursor-pointer border-2 rounded-xl aspect-[4/3] flex flex-col overflow-hidden transition-all ${activeSlideId === s.id ? 'border-primary shadow-md' : 'border-border/60 hover:border-primary/40 bg-white/50'}`}
              >
                <div className="bg-muted/30 px-2 py-1 flex items-center justify-between border-b border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                  {slides.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removeSlide(s.id); }} className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="flex-1 p-2 scale-[0.35] origin-top-left w-[280%] h-[280%] pointer-events-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(s.html || '') }}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col bg-muted/5 z-10">
          {!presenting && <div ref={editorRef} className="flex-1 border-none bg-white font-sans" />}
        </div>
      </div>

      {/* Presentation Fullscreen Node */}
      <div 
        ref={presentAreaRef} 
        className={`fixed inset-0 bg-black z-[9999] flex flex-col ${presenting ? 'block' : 'hidden'}`}
      >
        <div className="flex-1 flex items-center justify-center p-8 relative">
          <div 
            className="w-full max-w-6xl aspect-[16/9] bg-white rounded-xl shadow-2xl p-12 overflow-hidden ql-editor"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(slides[presentIndex]?.html || '') }}
          />
          
          {/* Controls overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center space-x-4 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full text-white opacity-0 hover:opacity-100 transition-opacity">
            <button onClick={() => setPresentIndex(i => Math.max(i - 1, 0))} disabled={presentIndex === 0} className="p-2 hover:bg-white/20 rounded-full disabled:opacity-30"><ChevronLeft size={24} /></button>
            <span className="font-mono text-sm font-bold">{presentIndex + 1} / {slides.length}</span>
            <button onClick={() => setPresentIndex(i => Math.min(i + 1, slides.length - 1))} disabled={presentIndex === slides.length - 1} className="p-2 hover:bg-white/20 rounded-full disabled:opacity-30"><ChevronRight size={24} /></button>
            <div className="w-px h-6 bg-white/20 mx-2"></div>
            <button onClick={() => document.exitFullscreen()} className="p-2 hover:bg-white/20 rounded-full"><X size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── SEND TO WORKFLOW MODAL ──────────────────
const SendToWorkflowModal = ({ isOpen, onClose, onSend, departments, initialTitle, currentUser, content }) => {
  const [targetDeptIds, setTargetDeptIds] = useState([]);
  const [priority, setPriority] = useState('normal');
  const [files, setFiles] = useState([]);
  const [isRefining, setIsRefining] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [activationMap, setActivationMap] = useState({});
  const [checkingActivation, setCheckingActivation] = useState({});
  const { aiEnabled } = useAIFeatures();

  const isDeptUser = currentUser?.role === 'department';
  const baseDepartments = departments.filter(d => d.name !== 'Super Admin');
  const allowedDepartments = (isDeptUser && currentUser?.deptId)
    ? baseDepartments.filter(d => d.id === currentUser.deptId)
    : baseDepartments;

  useEffect(() => {
    if (!isOpen) {
      setTargetDeptIds([]);
      setPriority('normal');
      setFiles([]);
      setAiPreview(null);
      return;
    }
    if (isDeptUser && currentUser?.deptId) {
      setTargetDeptIds([String(currentUser.deptId)]);
      checkActivation(currentUser.deptId);
    }
  }, [isOpen, isDeptUser, currentUser?.deptId]);

  const checkActivation = async (deptId) => {
    if (activationMap[deptId]) return;
    setCheckingActivation(prev => ({ ...prev, [deptId]: true }));
    try {
      const res = await deptAPI.checkActivation(deptId);
      setActivationMap(prev => ({ ...prev, [deptId]: res }));
    } catch {
      setActivationMap(prev => ({ ...prev, [deptId]: { activated: false } }));
    } finally {
      setCheckingActivation(prev => ({ ...prev, [deptId]: false }));
    }
  };

  const handleAiRefine = async () => {
    if (!content || content.trim().length < 10) {
      toast.error('Document content is too short for AI refinement.');
      return;
    }
    setIsRefining(true);
    try {
      const res = await aiAPI.refineDraft(content, 'pro');
      setAiPreview({
        refinedContent: res.refinedDescription,
        type: res.documentType,
        amount: res.totalAmount
      });
      toast.success('AI Refinement Complete (Grammar & Metadata Verified)');
    } catch (err) {
      toast.error('AI Refinement failed.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-background flex flex-col overflow-y-auto safe-p-top p-4 sm:p-6 lg:p-8 custom-scrollbar animate-in fade-in duration-300">
      
      <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-6 flex-1 h-full min-h-screen pb-10">
        
        {/* Top Header / Back Button */}
        <div className="flex items-center justify-between">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-white border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-wider shadow-sm group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Studio
          </button>
        </div>

        <div className="glass bg-white/95 w-full flex-1 rounded-[2rem] border border-border/40 shadow-xl relative flex flex-col overflow-hidden">

          <div className="p-6 lg:p-8 border-b border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 bg-white/50">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter leading-tight flex items-center space-x-3">
                <Send size={24} className="text-primary" />
                <span>Send to Workflow</span>
              </h2>
              <div className="flex items-center space-x-2 pt-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">Routing Template Configurator</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">Configuring: "{initialTitle}"</p>
          </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* AI Refinement Nudge — hidden when AI features disabled */}
          {aiEnabled && (
            <div className={`p-4 rounded-2xl border transition-all ${
              aiPreview ? 'bg-emerald-50 border-emerald-200' : 'bg-primary/5 border-primary/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${aiPreview ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                    <Zap size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">AI Polish & Verify</h3>
                    <p className="text-[10px] text-muted-foreground">Checks grammar and certifies document category.</p>
                  </div>
                </div>
                <button
                  onClick={handleAiRefine}
                  disabled={isRefining}
                  className="px-4 py-2 bg-white border border-border rounded-xl text-xs font-bold shadow-sm hover:border-primary/30 transition-all flex items-center gap-2"
                >
                  {isRefining ? <Loader2 size={14} className="animate-spin" /> : aiPreview ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Zap size={14} />}
                  {aiPreview ? 'Repolish' : 'Polish Content'}
                </button>
              </div>
              {aiPreview && (
                <div className="mt-3 pt-3 border-t border-emerald-100 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black uppercase text-emerald-700 tracking-widest bg-emerald-100 px-2 py-0.5 rounded">Category: {aiPreview.type}</div>
                  </div>
                  {aiPreview.amount > 0 && (
                    <div className="flex items-center gap-2 text-right justify-end">
                      <div className="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/10 px-2 py-0.5 rounded">₦{aiPreview.amount.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Target Departments</label>
              <div className="max-h-56 overflow-y-auto bg-muted/20 border border-border/40 rounded-2xl p-3 space-y-1">
                {allowedDepartments.map(d => {
                  const status = activationMap[d.id];
                  const loading = checkingActivation[d.id];
                  const isGlobalAdmin = currentUser?.role === 'global_admin';
                  const isBlocked = status && !status.activated && !isGlobalAdmin;
                  
                  return (
                    <div key={d.id} className="group">
                      <label className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                        targetDeptIds.includes(String(d.id)) ? 'bg-primary/5' : 'hover:bg-white/50'
                      }`}>
                        <div className="flex items-center space-x-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            className="rounded-lg border-border"
                            checked={targetDeptIds.includes(String(d.id))}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setTargetDeptIds(prev => checked ? [...prev, String(d.id)] : prev.filter(id => id !== String(d.id)));
                              if (checked) checkActivation(d.id);
                            }}
                            disabled={isDeptUser || isBlocked}
                          />
                          <span className={isBlocked ? 'text-muted-foreground line-through decoration-red-500/50' : ''}>{d.name}</span>
                        </div>
                        {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
                        {isBlocked && (
                          <div title="This department head has not uploaded a digital signature." className="text-red-500">
                            <AlertTriangle size={14} />
                          </div>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {['normal', 'urgent', 'critical'].map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                        priority === p ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-white border-border text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center justify-between">
                  <span>External Attachments</span>
                  <span className="text-[9px] font-bold text-primary">{files.length} selected</span>
                </label>
                <div 
                  onClick={() => document.getElementById('studio-attachments').click()}
                  className="border-2 border-dashed border-border/60 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                >
                  <Paperclip size={18} className="text-muted-foreground group-hover:text-primary mb-1" />
                  <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary">Click to attach files</span>
                  <input id="studio-attachments" type="file" multiple className="hidden" onChange={handleFileChange} />
                </div>
                {files.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5 mt-2 max-h-24 overflow-y-auto pr-1">
                     {files.map((file, i) => (
                       <div key={i} className="flex items-center justify-between bg-white border border-border/40 p-2 rounded-xl animate-in slide-in-from-left-2 duration-200">
                          <div className="flex items-center gap-2 overflow-hidden">
                             <ImageIcon size={12} className="text-primary shrink-0" />
                             <span className="text-[10px] font-medium truncate">{file.name}</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-red-400 hover:text-red-600 transition-colors">
                             <X size={12} />
                          </button>
                       </div>
                     ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/20 border-t border-border/40 flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 font-bold text-sm text-muted-foreground hover:bg-muted rounded-xl transition-all">Cancel</button>
          <button 
            disabled={targetDeptIds.length === 0}
            onClick={() => onSend({ 
              departmentIds: targetDeptIds, 
              departmentNames: allowedDepartments.filter(d => targetDeptIds.includes(String(d.id))).map(d => d.name),
              priority,
              aiPreview,
              files
            })}
            className="flex-[3] py-3 px-8 bg-primary text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
          >
            <Send size={18} />
            <span>Send to Workflow</span>
          </button>
        </div>
      </div>
     </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// ── MAIN DOCUMENT STUDIO ─────────────────────
// ══════════════════════════════════════════════
const DocumentStudio = ({ user, onViewChange }) => {
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      const depts = await getDepartments();
      setAvailableDepartments(depts);
    };
    fetchMetadata();
  }, []);

  const handleSendToWorkflow = async (metadata) => {
    if (!currentActiveDraft) return;
    
    // UI feedback for refining if needed
    let isProcessing = true;
    const processingToast = toast.loading('Initializing and refining document flow...');

    try {
      // 1. AI Content Refinement (Optional but integrated)
      const contentToSend = metadata.aiPreview?.refinedContent || currentActiveDraft.data;
      const type = metadata.aiPreview?.type || (currentActiveDraft.title.toLowerCase().includes('memo') ? 'Memo' : 'Requisition');
      const finalAmount = metadata.aiPreview?.amount || 0;

      const selectedNames = metadata.departmentNames || [];
      const toLabel = selectedNames.join(' & ') || 'TARGET DEPARTMENT';
      const deptInfo = availableDepartments.find(d => d.id === user?.deptId) || {};
      const deptCode = resolveDeptCode(deptInfo, user?.department);
      
      const updatedContent = applyMemoFields(contentToSend, {
        ref: formatMemoRef(deptCode),
        date: formatMemoDate(),
        to: toLabel.toUpperCase(),
        from: (deptInfo.name || user?.department || '').toUpperCase(),
        'sender-name': deptInfo.headName || '',
        'sender-title': deptInfo.headTitle || ''
      });

      const payloads = (metadata.departmentIds || []).map((deptId) => ({
        title: currentActiveDraft.title,
        description: `Submitted from Document Studio: ${currentActiveDraft.title}`,
        departmentId: user?.deptId ? parseInt(user.deptId) : 1,
        targetDepartmentId: parseInt(deptId),
        type: type,
        status: 'pending',
        amount: finalAmount,
        urgency: metadata.priority || 'normal',
        content: updatedContent,
        createdBy: user?.name || 'Administrator',
        createdAt: new Date().toISOString()
      }));

      // 2. Submit requisitions
      const result = await addRequisition(payloads);
      
      // 3. Handle External Attachments
      if (metadata.files && metadata.files.length > 0 && Array.isArray(result)) {
         toast.loading('Uploading external attachments...', { id: processingToast });
         for (const req of result) {
            try {
               await uploadAttachments(req.id, metadata.files);
            } catch (err) {
               console.error("Attachment upload failed for one dept:", err);
            }
         }
      }

      await logActivity('Document Sent', `"${currentActiveDraft.title}" sent ${selectedNames.length} departments via Studio with security clearance.`);
      toast.success('Successfully sent to selected departments!', { id: processingToast });
      setIsSendModalOpen(false);
    } catch (err) {
      console.error("Scale-to-Workflow failed:", err);
      const msg = err.response?.data?.error || 'Failed to send document to departments';
      toast.error(msg, { id: processingToast });
    } finally {
      isProcessing = false;
    }
  };
  
  const [activeTab, setActiveTab] = useState('doc');
  
  // Drafts State
  const [draftsManagerOpen, setDraftsManagerOpen] = useState(false);
  const [allDrafts, setAllDrafts] = useState([]);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [draftsSpaceUsed, setDraftsSpaceUsed] = useState(0);

  const localKey = `rms_drafts_${user?.department || 'global'}`;

  const loadDrafts = useCallback(async () => {
    const stored = await localforage.getItem(localKey);
    const drafts = Array.isArray(stored) ? stored : [];
    setAllDrafts(drafts);
    
    let totalSize = 0;
    drafts.forEach(d => { totalSize += (d.sizeBytes || 0); });
    setDraftsSpaceUsed(totalSize);
    return drafts;
  }, [localKey]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const initiateNewDraft = (type, templateKey = null) => {
    const newId = `draft_${Date.now()}`;
    const template = templateKey ? templates[templateKey] : null;
    const deptInfo = availableDepartments.find(d => d.id === user?.deptId) || {};
    const deptCode = resolveDeptCode(deptInfo, user?.department);
    
    // Pre-create the draft object to ensure it loads with template data immediately
    const newDraft = {
      id: newId,
      type,
      title: template ? template.title : (type === 'doc' ? 'Untitled Document' : type === 'sheet' ? 'Untitled Spreadsheet' : 'Untitled Presentation'),
      data: template
        ? (typeof template.data === 'function'
            ? template.data({
                deptCode,
                fromLabel: deptInfo.name || user?.department || '',
                toLabel: 'TARGET DEPARTMENT',
                subjectLabel: '[ENTER SUBJECT HERE]',
                headName: deptInfo.headName || '',
                headTitle: deptInfo.headTitle || '',
                date: new Date()
              })
            : template.data)
        : (type === 'sheet' ? [{ name: "Sheet1", celldata: [] }] : (type === 'slide' ? [{ id: Date.now(), html: '<h1 class="ql-align-center">New Slide</h1>' }] : '')),
      updatedAt: new Date().toISOString()
    };
    
    // Save it immediately so it's available for the next render
    const updateDrafts = async () => {
      const currentDrafts = Array.isArray(allDrafts) ? [...allDrafts, newDraft] : [newDraft];
      await localforage.setItem(localKey, currentDrafts);
      setAllDrafts(currentDrafts);
      setCurrentDraftId(newId);
      setActiveTab(type);
      setDraftsManagerOpen(false);
    };
    
    updateDrafts();
  };

  const handleAutosave = async ({ title, data }) => {
    if (!currentDraftId) {
      setCurrentDraftId(`draft_${Date.now()}`);
      return; // The next render will pick up the currentDraftId and autosave properly
    }

    const currentDrafts = Array.isArray(allDrafts) ? [...allDrafts] : [];
    const draftIndex = currentDrafts.findIndex(d => d.id === currentDraftId);
    
    const draftObj = {
      id: currentDraftId,
      type: activeTab,
      title,
      data,
      updatedAt: new Date().toISOString()
    };
    draftObj.sizeBytes = getObjectSize(draftObj);

    if (draftIndex >= 0) {
      currentDrafts[draftIndex] = draftObj;
    } else {
      currentDrafts.push(draftObj);
    }

    // Size limit check
    let sizeCalc = 0;
    currentDrafts.forEach(d => { sizeCalc += (d.sizeBytes || 0); });
    
    if (sizeCalc > MAX_STORAGE_BYTES) {
      alert("Storage limit reached! Please delete older offline drafts.");
      return;
    }

    await localforage.setItem(localKey, currentDrafts);
    setAllDrafts(currentDrafts);
    setDraftsSpaceUsed(sizeCalc);
  };

  const deleteDraft = async (id) => {
    const filtered = allDrafts.filter(d => d.id !== id);
    await localforage.setItem(localKey, filtered);
    await loadDrafts();
    if (currentDraftId === id) setCurrentDraftId(null);
  };

  const loadDraftIntoEditor = (draft) => {
    setCurrentDraftId(draft.id);
    setActiveTab(draft.type);
    setDraftsManagerOpen(false);
  };

  const currentActiveDraft = allDrafts.find(d => d.id === currentDraftId);

  return (
    <Layout user={user} currentView="document_studio" onViewChange={onViewChange}>
      <div className="max-w-6xl mx-auto space-y-8 pb-20 relative">
        
        <div className="space-y-4 max-w-7xl mx-auto px-2 lg:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
            <Edit3 className="text-primary" />
            <span>Document <span className="text-primary">Studio</span></span>
          </h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 font-medium">
            Create, edit, and export documents. <span className="text-emerald-600 font-bold hidden sm:inline">Offline Auto-Save is Active.</span>
          </p>
        </div>
          
          <button 
            onClick={() => setDraftsManagerOpen(true)}
            className="flex flex-col items-center justify-center bg-white border border-border/60 shadow-sm rounded-2xl px-5 py-3 hover:bg-muted/30 transition-all group"
          >
            <div className="flex items-center space-x-2 text-foreground font-bold">
              <FolderOpen size={18} className="text-primary group-hover:scale-110 transition-transform" />
              <span>Drafts ({allDrafts.length})</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1 w-full bg-muted/50 rounded-full overflow-hidden h-1.5 relative">
               <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${(draftsSpaceUsed/MAX_STORAGE_BYTES)*100}%`}}></div>
            </div>
            <p className="text-[9px] text-muted-foreground font-mono mt-1 uppercase">
              {(draftsSpaceUsed / 1024).toFixed(1)} KB / 5 MB
            </p>
          </button>
        </div>
        </div>

        {/* Tab Switcher */}
        {!currentDraftId ? (
          <div className="glass bg-white/50 border border-primary/20 rounded-3xl p-6 lg:p-10 text-center flex flex-col items-center justify-center min-h-[300px] w-full max-w-4xl mx-auto">
            <h2 className="text-lg lg:text-xl font-bold text-foreground mb-1">Start a New Document</h2>
            <p className="text-xs lg:text-sm text-muted-foreground mb-8 max-w-sm">Launch a new rich text document, spreadsheet, or presentation workspace.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full px-4">
              {/* Blank Document */}
              <button 
                onClick={() => initiateNewDraft('doc')} 
                className="flex flex-col items-center justify-center p-6 bg-white border border-border/60 hover:border-primary/40 hover:bg-white rounded-2xl shadow-sm transition-all hover:scale-[1.02] group"
              >
                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors text-primary">
                  <Plus size={24} />
                </div>
                <span className="font-bold text-sm">Blank Doc</span>
              </button>

              {/* Memo Template */}
              <button 
                onClick={() => initiateNewDraft('doc', 'memo')} 
                className="flex flex-col items-center justify-center p-6 bg-white border border-border/60 hover:border-primary/40 hover:bg-white rounded-2xl shadow-sm transition-all hover:scale-[1.02] group"
              >
                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors text-primary">
                  <FileText size={24} />
                </div>
                <span className="font-bold text-sm">Internal Memo</span>
              </button>

              {/* Requisition Template */}
              <button 
                onClick={() => initiateNewDraft('doc', 'requisition')} 
                className="flex flex-col items-center justify-center p-6 bg-white border border-border/60 hover:border-primary/40 hover:bg-white rounded-2xl shadow-sm transition-all hover:scale-[1.02] group"
              >
                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors text-primary">
                  <Save size={24} />
                </div>
                <span className="font-bold text-sm">Requisition</span>
              </button>

              {/* More Types */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => initiateNewDraft('sheet')} 
                  className="flex items-center space-x-3 w-full p-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-all text-xs"
                >
                  <Table size={16} /> <span>New Sheet</span>
                </button>
                <button 
                  onClick={() => initiateNewDraft('slide')} 
                  className="flex items-center space-x-3 w-full p-3 bg-orange-50 text-orange-700 font-bold rounded-xl hover:bg-orange-100 transition-all text-xs"
                >
                  <Presentation size={16} /> <span>New Slide</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-3 p-1.5 glass bg-white/80 border border-border/50 rounded-2xl w-fit shadow-sm">
              <TabButton icon={FileText} label="Document Editor" active={activeTab === 'doc'} onClick={() => { setActiveTab('doc'); initiateNewDraft('doc'); }} />
              <TabButton icon={Table} label="Spreadsheet" active={activeTab === 'sheet'} onClick={() => { setActiveTab('sheet'); initiateNewDraft('sheet'); }} />
              <TabButton icon={Presentation} label="Presentation" active={activeTab === 'slide'} onClick={() => { setActiveTab('slide'); initiateNewDraft('slide'); }} />
            </div>

            {/* Active Editor */}
          {currentDraftId && activeTab === 'doc' && currentActiveDraft && (
          <RichTextEditor 
            key={currentDraftId}
            loadedDraft={currentActiveDraft} 
            onAutosave={handleAutosave} 
            onSend={() => setIsSendModalOpen(true)}
          />
        )}
        {currentDraftId && activeTab === 'sheet' && currentActiveDraft && (
          <SpreadsheetEditor key={currentDraftId} loadedDraft={currentActiveDraft} onAutosave={handleAutosave} />
        )}
        {currentDraftId && activeTab === 'slide' && currentActiveDraft && (
          <PresentationEditor key={currentDraftId} loadedDraft={currentActiveDraft} onAutosave={handleAutosave} />
        )}

        <SendToWorkflowModal 
          isOpen={isSendModalOpen}
          onClose={() => setIsSendModalOpen(false)}
          onSend={handleSendToWorkflow}
          departments={availableDepartments}
          initialTitle={currentActiveDraft?.title}
          currentUser={user}
          content={currentActiveDraft?.data}
        />
  </>
        )}

      </div>

      {/* Drafts Manager Modal */}
      {draftsManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col border border-border/50 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/10">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center space-x-2">
                  <HardDrive size={20} className="text-primary" />
                  <span>Department Drafts</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Manage auto-saved documents for {user?.department}</p>
              </div>
              <button onClick={() => setDraftsManagerOpen(false)} className="p-2 hover:bg-muted text-muted-foreground rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-muted/5 custom-scrollbar">
              {allDrafts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                  <p className="font-bold">No saved drafts found.</p>
                  <p className="text-xs mt-1">Start a new document to see it appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allDrafts.map(draft => (
                    <div key={draft.id} className="bg-white border border-border/50 rounded-2xl p-4 flex flex-col group hover:border-primary/30 transition-all hover:shadow-md">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className={`p-2 rounded-lg ${draft.type === 'doc' ? 'bg-blue-500/10 text-blue-600' : draft.type === 'sheet' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600'}`}>
                            {draft.type === 'doc' ? <FileText size={16} /> : draft.type === 'sheet' ? <Table size={16} /> : <Presentation size={16} />}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-foreground truncate max-w-[150px]">{draft.title}</h3>
                            <p className="text-[10px] text-muted-foreground font-mono uppercase mt-0.5">{(draft.sizeBytes / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button onClick={() => deleteDraft(draft.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mb-4 flex items-center space-x-1">
                        <Clock size={12} />
                        <span>{new Date(draft.updatedAt).toLocaleString()}</span>
                      </div>

                      <button 
                        onClick={() => loadDraftIntoEditor(draft)}
                        className="w-full mt-auto flex items-center justify-center space-x-2 bg-muted hover:bg-primary/10 hover:text-primary text-foreground font-bold text-xs py-2 rounded-xl transition-all"
                      >
                        <Edit3 size={14} />
                        <span>Resume Editing</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DocumentStudio;
