import React, { useState, useEffect } from 'react';
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

import { getDepartments, addDepartment, deleteDepartment } from '../lib/store';
import { toast } from 'react-hot-toast';

const DepartmentManager = ({ onViewChange }) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadDepts = async () => {
    const data = await getDepartments();
    setDepartments(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDepts();
  }, []);

  const handleAdd = async () => {
    const name = prompt("Enter Department Name:");
    if (!name) return;
    const type = confirm("Is this a Strategic department? (Cancel for Operational)") ? "Strategic" : "Operational";
    
    await addDepartment({ name, type });
    await loadDepts();
    toast.success(`${name} Department added`);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete the ${name} department?`)) return;
    await deleteDepartment(id);
    await loadDepts();
    toast.error(`${name} Department removed`);
  };

  const strategic = departments.filter(d => d.type === 'Strategic');
  const operational = departments.filter(d => d.type === 'Operational');

  if (loading) return <div className="p-20 text-center animate-pulse text-muted-foreground font-mono text-xs">Syncing Corporate Hierarchy...</div>;

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
            <button 
              onClick={handleAdd}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center space-x-2"
            >
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
              {strategic.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).map(dept => (
                <DeptItem key={dept.id} name={dept.name} type="Strategic" onDelete={() => handleDelete(dept.id, dept.name)} />
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
              {operational.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).map(dept => (
                <DeptItem key={dept.id} name={dept.name} type="Operational" onDelete={() => handleDelete(dept.id, dept.name)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DepartmentManager;
