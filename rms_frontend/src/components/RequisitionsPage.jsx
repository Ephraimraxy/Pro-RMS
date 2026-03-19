import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import RequisitionForm from './RequisitionForm';
import { useAuth } from '../context/AuthContext';
import { getRequisitions, updateRequisitionStatus } from '../lib/store';
import { Search, Filter, Plus, Eye, CheckCircle2, XCircle, Clock, FileText as FileIcon } from 'lucide-react';

const statusColors = {
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  rejected: 'bg-red-50 border-red-200 text-red-700',
  draft: 'bg-muted border-border text-muted-foreground',
};

const RequisitionsPage = ({ onViewChange }) => {
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const data = await getRequisitions();
    setRequisitions(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = requisitions.filter(r => {
    const matchesSearch = r.title?.toLowerCase().includes(search.toLowerCase()) || r.id?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (id, newStatus) => {
    await updateRequisitionStatus(id, newStatus);
    setSelectedReq(null);
    loadData();
  };

  return (
    <Layout user={user} currentView="requisitions" onViewChange={onViewChange}>
      <RequisitionForm isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); loadData(); }} user={user} />

      {/* Detail Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setSelectedReq(null)} />
          <div className="glass bg-white/90 w-full max-w-lg rounded-3xl border border-border/50 shadow-2xl relative p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{selectedReq.id}</h2>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColors[selectedReq.status]}`}>{selectedReq.status}</span>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="font-bold text-muted-foreground">Title:</span> <span className="text-foreground">{selectedReq.title}</span></p>
              <p><span className="font-bold text-muted-foreground">Type:</span> <span className="text-foreground">{selectedReq.type}</span></p>
              <p><span className="font-bold text-muted-foreground">Amount:</span> <span className="text-foreground font-mono">{selectedReq.amount ? `₦${selectedReq.amount.toLocaleString()}` : '—'}</span></p>
              <p><span className="font-bold text-muted-foreground">Department:</span> <span className="text-foreground">{selectedReq.department}</span></p>
              <p><span className="font-bold text-muted-foreground">Urgency:</span> <span className="text-foreground capitalize">{selectedReq.urgency}</span></p>
              <p><span className="font-bold text-muted-foreground">Description:</span> <span className="text-foreground">{selectedReq.description}</span></p>
              <p><span className="font-bold text-muted-foreground">Date:</span> <span className="text-foreground font-mono text-xs">{new Date(selectedReq.createdAt).toLocaleString()}</span></p>
            </div>
            {selectedReq.status === 'pending' && (
              <div className="flex items-center space-x-3 pt-4 border-t border-border/50">
                <button onClick={() => handleStatusChange(selectedReq.id, 'approved')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition-all">
                  <CheckCircle2 size={16} /> <span>Approve</span>
                </button>
                <button onClick={() => handleStatusChange(selectedReq.id, 'rejected')} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition-all">
                  <XCircle size={16} /> <span>Reject</span>
                </button>
              </div>
            )}
            <button onClick={() => setSelectedReq(null)} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors font-bold">Close</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">All <span className="text-primary italic">Requisitions</span></h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} records found</p>
          </div>
          <button onClick={() => setIsFormOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center space-x-2 w-fit">
            <Plus size={18} /> <span>New Requisition</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID or title..." className="w-full bg-white/80 border border-border/50 rounded-xl py-2.5 pl-12 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" />
          </div>
          <div className="flex space-x-2">
            {['all', 'pending', 'approved', 'rejected', 'draft'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${filterStatus === s ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/50 border-border/50 text-muted-foreground hover:text-foreground'}`}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse font-mono text-xs">Loading requisitions...</div>
        ) : (
          <div className="glass rounded-3xl border border-border/50 overflow-hidden shadow-sm bg-white/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                    <th className="py-4 px-6">Ref ID</th>
                    <th className="py-4 px-6">Type</th>
                    <th className="py-4 px-6">Title</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Dept</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
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
                      <td className="py-4 px-6"><span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${statusColors[r.status]}`}>{r.status}</span></td>
                      <td className="py-4 px-6 text-right">
                        <button onClick={() => setSelectedReq(r)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-all"><Eye size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan="7" className="py-12 text-center text-muted-foreground text-sm">No requisitions match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default RequisitionsPage;
