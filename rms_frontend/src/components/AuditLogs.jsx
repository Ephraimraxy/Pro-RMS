import React from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { Activity, ShieldCheck, User, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const AuditLogEntry = ({ user, action, type, details, date }) => {
  const icons = {
    approval: <CheckCircle2 size={14} className="text-emerald-400" />,
    rejection: <XCircle size={14} className="text-red-400" />,
    security: <ShieldCheck size={14} className="text-blue-400" />,
    system: <Activity size={14} className="text-zinc-400" />,
    warning: <AlertTriangle size={14} className="text-amber-400" />
  };

  return (
    <div className="flex items-start space-x-4 p-4 border-b border-white/5 hover:bg-white/[0.01] transition-all group">
      <div className={`mt-1 p-2 rounded-lg bg-white/5 border border-white/5`}>
        {icons[type] || icons.system}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
            {user} <span className="text-zinc-500 font-medium font-sans">performed</span> {action}
          </p>
          <span className="text-[10px] text-zinc-500 font-mono flex items-center space-x-1 uppercase">
            <Clock size={10} />
            <span>{date}</span>
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">{details}</p>
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
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-3">
              <Activity className="text-blue-500" />
              <span>Audit <span className="text-blue-500">Logs</span></span>
            </h1>
            <p className="text-zinc-500 text-sm mt-1 font-medium italic">Immutable ledger of all system decisions and security actions.</p>
          </div>
          <div className="bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-xl text-blue-400 text-xs font-bold uppercase tracking-widest">
            Audit Mode Active
          </div>
        </div>

        <div className="glass rounded-3xl border border-white/5 overflow-hidden shadow-2xl divide-y divide-white/5">
          {logs.map((log, idx) => (
            <AuditLogEntry key={idx} {...log} />
          ))}
        </div>
        
        <div className="text-center py-8">
           <button className="text-xs font-bold text-zinc-500 hover:text-white transition-all bg-white/5 px-6 py-2.5 rounded-xl border border-white/5">
             Load More Activity
           </button>
        </div>
      </div>
    </Layout>
  );
};

export default AuditLogs;
