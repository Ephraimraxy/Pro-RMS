import React from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { Activity, ShieldCheck, User, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const AuditLogEntry = ({ user, action, type, details, date }) => {
  const icons = {
    approval: <CheckCircle2 size={14} className="text-emerald-500" />,
    rejection: <XCircle size={14} className="text-destructive" />,
    security: <ShieldCheck size={14} className="text-primary" />,
    system: <Activity size={14} className="text-muted-foreground" />,
    warning: <AlertTriangle size={14} className="text-amber-500" />
  };

  return (
    <div className="flex items-start space-x-4 p-4 border-b border-border/50 hover:bg-muted/50 transition-all group">
      <div className={`mt-1 p-2 rounded-lg bg-muted border border-border/50 shadow-sm`}>
        {icons[type] || icons.system}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            {user} <span className="text-muted-foreground font-medium font-sans">performed</span> {action}
          </p>
          <span className="text-[10px] text-muted-foreground font-mono flex items-center space-x-1 uppercase">
            <Clock size={10} />
            <span>{date}</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{details}</p>
      </div>
    </div>
  );
};

const AuditLogs = ({ onViewChange }) => {
  const { user } = useAuth();

  const logs = [
    { user: 'Admin Account', action: 'Policy Update', type: 'security', details: 'Updated the GM approval threshold from ₦500,000 to ₦1,000,000.', date: 'Today, 10:45 AM' },
    { user: 'Auditor (wuseberger@gmail.com)', action: 'Requisition Approval', type: 'approval', details: 'Approved REQ-2026-001 with comments: "Necessary for operation."', date: 'Today, 09:12 AM' },
    { user: 'System', action: 'Session Cleared', type: 'system', details: 'Auto-expired 4 sessions older than 24 hours.', date: 'Today, 00:01 AM' },
    { user: 'GM (Director)', action: 'High-Value Rejection', type: 'rejection', details: 'Rejected REQ-2026-005. Reason: "Exceeds monthly departmental budget."', date: 'Yesterday, 14:20 PM' },
    { user: 'Security Module', action: 'MFA Success', type: 'security', details: 'Global Admin successfully authenticated via MFA.', date: 'Yesterday, 08:00 AM' },
  ];

  return (
    <Layout user={user} currentView="audit_logs" onViewChange={onViewChange}>
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="flex items-center justify-between border-b border-border/50 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
              <Activity className="text-primary" />
              <span>Audit <span className="text-primary">Logs</span></span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium italic">Immutable ledger of all system decisions and security actions.</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl text-primary text-xs font-bold uppercase tracking-widest shadow-sm">
            Audit Mode Active
          </div>
        </div>

        <div className="glass bg-white/60 rounded-3xl border border-border/50 overflow-hidden shadow-md divide-y divide-border/50">
          {logs.map((log, idx) => (
            <AuditLogEntry key={idx} {...log} />
          ))}
        </div>
        
        <div className="text-center py-8">
           <button className="text-xs font-bold text-muted-foreground hover:text-foreground transition-all bg-white/80 px-6 py-2.5 rounded-xl border border-border shadow-sm hover:shadow-md">
             Load More Activity
           </button>
        </div>
      </div>
    </Layout>
  );
};

export default AuditLogs;
