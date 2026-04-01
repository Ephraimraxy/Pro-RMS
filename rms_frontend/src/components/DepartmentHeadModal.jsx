import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

const DepartmentHeadModal = ({ isOpen, department, onSave }) => {
  const [headName, setHeadName] = useState('');
  const [headTitle, setHeadTitle] = useState('');
  const [headEmail, setHeadEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!department) return;
    const isIsac = department.name?.toLowerCase().includes('isac') || department.code?.toLowerCase() === 'isc';
    setHeadName(department.headName || (isIsac ? 'Dr. Victor Umunnakwe' : ''));
    setHeadTitle(department.headTitle || (isIsac ? 'ISAC Coordinator' : ''));
    setHeadEmail(department.headEmail || '');
  }, [department]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
      <div className="glass bg-white/95 w-full max-w-lg rounded-3xl border border-border/50 shadow-2xl relative overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-xl font-bold text-foreground">Set Department Head</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Department head details are required for notifications and official memo headers.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Head Name</label>
            <input
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
              className="w-full bg-muted/20 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Head Title</label>
            <input
              value={headTitle}
              onChange={(e) => setHeadTitle(e.target.value)}
              className="w-full bg-muted/20 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Title / Position"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Email Address</label>
            <input
              type="email"
              value={headEmail}
              onChange={(e) => setHeadEmail(e.target.value)}
              className="w-full bg-muted/20 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="email@company.com"
            />
          </div>
        </div>
        <div className="p-6 border-t border-border/50 bg-muted/20">
          <button
            onClick={async () => {
              if (!headName.trim() || !headTitle.trim() || !headEmail.trim()) return;
              setSaving(true);
              await onSave({ headName: headName.trim(), headTitle: headTitle.trim(), headEmail: headEmail.trim() });
              setSaving(false);
            }}
            disabled={saving || !headName.trim() || !headTitle.trim() || !headEmail.trim()}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Department Head'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentHeadModal;
