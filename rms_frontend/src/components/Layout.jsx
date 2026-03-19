import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, ClipboardCheck, History, Settings, LogOut, Bell, Briefcase, Activity, User as UserIcon, PenTool } from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
    active ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/10' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
  }`}>
    <Icon size={20} />
    <span className="font-medium text-sm">{label}</span>
  </div>
);

const Navbar = ({ user }) => (
  <nav className="h-16 border-b border-white/5 glass sticky top-0 z-[60] flex items-center justify-between px-6">
    <div className="flex items-center space-x-4">
      <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center overflow-hidden">
         <img src="/favicon.png" alt="Logo" className="w-6 h-6 object-contain" />
      </div>
      <div className="hidden md:block">
        <h1 className="text-sm font-bold text-white tracking-tight">CSS <span className="text-blue-500 font-black italic">RMS</span></h1>
      </div>
    </div>

    <div className="flex items-center space-x-6">
      <div className="hidden lg:flex items-center space-x-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span>Production Cluster</span>
      </div>
      
      <button className="relative text-zinc-400 hover:text-white transition-colors">
        <Bell size={20} />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-background"></span>
      </button>

      <div className="flex items-center space-x-3 pl-6 border-l border-white/5">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-white leading-none">{user?.name || 'Authorized User'}</p>
          <p className="text-[10px] text-zinc-500 font-medium mt-1 uppercase tracking-tighter">{user?.role || 'Staff'}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400">
           <UserIcon size={20} />
        </div>
      </div>
    </div>
  </nav>
);

const Layout = ({ children, user, currentView, onViewChange }) => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-blue-500/30 font-sans antialiased">
      <Navbar user={user} />
      
      <div className="flex">
        <aside className="w-64 h-[calc(100vh-64px)] border-r border-white/5 glass sticky top-16 hidden lg:block p-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4 mt-2">Main Navigation</p>
            <SidebarItem 
               icon={LayoutDashboard} 
               label="Dashboard" 
               active={currentView === 'dashboard'} 
               onClick={() => onViewChange('dashboard')} 
            />
            <SidebarItem icon={FileText} label="Memo Management" />
            <SidebarItem icon={ClipboardCheck} label="Requisitions" />
            <SidebarItem icon={History} label="My Activity" />
            <SidebarItem 
               icon={PenTool} 
               label="Document Studio" 
               active={currentView === 'document_studio'} 
               onClick={() => onViewChange('document_studio')} 
            />
          </div>

          <div className="mt-8 space-y-1">
           <p className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">Administration</p>
           <SidebarItem 
              icon={Settings} 
              label="Workflow Builder" 
              active={currentView === 'workflow_builder'} 
              onClick={() => onViewChange('workflow_builder')} 
           />
           <SidebarItem 
              icon={Briefcase} 
              label="Dept Manager" 
              active={currentView === 'department_manager'} 
              onClick={() => onViewChange('department_manager')} 
           />
           <SidebarItem 
              icon={Activity} 
              label="System Audit" 
              active={currentView === 'audit_logs'} 
              onClick={() => onViewChange('audit_logs')} 
           />
           <SidebarItem icon={LogOut} label="Sign Out" onClick={logout} />
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
