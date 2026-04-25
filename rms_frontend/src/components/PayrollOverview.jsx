import { useState, useEffect } from 'react';
import { hrAPI } from '../lib/api';
import {
  DollarSign, ChevronLeft, ChevronRight, Download,
  CheckCircle2, Clock, AlertTriangle, Printer,
  X, FileText, Users
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const fmt = (v) => `₦${Number(v || 0).toLocaleString()}`;

const STATUS_COLORS = {
  paid:    'bg-emerald-50 border-emerald-200 text-emerald-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  failed:  'bg-red-50 border-red-200 text-red-700',
};

const generatePayslipPDF = (record, month, year) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(32, 110, 51);
  doc.rect(0, 0, w, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CSS GROUP', 14, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('PAYSLIP', 14, 24);
  doc.text(`${MONTHS[month - 1]} ${year}`, 14, 31);

  // Right side
  doc.setFontSize(9);
  doc.text(`Employee ID: ${record.employeeId || '—'}`, w - 14, 16, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, w - 14, 24, { align: 'right' });

  // Employee block
  doc.setTextColor(30, 30, 30);
  doc.setFillColor(245, 247, 245);
  doc.rect(14, 48, w - 28, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`${record.employeeName || record.firstName + ' ' + record.lastName || '—'}`, 20, 58);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Position: ${record.jobTitle || '—'}`, 20, 65);
  doc.text(`Department: ${record.department || '—'}`, 20, 71);

  // Earnings
  let y = 88;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(32, 110, 51);
  doc.text('EARNINGS', 14, y);
  doc.setDrawColor(32, 110, 51);
  doc.line(14, y + 2, w - 14, y + 2);
  y += 8;

  const earnings = [
    ['Basic Salary',   record.basicSalary   || 0],
    ['Housing Allow.', record.housing       || 0],
    ['Transport Allow.',record.transport    || 0],
    ['Medical Allow.', record.medical       || 0],
    ['Other Allowance',record.otherAllowance || 0],
  ];
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  earnings.forEach(([label, val]) => {
    doc.text(label, 20, y);
    doc.text(fmt(val), w - 14, y, { align: 'right' });
    y += 7;
  });

  const grossEarnings = earnings.reduce((s, [, v]) => s + Number(v), 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(32, 110, 51, 0.08);
  doc.rect(14, y, w - 28, 10, 'F');
  doc.text('Gross Earnings', 20, y + 7);
  doc.text(fmt(grossEarnings), w - 14, y + 7, { align: 'right' });
  y += 16;

  // Deductions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(200, 50, 50);
  doc.text('DEDUCTIONS', 14, y);
  doc.setDrawColor(200, 50, 50);
  doc.line(14, y + 2, w - 14, y + 2);
  y += 8;

  const deductions = [
    ['Tax (PAYE)',    record.tax     || 0],
    ['NHF',          record.nhf     || 0],
    ['Pension',      record.pension || 0],
    ['Other Deductions', record.otherDeductions || 0],
  ];
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  deductions.forEach(([label, val]) => {
    doc.text(label, 20, y);
    doc.text(fmt(val), w - 14, y, { align: 'right' });
    y += 7;
  });

  const totalDeductions = deductions.reduce((s, [, v]) => s + Number(v), 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(255, 50, 50, 0.05);
  doc.rect(14, y, w - 28, 10, 'F');
  doc.text('Total Deductions', 20, y + 7);
  doc.text(fmt(totalDeductions), w - 14, y + 7, { align: 'right' });
  y += 18;

  // Net Pay
  const netPay = record.netPay || (grossEarnings - totalDeductions);
  doc.setFillColor(32, 110, 51);
  doc.rect(14, y, w - 28, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NET PAY', 20, y + 11);
  doc.text(fmt(netPay), w - 14, y + 11, { align: 'right' });
  y += 24;

  // Footer
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('This is a computer-generated payslip and requires no signature.', w / 2, y + 8, { align: 'center' });
  doc.text('CSS Group · HR Department · Confidential', w / 2, y + 14, { align: 'center' });

  doc.save(`Payslip_${record.employeeName || record.id}_${MONTHS[month - 1]}_${year}.pdf`);
};

const PayrollOverview = ({ onViewChange }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await hrAPI.getPayroll({ year, month });
      const data = Array.isArray(res) ? res : (res?.results || []);
      setPayroll(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const totalPayroll = payroll.reduce((s, r) => s + Number(r.netPay || r.basicSalary || 0), 0);
  const avgSalary = payroll.length ? Math.round(totalPayroll / payroll.length) : 0;
  const paidCount = payroll.filter(r => r.status === 'paid').length;
  const pendingCount = payroll.filter(r => r.status !== 'paid').length;

  const handleProcessAll = async () => {
    setProcessing(true);
    try {
      await hrAPI.processPayroll(month, year);
      toast.success(`Payroll processed for ${MONTHS[month - 1]} ${year}.`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Payroll processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async (record) => {
    try {
      await hrAPI.markPayslipPaid(record.id);
      toast.success(`${record.employeeName || 'Employee'} marked as paid.`);
      load();
    } catch (err) {
      toast.error('Failed to update payment status.');
    }
  };

  return (
    <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up px-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
            Payroll <span className="text-primary italic font-serif">Overview</span>
          </h1>
          <p className="text-muted-foreground text-[13px] font-medium">
            {MONTHS[month - 1]} {year} · {payroll.length} employee{payroll.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleProcessAll}
            disabled={processing || payroll.length === 0}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 shrink-0"
          >
            <DollarSign size={15} /> {processing ? 'Processing…' : 'Process Payroll'}
          </button>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex items-center justify-between">
        <button onClick={prevMonth} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground tracking-tighter">{MONTHS[month - 1]} {year}</h2>
          <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{paidCount} paid · {pendingCount} pending</p>
        </div>
        <button onClick={nextMonth} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Payroll',     value: fmt(totalPayroll), icon: DollarSign,   color: 'green'   },
          { label: 'Average Salary',    value: fmt(avgSalary),    icon: Users,         color: 'blue'    },
          { label: 'Employees Paid',    value: paidCount,         icon: CheckCircle2,  color: 'emerald' },
          { label: 'Pending Payment',   value: pendingCount,      icon: Clock,         color: 'amber'   },
        ].map(s => (
          <div key={s.label} className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-11 h-11 rounded-2xl bg-${s.color}-500/10 border border-${s.color}-500/20 text-${s.color}-600 flex items-center justify-center shrink-0`}>
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">{s.label}</p>
              <p className="text-xl font-black text-foreground tracking-tighter">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Payroll Table */}
      <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 p-1 shadow-2xl shadow-primary/5 overflow-hidden">
        <div className="bg-[#FAF9F6]/30 rounded-[1.8rem] p-4 lg:p-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted/40 rounded-2xl animate-pulse" />)}
            </div>
          ) : payroll.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-40">
                <FileText size={32} className="text-muted-foreground" />
              </div>
              <p className="text-xl font-black text-foreground">No Payroll Records</p>
              <p className="text-sm text-muted-foreground">Process payroll to generate records for {MONTHS[month - 1]} {year}.</p>
              <button onClick={handleProcessAll} disabled={processing} className="mx-auto flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50">
                <DollarSign size={14} /> Run Payroll
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="pb-4 px-5">Employee</th>
                    <th className="pb-4 px-5">Department</th>
                    <th className="pb-4 px-5 text-right">Basic</th>
                    <th className="pb-4 px-5 text-right">Allowances</th>
                    <th className="pb-4 px-5 text-right">Deductions</th>
                    <th className="pb-4 px-5 text-right">Net Pay</th>
                    <th className="pb-4 px-5">Status</th>
                    <th className="pb-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map(rec => {
                    const allowances = Number(rec.housing || 0) + Number(rec.transport || 0) + Number(rec.medical || 0) + Number(rec.otherAllowance || 0);
                    const deductions = Number(rec.tax || 0) + Number(rec.nhf || 0) + Number(rec.pension || 0) + Number(rec.otherDeductions || 0);
                    const netPay = rec.netPay || (Number(rec.basicSalary || 0) + allowances - deductions);
                    return (
                      <tr key={rec.id} className="group transition-all">
                        <td className="py-3 px-5 bg-white/50 border-y border-l border-border/30 rounded-l-2xl group-hover:bg-white transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                              {(rec.employeeName || rec.firstName || 'E').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[12px] font-bold text-foreground">{rec.employeeName || `${rec.firstName || ''} ${rec.lastName || ''}`}</p>
                              <p className="text-[9px] text-muted-foreground/60 font-mono">{rec.jobTitle || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <span className="text-[11px] font-medium text-muted-foreground">{rec.department || '—'}</span>
                        </td>
                        <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors text-right">
                          <span className="text-[12px] font-bold text-foreground font-mono">{fmt(rec.basicSalary)}</span>
                        </td>
                        <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors text-right">
                          <span className="text-[12px] font-bold text-emerald-600 font-mono">+{fmt(allowances)}</span>
                        </td>
                        <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors text-right">
                          <span className="text-[12px] font-bold text-red-500 font-mono">-{fmt(deductions)}</span>
                        </td>
                        <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors text-right">
                          <span className="text-[14px] font-black text-foreground font-mono">{fmt(netPay)}</span>
                        </td>
                        <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${STATUS_COLORS[rec.status] || STATUS_COLORS.pending}`}>
                            {rec.status || 'pending'}
                          </span>
                        </td>
                        <td className="py-3 px-5 bg-white/50 border-y border-r border-border/30 rounded-r-2xl group-hover:bg-white transition-colors">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setDetailRecord({ ...rec, netPay, allowances, deductions })}
                              title="Preview Payslip"
                              className="p-1.5 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-border/40"
                            >
                              <FileText size={13} />
                            </button>
                            <button
                              onClick={() => generatePayslipPDF({ ...rec, netPay }, month, year)}
                              title="Download PDF"
                              className="p-1.5 rounded-lg bg-primary/5 hover:bg-primary text-primary hover:text-white transition-colors border border-primary/20"
                            >
                              <Download size={13} />
                            </button>
                            {rec.status !== 'paid' && (
                              <button
                                onClick={() => handleMarkPaid(rec)}
                                title="Mark as Paid"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-colors border border-emerald-200"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-right">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Net Payroll</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-[16px] font-black text-primary font-mono">{fmt(totalPayroll)}</span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payslip Preview Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetailRecord(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setDetailRecord(null)} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
              <X size={16} />
            </button>

            {/* Header */}
            <div className="bg-primary rounded-2xl p-4 text-white text-center space-y-0.5">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-70">CSS Group</p>
              <p className="text-lg font-black">PAYSLIP</p>
              <p className="text-[10px] font-medium opacity-80">{MONTHS[month - 1]} {year}</p>
            </div>

            <div className="bg-muted/30 rounded-xl p-3 space-y-0.5">
              <p className="text-[13px] font-black text-foreground">{detailRecord.employeeName || `${detailRecord.firstName || ''} ${detailRecord.lastName || ''}`}</p>
              <p className="text-[10px] text-muted-foreground">{detailRecord.jobTitle || '—'} · {detailRecord.department || '—'}</p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Earnings</p>
              {[
                ['Basic Salary', detailRecord.basicSalary],
                ['Housing Allowance', detailRecord.housing],
                ['Transport Allowance', detailRecord.transport],
                ['Medical Allowance', detailRecord.medical],
                ['Other Allowance', detailRecord.otherAllowance],
              ].filter(([, v]) => Number(v) > 0).map(([l, v]) => (
                <div key={l} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{l}</span>
                  <span className="font-bold text-foreground">{fmt(v)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-border/30 pt-3">
              <p className="text-[10px] font-black text-destructive uppercase tracking-widest">Deductions</p>
              {[
                ['Tax (PAYE)', detailRecord.tax],
                ['NHF', detailRecord.nhf],
                ['Pension', detailRecord.pension],
                ['Other', detailRecord.otherDeductions],
              ].filter(([, v]) => Number(v) > 0).map(([l, v]) => (
                <div key={l} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{l}</span>
                  <span className="font-bold text-red-600">-{fmt(v)}</span>
                </div>
              ))}
            </div>

            <div className="bg-primary rounded-2xl p-4 flex items-center justify-between">
              <span className="text-[11px] font-black text-white uppercase tracking-widest">Net Pay</span>
              <span className="text-xl font-black text-white">{fmt(detailRecord.netPay)}</span>
            </div>

            <button
              onClick={() => generatePayslipPDF(detailRecord, month, year)}
              className="w-full py-3 rounded-xl bg-primary/10 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Download size={14} /> Download PDF Payslip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollOverview;
