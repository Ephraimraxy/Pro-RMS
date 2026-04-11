import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { getRequisitions } from '../lib/store';

const QueueItem = ({ id, type, title, amount, department, status, date, currentStageName, onView }) => (
  <tr className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
    <td className="py-4 px-6">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-primary">#{id}</span>
        <span className="text-[10px] text-muted-foreground font-mono uppercase">{date}</span>
      </div>
    </td>
    <td className="py-4 px-6">
      <div className="flex items-center space-x-2">
        <span className={`w-2 h-2 rounded-full ${
          type === 'Cash' ? 'bg-emerald-500' : type === 'Material' ? 'bg-primary' : 'bg-amber-500'
        }`}></span>
        <span className="text-sm font-semibold text-foreground">{type}</span>
      </div>
    </td>
    <td className="py-4 px-6">
      <p className="text-sm text-foreground line-clamp-1 max-w-xs">{title}</p>
    </td>
    <td className="py-4 px-6">
      <span className="text-sm font-bold text-foreground font-mono">
        {amount ? `₦${Number(amount).toLocaleString()}` : '—'}
      </span>
    </td>
    <td className="py-4 px-6">
      <span className="text-xs font-medium text-muted-foreground">{department}</span>
    </td>
    <td className="py-4 px-6">
      {currentStageName ? (
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md whitespace-nowrap">
          {currentStageName}
        </span>
      ) : (
        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
          status === 'pending' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border/50 text-muted-foreground'
        }`}>
          {status}
        </span>
      )}
    </td>
    <td className="py-4 px-6 text-right">
       <button onClick={onView} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-all">
         <Eye size={16} />
       </button>
    </td>
  </tr>
);

const ApprovalQueue = ({ onViewRequisition, filterStatus = 'pending' }) => {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const all = await getRequisitions();
      setRequisitions(all);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = requisitions.filter(r => {
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchesSearch = !search || 
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      String(r.id).includes(search);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="glass rounded-3xl border border-border/50 overflow-hidden shadow-sm bg-white/60">
      <div className="p-6 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search requisitions..." 
            className="w-full bg-white/80 border border-border/50 rounded-xl py-2.5 pl-12 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <Clock size={14} />
          <span className="font-bold">{filtered.length} {filterStatus === 'pending' ? 'pending' : ''} items</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 size={24} className="mx-auto mb-3 animate-spin text-primary" />
            <p className="text-xs font-bold">Loading requisitions…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-3">
            <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
            <p className="text-sm font-semibold">
              {filterStatus === 'pending' 
                ? 'All caught up! No pending requisitions.' 
                : 'No requisitions match your filter.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                <th className="py-4 px-6">Ref ID</th>
                <th className="py-4 px-6">Type</th>
                <th className="py-4 px-6">Title</th>
                <th className="py-4 px-6">Amount</th>
                <th className="py-4 px-6">Dept</th>
                <th className="py-4 px-6">Stage</th>
                <th className="py-4 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <QueueItem
                  key={r.id}
                  id={r.id}
                  type={r.type}
                  title={r.title}
                  amount={r.amount}
                  department={r.department}
                  status={r.status}
                  currentStageName={r.currentStageName}
                  date={new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                  onView={() => onViewRequisition?.(r)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ApprovalQueue;
