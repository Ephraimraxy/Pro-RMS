import React, { useState, useRef, useCallback, useEffect } from 'react';
import Layout from './Layout';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import localforage from 'localforage';
import { 
  FileText, Table, Download, Plus, Trash2, Save, 
  FileSpreadsheet, FileImage, File, ChevronDown,
  Columns, CloudOff, Cloud
} from 'lucide-react';

// Configure LocalForage
localforage.config({
  name: 'CSS_RMS_Offline',
  storeName: 'drafts'
});

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
const SaveIndicator = ({ saving, lastSaved }) => (
  <div className="flex items-center space-x-2 text-[10px] font-mono font-bold text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
    {saving ? (
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
const RichTextEditor = () => {
  const [title, setTitle] = useState('Untitled Document');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const printRef = useRef();

  // Load from offline storage sequentially
  useEffect(() => {
    localforage.getItem('rms_doc_draft').then(draft => {
      if (draft) {
        setTitle(draft.title || 'Untitled Document');
        setContent(draft.content || '');
      }
      setIsLoaded(true);
    });
  }, []);

  // Autosave when data changes sequentially
  useEffect(() => {
    if (!isLoaded) return;
    setSaving(true);
    const timer = setTimeout(() => {
      localforage.setItem('rms_doc_draft', { title, content }).then(() => setSaving(false));
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, content, isLoaded]);

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean'],
    ],
  };

  const handleExport = useCallback(async (type) => {
    const el = printRef.current;
    if (!el) return;

    if (type === 'pdf') {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${title}.pdf`);
    }

    if (type === 'png') {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${title}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }

    if (type === 'html') {
      const blob = new Blob([`<html><head><title>${title}</title><style>body{font-family:sans-serif;color:#333;}</style></head><body>${content}</body></html>`], { type: 'text/html' });
      const link = document.createElement('a');
      link.download = `${title}.html`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }

    if (type === 'txt') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      const blob = new Blob([text], { type: 'text/plain' });
      const link = document.createElement('a');
      link.download = `${title}.txt`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  }, [title, content]);

  const exportFormats = [
    { type: 'pdf', label: 'Export as PDF', icon: File },
    { type: 'png', label: 'Export as PNG Image', icon: FileImage },
    { type: 'html', label: 'Export as HTML', icon: FileText },
    { type: 'txt', label: 'Export as Plain Text', icon: FileText },
  ];

  if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse font-mono tracking-widest text-xs">Loading Offline Draft Cache...</div>;

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
        <ExportMenu onExport={handleExport} formats={exportFormats} />
      </div>

      {/* Printable Area */}
      <div ref={printRef} className="glass bg-white border border-border/50 rounded-2xl p-8 min-h-[600px] shadow-sm relative z-10">
        <div className="mb-6 pb-4 border-b border-border/50">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-[10px] text-muted-foreground font-mono mt-1">CSS Group Holding — Internal Document</p>
        </div>
        <ReactQuill
          theme="snow"
          value={content}
          onChange={setContent}
          modules={quillModules}
          placeholder="Start typing your document content here..."
          className="rms-quill-editor relative z-10"
        />
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// ── SPREADSHEET EDITOR ───────────────────────
// ══════════════════════════════════════════════
const SpreadsheetEditor = () => {
  const [title, setTitle] = useState('Untitled Spreadsheet');
  const [columns, setColumns] = useState(['Item', 'Description', 'Quantity', 'Unit Price (₦)', 'Total (₦)']);
  const [rows, setRows] = useState([
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ]);
  const [saving, setSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from offline storage
  useEffect(() => {
    localforage.getItem('rms_sheet_draft').then(draft => {
      if (draft) {
        setTitle(draft.title || 'Untitled Spreadsheet');
        setColumns(draft.columns || ['Item', 'Description', 'Quantity', 'Unit Price (₦)', 'Total (₦)']);
        setRows(draft.rows || [['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', '']]);
      }
      setIsLoaded(true);
    });
  }, []);

  // Autosave
  useEffect(() => {
    if (!isLoaded) return;
    setSaving(true);
    const timer = setTimeout(() => {
      localforage.setItem('rms_sheet_draft', { title, columns, rows }).then(() => setSaving(false));
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, columns, rows, isLoaded]);

  const updateCell = (rowIdx, colIdx, value) => {
    const updated = rows.map((r, ri) => ri === rowIdx ? r.map((c, ci) => ci === colIdx ? value : c) : r);
    setRows(updated);
  };

  const addRow = () => setRows([...rows, Array(columns.length).fill('')]);
  const removeRow = (idx) => setRows(rows.filter((_, i) => i !== idx));
  const addColumn = () => {
    setColumns([...columns, `Column ${columns.length + 1}`]);
    setRows(rows.map(r => [...r, '']));
  };

  const handleExport = useCallback((type) => {
    const wsData = [columns, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    if (type === 'xlsx') {
      XLSX.writeFile(wb, `${title}.xlsx`);
    }
    if (type === 'csv') {
      XLSX.writeFile(wb, `${title}.csv`, { bookType: 'csv' });
    }
    if (type === 'pdf') {
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.setFontSize(16);
      pdf.text(title, 14, 20);
      pdf.setFontSize(8);
      pdf.text('CSS Group Holding — Generated Spreadsheet', 14, 26);
      
      const startY = 35;
      const cellW = (pdf.internal.pageSize.getWidth() - 28) / columns.length;
      const cellH = 10;

      // Header
      pdf.setFillColor(240, 240, 245);
      pdf.setTextColor(30, 30, 40);
      pdf.setFontSize(9);
      columns.forEach((col, ci) => {
        pdf.rect(14 + ci * cellW, startY, cellW, cellH, 'F');
        pdf.text(col, 14 + ci * cellW + 3, startY + 7);
      });

      // Body
      pdf.setTextColor(60, 60, 70);
      pdf.setFontSize(8);
      rows.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          pdf.rect(14 + ci * cellW, startY + (ri + 1) * cellH, cellW, cellH);
          pdf.text(String(cell || ''), 14 + ci * cellW + 3, startY + (ri + 1) * cellH + 7);
        });
      });

      pdf.save(`${title}.pdf`);
    }
  }, [title, columns, rows]);

  const exportFormats = [
    { type: 'xlsx', label: 'Export as Excel (.xlsx)', icon: FileSpreadsheet },
    { type: 'csv', label: 'Export as CSV', icon: FileText },
    { type: 'pdf', label: 'Export as PDF', icon: File },
  ];

  if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse font-mono tracking-widest text-xs">Loading Offline Draft Cache...</div>;

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
        <ExportMenu onExport={handleExport} formats={exportFormats} />
      </div>

      <div className="glass bg-white/70 border border-border/50 rounded-2xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center space-x-2 p-3 border-b border-border/50 bg-white/50 relative z-20">
          <button onClick={addRow} className="flex items-center space-x-1.5 text-xs font-bold text-muted-foreground hover:text-foreground bg-white/80 hover:bg-muted shadow-sm px-3 py-2 rounded-lg transition-all border border-border/50">
            <Plus size={14} /> <span>Add Row</span>
          </button>
          <button onClick={addColumn} className="flex items-center space-x-1.5 text-xs font-bold text-muted-foreground hover:text-foreground bg-white/80 hover:bg-muted shadow-sm px-3 py-2 rounded-lg transition-all border border-border/50">
            <Columns size={14} /> <span>Add Column</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar relative z-10">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-10 p-3 text-muted-foreground text-[10px] font-mono bg-muted/30">#</th>
                {columns.map((col, ci) => (
                  <th key={ci} className="p-0 border-l border-border/50 bg-muted/30">
                    <input
                      value={col}
                      onChange={(e) => {
                        const updated = [...columns];
                        updated[ci] = e.target.value;
                        setColumns(updated);
                      }}
                      className="w-full bg-transparent text-primary text-xs font-bold px-4 py-3 outline-none focus:bg-white/80 transition-all text-center"
                    />
                  </th>
                ))}
                <th className="w-10 bg-muted/30"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border/50 hover:bg-white transition-colors bg-white/40">
                  <td className="p-3 text-muted-foreground text-[10px] font-mono text-center">{ri + 1}</td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-0 border-l border-border/50">
                      <input
                        value={cell}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className="w-full bg-transparent text-foreground text-sm px-4 py-3 outline-none focus:bg-white/90 transition-all"
                        placeholder="—"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center border-l border-border/50">
                    <button onClick={() => removeRow(ri)} className="text-muted-foreground hover:text-destructive transition-colors p-1 bg-white/80 rounded-md border border-border/50 shadow-sm">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// ── MAIN DOCUMENT STUDIO ─────────────────────
// ══════════════════════════════════════════════
const DocumentStudio = ({ user, onViewChange }) => {
  const [activeTab, setActiveTab] = useState('doc');

  return (
    <Layout user={user} currentView="document_studio" onViewChange={onViewChange}>
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            Document <span className="text-primary italic">Studio</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create, edit, and export documents and spreadsheets effortlessly with <span className="text-emerald-500 font-bold">Offline Auto-Save</span>.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-3 p-1.5 glass bg-white/80 border border-border/50 rounded-2xl w-fit shadow-sm">
          <TabButton icon={FileText} label="Document Editor" active={activeTab === 'doc'} onClick={() => setActiveTab('doc')} />
          <TabButton icon={Table} label="Spreadsheet" active={activeTab === 'sheet'} onClick={() => setActiveTab('sheet')} />
        </div>

        {/* Active Editor */}
        {activeTab === 'doc' && <RichTextEditor />}
        {activeTab === 'sheet' && <SpreadsheetEditor />}
      </div>
    </Layout>
  );
};

export default DocumentStudio;
