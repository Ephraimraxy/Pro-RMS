import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import ApprovalQueue from './ApprovalQueue';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { CORPORATE_HIERARCHY } from '../constants/departments';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, ListFilter, ShieldAlert, Boxes } from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="glass p-6 rounded-2xl border border-border/50 relative overflow-hidden group hover:border-primary/30 transition-all cursor-pointer bg-white/60">
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
  <div className="glass bg-white/60 p-5 rounded-2xl border border-border/50 hover:border-primary/20 transition-all cursor-pointer group flex items-center justify-between shadow-sm hover:shadow-md">
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
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoadingDepts(true);
        // Live Fetch from Custom Node.js Postgres API
        const response = await api.get('/api/departments');
        setDepartments(response.data);
        setLoadingDepts(false);
      } catch (error) {
        console.error("Failed to fetch node departments:", error);
        
        // Graceful fallback to cached hierarchy if backend is offline
        setDepartments([...CORPORATE_HIERARCHY.strategic, ...CORPORATE_HIERARCHY.operational].map((d, index) => ({
          id: index + 1, 
          name: d, 
          parentId: CORPORATE_HIERARCHY.strategic.includes(d) ? null : 1
        })));
        setLoadingDepts(false);
      }
    };
    
    if (user) {
      fetchDepartments();
    }
  }, [user]);

  const strategicDepts = departments.filter(d => !d.parent_id);
  const operationalDepts = departments.filter(d => d.parent_id);

  return (
    <Layout user={user} currentView="dashboard" onViewChange={onViewChange}>
      <RequisitionForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        user={user}
      />
      
      <div className="max-w-7xl mx-auto space-y-12 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Oversight <span className="text-primary italic">Dashboard</span></h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium">Welcome back, {user?.name}. Monitoring CSS Node Cluster.</p>
          </div>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center space-x-2 w-fit"
          >
            <span>Raise New Requisition</span>
            <ArrowUpRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Pending Approval" value="12" icon={Clock} color="orange" />
          <StatCard label="Approved Today" value="08" icon={CheckCircle2} color="emerald" />
          <StatCard label="Rejected" value="02" icon={XCircle} color="red" />
          <StatCard label="Total Spent (MTD)" value="₦2.4M" icon={ArrowUpRight} color="orange" />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-bold text-foreground">Pending My Action</h3>
              <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">Action Required</span>
            </div>
            <button className="text-xs font-bold text-muted-foreground hover:text-primary transition-all flex items-center space-x-2">
              <ListFilter size={14} />
              <span>View All</span>
            </button>
          </div>
          <ApprovalQueue />
        </div>

        <div className="space-y-6">
          <div className="flex items-center space-x-4 border-b border-border/50 pb-4 pt-4">
            <h3 className="text-lg font-bold text-foreground transition-colors flex items-center gap-2"><ShieldAlert size={20} className="text-primary"/> Strategic Management</h3>
            <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border border-primary/20">Core Logic Node</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingDepts ? (
               <div className="text-muted-foreground text-sm font-bold">Synchronizing with Node.js Backend...</div>
            ) : strategicDepts.length > 0 ? (
               strategicDepts.map(dept => (
                 <DepartmentCard key={dept.id} name={dept.name} type="Strategic Wing" />
               ))
            ) : (
               <div className="text-muted-foreground text-sm">No strategic departments found.</div>
            )}
          </div>

          <div className="flex items-center space-x-4 border-b border-border/50 pb-4 pt-4 mt-8">
            <h3 className="text-lg font-bold text-foreground transition-colors flex items-center gap-2"><Boxes size={20} className="text-primary"/> Operational Units</h3>
            <span className="bg-muted text-muted-foreground border border-border text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">Field Operations</span>
            <span className="text-muted-foreground text-xs font-bold">{operationalDepts.length} Active Nodes</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingDepts ? (
               <div className="text-muted-foreground text-sm font-bold">Synchronizing with Node.js Backend...</div>
            ) : operationalDepts.length > 0 ? (
               operationalDepts.map(dept => (
                 <DepartmentCard key={dept.id} name={dept.name} type="Operations" />
               ))
            ) : (
               <div className="text-muted-foreground text-sm">No operational units found.</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
