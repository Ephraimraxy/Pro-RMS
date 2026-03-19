import React, { useState } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { CORPORATE_HIERARCHY } from '../constants/departments';
import { Plus, Trash2, Building2, Briefcase, Search, MoreVertical } from 'lucide-react';

const DeptItem = ({ name, type, onDelete }) => (
  <div className="glass bg-white/80 p-4 rounded-2xl border border-border/50 flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
    <div className="flex items-center space-x-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        type === 'Strategic' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted border border-border/50 text-muted-foreground'
      }`}>
        <Building2 size={18} />
      </div>
      <div>
        <h4 className="text-sm font-bold text-foreground">{name}</h4>
        <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight font-mono">{type}</p>
      </div>
    </div>
    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all">
       <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
         <Trash2 size={14} />
       </button>
       <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
         <MoreVertical size={14} />
       </button>
    </div>
  </div>
);

const DepartmentManager = ({ onViewChange }) => {
  const { user } = useAuth();
  const [strategic, setStrategic] = useState(CORPORATE_HIERARCHY.strategic);
  const [operational, setOperational] = useState(CORPORATE_HIERARCHY.operational);
  const [searchTerm, setSearchTerm] = useState('');

  const deleteDept = (name, type) => {
    if (type === 'Strategic') setStrategic(strategic.filter(d => d !== name));
    else setOperational(operational.filter(d => d !== name));
  };

  return (
    <Layout user={user} currentView="department_manager" onViewChange={onViewChange}>
      <div className="max-w-6xl mx-auto space-y-12 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
              <Briefcase className="text-primary" />
              <span>Department <span className="text-primary">Manager</span></span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium">
              Manage operational units and strategic control departments.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search departments..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/80 border border-border/50 rounded-xl py-3 pl-12 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-64 shadow-sm transition-all"
              />
            </div>
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center space-x-2">
              <Plus size={18} />
              <span>Add Department</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Strategic Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
               <h3 className="text-lg font-bold text-foreground">Strategic Control</h3>
               <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{strategic.length} Total</span>
            </div>
            <div className="grid gap-4">
              {strategic.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase())).map(dept => (
                <DeptItem key={dept} name={dept} type="Strategic" onDelete={() => deleteDept(dept, 'Strategic')} />
              ))}
            </div>
          </div>

          {/* Operational Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
               <h3 className="text-lg font-bold text-foreground">Operational Units</h3>
               <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{operational.length} Total</span>
            </div>
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {operational.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase())).map(dept => (
                <DeptItem key={dept} name={dept} type="Operational" onDelete={() => deleteDept(dept, 'Operational')} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DepartmentManager;
