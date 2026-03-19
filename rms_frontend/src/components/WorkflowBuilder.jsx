import React, { useState } from 'react';
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
                <option value="GM" className="bg-background">General Manager</option>
                <option value="Chairman" className="bg-background">Chairman</option>
                <option value="Accounts" className="bg-background">Finance Controller</option>
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

const WorkflowBuilder = ({ onViewChange }) => {
  const { user } = useAuth();
  const [stages, setStages] = useState([
    { id: 1, sequence: 1, name: 'Admin Review', role: 'Admin', threshold: 0 },
    { id: 2, sequence: 2, name: 'Internal Audit', role: 'Audit', threshold: 0 },
    { id: 3, sequence: 3, name: 'Management Approval', role: 'GM', threshold: 500000 },
  ]);

  const addStage = () => {
    const newStage = {
      id: Date.now(),
      sequence: stages.length + 1,
      name: 'New Stage',
      role: 'Admin',
      threshold: 0
    };
    setStages([...stages, newStage]);
  };

  const updateStage = (updatedStage) => {
    setStages(stages.map(s => s.id === updatedStage.id ? updatedStage : s));
  };

  const deleteStage = (id) => {
    setStages(stages.filter(s => s.id !== id).map((s, idx) => ({ ...s, sequence: idx + 1 })));
  };

  return (
    <Layout user={user} currentView="workflow_builder" onViewChange={onViewChange}>
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
              <Settings2 className="text-primary" />
              <span>Workflow <span className="text-primary">Builder</span></span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium italic">
              "Zero-Hardcoding" Engine: Define the rules of your organisation's governance.
            </p>
          </div>
          <button 
            onClick={addStage}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center space-x-2"
          >
            <Plus size={18} />
            <span>Add Stage</span>
          </button>
        </div>

        <div className="flex flex-col items-center space-y-0">
          {stages.map((stage, idx) => (
            <WorkflowStage 
              key={stage.id} 
              stage={stage} 
              onUpdate={updateStage}
              onDelete={() => deleteStage(stage.id)}
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
    </Layout>
  );
};

export default WorkflowBuilder;
