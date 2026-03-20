import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Shield, ArrowDown, Settings2, Info } from 'lucide-react';

const WorkflowStage = ({ stage, onUpdate, onDelete, isFirst }) => {
  return (
    <div className="relative flex flex-col items-center w-full">
      {!isFirst && (
        <div className="h-8 w-px bg-border flex items-center justify-center">
           <ArrowDown size={14} className="text-muted-foreground" />
        </div>
      )}
      
      <div className="glass bg-white/60 w-full max-w-md p-5 rounded-2xl border border-border/50 relative group hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shadow-sm">
                {stage.sequence}
             </div>
             <input 
                type="text" 
                value={stage.name}
                onChange={(e) => onUpdate({ ...stage, name: e.target.value })}
                className="bg-transparent border-none text-foreground font-bold text-sm focus:outline-none focus:ring-0 w-32"
                placeholder="Stage Name"
             />
          </div>
          <button onClick={onDelete} className="p-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Authorized Role</label>
            <div className="flex items-center space-x-2 bg-white/80 rounded-lg px-3 py-2 border border-border/50 shadow-sm">
              <Shield size={12} className="text-muted-foreground" />
              <select 
                value={stage.role}
                onChange={(e) => onUpdate({ ...stage, role: e.target.value })}
                className="bg-transparent border-none text-xs text-foreground focus:outline-none w-full cursor-pointer"
              >
                <option value="Admin" className="bg-background">Admin</option>
                <option value="Audit" className="bg-background">Audit</option>
                <option value="Procurement" className="bg-background">Procurement</option>
                <option value="Finance" className="bg-background">Finance</option>
                <option value="GM" className="bg-background">General Manager</option>
                <option value="Chairman" className="bg-background">Chairman</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Min Threshold (₦)</label>
            <input 
                type="number"
                value={stage.threshold}
                onChange={(e) => onUpdate({ ...stage, threshold: e.target.value })}
                className="bg-white/80 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground w-full focus:outline-none focus:border-primary/50 font-mono shadow-sm"
                placeholder="0"
            />
          </div>
        </div>
        
        {stage.threshold > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center space-x-2 text-[10px] text-primary font-bold italic">
            <Info size={10} />
            <span>This stage will be skipped for requisitions below ₦{Number(stage.threshold).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

import { getWorkflows, updateWorkflows, getRequisitionTypes, addRequisitionType, deleteRequisitionType } from '../lib/store';
import { toast } from 'react-hot-toast';
import Modal from './Modal';

const WorkflowBuilder = ({ onViewChange }) => {
  const { user } = useAuth();
  const [stages, setStages] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stages'); // 'stages' or 'types'
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState(null);
  const [pendingType, setPendingType] = useState(null);
  const [newTypeName, setNewTypeName] = useState('');

  const loadData = async () => {
    const [workflowData, typeData] = await Promise.all([
      getWorkflows(),
      getRequisitionTypes()
    ]);
    setStages(workflowData);
    setTypes(typeData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);

  const addStage = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 600));
    const newStage = {
      id: Date.now(),
      sequence: stages.length + 1,
      name: 'New Stage',
      role: 'Admin',
      threshold: 0
    };
    const updated = [...stages, newStage];
    setStages(updated);
    await updateWorkflows(updated);
    setIsProcessing(false);
    toast.success('New stage added to workflow');
  };

  const updateStage = async (updatedStage) => {
    const updated = stages.map(s => s.id === updatedStage.id ? updatedStage : s);
    setStages(updated);
    await updateWorkflows(updated);
  };

  const confirmDelete = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 600));
    
    if (activeTab === 'stages' && pendingStage) {
      const updated = stages.filter(s => s.id !== pendingStage.id).map((s, idx) => ({ ...s, sequence: idx + 1 }));
      setStages(updated);
      await updateWorkflows(updated);
      toast.error('Stage removed');
    } else if (activeTab === 'types' && pendingType) {
      await deleteRequisitionType(pendingType.id);
      setTypes(types.filter(t => t.id !== pendingType.id));
    }
    
    setIsProcessing(false);
    setIsDeleteModalOpen(false);
    setPendingStage(null);
    setPendingType(null);
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    if (!newTypeName) return;
    setIsProcessing(true);
    const result = await addRequisitionType({ name: newTypeName });
    if (result) {
        setTypes([...types, result]);
        setNewTypeName('');
    }
    setIsProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <Settings2 size={24} className="animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-bold text-primary tracking-widest uppercase animate-pulse">Syncing Approval Chain</p>
      </div>
    );
  }

  return (
    <Layout user={user} currentView="workflow_builder" onViewChange={onViewChange}>
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
              <Settings2 className="text-primary" />
              <span>Studio <span className="text-primary">Configuration</span></span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium italic">
              "Zero-Hardcoding" Hub: Define the rules and types of your organisation.
            </p>
          </div>
          
          <div className="flex bg-muted/40 p-1.5 rounded-2xl border border-border/50 shadow-inner">
            <button 
              onClick={() => setActiveTab('stages')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'stages' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[0.98]' : 'text-muted-foreground hover:bg-muted/80'}`}
            >
              Approval Workflow
            </button>
            <button 
              onClick={() => setActiveTab('types')}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'types' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[0.98]' : 'text-muted-foreground hover:bg-muted/80'}`}
            >
              Unit Types
            </button>
          </div>
        </div>

        {activeTab === 'stages' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-end">
              <button 
                onClick={addStage}
                disabled={isProcessing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                   <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                ) : (
                   <Plus size={18} />
                )}
                <span>{isProcessing ? 'Adding...' : 'Add Stage'}</span>
              </button>
            </div>
            
            <div className="flex flex-col items-center space-y-0">
              {stages.map((stage, idx) => (
                <WorkflowStage 
                  key={stage.id} 
                  stage={stage} 
                  onUpdate={updateStage}
                  onDelete={() => { setPendingStage(stage); setIsDeleteModalOpen(true); }}
                  isFirst={idx === 0}
                />
              ))}

              <div className="flex flex-col items-center mt-4">
                 <div className="h-8 w-px bg-border"></div>
                 <div className="glass p-4 rounded-2xl border border-emerald-500/20 bg-emerald-50 text-emerald-600 font-bold text-xs uppercase tracking-[0.2em] shadow-sm">
                    Finance Processing (Final)
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="glass bg-white/60 p-8 rounded-[2.5rem] border border-border/50 shadow-xl overflow-hidden relative">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/40">
                    <h3 className="text-xl font-bold text-foreground">Manage Requisition Types</h3>
                    <form onSubmit={handleAddType} className="flex items-center space-x-3">
                        <input 
                            type="text" 
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            placeholder="New Type (e.g. Petty Cash)"
                            className="bg-muted/30 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none w-64"
                        />
                        <button type="submit" disabled={isProcessing} className="bg-primary p-3 rounded-xl text-primary-foreground hover:scale-105 transition-all shadow-lg shadow-primary/20 active:scale-95">
                           <Plus size={20} />
                        </button>
                    </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {types.map(type => (
                        <div key={type.id} className="p-5 rounded-2xl border border-border/40 bg-white/40 group hover:border-primary/20 transition-all flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                   <FileText size={20} />
                                </div>
                                <span className="font-bold text-foreground">{type.name}</span>
                            </div>
                            <button 
                                onClick={() => { setPendingType(type); setIsDeleteModalOpen(true); }}
                                className="p-2 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Delete Workflow Stage"
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
                  <span>Removing...</span>
                </>
              ) : (
                <span>Delete Stage</span>
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
            <p className="text-sm font-medium text-muted-foreground">Are you sure you want to delete</p>
            <p className="text-lg font-bold text-foreground">"{activeTab === 'stages' ? pendingStage?.name : pendingType?.name}"</p>
            <p className="text-sm font-medium text-muted-foreground">
                {activeTab === 'stages' ? 'This will re-sequence the approval chain.' : 'This will remove this requisition type from the system.'}
            </p>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default WorkflowBuilder;
