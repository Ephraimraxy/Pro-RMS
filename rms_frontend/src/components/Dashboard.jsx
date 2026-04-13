import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import { useAuth } from '../context/AuthContext';
import { CORPORATE_HIERARCHY } from '../constants/departments';
import { getDashboardStats, getRequisitions, getDepartments } from '../lib/store';
import { reqAPI } from '../lib/api';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, ListFilter, ShieldAlert, Boxes, Eye, AlertTriangle, Plus, ShieldCheck } from 'lucide-react';

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

const DepartmentCard = ({ name, type }) => (
  <div className="glass bg-white/60 p-3 lg:p-5 rounded-2xl border border-border/50 hover:border-primary/20 transition-all cursor-pointer group flex items-center justify-between shadow-sm hover:shadow-md">
    <div className="flex items-center space-x-4">
      <div className="w-10 h-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 group-hover:border-primary/20 transition-all font-bold">
        {name[0]}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-foreground transition-colors">{name}</h4>
        <p className="text-[10px] text-muted-foreground uppercase font-bold">{type}</p>
      </div>
    </div>
    <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
  </div>
);

const Dashboard = ({ onViewChange }) => {
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalSpent: 0 });
  const [recentPending, setRecentPending] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  const loadDashboard = async () => {
    const s = await getDashboardStats();
    setStats(s);
    const all = await getRequisitions();
    setRecentPending(all.filter(r => r.status === 'pending').slice(0, 5));
    
    setLoadingDepts(true);
    const depts = await getDepartments();
    setDepartments(depts);
    setLoadingDepts(false);
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

  const strategicDepts = departments.filter(d => d.type === 'Strategic');
  const operationalDepts = departments.filter(d => d.type === 'Operational');

  return (
    <Layout user={user} currentView="dashboard" onViewChange={onViewChange}>
      <RequisitionForm 
        isOpen={isFormOpen} 
        onClose={() => { setIsFormOpen(false); loadDashboard(); }} 
        user={user}
      />
      
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

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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
          <button 
            onClick={() => setIsFormOpen(true)}
            disabled={user?.role === 'department' && !isDeptReady}
            className="group bg-foreground hover:bg-foreground/90 text-background font-black py-4 px-10 rounded-2xl transition-all shadow-2xl shadow-black/10 flex items-center gap-4 w-fit active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            <span className="uppercase tracking-widest text-[10px]">Raise New Requisition</span>
          </button>
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
                        <th className="pb-4 px-6">Module</th>
                        <th className="pb-4 px-6">Brief Description</th>
                        <th className="pb-4 px-6">Payload</th>
                        <th className="pb-4 px-6">Source</th>
                        <th className="pb-4 px-6">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPending.map(r => (
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
                            <p className="text-sm font-bold text-foreground max-w-xs truncate">{r.title}</p>
                          </td>
                          <td className="py-4 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                             <span className="text-sm font-black text-foreground font-mono">₦{Number(r.amount || 0).toLocaleString()}</span>
                          </td>
                          <td className="py-4 px-6 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                            <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60">{r.department}</span>
                          </td>
                          <td className="py-4 px-6 bg-white/50 border-y border-r border-border/30 rounded-r-2xl group-hover:bg-white transition-colors text-right">
                            <button onClick={() => onViewChange('requisitions')} className="p-2.5 bg-background hover:bg-primary hover:text-white rounded-xl text-primary transition-all border border-primary/10 shadow-sm active:scale-90">
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Strategic Sections Grouped in the Main Card */}
            {user?.role !== 'department' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-border/20">
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                        <ShieldAlert size={22} />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-black text-foreground tracking-tight">Strategic Control</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Core Governance Units</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {strategicDepts.map(dept => (
                       <DepartmentCard key={dept.id} name={dept.name} type="Strategic" />
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-muted border border-border/50 flex items-center justify-center text-muted-foreground shadow-inner">
                        <Boxes size={22} />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-black text-foreground tracking-tight">Operational Network</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Satellite Action Units</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {operationalDepts.map(dept => (
                       <DepartmentCard key={dept.id} name={dept.name} type="Unit" />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
