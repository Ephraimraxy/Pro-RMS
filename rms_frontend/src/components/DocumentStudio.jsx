import React, { useState, useRef, useCallback } from 'react';
import Layout from './Layout';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { 
  FileText, Table, Download, Plus, Trash2, Save, 
  FileSpreadsheet, FileImage, File, ChevronDown,
  Bold, Italic, AlignLeft, Type, Columns
} from 'lucide-react';

// ── Tab Button ──
const TabButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
      active 
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/10' 
        : 'text-zinc-500 hover:text-white hover:bg-white/5'
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
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
      >
        <Download size={16} />
        <span>Export</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 glass border border-white/10 rounded-2xl p-2 z-50 shadow-2xl">
          {formats.map(f => (
            <button
              key={f.type}
              onClick={() => { onExport(f.type); setOpen(false); }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-all"
            >
              <f.icon size={16} className="text-blue-400" />
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
// ── RICH TEXT EDITOR (Docs / Memos) ──────────
// ══════════════════════════════════════════════
const RichTextEditor = () => {
  const [title, setTitle] = useState('Untitled Document');
  const [content, setContent] = useState('');
  const printRef = useRef();

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
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0a0a0f' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${title}.pdf`);
    }

    if (type === 'png') {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0a0a0f' });
      const link = document.createElement('a');
      link.download = `${title}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }

    if (type === 'html') {
      const blob = new Blob([`<html><head><title>${title}</title></head><body>${content}</body></html>`], { type: 'text/html' });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-black text-white bg-transparent outline-none border-b-2 border-transparent focus:border-blue-500/50 transition-all pb-1 w-full max-w-lg"
          placeholder="Document Title..."
        />
        <ExportMenu onExport={handleExport} formats={exportFormats} />
      </div>

      {/* Printable Area */}
      <div ref={printRef} className="glass border border-white/10 rounded-2xl p-8 min-h-[600px]">
        <div className="mb-6 pb-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-[10px] text-zinc-600 font-mono mt-1">CSS Group Holding — Internal Document</p>
        </div>
        <ReactQuill
          theme="snow"
          value={content}
          onChange={setContent}
          modules={quillModules}
          placeholder="Start typing your document content here..."
          className="rms-quill-editor"
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
      pdf.setFillColor(30, 30, 50);
      pdf.setTextColor(100, 150, 255);
      pdf.setFontSize(9);
      columns.forEach((col, ci) => {
        pdf.rect(14 + ci * cellW, startY, cellW, cellH, 'F');
        pdf.text(col, 14 + ci * cellW + 3, startY + 7);
      });

      // Body
      pdf.setTextColor(200, 200, 210);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-black text-white bg-transparent outline-none border-b-2 border-transparent focus:border-blue-500/50 transition-all pb-1 w-full max-w-lg"
          placeholder="Spreadsheet Title..."
        />
        <ExportMenu onExport={handleExport} formats={exportFormats} />
      </div>

      <div className="glass border border-white/10 rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center space-x-2 p-3 border-b border-white/5">
          <button onClick={addRow} className="flex items-center space-x-1.5 text-xs font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-all">
            <Plus size={14} /> <span>Add Row</span>
          </button>
          <button onClick={addColumn} className="flex items-center space-x-1.5 text-xs font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-all">
            <Columns size={14} /> <span>Add Column</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-10 p-3 text-zinc-600 text-[10px] font-mono">#</th>
                {columns.map((col, ci) => (
                  <th key={ci} className="p-0 border-l border-white/5">
                    <input
                      value={col}
                      onChange={(e) => {
                        const updated = [...columns];
                        updated[ci] = e.target.value;
                        setColumns(updated);
                      }}
                      className="w-full bg-blue-600/5 text-blue-400 text-xs font-bold px-4 py-3 outline-none focus:bg-blue-600/10 transition-all"
                    />
                  </th>
                ))}
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-zinc-700 text-[10px] font-mono text-center">{ri + 1}</td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-0 border-l border-white/5">
                      <input
                        value={cell}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className="w-full bg-transparent text-zinc-300 text-sm px-4 py-3 outline-none focus:bg-white/5 transition-all"
                        placeholder="—"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <button onClick={() => removeRow(ri)} className="text-zinc-700 hover:text-red-400 transition-colors p-1">
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
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Document <span className="text-blue-500 italic">Studio</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Create, edit, and export documents and spreadsheets without leaving the portal.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-3 p-1.5 glass border border-white/5 rounded-2xl w-fit">
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
