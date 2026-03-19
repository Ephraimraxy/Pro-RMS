import React from 'react';
import { Search, Filter, MoreVertical, Eye } from 'lucide-react';
import { CORPORATE_HIERARCHY } from '../constants/departments';

const QueueItem = ({ id, type, description, amount, department, status, date }) => (
  <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
    <td className="py-4 px-6">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-blue-400">#{id}</span>
        <span className="text-[10px] text-zinc-500 font-mono uppercase">{date}</span>
      </div>
    </td>
    <td className="py-4 px-6">
      <div className="flex items-center space-x-2">
        <span className={`w-2 h-2 rounded-full ${
          type === 'Cash' ? 'bg-emerald-500' : type === 'Material' ? 'bg-blue-500' : 'bg-amber-500'
        }`}></span>
        <span className="text-sm font-semibold text-white">{type}</span>
      </div>
    </td>
    <td className="py-4 px-6">
      <p className="text-sm text-zinc-400 line-clamp-1 max-w-xs">{description}</p>
    </td>
    <td className="py-4 px-6">
      <span className="text-sm font-bold text-white font-mono">{amount ? `₦${amount}` : '--'}</span>
    </td>
    <td className="py-4 px-6">
      <span className="text-xs font-medium text-zinc-500">{department}</span>
    </td>
    <td className="py-4 px-6">
      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
        status === 'Pending' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-zinc-800 border-white/5 text-zinc-500'
      }`}>
        {status}
      </span>
    </td>
    <td className="py-4 px-6 text-right">
       <button className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all">
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
    <div className="glass rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.01]">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search requisitions..." 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
          />
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all">
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-500 hover:text-white transition-all">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] text-zinc-500 text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
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
