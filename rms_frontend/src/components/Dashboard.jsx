import { useState, useEffect } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, getRequisitions } from '../lib/store';
import { reqAPI } from '../lib/api';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, ListFilter, Eye, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color, onClick }) => (
  <div onClick={onClick} className="glass p-5 rounded-[2rem] border border-border/40 relative overflow-hidden group hover:border-primary/40 transition-all cursor-pointer bg-white/70 shadow-sm hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]">
    <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/5 blur-[80px] rounded-full translate-x-12 -translate-y-12`}></div>
    <div className="flex flex-col gap-4 relative z-10">
      <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-600 flex items-center justify-center group-hover:bg-${color}-500 group-hover:text-white transition-all duration-500 shadow-inner`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-1">{label}</p>
        <h3 className="text-4xl font-black text-foreground tracking-tighter leading-none">{value}</h3>
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

const Dashboard = ({ onViewChange }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalSpent: 0 });
  const [recentPending, setRecentPending] = useState([]);

  const loadDashboard = async () => {
    const s = await getDashboardStats(user);
    setStats(s);
    const all = await getRequisitions();
    const userDeptId = Number(user.deptId);
    const userDeptName = user.departmentName || '';
    const isAdmin = normalizeRole(user.role) === 'global_admin';
    const isExecutive = isAdmin || 
                      /ceo|chairman/i.test(userDeptName) || 
                      /general\s*manager|\bgm\b/i.test(userDeptName);

    const pendingForMe = all.filter(r => {
      // 1. Standard internal approval path
      const isTargeted = Number(r.targetDepartmentId) === userDeptId && r.status === 'pending';
      // 2. Final Approval path (for Chairman/GM/Admin)
      const needsFinal = isExecutive && r.status === 'approved' && (!r.finalApprovalStatus || r.finalApprovalStatus === 'none');
      // 3. Vetting path
      const isVetting = Number(r.currentVettingDeptId) === userDeptId && r.finalApprovalStatus === 'vetting';
      
      return isTargeted || needsFinal || isVetting;
    });
    setRecentPending(pendingForMe.slice(0, 5));
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

  const formatCurrency = (val) => {
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(0)}K`;
    return `₦${val.toLocaleString()}`;
  };

  return (
    <Layout user={user} currentView="dashboard" onViewChange={onViewChange}>
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
          <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Pending Approval" value={String(stats.pending).padStart(2, '0')} icon={Clock} color="orange" onClick={() => onViewChange('requisitions')} />
          <StatCard label="Total Approved" value={String(stats.approved).padStart(2, '0')} icon={CheckCircle2} color="emerald" onClick={() => onViewChange('requisitions')} />
          <StatCard label="Rejected" value={String(stats.rejected).padStart(2, '0')} icon={XCircle} color="red" onClick={() => onViewChange('requisitions')} />
          <StatCard label="Total Spent" value={formatCurrency(stats.totalSpent)} icon={ArrowUpRight} color="blue" />
        </div>

        {/* Unified Content Card */}
        <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 p-1 shadow-2xl shadow-primary/5 overflow-hidden">
          <div className="bg-[#FAF9F6]/30 rounded-[1.8rem] p-4 lg:p-6 space-y-8">
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
                <button onClick={() => onViewChange('requisitions')} className="px-5 py-2 rounded-xl bg-white border border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center gap-3 active:scale-95">
                  <ListFilter size={14} />
                  View All Directory
                </button>
              </div>

              {recentPending.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-black text-foreground tracking-tight">Governance Clear</p>
                    <p className="text-sm text-muted-foreground font-medium">All administrative items have been synchronized.</p>
                  </div>
                </div>
              ) : (
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
                      {recentPending.map(r => {
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
                              <div className={`w-2 h-2 rounded-full ${r.type === 'Cash' ? 'bg-emerald-500' : 'bg-primary'} shadow-sm shadow-black/10`} />
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
                            <button onClick={() => onViewChange('requisitions', { reqId: r.id })} className="p-2.5 bg-background hover:bg-primary hover:text-white rounded-xl text-primary transition-all border border-primary/10 shadow-sm active:scale-90">
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
