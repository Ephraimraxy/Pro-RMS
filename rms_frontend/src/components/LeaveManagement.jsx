import { useState, useEffect } from 'react';
import { hrAPI } from '../lib/api';
import {
  CalendarDays, CheckCircle2, XCircle, Clock, Filter,
  Plus, X, MessageSquare, Eye, AlertCircle, ArrowRight,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const TABS = ['Pending', 'Approved', 'Rejected', 'All'];
const LEAVE_TYPES = ['Annual', 'Sick', 'Maternity', 'Paternity', 'Emergency', 'Compassionate', 'Study'];

const STATUS_COLORS = {
  pending:  'bg-amber-50 border-amber-200 text-amber-700',
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  rejected: 'bg-red-50 border-red-200 text-red-700',
};

const TYPE_COLORS = {
  Annual:       'bg-blue-50   border-blue-200   text-blue-700',
  Sick:         'bg-red-50    border-red-200    text-red-700',
  Maternity:    'bg-pink-50   border-pink-200   text-pink-700',
  Paternity:    'bg-indigo-50 border-indigo-200 text-indigo-700',
  Emergency:    'bg-orange-50 border-orange-200 text-orange-700',
  Compassionate:'bg-purple-50 border-purple-200 text-purple-700',
  Study:        'bg-teal-50   border-teal-200   text-teal-700',
};

const diffDays = (start, end) => {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / 86400000) + 1);
};

const Avatar = ({ name }) => {
  const initials = (name || 'E').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
};

const EMPTY_FORM = { employeeName: '', leaveType: 'Annual', startDate: '', endDate: '', reason: '' };

const LeaveManagement = ({ onViewChange }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionTarget, setActionTarget] = useState(null); // { leave, action: 'approve'|'reject' }
  const [remarks, setRemarks] = useState('');
  const [actioning, setActioning] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detailLeave, setDetailLeave] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await hrAPI.getLeaves();
      const data = Array.isArray(res) ? res : (res?.results || []);
      setLeaves(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = leaves.filter(lv => {
    const tabMatch =
      activeTab === 'All' ? true :
      activeTab === 'Pending'  ? lv.status === 'pending'  :
      activeTab === 'Approved' ? lv.status === 'approved' :
      activeTab === 'Rejected' ? lv.status === 'rejected' : true;
    const typeMatch = !typeFilter || lv.leaveType === typeFilter;
    return tabMatch && typeMatch;
  });

  const counts = {
    Pending:  leaves.filter(l => l.status === 'pending').length,
    Approved: leaves.filter(l => l.status === 'approved').length,
    Rejected: leaves.filter(l => l.status === 'rejected').length,
    All:      leaves.length,
  };

  const handleAction = async () => {
    if (!actionTarget) return;
    setActioning(true);
    try {
      if (actionTarget.action === 'approve') {
        await hrAPI.approveLeave(actionTarget.leave.id, remarks);
        toast.success('Leave approved.');
      } else {
        await hrAPI.rejectLeave(actionTarget.leave.id, remarks);
        toast.success('Leave rejected.');
      }
      setActionTarget(null);
      setRemarks('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed.');
    } finally {
      setActioning(false);
    }
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();
    if (!form.employeeName || !form.startDate || !form.endDate) {
      toast.error('Employee name, start and end date are required.');
      return;
    }
    setSaving(true);
    try {
      await hrAPI.createLeave(form);
      toast.success('Leave request created.');
      setShowAddForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create leave.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up px-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
            Leave <span className="text-primary italic font-serif">Management</span>
          </h1>
          <p className="text-muted-foreground text-[13px] font-medium">
            {counts.Pending} pending request{counts.Pending !== 1 ? 's' : ''} awaiting approval.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 shrink-0"
        >
          <Plus size={16} /> New Request
        </button>
      </div>

      {/* Stat Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`glass p-4 rounded-2xl border text-left transition-all ${activeTab === tab ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border/40 bg-white/70 hover:border-primary/20'}`}
          >
            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">{tab}</p>
            <p className="text-3xl font-black text-foreground tracking-tighter">{String(counts[tab] || 0).padStart(2, '0')}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex gap-2 flex-wrap flex-1">
          <button
            onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${!typeFilter ? 'bg-primary text-white border-primary' : 'bg-white border-border/50 text-muted-foreground hover:border-primary/40'}`}
          >
            All Types
          </button>
          {LEAVE_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${typeFilter === t ? 'bg-primary text-white border-primary' : 'bg-white border-border/50 text-muted-foreground hover:border-primary/40'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 p-1 shadow-2xl shadow-primary/5 overflow-hidden">
        <div className="bg-[#FAF9F6]/30 rounded-[1.8rem] p-4 lg:p-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted/40 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-xl font-black text-foreground tracking-tight">No Leave Requests</p>
              <p className="text-sm text-muted-foreground">No {activeTab.toLowerCase()} leave requests{typeFilter ? ` of type "${typeFilter}"` : ''}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="pb-4 px-5">Employee</th>
                    <th className="pb-4 px-5">Leave Type</th>
                    <th className="pb-4 px-5">Duration</th>
                    <th className="pb-4 px-5">Days</th>
                    <th className="pb-4 px-5">Reason</th>
                    <th className="pb-4 px-5">Status</th>
                    <th className="pb-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lv => (
                    <tr key={lv.id} className="group transition-all">
                      <td className="py-3 px-5 bg-white/50 border-y border-l border-border/30 rounded-l-2xl group-hover:bg-white transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar name={lv.employeeName || lv.employee?.name} />
                          <div>
                            <p className="text-[12px] font-bold text-foreground">{lv.employeeName || lv.employee?.name || '—'}</p>
                            <p className="text-[9px] text-muted-foreground/60 font-mono">{lv.department || lv.employee?.department || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${TYPE_COLORS[lv.leaveType] || 'bg-muted border-border text-muted-foreground'}`}>
                          {lv.leaveType || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <span>{lv.startDate ? new Date(lv.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</span>
                          <ArrowRight size={9} className="opacity-40" />
                          <span>{lv.endDate ? new Date(lv.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                        <span className="text-sm font-black text-foreground">{lv.days ?? diffDays(lv.startDate, lv.endDate)}</span>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors max-w-[200px]">
                        <p className="text-[11px] text-muted-foreground truncate">{lv.reason || '—'}</p>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${STATUS_COLORS[lv.status] || STATUS_COLORS.pending}`}>
                          {lv.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-r border-border/30 rounded-r-2xl group-hover:bg-white transition-colors">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailLeave(lv)}
                            className="p-1.5 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-border/40"
                            title="View Detail"
                          >
                            <Eye size={13} />
                          </button>
                          {lv.status === 'pending' && (
                            <>
                              <button
                                onClick={() => { setActionTarget({ leave: lv, action: 'approve' }); setRemarks(''); }}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-colors border border-emerald-200"
                                title="Approve"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                              <button
                                onClick={() => { setActionTarget({ leave: lv, action: 'reject' }); setRemarks(''); }}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-destructive text-destructive hover:text-white transition-colors border border-red-200"
                                title="Reject"
                              >
                                <XCircle size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Approve / Reject Modal */}
      {actionTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActionTarget(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${actionTarget.action === 'approve' ? 'bg-emerald-100 border border-emerald-200' : 'bg-red-100 border border-red-200'}`}>
              {actionTarget.action === 'approve'
                ? <CheckCircle2 size={28} className="text-emerald-600" />
                : <XCircle size={28} className="text-destructive" />}
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-foreground capitalize">
                {actionTarget.action} Leave Request
              </h3>
              <p className="text-[12px] text-muted-foreground">
                <strong>{actionTarget.leave.employeeName || actionTarget.leave.employee?.name}</strong> — {actionTarget.leave.leaveType}
                {' '}({actionTarget.leave.days ?? diffDays(actionTarget.leave.startDate, actionTarget.leave.endDate)} days)
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <MessageSquare size={11} /> Remarks {actionTarget.action === 'reject' && <span className="text-destructive">*</span>}
              </label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                placeholder={actionTarget.action === 'approve' ? 'Optional note for the employee…' : 'Reason for rejection…'}
                className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-muted/20 text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActionTarget(null)} className="flex-1 py-3 rounded-xl border border-border/50 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted transition-all">
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actioning || (actionTarget.action === 'reject' && !remarks.trim())}
                className={`flex-1 py-3 rounded-xl text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-60 active:scale-95 ${actionTarget.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-destructive hover:bg-destructive/90 shadow-destructive/20'}`}
              >
                {actioning ? 'Processing…' : `Confirm ${actionTarget.action === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailLeave && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailLeave(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <button onClick={() => setDetailLeave(null)} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
              <X size={16} />
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-foreground">Leave Detail</h3>
              <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${STATUS_COLORS[detailLeave.status] || STATUS_COLORS.pending}`}>
                {detailLeave.status}
              </span>
            </div>
            {[
              ['Employee', detailLeave.employeeName || detailLeave.employee?.name],
              ['Department', detailLeave.department || detailLeave.employee?.department],
              ['Leave Type', detailLeave.leaveType],
              ['Start Date', detailLeave.startDate ? new Date(detailLeave.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
              ['End Date',   detailLeave.endDate   ? new Date(detailLeave.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
              ['Total Days', detailLeave.days ?? diffDays(detailLeave.startDate, detailLeave.endDate)],
              ['Reason', detailLeave.reason],
              ['HR Remarks', detailLeave.remarks],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} className="flex items-start gap-3 border-b border-border/20 pb-2">
                <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest w-24 shrink-0 pt-0.5">{label}</p>
                <p className="text-[12px] font-medium text-foreground">{val}</p>
              </div>
            ))}
            {detailLeave.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setDetailLeave(null); setActionTarget({ leave: detailLeave, action: 'approve' }); setRemarks(''); }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={13} /> Approve
                </button>
                <button
                  onClick={() => { setDetailLeave(null); setActionTarget({ leave: detailLeave, action: 'reject' }); setRemarks(''); }}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-[10px] font-black uppercase tracking-widest hover:bg-destructive/90 transition-all flex items-center justify-center gap-1.5"
                >
                  <XCircle size={13} /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Leave Form Slide-In */}
      {showAddForm && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddForm(false)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto custom-scrollbar shadow-2xl animate-in slide-in-from-right-5 duration-300 flex flex-col">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-border/40 px-6 py-5 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-black text-foreground tracking-tight">New Leave Request</h2>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Create a leave request on behalf of an employee</p>
              </div>
              <button onClick={() => setShowAddForm(false)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddLeave} className="p-6 space-y-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Employee Name <span className="text-destructive">*</span></label>
                <input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))} required className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" placeholder="Full name…" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Leave Type</label>
                <select value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Start Date <span className="text-destructive">*</span></label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} required className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">End Date <span className="text-destructive">*</span></label>
                  <input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} required className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>
              {form.startDate && form.endDate && (
                <p className="text-[11px] font-black text-primary bg-primary/5 border border-primary/10 px-3 py-2 rounded-xl">
                  Duration: {diffDays(form.startDate, form.endDate)} working day(s)
                </p>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reason / Notes</label>
                <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={3} placeholder="Brief description…" className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 rounded-xl border border-border/50 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60 active:scale-95">
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
