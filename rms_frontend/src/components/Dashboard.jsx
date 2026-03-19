import React, { useState } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import ApprovalQueue from './ApprovalQueue';
import { useAuth } from '../context/AuthContext';
import { CORPORATE_HIERARCHY } from '../constants/departments';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, ListFilter } from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="glass p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-blue-500/20 transition-all cursor-pointer">
    <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/5 blur-3xl rounded-full translate-x-12 -translate-y-12`}></div>
    <div className="flex items-center justify-between relative z-10">
      <div>
        <p className="text-zinc-500 text-sm font-medium mb-1 uppercase tracking-tight">{label}</p>
        <h3 className="text-3xl font-bold text-white leading-none">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-white/5 border border-white/10 text-${color}-400 group-hover:scale-110 transition-transform`}>
        <Icon size={24} />
      </div>
    </div>
  </div>
);

const DepartmentCard = ({ name, type }) => (
  <div className="glass p-5 rounded-2xl border border-white/5 hover:border-blue-500/10 transition-all cursor-pointer group flex items-center justify-between">
    <div className="flex items-center space-x-4">
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-blue-400 group-hover:bg-blue-600/10 transition-all">
        {name[0]}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">{name}</h4>
        <p className="text-[10px] text-zinc-500 uppercase font-medium">{type}</p>
      </div>
    </div>
    <ArrowUpRight size={16} className="text-zinc-700 group-hover:text-blue-400 transition-colors" />
  </div>
);

const Dashboard = ({ onViewChange }) => {
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);

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
            <h1 className="text-3xl font-bold text-white tracking-tight">Oversight <span className="text-blue-500">Dashboard</span></h1>
            <p className="text-zinc-400 text-sm mt-1 font-medium">Welcome back, {user?.name}. Monitoring CSS Group operations.</p>
          </div>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center space-x-2 w-fit"
          >
            <span>Raise New Requisition</span>
            <ArrowUpRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Pending Approval" value="12" icon={Clock} color="indigo" />
          <StatCard label="Approved Today" value="08" icon={CheckCircle2} color="green" />
          <StatCard label="Rejected" value="02" icon={XCircle} color="red" />
          <StatCard label="Total Spent (MTD)" value="₦2.4M" icon={ArrowUpRight} color="blue" />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-bold text-white">Pending My Action</h3>
              <span className="bg-amber-600/20 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">Action Required</span>
            </div>
            <button className="text-xs font-bold text-zinc-500 hover:text-white transition-all flex items-center space-x-2">
              <ListFilter size={14} />
              <span>View All</span>
            </button>
          </div>
          <ApprovalQueue />
        </div>

        <div className="space-y-6">
          <div className="flex items-center space-x-4 border-b border-white/5 pb-4 pt-4">
            <h3 className="text-lg font-bold text-white">Strategic Control</h3>
            <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">Core</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CORPORATE_HIERARCHY.strategic.map(dept => (
              <DepartmentCard key={dept} name={dept} type="Strategic" />
            ))}
          </div>

          <div className="flex items-center space-x-4 border-b border-white/5 pb-4 pt-4">
            <h3 className="text-lg font-bold text-white">Operational Units</h3>
            <span className="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{CORPORATE_HIERARCHY.operational.length} Units</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CORPORATE_HIERARCHY.operational.map(dept => (
              <DepartmentCard key={dept} name={dept} type="Operations" />
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
