import React from 'react';
import { Search, Filter, MoreVertical, Eye } from 'lucide-react';

const QueueItem = ({ id, type, description, amount, department, status, date }) => (
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
      <p className="text-sm text-foreground line-clamp-1 max-w-xs">{description}</p>
    </td>
    <td className="py-4 px-6">
      <span className="text-sm font-bold text-foreground font-mono">{amount ? `₦${amount}` : '--'}</span>
    </td>
    <td className="py-4 px-6">
      <span className="text-xs font-medium text-muted-foreground">{department}</span>
    </td>
    <td className="py-4 px-6">
      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
        status === 'Pending' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border/50 text-muted-foreground'
      }`}>
        {status}
      </span>
    </td>
    <td className="py-4 px-6 text-right">
       <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-all">
         <Eye size={16} />
       </button>
    </td>
  </tr>
);

const ApprovalQueue = () => {
  const dummyData = [
    { id: 'REQ-2026-001', type: 'Cash', description: 'Office Supplies Reimbursement', amount: '45,000', department: 'Hatchery', status: 'Pending', date: '19 MAR 2026' },
    { id: 'REQ-2026-002', type: 'Material', description: 'Printer Toner Cartridges (10 units)', amount: '120,000', department: 'Poultry', status: 'Pending', date: '19 MAR 2026' },
    { id: 'REQ-2026-003', type: 'Memo', description: 'Request for Policy Review Meeting', amount: null, department: 'HR Department', status: 'Approved', date: '18 MAR 2026' },
  ];

  return (
    <div className="glass rounded-3xl border border-border/50 overflow-hidden shadow-sm bg-white/60">
      <div className="p-6 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search requisitions..." 
            className="w-full bg-white/80 border border-border/50 rounded-xl py-2.5 pl-12 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 bg-white/80 border border-border/50 px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-primary transition-all shadow-sm">
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button className="p-2.5 bg-white/80 border border-border/50 rounded-xl text-muted-foreground hover:text-primary transition-all shadow-sm">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
              <th className="py-4 px-6">Ref ID</th>
              <th className="py-4 px-6">Type</th>
              <th className="py-4 px-6">Description</th>
              <th className="py-4 px-6">Amount</th>
              <th className="py-4 px-6">Dept</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6"></th>
            </tr>
          </thead>
          <tbody>
            {dummyData.map(item => <QueueItem key={item.id} {...item} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApprovalQueue;
