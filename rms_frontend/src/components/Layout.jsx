import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, ClipboardCheck, History, Settings, LogOut, Bell, Briefcase, Activity, User as UserIcon, PenTool } from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active = false, onClick, mobile = false }) => (
  <div 
    onClick={onClick}
    className={mobile
      ? `flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer transition-all ${active ? 'text-primary scale-110' : 'text-muted-foreground hover:text-foreground'}`
      : `flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
  }>
    <Icon size={mobile ? 22 : 20} className={mobile && active ? 'drop-shadow-md' : ''} />
    <span className={mobile ? "text-[10px] font-bold mt-1 tracking-tight" : "font-medium text-sm"}>{label}</span>
  </div>
);

const Navbar = ({ user }) => (
  <nav className="h-16 border-b border-border/50 bg-white/80 backdrop-blur-md sticky top-0 z-[60] flex items-center justify-between px-4 lg:px-6">
    <div className="flex items-center space-x-3 lg:space-x-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
         <img src="/favicon.png" alt="Logo" className="w-6 h-6 object-contain" />
      </div>
      <div>
        <h1 className="text-sm font-bold text-foreground tracking-tight">CSS <span className="text-primary font-black italic">RMS</span></h1>
      </div>
    </div>

    <div className="flex items-center space-x-4 lg:space-x-6">
      <div className="hidden lg:flex items-center space-x-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-3 py-1.5 rounded-full border border-border/50">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span>Production Cluster</span>
      </div>
      
      <button className="relative text-muted-foreground hover:text-primary transition-colors">
        <Bell size={20} />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
      </button>

      <div className="flex items-center space-x-3 pl-4 lg:pl-6 border-l border-border/50">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-foreground leading-none">{user?.name || 'Administrator'}</p>
          <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-tighter">{user?.role || 'Global Admin'}</p>
        </div>
        <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center text-primary">
           <UserIcon size={18} className="lg:w-5 lg:h-5" />
        </div>
      </div>
    </div>
  </nav>
);

const Layout = ({ children, user, currentView, onViewChange }) => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans antialiased">
      <Navbar user={user} />
      
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="w-64 h-[calc(100vh-64px)] border-r border-border/50 bg-white/50 backdrop-blur-md sticky top-16 hidden lg:block p-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 mt-2">Main Navigation</p>
            <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} />
            <SidebarItem icon={FileText} label="Memo Management" active={currentView === 'memos'} onClick={() => onViewChange('memos')} />
            <SidebarItem icon={ClipboardCheck} label="Requisitions" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} />
            <SidebarItem icon={History} label="My Activity" active={currentView === 'activity'} onClick={() => onViewChange('activity')} />
            <SidebarItem icon={PenTool} label="Document Studio" active={currentView === 'document_studio'} onClick={() => onViewChange('document_studio')} />
          </div>

          <div className="mt-8 space-y-1">
           <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">Administration</p>
           <SidebarItem icon={Settings} label="Workflow Builder" active={currentView === 'workflow_builder'} onClick={() => onViewChange('workflow_builder')} />
           <SidebarItem icon={Briefcase} label="Dept Manager" active={currentView === 'department_manager'} onClick={() => onViewChange('department_manager')} />
           <SidebarItem icon={Activity} label="System Audit" active={currentView === 'audit_logs'} onClick={() => onViewChange('audit_logs')} />
           <SidebarItem icon={LogOut} label="Sign Out" onClick={logout} />
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 p-4 pb-28 lg:p-8 lg:pb-8 overflow-y-auto relative z-10 w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-border/50 lg:hidden flex items-center justify-around px-2 py-3 z-[100] shadow-[0_-4px_24px_rgba(0,0,0,0.05)] pb-safe">
        <SidebarItem icon={LayoutDashboard} label="Overview" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} mobile />
        <SidebarItem icon={ClipboardCheck} label="Requests" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} mobile />
        <SidebarItem icon={PenTool} label="Studio" active={currentView === 'document_studio'} onClick={() => onViewChange('document_studio')} mobile />
        <SidebarItem icon={Settings} label="Admin" active={['workflow_builder', 'department_manager', 'audit_logs'].includes(currentView)} onClick={() => onViewChange('workflow_builder')} mobile />
        <SidebarItem icon={LogOut} label="Sign Out" onClick={logout} mobile />
      </nav>
    </div>
  );
};

export default Layout;
