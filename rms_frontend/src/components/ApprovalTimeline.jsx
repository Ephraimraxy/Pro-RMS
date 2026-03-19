import React from 'react';
import { Check, Clock, User, MessageSquare } from 'lucide-react';

const TimelineStep = ({ label, role, status, isLast = false, date, comment }) => {
  const isCompleted = status === 'approved';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  return (
    <div className="relative pl-8 pb-8 last:pb-0 group">
      {!isLast && (
        <div className={`absolute left-[11px] top-6 bottom-0 w-[2px] ${
          isCompleted ? 'bg-blue-600/50' : 'bg-white/5'
        }`} />
      )}
      
      {/* Icon Node */}
      <div className={`absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
        isCompleted ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/20' : 
        isPending ? 'bg-background border-blue-500 animate-pulse' : 
        isRejected ? 'bg-red-600 border-red-600' :
        'bg-background border-white/10'
      }`}>
        {isCompleted && <Check size={12} className="text-white" />}
        {isPending && <Clock size={12} className="text-blue-400" />}
        {!isCompleted && !isPending && !isRejected && <div className="w-1 h-1 bg-white/20 rounded-full" />}
      </div>

      <div className="glass p-4 rounded-2xl border border-white/5 group-hover:border-blue-500/10 transition-all">
        <div className="flex items-center justify-between mb-2">
          <h4 className={`text-sm font-bold ${isCompleted ? 'text-white' : 'text-zinc-400'}`}>{label}</h4>
          <span className="text-[10px] text-zinc-500 font-mono uppercase">{date || 'Awaiting'}</span>
        </div>
        
        <div className="flex items-center space-x-2 text-xs text-zinc-500 mb-2">
          <User size={12} />
          <span className="font-medium tracking-tight">{role}</span>
        </div>

        {comment && (
          <div className="flex items-start space-x-2 bg-white/5 p-2 rounded-lg mt-2 italic text-[11px] text-zinc-400">
            <MessageSquare size={10} className="mt-0.5 mt-0.5 shrink-0" />
            <p>{comment}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ApprovalTimeline = ({ stages = [] }) => {
  return (
    <div className="py-4">
      {stages.map((stage, idx) => (
        <TimelineStep 
          key={stage.id} 
          {...stage} 
          isLast={idx === stages.length - 1} 
        />
      ))}
    </div>
  );
};

export default ApprovalTimeline;
