import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, getRequisitions, isMemoRecord, isOperationalRequisition } from '../lib/store';
import { reqAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, ListFilter, Eye, AlertTriangle, ShieldCheck, ArrowRight, Paperclip, ChevronDown, ChevronUp, Send, BadgeCheck, RotateCcw, FileText } from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color, onClick }) => (
  <div onClick={onClick} className={`glass p-3.5 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-border/40 relative overflow-hidden group transition-all bg-white/70 shadow-sm ${onClick ? 'hover:border-primary/40 cursor-pointer hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]' : ''}`}>
    <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/5 blur-[60px] rounded-full translate-x-8 -translate-y-8`}></div>
    <div className="flex flex-col gap-2.5 sm:gap-4 relative z-10">
      <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-600 flex items-center justify-center group-hover:bg-${color}-500 group-hover:text-white transition-all duration-500 shadow-inner`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[8px] sm:text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-0.5 sm:mb-1 leading-tight">{label}</p>
        <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter leading-none">{value}</h3>
      </div>
    </div>
  </div>
);

const statusColors = {
  pending:    'bg-amber-50 border-amber-200 text-amber-700',
  approved:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  rejected:   'bg-red-50 border-red-200 text-red-700',
  draft:      'bg-muted border-border text-muted-foreground',
  // Final states
  vetting:    'bg-blue-50 border-blue-200 text-blue-700',
  treated:    'bg-indigo-50 border-indigo-200 text-indigo-700',
  published:  'bg-emerald-50 border-emerald-200 text-emerald-700',
};

const normalizeRole = (r) => (r || '').toLowerCase().replace(/\s+/g, '_');

// Normalize a requisition so department/creator are always strings, not nested objects.
const normalizeReq = (r) => ({
  ...r,
  department:       r.department?.name ?? r.department ?? r.departmentName ?? '',
  creator:          r.creator?.name    ?? r.creator    ?? r.creatorName    ?? '',
  currentStageName: r.currentStage?.name ?? '',
  finalState:       r.finalApprovalStatus ?? 'none',
});

const urgencyColors = {
  normal:   'text-muted-foreground',
  urgent:   'text-amber-600 font-bold',
  critical: 'text-red-600 font-bold',
};

const TYPE_FILTERS = ['All', 'Cash', 'Material', 'Memo'];

const matchesTypeFilter = (record, filter) => {
  if (filter === 'All') return true;
  if (filter === 'Memo') return isMemoRecord(record);
  return String(record?.type || '').toLowerCase().startsWith(filter.toLowerCase());
};

const Dashboard = ({ onViewChange }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalSpent: 0, memos: 0, memoPending: 0, memoPublished: 0 });
  const [recentPending, setRecentPending] = useState([]);
  const [ccReqs, setCcReqs] = useState([]);
  const [ccOpen, setCcOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [myReqs, setMyReqs] = useState([]);
  const [myStats, setMyStats] = useState({ submitted: 0, requisitions: 0, memos: 0, inProgress: 0, treated: 0, rejected: 0 });
  const [departments, setDepartments] = useState([]);

  const loadDashboard = async () => {
    const s = await getDashboardStats(user);
    setStats(s);
    const all = await getRequisitions({ scope: 'all' });
    const userDeptId = user.deptId ? Number(user.deptId) : null;
    const userDeptName = user.departmentName || '';
    const isAdmin = normalizeRole(user.role) === 'global_admin';
    const isExecutive = isAdmin ||
                      /ceo|chairman/i.test(userDeptName) ||
                      /general\s*manager|\bgm\b/i.test(userDeptName);

    const DONE_STATES = ['treated', 'published'];
    const pendingForMe = all.filter(r => {
      if (DONE_STATES.includes(r.finalApprovalStatus)) return false;
      if (isAdmin && !userDeptId) {
        return r.status === 'pending' || r.finalApprovalStatus === 'vetting' ||
          (r.status === 'approved' && (!r.finalApprovalStatus || r.finalApprovalStatus === 'none'));
      }
      const isTargeted = Number(r.targetDepartmentId) === userDeptId &&
        r.status === 'pending' &&
        (!r.finalApprovalStatus || r.finalApprovalStatus === 'none');
      const needsFinal = isExecutive && r.status === 'approved' && (!r.finalApprovalStatus || r.finalApprovalStatus === 'none');
      const isVetting = Number(r.currentVettingDeptId) === userDeptId && r.finalApprovalStatus === 'vetting';
      return isTargeted || needsFinal || isVetting;
    });
    setRecentPending(pendingForMe.slice(0, 5));

    // CC'd requisitions — tagged as observer
    if (user?.role === 'department' && userDeptId) {
      const cc = all.filter(r => isOperationalRequisition(r) && Array.isArray(r.tags) && r.tags.some(t => Number(t.deptId) === userDeptId));
      setCcReqs(cc);

      // My outgoing requests — created by this dept (excluding drafts for stats)
      const mine = all.filter(r => Number(r.departmentId) === userDeptId || Number(r.creatorDeptId) === userDeptId);
      const submitted = mine.filter(r => r.status !== 'draft');
      const inProgress = submitted.filter(r => !['treated', 'published', 'rejected'].includes(r.finalApprovalStatus) && r.status !== 'rejected');
      const treated = submitted.filter(r => ['treated', 'published'].includes(r.finalApprovalStatus));
      const rejected = submitted.filter(r => r.status === 'rejected');
      setMyStats({
        submitted: submitted.length,
        requisitions: submitted.filter(isOperationalRequisition).length,
        memos: submitted.filter(isMemoRecord).length,
        inProgress: inProgress.length,
        treated: treated.length,
        rejected: rejected.length
      });
      // Show last 10 sorted newest first (include drafts in the list for visibility)
      setMyReqs([...mine].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10));

      // Load departments for "Currently With" display
      try {
        const depts = await import('../lib/store').then(m => m.getDepartments());
        setDepartments(depts);
      } catch {}
    }
  };

  const [isDeptReady, setIsDeptReady] = useState(true);
  useEffect(() => {
    if (user?.role === 'department') {
      reqAPI.getDeptProfile().then(p => {
        setIsDeptReady(p.hasSignature && p.headEmail && p.headName);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Live sync — re-fetch dashboard data whenever any involved requisition changes
  useEffect(() => {
    if (!localStorage.getItem('rms_user')) return;
    let es;
    let reconnectTimer;

    const connect = async () => {
      try {
        const { ticket } = await reqAPI.getSseTicket();
        es = new EventSource(`/api/events?ticket=${encodeURIComponent(ticket)}`);
        es.addEventListener('requisition_updated', (e) => {
          const { id, action, fromDept, toDept } = JSON.parse(e.data);

          // Silently refresh all dashboard data
          loadDashboard();

          // Descriptive toast so the user knows what changed
          const label = (() => {
            if (!action) return `Req #${id} was updated`;
            if (action === 'forwarded')        return `📤 ${fromDept} forwarded Req #${id}${toDept ? ` → ${toDept}` : ''}`;
            if (action === 'returned')         return `↩️ ${fromDept} returned Req #${id}${toDept ? ` to ${toDept}` : ''}`;
            if (action === 'approved')         return `✅ ${fromDept} approved Req #${id}`;
            if (action === 'rejected')         return `❌ ${fromDept} rejected Req #${id}`;
            if (action === 'finally_approved') return `🏆 ${fromDept} finally approved Req #${id}`;
            if (action === 'sent_to_vetting')  return `📋 Req #${id} sent to vetting${toDept ? ` → ${toDept}` : ''}`;
            if (action === 'vetting_forwarded') return `📋 ${fromDept} forwarded Req #${id} in vetting`;
            if (action === 'treated')          return `✅ ${fromDept} treated Req #${id}`;
            return `Req #${id} was updated`;
          })();

          toast(label, {
            duration: 5000,
            style: { fontSize: '12px', fontWeight: '600' },
            id: `req-update-${id}`
          });
        });
        es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 8000); };
      } catch { reconnectTimer = setTimeout(connect, 15000); }
    };

    connect();
    return () => { es?.close(); clearTimeout(reconnectTimer); };
  }, []);

  const formatCurrency = (val) => {
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(0)}K`;
    return `₦${val.toLocaleString()}`;
  };

  return (
    <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up px-1">
        {user?.role === 'department' && !isDeptReady && (
          <div className="glass bg-amber-500/10 border border-amber-500/30 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-amber-500/10">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-[1.5rem] bg-amber-500/20 flex items-center justify-center text-amber-600 shadow-inner">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-amber-800 tracking-tight">Governance Setup Required</h2>
                <p className="text-sm text-amber-700/80 font-medium leading-relaxed max-w-xl">
                  Your department cannot initiate requisitions until the head official's profile and biological signature are registered in the system.
                </p>
              </div>
            </div>
            <button
               onClick={() => onViewChange('dept_profile')}
               className="bg-amber-600 hover:bg-amber-700 text-white font-black py-4 px-8 rounded-2xl transition-all shadow-xl shadow-amber-600/20 flex items-center gap-3 shrink-0 active:scale-95"
            >
              Complete Setup
              <ShieldCheck size={20} />
            </button>
          </div>
        )}

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter leading-tight">
            {user?.role === 'department' ? (
              <span>{user.name} <span className="text-primary italic font-serif">Unit Portal</span></span>
            ) : (
              <span>Oversight <span className="text-primary italic font-serif">Command</span></span>
            )}
          </h1>
          <p className="text-muted-foreground text-[13px] font-medium tracking-tight">
            {user?.role === 'department'
              ? `Operational control for the ${user.name} unit.`
              : `Monitoring CSS Group strategic operations.`}
          </p>
        </div>

        <div className={`grid gap-3 sm:gap-6 ${user?.role === 'department' ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2 lg:grid-cols-5'}`}>
          <StatCard label="Pending Actions" value={String(stats.pending).padStart(2, '0')} icon={Clock} color="orange" />
          <StatCard label="Approved Reqs" value={String(stats.approved).padStart(2, '0')} icon={CheckCircle2} color="emerald" onClick={() => onViewChange('requisitions')} />
          <StatCard label="Rejected Reqs" value={String(stats.rejected).padStart(2, '0')} icon={XCircle} color="red" onClick={() => onViewChange('requisitions')} />
          <StatCard label="Total Spent" value={formatCurrency(stats.totalSpent)} icon={ArrowUpRight} color="blue" />
          <StatCard label="Memo Traffic" value={String(stats.memos).padStart(2, '0')} icon={FileText} color="purple" onClick={() => onViewChange('memos')} />
          {user?.role === 'department' && (
            <div
              onClick={() => setCcOpen(o => !o)}
              className="glass p-3.5 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-amber-200/60 relative overflow-hidden group hover:border-amber-400/60 transition-all cursor-pointer bg-amber-50/60 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 active:scale-[0.98]"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-[60px] rounded-full translate-x-8 -translate-y-8" />
              <div className="flex flex-col gap-2.5 sm:gap-4 relative z-10">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Paperclip size={18} />
                </div>
                <div>
                  <p className="text-[8px] sm:text-[10px] font-black text-amber-700/60 uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-0.5 sm:mb-1 leading-tight">CC Inbox</p>
                  <div className="flex items-end gap-2">
                    <h3 className="text-2xl sm:text-4xl font-black text-amber-800 tracking-tighter leading-none">{String(ccReqs.length).padStart(2, '0')}</h3>
                    <span className="mb-1 text-amber-500">{ccOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Unified Content Card */}
        <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 p-1 shadow-2xl shadow-primary/5 overflow-hidden">
          <div className="bg-[#FAF9F6]/30 rounded-[1.8rem] p-4 lg:p-6 space-y-8">

            {/* ── CC Inbox — shown first when open ── */}
            {user?.role === 'department' && ccOpen && (
              <div className="space-y-4 pb-6 border-b border-amber-200/40 animate-in fade-in slide-in-from-top-3 duration-300">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    <h3 className="text-xl font-bold text-foreground tracking-tight">CC Inbox</h3>
                    <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.15em]">
                      {ccReqs.length} record{ccReqs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 font-medium">Requisitions shared with your department as a read-only observer</p>
                </div>

                {ccReqs.length === 0 ? (
                  <div className="py-14 text-center space-y-3">
                    <div className="w-14 h-14 bg-amber-500/10 border border-amber-200 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                      <Paperclip size={22} />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground">No CC'd requisitions yet.</p>
                    <p className="text-xs text-muted-foreground/60">When another department tags your unit as an observer, records will appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="pb-3 px-4">Ref</th>
                          <th className="pb-3 px-4">Type</th>
                          <th className="pb-3 px-4">Title</th>
                          <th className="pb-3 px-4">Amount</th>
                          <th className="pb-3 px-4">From → To</th>
                          <th className="pb-3 px-4">State</th>
                          <th className="pb-3 px-4">Tagged</th>
                          <th className="pb-3 px-4 text-right">View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ccReqs.map(r => {
                          const norm = normalizeReq(r);
                          const isMoneyReq = r.type === 'Cash' || (r.amount && r.amount > 0);
                          const myTag = r.tags?.find(t => Number(t.deptId) === Number(user.deptId));
                          const taggedAt = myTag?.taggedAt ? new Date(myTag.taggedAt).toLocaleDateString() : '—';

                          const stateLabel = (() => {
                            if (norm.status === 'draft') return { label: 'Draft', color: statusColors.draft };
                            if (norm.status === 'rejected') return { label: 'Rejected', color: statusColors.rejected };
                            if (norm.finalState === 'published') return { label: 'Published', color: statusColors.published };
                            if (norm.finalState === 'treated') return { label: 'Treated', color: statusColors.treated };
                            if (norm.finalState === 'vetting') return { label: 'Vetting', color: statusColors.vetting };
                            if (norm.finalState === 'approved' && norm.status === 'approved') return { label: 'Finally Approved', color: statusColors.approved };
                            if (norm.status === 'approved') return { label: 'Approved', color: statusColors.approved };
                            if (norm.status === 'pending') return { label: 'Pending', color: statusColors.pending };
                            return { label: norm.status, color: statusColors.pending };
                          })();

                          return (
                            <tr key={r.id} className="group transition-all">
                              <td className="py-3 px-4 bg-amber-50/50 border-y border-l border-amber-200/40 rounded-l-xl group-hover:bg-amber-50/80 transition-colors">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-amber-700 tracking-widest">#{r.id}</span>
                                  <span className="text-[9px] text-muted-foreground/50 font-mono italic">{new Date(r.createdAt).toLocaleDateString()}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 bg-amber-50/50 border-y border-amber-200/40 group-hover:bg-amber-50/80 transition-colors">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${r.type === 'Cash' ? 'bg-emerald-500' : r.type === 'Material' ? 'bg-primary' : 'bg-amber-500'}`} />
                                  <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{r.type}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 bg-amber-50/50 border-y border-amber-200/40 group-hover:bg-amber-50/80 transition-colors max-w-[180px]">
                                <p className="text-[11px] font-bold text-foreground truncate">{r.title}</p>
                                {r.urgency && r.urgency !== 'normal' && (
                                  <span className={`text-[8px] font-black uppercase ${urgencyColors[r.urgency]}`}>{r.urgency}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 bg-amber-50/50 border-y border-amber-200/40 group-hover:bg-amber-50/80 transition-colors">
                                {isMoneyReq
                                  ? <span className="text-[11px] font-black font-mono text-foreground">₦{Number(r.amount || 0).toLocaleString()}</span>
                                  : <span className="text-[9px] text-muted-foreground/50 italic">Non-financial</span>}
                              </td>
                              <td className="py-3 px-4 bg-amber-50/50 border-y border-amber-200/40 group-hover:bg-amber-50/80 transition-colors">
                                <div className="flex items-center gap-1 text-[9px]">
                                  <span className="font-bold text-muted-foreground/70 uppercase truncate max-w-[70px]">{norm.department}</span>
                                  {r.targetDepartment?.name && (
                                    <>
                                      <ArrowRight size={8} className="text-muted-foreground/30 shrink-0" />
                                      <span className="font-black text-primary uppercase truncate max-w-[70px]">{r.targetDepartment.name}</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 bg-amber-50/50 border-y border-amber-200/40 group-hover:bg-amber-50/80 transition-colors">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${stateLabel.color}`}>
                                  {stateLabel.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 bg-amber-50/50 border-y border-amber-200/40 group-hover:bg-amber-50/80 transition-colors">
                                <div className="flex items-center gap-1 text-[9px] text-amber-600/80">
                                  <Paperclip size={9} />
                                  <span className="font-mono">{taggedAt}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 bg-amber-50/50 border-y border-r border-amber-200/40 rounded-r-xl group-hover:bg-amber-50/80 transition-colors text-right">
                                <button
                                  onClick={() => onViewChange('requisitions', { reqId: r.id })}
                                  className="p-2 bg-amber-100 hover:bg-amber-500 hover:text-white rounded-xl text-amber-700 transition-all border border-amber-200/60 shadow-sm active:scale-90"
                                >
                                  <Eye size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Pending Queue */}
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-border/20 pb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  <h3 className="text-xl font-bold text-foreground tracking-tight">System Action Items</h3>
                  {recentPending.length > 0 && (
                    <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.15em] animate-pulse">Neural Alert</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onViewChange('requisitions')} className="px-4 py-2 rounded-xl bg-white border border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center gap-2 active:scale-95">
                    <ListFilter size={14} />
                    Requisitions
                  </button>
                  <button onClick={() => onViewChange('memos')} className="px-4 py-2 rounded-xl bg-white border border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all flex items-center gap-2 active:scale-95">
                    <FileText size={14} />
                    Memos
                  </button>
                </div>
              </div>

              {/* Type filter tabs */}
              <div className="flex gap-2 flex-wrap -mt-2">
                {TYPE_FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setTypeFilter(f)}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      typeFilter === f
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white border-border/50 text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {(() => {
                const filtered = recentPending.filter(r => matchesTypeFilter(r, typeFilter));
                return filtered.length === 0 ? null : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
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
                      {filtered.map(r => {
                        const isMoneyReq = r.type === 'Cash' || (r.amount && r.amount > 0);
                        return (
                        <tr key={r.id} className="group transition-all">
                          <td className="py-4 px-6 bg-white/50 border-y border-l border-border/30 rounded-l-2xl group-hover:bg-white transition-colors">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-primary tracking-widest mb-0.5">#{r.id}</span>
                              <span className="text-[10px] text-muted-foreground/60 font-mono italic">{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-2 h-2 rounded-full ${r.type === 'Cash' ? 'bg-emerald-500' : isMemoRecord(r) ? 'bg-amber-500' : 'bg-primary'} shadow-sm shadow-black/10`} />
                              <span className="text-xs font-black text-foreground uppercase tracking-widest">{r.type}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
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
                          <td className="py-4 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                             {isMoneyReq ? (
                               <span className="text-sm font-black text-foreground font-mono">₦{Number(r.amount || 0).toLocaleString()}</span>
                             ) : (
                               <span className="text-[10px] text-muted-foreground/50 italic">Non-financial</span>
                             )}
                          </td>
                          <td className="py-4 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
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
                          <td className="py-4 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                            <div className="flex flex-col gap-1">
                              {(() => {
                                const norm = normalizeReq(r);
                                const details = (() => {
                                  if (norm.status === 'draft') return { label: 'Draft', color: statusColors.draft };
                                  if (norm.status === 'rejected') return { label: 'Rejected', color: statusColors.rejected };
                                  
                                  // Sub-workflow Statuses
                                  if (norm.finalState === 'published') return { label: 'Published', color: statusColors.published };
                                  if (norm.finalState === 'treated')   return { label: 'Treated', color: statusColors.treated };
                                  if (norm.finalState === 'vetting')   return { label: 'Vetting', color: statusColors.vetting };
                                  if (norm.finalState === 'approved' && norm.status === 'approved') return { label: 'Final Approved', color: statusColors.approved };
                                  
                                  if (norm.status === 'approved') return { label: 'Approved (Internal)', color: statusColors.approved };
                                  
                                  if (norm.status === 'pending') {
                                    return { 
                                      label:  norm.currentStageName ? `At: ${norm.currentStageName}` : 'Pending', 
                                      color:  statusColors.pending,
                                      sub:    norm.currentStageName ? 'Review Pending' : null
                                    };
                                  }
                                  return { label: norm.status, color: statusColors.pending };
                                })();

                                return (
                                  <>
                                    <span className={`w-fit px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${details.color}`}>
                                      {details.label}
                                    </span>
                                    {details.sub && (
                                      <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter truncate max-w-[100px]">
                                        {details.sub}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-4 px-6 bg-white/50 border-y border-r border-border/30 rounded-r-2xl group-hover:bg-white transition-colors text-right">
                            <button onClick={() => isMemoRecord(r) ? onViewChange('memos') : onViewChange('requisitions', { reqId: r.id })} className="p-2.5 bg-background hover:bg-primary hover:text-white rounded-xl text-primary transition-all border border-primary/10 shadow-sm active:scale-90">
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              );
              })()}
            </div>

            {/* ── My Outgoing Requests — department users only ── */}
            {user?.role === 'department' && (
              <div className="space-y-6 pt-6 border-t border-border/20">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                    <h3 className="text-xl font-bold text-foreground tracking-tight">My Outgoing Records</h3>
                    <span className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.15em]">
                      {myStats.submitted} submitted
                    </span>
                    <span className="bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.15em]">
                      {myStats.requisitions} req / {myStats.memos} memo
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onViewChange('requisitions')} className="px-4 py-1.5 rounded-xl bg-white border border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all flex items-center gap-2 active:scale-95">
                      <ListFilter size={12} /> Reqs
                    </button>
                    <button onClick={() => onViewChange('memos')} className="px-4 py-1.5 rounded-xl bg-white border border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all flex items-center gap-2 active:scale-95">
                      <FileText size={12} /> Memos
                    </button>
                  </div>
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Submitted', value: myStats.submitted, icon: Send, color: 'blue' },
                    { label: 'In Progress', value: myStats.inProgress, icon: RotateCcw, color: 'amber' },
                    { label: 'Treated', value: myStats.treated, icon: BadgeCheck, color: 'emerald' },
                    { label: 'Rejected', value: myStats.rejected, icon: XCircle, color: 'red' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`flex items-center gap-3 p-3 rounded-2xl bg-${color}-50/60 border border-${color}-200/50`}>
                      <div className={`w-9 h-9 rounded-xl bg-${color}-500/10 flex items-center justify-center text-${color}-600 shrink-0`}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">{label}</p>
                        <p className={`text-xl font-black text-${color}-700 tracking-tighter leading-none`}>{String(value).padStart(2, '0')}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent outgoing requests list */}
                {myReqs.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-14 h-14 bg-blue-500/10 border border-blue-200 text-blue-400 rounded-full flex items-center justify-center mx-auto">
                      <Send size={22} />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground">No outgoing records created yet.</p>
                    <p className="text-xs text-muted-foreground/60">Cash/material requisitions and memos you create will appear here with live status tracking.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="pb-3 px-4">Ref</th>
                          <th className="pb-3 px-4">Type</th>
                          <th className="pb-3 px-4">Title</th>
                          <th className="pb-3 px-4">Amount</th>
                          <th className="pb-3 px-4">Currently With</th>
                          <th className="pb-3 px-4">Status</th>
                          <th className="pb-3 px-4 text-right">View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myReqs.map(r => {
                          const norm = normalizeReq(r);
                          const isMoneyReq = r.type === 'Cash' || (r.amount && r.amount > 0);

                          // Resolve "Currently With" label
                          const currentlyWith = (() => {
                            if (r.status === 'draft') return { label: 'Not Submitted', color: 'text-muted-foreground' };
                            if (r.status === 'rejected') return { label: 'Rejected', color: 'text-red-600' };
                            if (['treated', 'published'].includes(r.finalApprovalStatus)) return { label: 'Completed', color: 'text-emerald-600' };
                            if (r.finalApprovalStatus === 'vetting') {
                              const vDept = departments.find(d => d.id === Number(r.currentVettingDeptId));
                              return { label: vDept?.name || 'Vetting Dept', color: 'text-purple-600' };
                            }
                            const tDept = departments.find(d => d.id === Number(r.targetDepartmentId));
                            return { label: tDept?.name || 'Processing', color: 'text-blue-600' };
                          })();

                          const stateInfo = (() => {
                            if (norm.status === 'draft') return { label: 'Draft', color: statusColors.draft };
                            if (norm.status === 'rejected') return { label: 'Rejected', color: statusColors.rejected };
                            if (norm.finalState === 'published') return { label: 'Published', color: statusColors.published };
                            if (norm.finalState === 'treated') return { label: 'Treated', color: statusColors.treated };
                            if (norm.finalState === 'vetting') return { label: 'In Vetting', color: statusColors.vetting };
                            if (norm.finalState === 'approved') return { label: 'Finally Approved', color: statusColors.approved };
                            if (norm.status === 'approved') return { label: 'Approved', color: statusColors.approved };
                            if (norm.status === 'pending') return { label: 'Pending', color: statusColors.pending };
                            return { label: norm.status, color: statusColors.pending };
                          })();

                          return (
                            <tr key={r.id} className="group transition-all">
                              <td className="py-3 px-4 bg-blue-50/30 border-y border-l border-blue-100/60 rounded-l-xl group-hover:bg-blue-50/60 transition-colors">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-blue-600 tracking-widest">#{r.id}</span>
                                  <span className="text-[9px] text-muted-foreground/50 font-mono italic">{new Date(r.createdAt).toLocaleDateString()}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 bg-blue-50/30 border-y border-blue-100/60 group-hover:bg-blue-50/60 transition-colors">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${r.type === 'Cash' ? 'bg-emerald-500' : r.type === 'Material' ? 'bg-primary' : 'bg-amber-500'}`} />
                                  <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{r.type}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 bg-blue-50/30 border-y border-blue-100/60 group-hover:bg-blue-50/60 transition-colors max-w-[200px]">
                                <p className="text-[11px] font-bold text-foreground truncate">{r.title}</p>
                                {r.urgency && r.urgency !== 'normal' && (
                                  <span className={`text-[8px] font-black uppercase ${urgencyColors[r.urgency]}`}>{r.urgency}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 bg-blue-50/30 border-y border-blue-100/60 group-hover:bg-blue-50/60 transition-colors">
                                {isMoneyReq
                                  ? <span className="text-[11px] font-black font-mono text-foreground">₦{Number(r.amount || 0).toLocaleString()}</span>
                                  : <span className="text-[9px] text-muted-foreground/50 italic">—</span>}
                              </td>
                              <td className="py-3 px-4 bg-blue-50/30 border-y border-blue-100/60 group-hover:bg-blue-50/60 transition-colors">
                                <span className={`text-[10px] font-black ${currentlyWith.color}`}>{currentlyWith.label}</span>
                              </td>
                              <td className="py-3 px-4 bg-blue-50/30 border-y border-blue-100/60 group-hover:bg-blue-50/60 transition-colors">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${stateInfo.color}`}>
                                  {stateInfo.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 bg-blue-50/30 border-y border-r border-blue-100/60 rounded-r-xl group-hover:bg-blue-50/60 transition-colors text-right">
                                <button
                                  onClick={() => isMemoRecord(r) ? onViewChange('memos') : onViewChange('requisitions', { reqId: r.id })}
                                  className="p-2 bg-white hover:bg-blue-500 hover:text-white rounded-xl text-blue-500 transition-all border border-blue-200/60 shadow-sm active:scale-90"
                                >
                                  <Eye size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}


          </div>
        </div>
      </div>
  );
};

export default Dashboard;
