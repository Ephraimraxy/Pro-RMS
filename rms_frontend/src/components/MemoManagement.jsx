import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { getRequisitions } from '../lib/store';
import { FileText, Send, Clock, CheckCircle2, Eye } from 'lucide-react';

const MemoManagement = ({ onViewChange }) => {
  const { user } = useAuth();
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const all = await getRequisitions();
      setMemos(all.filter(r => r.type === 'Memo'));
      setLoading(false);
    };
    load();
  }, []);

  const statusIcon = {
    pending: <Clock size={14} className="text-amber-500" />,
    approved: <CheckCircle2 size={14} className="text-emerald-500" />,
    rejected: <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block" />,
    draft: <FileText size={14} className="text-muted-foreground" />,
  };

  return (
    <Layout user={user} currentView="memos" onViewChange={onViewChange}>
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Memo <span className="text-primary italic">Management</span></h1>
          <p className="text-muted-foreground text-sm mt-1">View and track all memo-type requisitions across departments.</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse font-mono text-xs">Loading memos...</div>
        ) : memos.length === 0 ? (
          <div className="glass bg-white/60 rounded-3xl border border-border/50 p-12 text-center">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold text-foreground">No Memos Yet</h3>
            <p className="text-sm text-muted-foreground mt-2">Create a new memo requisition from the Dashboard or Requisitions page.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {memos.map(memo => (
              <div key={memo.id} className="glass bg-white/60 rounded-2xl border border-border/50 p-6 hover:border-primary/20 transition-all cursor-pointer group shadow-sm hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-xs font-bold text-primary">{memo.id}</span>
                      <div className="flex items-center space-x-1">
                        {statusIcon[memo.status]}
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{memo.status}</span>
                      </div>
                    </div>
                    <h3 className="text-foreground font-semibold">{memo.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{memo.description}</p>
                    <div className="flex items-center space-x-4 mt-3 text-[10px] text-muted-foreground font-mono uppercase">
                      <span>{memo.department}</span>
                      <span>•</span>
                      <span>{new Date(memo.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => onViewChange('requisitions')} className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-muted">
                    <Eye size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MemoManagement;
