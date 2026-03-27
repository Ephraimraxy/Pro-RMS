import React, { useState, useRef, useCallback, useEffect } from 'react';
import Layout from './Layout';
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
  getRequisitionTypes,
  logActivity 
} from '../lib/store';

import { 
  FileText, Table, Download, Plus, Trash2, Save, 
  FileSpreadsheet, FileImage, File, ChevronDown,
  CloudOff, Cloud, Clock, X, HardDrive, AlertCircle, 
  FolderOpen, Edit3, Presentation, MonitorPlay, ChevronLeft, ChevronRight, Maximize
} from 'lucide-react';

localforage.config({ name: 'CSS_RMS_Offline', storeName: 'drafts' });
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5MB max offline storage per department

const getObjectSize = (obj) => {
  try { return new Blob([JSON.stringify(obj)]).size; } catch(e) { return 0; }
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
  const quillInstance = useRef(null);

  useEffect(() => {
    if (!editorRef.current || quillInstance.current) return;
    
    quillInstance.current = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'script': 'sub'}, { 'script': 'super' }],
          [{ 'header': 1 }, { 'header': 2 }, 'blockquote', 'code-block'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
          [{ 'direction': 'rtl' }, { 'align': [] }],
          ['link', 'image', 'video'],
          ['clean']
        ]
      }
    });

    if (loadedDraft?.data) {
      quillInstance.current.root.innerHTML = loadedDraft.data;
    }

    quillInstance.current.on('text-change', () => {
      setSaving(true);
      if (window.docAutoSaveTimer) clearTimeout(window.docAutoSaveTimer);
      window.docAutoSaveTimer = setTimeout(() => {
        onAutosave({ title, data: quillInstance.current.root.innerHTML });
        setSaving(false);
      }, 1500);
    });
  }, [loadedDraft, onAutosave, title]);

  useEffect(() => {
    // Save on title change
    setSaving(true);
    if (window.docTitleTimer) clearTimeout(window.docTitleTimer);
    window.docTitleTimer = setTimeout(() => {
      if (quillInstance.current) {
        onAutosave({ title, data: quillInstance.current.root.innerHTML });
      }
      setSaving(false);
    }, 1500);
  }, [title]);

  const handleExport = useCallback(async (type) => {
    const contentHtml = quillInstance.current?.root.innerHTML || '';
    if (type === 'html') {
      const blob = new Blob([`<html><head><title>${title}</title><style>body{font-family:sans-serif;}</style></head><body>${contentHtml}</body></html>`], { type: 'text/html' });
      const link = document.createElement('a');
      link.download = `${title}.html`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  }, [title]);

  const exportFormats = [
    { type: 'html', label: 'Export as HTML', icon: FileText }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2 w-full max-w-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-black text-foreground bg-transparent outline-none border-b-2 border-transparent focus:border-primary/50 transition-all pb-1 w-full"
            placeholder="Document Title..."
          />
          <SaveIndicator saving={saving} />
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onSend}
            className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-amber-600/20"
          >
            <Send size={16} />
            <span>Send to Workflow</span>
          </button>
          <ExportMenu onExport={handleExport} formats={exportFormats} />
        </div>
      </div>

      <div className="glass bg-white border border-border/50 rounded-2xl shadow-sm relative z-10 overflow-hidden flex flex-col">
          <div ref={editorRef} className="h-[600px] border-none font-sans" />
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
  const sheetData = useRef(loadedDraft?.data || [{ name: "Sheet1", celldata: [] }]);

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
        quillInstance.current.root.innerHTML = currentSlide.html || '';
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
                <div className="flex-1 p-2 scale-[0.35] origin-top-left w-[280%] h-[280%] pointer-events-none" dangerouslySetInnerHTML={{ __html: s.html }}></div>
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
            dangerouslySetInnerHTML={{ __html: slides[presentIndex]?.html || '' }}
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

// ══════════════════════════════════════════════
// ── MAIN DOCUMENT STUDIO ─────────────────────
// ══════════════════════════════════════════════
const DocumentStudio = ({ user, onViewChange }) => {
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [requisitionTypes, setRequisitionTypes] = useState([]);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      const [depts, types] = await Promise.all([
        getDepartments(),
        getRequisitionTypes()
      ]);
      setAvailableDepartments(depts);
      setRequisitionTypes(types);
    };
    fetchMetadata();
  }, []);

  const handleSendToWorkflow = async (metadata) => {
    if (!currentActiveDraft) return;
    
    try {
      const type = metadata.type || (currentActiveDraft.title.toLowerCase().includes('memo') ? 'Memo' : 'Requisition');
      const requisitionData = {
        title: currentActiveDraft.title,
        description: metadata.description || `Submitted from Document Studio: ${currentActiveDraft.title}`,
        departmentId: parseInt(metadata.departmentId),
        type: type,
        status: 'pending',
        amount: metadata.amount ? parseFloat(metadata.amount) : 0,
        content: currentActiveDraft.data, // Storing the HTML content in the requisition
        createdBy: user?.name || 'Administrator',
        createdAt: new Date().toISOString()
      };

      await addRequisition(requisitionData);
      await logActivity('Document Sent', `"${loadedDraft.title}" sent to ${metadata.departmentName} for approval`);
      toast.success('Successfully sent to workflow chain!');
      setIsSendModalOpen(false);
    } catch (err) {
      console.error("Scale-to-Workflow failed:", err);
      toast.error('Failed to send document to workflow');
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
    const drafts = stored || [];
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
    
    // Pre-create the draft object to ensure it loads with template data immediately
    const newDraft = {
      id: newId,
      type,
      title: template ? template.title : (type === 'doc' ? 'Untitled Document' : type === 'sheet' ? 'Untitled Spreadsheet' : 'Untitled Presentation'),
      data: template ? template.data : (type === 'sheet' ? [{ name: "Sheet1", celldata: [] }] : (type === 'slide' ? [{ id: Date.now(), html: '<h1 class="ql-align-center">New Slide</h1>' }] : '')),
      updatedAt: new Date().toISOString()
    };
    
    // Save it immediately so it's available for the next render
    const updateDrafts = async () => {
      const currentDrafts = [...allDrafts, newDraft];
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

    const currentDrafts = [...allDrafts];
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
    currentDrafts.forEach(d => { sizeCalc += d.sizeBytes; });
    
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
          types={requisitionTypes}
          initialTitle={currentActiveDraft?.title}
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
