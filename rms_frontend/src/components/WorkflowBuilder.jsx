import React, { useState } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Shield, ArrowDown, Settings2, Info } from 'lucide-react';

const WorkflowStage = ({ stage, onUpdate, onDelete, isFirst }) => {
  return (
    <div className="relative flex flex-col items-center w-full">
      {!isFirst && (
        <div className="h-8 w-px bg-white/10 flex items-center justify-center">
           <ArrowDown size={14} className="text-zinc-600" />
        </div>
      )}
      
      <div className="glass w-full max-w-md p-5 rounded-2xl border border-white/10 relative group hover:border-blue-500/30 transition-all">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                {stage.sequence}
             </div>
             <input 
                type="text" 
                value={stage.name}
                onChange={(e) => onUpdate({ ...stage, name: e.target.value })}
                className="bg-transparent border-none text-white font-bold text-sm focus:outline-none focus:ring-0 w-32"
                placeholder="Stage Name"
             />
          </div>
          <button onClick={onDelete} className="p-2 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Authorized Role</label>
            <div className="flex items-center space-x-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
              <Shield size={12} className="text-zinc-400" />
              <select 
                value={stage.role}
                onChange={(e) => onUpdate({ ...stage, role: e.target.value })}
                className="bg-transparent border-none text-xs text-white focus:outline-none w-full cursor-pointer"
              >
                <option value="Admin" className="bg-zinc-900">Admin</option>
                <option value="Audit" className="bg-zinc-900">Audit</option>
                <option value="GM" className="bg-zinc-900">General Manager</option>
                <option value="Chairman" className="bg-zinc-900">Chairman</option>
                <option value="Accounts" className="bg-zinc-900">Finance Controller</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Min Threshold (₦)</label>
            <input 
                type="number"
                value={stage.threshold}
                onChange={(e) => onUpdate({ ...stage, threshold: e.target.value })}
                className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white w-full focus:outline-none focus:border-blue-500/50 font-mono"
                placeholder="0"
            />
          </div>
        </div>
        
        {stage.threshold > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center space-x-2 text-[10px] text-blue-400 font-medium italic">
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
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-3">
              <Settings2 className="text-blue-500" />
              <span>Workflow <span className="text-blue-500">Builder</span></span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1 font-medium italic">
              "Zero-Hardcoding" Engine: Define the rules of your organisation's governance.
            </p>
          </div>
          <button 
            onClick={addStage}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center space-x-2"
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
             <div className="h-8 w-px bg-white/10"></div>
             <div className="glass p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-bold text-xs uppercase tracking-[0.2em]">
                Finance Processing (Final)
             </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default WorkflowBuilder;
