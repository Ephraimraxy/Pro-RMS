import React, { useState } from 'react';
import { CheckCircle2, XCircle, Share2, MessageSquare } from 'lucide-react';

const ApprovalActionPanel = ({ onApprove, onReject, onEscalate }) => {
  const [comment, setComment] = useState('');

  return (
    <div className="glass p-6 rounded-3xl border border-white/10 shadow-lg space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center space-x-2">
          <MessageSquare size={12} />
          <span>Decision Comments / Remarks</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="State reason for approval or rejection..."
          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px] transition-all text-sm"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => onApprove(comment)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2"
        >
          <CheckCircle2 size={18} />
          <span>Approve</span>
        </button>
        
        <button
          onClick={() => onReject(comment)}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center space-x-2"
        >
          <XCircle size={18} />
          <span>Reject</span>
        </button>

        <button
          onClick={() => onEscalate(comment)}
          className="col-span-2 lg:col-span-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-all border border-white/5 flex items-center justify-center space-x-2"
        >
          <Share2 size={18} />
          <span>Escalate</span>
        </button>
      </div>
    </div>
  );
};

export default ApprovalActionPanel;
