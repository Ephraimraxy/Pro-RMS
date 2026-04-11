import React, { useState } from 'react';
import { CheckCircle2, XCircle, Share2, MessageSquare } from 'lucide-react';
import VoiceDictation from './VoiceDictation';

const ApprovalActionPanel = ({ onApprove, onReject, onEscalate }) => {
  const [comment, setComment] = useState('');

  return (
    <div className="glass bg-white/80 p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare size={12} />
            <span>Decision Comments / Remarks</span>
          </div>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="State reason for approval or rejection..."
          className="w-full bg-white border border-border/50 rounded-2xl p-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px] transition-all text-sm shadow-sm"
        />
        <div className="flex items-center justify-start pb-2 pt-1 border-b border-border/40 mb-2">
           <VoiceDictation onTranscript={(text) => setComment(prev => prev + (prev ? ' ' : '') + text)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => onApprove(comment)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2"
        >
          <CheckCircle2 size={18} />
          <span>Approve</span>
        </button>
        
        <button
          onClick={() => onReject(comment)}
          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-4 rounded-2xl transition-all shadow-md shadow-destructive/20 flex items-center justify-center space-x-2"
        >
          <XCircle size={18} />
          <span>Reject</span>
        </button>

        <button
          onClick={() => onEscalate(comment)}
          className="col-span-2 lg:col-span-1 bg-muted hover:bg-muted/80 text-foreground font-bold py-4 rounded-2xl transition-all border border-border/50 flex items-center justify-center space-x-2 shadow-sm"
        >
          <Share2 size={18} />
          <span>Escalate</span>
        </button>
      </div>
    </div>
  );
};

export default ApprovalActionPanel;
