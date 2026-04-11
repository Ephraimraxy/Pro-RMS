import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import { useAuth } from '../context/AuthContext';
import { CORPORATE_HIERARCHY } from '../constants/departments';
import { getDashboardStats, getRequisitions, getDepartments } from '../lib/store';
import { reqAPI } from '../lib/api';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, ListFilter, ShieldAlert, Boxes, Eye, AlertTriangle } from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color, onClick }) => (
  <div onClick={onClick} className="glass p-4 lg:p-6 rounded-2xl border border-border/50 relative overflow-hidden group hover:border-primary/30 transition-all cursor-pointer bg-white/60">
    <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/10 blur-3xl rounded-full translate-x-12 -translate-y-12`}></div>
    <div className="flex items-center justify-between relative z-10">
      <div>
        <p className="text-muted-foreground text-sm font-medium mb-1 uppercase tracking-tight">{label}</p>
        <h3 className="text-3xl font-bold text-foreground leading-none">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-${color}-50 border border-${color}-100 text-${color}-600 group-hover:scale-110 transition-transform shadow-sm`}>
        <Icon size={24} />
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
      
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        {user?.role === 'department' && !isDeptReady && (
          <div className="glass bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-amber-800 tracking-tight">Governance Setup Incomplete</h2>
                <p className="text-sm text-amber-700 font-medium">Your department cannot initiate requisitions until the head official's profile and signature are configured.</p>
              </div>
            </div>
            <button
               onClick={() => onViewChange('dept_profile')}
               className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center gap-2"
            >
              Complete Setup Now
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              {user?.role === 'department' ? (
                <span>{user.name} <span className="text-primary italic">Unit Portal</span></span>
              ) : (
                <span>Oversight <span className="text-primary italic">Dashboard</span></span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium">
              {user?.role === 'department' 
                ? `Operational control for the ${user.name} unit. Monitoring local activities.` 
                : `Welcome back, ${user?.name}. Monitoring CSS Group operations.`}
            </p>
          </div>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center space-x-2 w-fit"
          >
            <span>Raise New Requisition</span>
            <ArrowUpRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard label="Pending Approval" value={String(stats.pending).padStart(2, '0')} icon={Clock} color="orange" onClick={() => onViewChange('requisitions')} />
          <StatCard label="Approved" value={String(stats.approved).padStart(2, '0')} icon={CheckCircle2} color="emerald" onClick={() => onViewChange('requisitions')} />
          <StatCard label="Rejected" value={String(stats.rejected).padStart(2, '0')} icon={XCircle} color="red" onClick={() => onViewChange('requisitions')} />
          <StatCard label="Total Approved Spend" value={formatCurrency(stats.totalSpent)} icon={ArrowUpRight} color="orange" />
        </div>

        {/* Pending Queue */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-bold text-foreground">Pending My Action</h3>
              {recentPending.length > 0 && (
                <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">Action Required</span>
              )}
            </div>
            <button onClick={() => onViewChange('requisitions')} className="text-xs font-bold text-muted-foreground hover:text-primary transition-all flex items-center space-x-2">
              <ListFilter size={14} />
              <span>View All</span>
            </button>
          </div>

          {recentPending.length === 0 ? (
            <div className="glass bg-white/60 rounded-2xl border border-border/50 p-8 text-center text-muted-foreground text-sm">
              <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
              <p className="font-semibold">All caught up! No items pending your action.</p>
            </div>
          ) : (
            <div className="glass rounded-3xl border border-border/50 overflow-hidden shadow-sm bg-white/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                      <th className="py-4 px-6">Ref ID</th>
                      <th className="py-4 px-6">Type</th>
                      <th className="py-4 px-6">Description</th>
                      <th className="py-4 px-6">Amount</th>
                      <th className="py-4 px-6">Dept</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPending.map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-4 px-6">
                          <span className="text-xs font-bold text-primary">{r.id}</span>
                          <div className="text-[10px] text-muted-foreground font-mono">{new Date(r.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${r.type === 'Cash' ? 'bg-emerald-500' : r.type === 'Material' ? 'bg-primary' : 'bg-amber-500'}`}></span>
                            <span className="text-sm font-semibold text-foreground">{r.type}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-foreground max-w-xs line-clamp-1">{r.title}</td>
                        <td className="py-4 px-6 text-sm font-bold text-foreground font-mono">{r.amount ? `₦${r.amount.toLocaleString()}` : '—'}</td>
                        <td className="py-4 px-6 text-xs text-muted-foreground">{r.department}</td>
                        <td className="py-4 px-6"><span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-primary/10 border border-primary/20 text-primary">Pending</span></td>
                        <td className="py-4 px-6 text-right">
                          <button onClick={() => onViewChange('requisitions')} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-all"><Eye size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Departments - Only visible to Super Admins */}
        {user?.role !== 'department' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4 border-b border-border/50 pb-4 pt-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><ShieldAlert size={20} className="text-primary"/> Strategic Management</h3>
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border border-primary/20">Core</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loadingDepts ? (
                 <div className="text-muted-foreground text-sm font-bold">Loading departments...</div>
              ) : strategicDepts.map(dept => (
                 <DepartmentCard key={dept.id} name={dept.name} type="Strategic" />
              ))}
            </div>

            <div className="flex items-center space-x-4 border-b border-border/50 pb-4 pt-4 mt-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Boxes size={20} className="text-primary"/> Operational Units</h3>
              <span className="bg-muted text-muted-foreground border border-border text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{operationalDepts.length} Units</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {loadingDepts ? (
                 <div className="text-muted-foreground text-sm font-bold">Loading...</div>
              ) : operationalDepts.map(dept => (
                 <DepartmentCard key={dept.id} name={dept.name} type="Operations" />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
