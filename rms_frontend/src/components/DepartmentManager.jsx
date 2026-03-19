import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { CORPORATE_HIERARCHY } from '../constants/departments';
import { Plus, Trash2, Building2, Briefcase, Search, MoreVertical, ChevronDown, ChevronRight } from 'lucide-react';

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
        <div className="flex items-center space-x-2">
          <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight font-mono">{type}</p>
          <span className="text-[10px] text-primary/60 font-mono tracking-tighter border border-primary/20 px-1 rounded bg-primary/5">CODE: {name.substring(0,3).toUpperCase()}-2026</span>
        </div>
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
import Modal from './Modal';

const DepartmentManager = ({ onViewChange }) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDept, setPendingDept] = useState(null);
  const [newDeptData, setNewDeptData] = useState({ name: '', type: 'Operational', accessCode: '' });

  // Section states
  const [isStrategicOpen, setIsStrategicOpen] = useState(true);
  const [isOperationalOpen, setIsOperationalOpen] = useState(true);

  const openAddModal = (type = 'Operational') => {
    setNewDeptData({ name: '', type, accessCode: '' });
    setIsAddModalOpen(true);
  };

  const loadDepts = async () => {
    const data = await getDepartments();
    setDepartments(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDepts();
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newDeptData.name) return;
    setIsProcessing(true);
    // Simulate real network delay for UX
    await new Promise(r => setTimeout(r, 600));
    await addDepartment(newDeptData);
    await loadDepts();
    setIsProcessing(false);
    setIsAddModalOpen(false);
    setNewDeptData({ name: '', type: 'Operational' });
    toast.success(`${newDeptData.name} Department added`);
  };

  const confirmDelete = async () => {
    if (!pendingDept) return;
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 600));
    await deleteDepartment(pendingDept.id);
    await loadDepts();
    setIsProcessing(false);
    setIsDeleteModalOpen(false);
    toast.error(`${pendingDept.name} Department removed`);
    setPendingDept(null);
  };

  const strategic = departments.filter(d => d.type === 'Strategic');
  const operational = departments.filter(d => d.type === 'Operational');

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <Briefcase size={24} className="animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-bold text-primary tracking-widest uppercase animate-pulse">Syncing Corporate Hierarchy</p>
      </div>
    );
  }

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
              onClick={() => setIsAddModalOpen(true)}
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
               <button 
                 onClick={() => setIsStrategicOpen(!isStrategicOpen)}
                 className="flex items-center space-x-2 text-lg font-bold text-foreground hover:text-primary transition-colors group"
               >
                 {isStrategicOpen ? <ChevronDown size={20} className="text-primary"/> : <ChevronRight size={20} />}
                 <span>Strategic Control</span>
               </button>
               <div className="flex items-center space-x-4">
                 <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{strategic.length} Total</span>
                 <button 
                   onClick={() => openAddModal('Strategic')}
                   className="p-1 px-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all flex items-center space-x-1"
                 >
                   <Plus size={14} />
                   <span className="text-[10px] font-bold uppercase">Add</span>
                 </button>
               </div>
            </div>
            
            {isStrategicOpen && (
              <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {strategic.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-4 text-center">No strategic units found</p>
                ) : (
                  strategic.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).map(dept => (
                    <DeptItem key={dept.id} name={dept.name} type="Strategic" onDelete={() => { setPendingDept(dept); setIsDeleteModalOpen(true); }} />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Operational Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
               <button 
                 onClick={() => setIsOperationalOpen(!isOperationalOpen)}
                 className="flex items-center space-x-2 text-lg font-bold text-foreground hover:text-primary transition-colors group"
               >
                 {isOperationalOpen ? <ChevronDown size={20} className="text-primary"/> : <ChevronRight size={20} />}
                 <span>Operational Units</span>
               </button>
               <div className="flex items-center space-x-4">
                 <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{operational.length} Total</span>
                 <button 
                   onClick={() => openAddModal('Operational')}
                   className="p-1 px-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all flex items-center space-x-1"
                 >
                   <Plus size={14} />
                   <span className="text-[10px] font-bold uppercase">Add</span>
                 </button>
               </div>
            </div>
            
            {isOperationalOpen && (
              <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-300">
                {operational.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-4 text-center">No operational units found</p>
                ) : (
                  operational.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).map(dept => (
                    <DeptItem key={dept.id} name={dept.name} type="Operational" onDelete={() => { setPendingDept(dept); setIsDeleteModalOpen(true); }} />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Department Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title="Add New Department"
        footer={(
          <>
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="flex-1 px-4 py-3 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddSubmit}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <span>Create Department</span>
              )}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Department Name</label>
            <input 
              type="text" 
              value={newDeptData.name}
              onChange={(e) => setNewDeptData({...newDeptData, name: e.target.value})}
              placeholder="e.g. Finance & Accounts"
              className="w-full bg-muted/30 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Login Access Code</label>
            <input 
              type="text" 
              value={newDeptData.accessCode}
              onChange={(e) => setNewDeptData({...newDeptData, accessCode: e.target.value})}
              placeholder="e.g. HATCH-2026"
              className="w-full bg-muted/30 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">ClassificationType</label>
            <div className="grid grid-cols-2 gap-3">
              {['Operational', 'Strategic'].map(type => (
                <button
                  key={type}
                  onClick={() => setNewDeptData({...newDeptData, type})}
                  className={`p-4 rounded-xl border transition-all text-xs font-bold uppercase tracking-tight ${
                    newDeptData.type === type 
                    ? 'bg-primary/10 border-primary/50 text-primary shadow-sm' 
                    : 'bg-white border-border/50 text-muted-foreground hover:border-border'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Delete Department"
        footer={(
          <>
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 px-4 py-3 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={confirmDelete}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm shadow-lg shadow-destructive/20 hover:bg-destructive/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Permanently</span>
              )}
            </button>
          </>
        )}
      >
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-2">
            <Trash2 size={32} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Are you sure you want to delete the</p>
            <p className="text-lg font-bold text-foreground">"{pendingDept?.name}"</p>
            <p className="text-sm font-medium text-muted-foreground">department? This action cannot be undone.</p>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default DepartmentManager;
