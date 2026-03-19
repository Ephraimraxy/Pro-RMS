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
          isCompleted ? 'bg-primary/50' : 'bg-border/50'
        }`} />
      )}
      
      {/* Icon Node */}
      <div className={`absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
        isCompleted ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 
        isPending ? 'bg-background border-primary animate-pulse' : 
        isRejected ? 'bg-destructive border-destructive' :
        'bg-background border-border/50'
      }`}>
        {isCompleted && <Check size={12} className="text-primary-foreground" />}
        {isPending && <Clock size={12} className="text-primary" />}
        {!isCompleted && !isPending && !isRejected && <div className="w-1 h-1 bg-muted-foreground/30 rounded-full" />}
      </div>

      <div className="glass bg-white/70 p-4 rounded-2xl border border-border/50 group-hover:border-primary/30 transition-all shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className={`text-sm font-bold ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</h4>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">{date || 'Awaiting'}</span>
        </div>
        
        <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-2">
          <User size={12} />
          <span className="font-medium tracking-tight">{role}</span>
        </div>

        {comment && (
          <div className="flex items-start space-x-2 bg-muted/50 p-2 rounded-lg mt-2 italic text-[11px] text-muted-foreground">
            <MessageSquare size={10} className="mt-0.5 shrink-0" />
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
