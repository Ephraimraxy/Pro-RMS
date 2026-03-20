import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, FileText, ClipboardCheck, History, Settings, 
  LogOut, Bell, Briefcase, Activity, User as UserIcon, PenTool,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active = false, onClick, mobile = false, isCollapsed = false }) => (
  <div 
    onClick={onClick}
    title={isCollapsed ? label : ''}
    className={mobile
      ? `flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer transition-all ${active ? 'text-primary scale-110' : 'text-muted-foreground hover:text-foreground'}`
      : `flex items-center group relative px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'space-x-3'} ${active ? 'bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
    }
  >
    <Icon size={mobile ? 22 : 20} className={`${mobile && active ? 'drop-shadow-md' : ''} transition-transform duration-300 group-hover:scale-110`} />
    {!mobile && !isCollapsed && (
      <span className="font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 transform translate-x-0 opacity-100">
        {label}
      </span>
    )}
    {isCollapsed && !mobile && (
       <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]">
         {label}
       </div>
    )}
    {mobile && <span className="text-[10px] font-bold mt-1 tracking-tight">{label}</span>}
  </div>
);

const Navbar = ({ user }) => (
  <nav className="h-16 border-b border-border/50 bg-white/80 backdrop-blur-md sticky top-0 z-[60] flex items-center justify-between px-4 lg:px-6">
    <div className="flex items-center space-x-3 lg:space-x-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
         <img src="/favicon.png" alt="Logo" className="w-6 h-6 object-contain" />
      </div>
      <div>
        <h1 className="text-sm font-bold text-foreground tracking-tight uppercase">CSS <span className="text-primary font-black italic">RMS</span></h1>
      </div>
    </div>

    <div className="flex items-center space-x-4 lg:space-x-6">
      <div className="hidden lg:flex items-center space-x-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-3 py-1.5 rounded-full border border-border/50 hover:bg-muted transition-colors cursor-default group">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse group-hover:scale-125 transition-transform"></div>
        <span className="group-hover:text-foreground transition-colors">RMS NODE: ONLINE</span>
      </div>
      
      <button className="relative text-muted-foreground hover:text-primary transition-colors">
        <Bell size={20} />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
      </button>

      <div className="flex items-center space-x-3 pl-4 lg:pl-6 border-l border-border/50">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-foreground leading-none flex items-center justify-end space-x-1.5">
            <span>{user?.name || 'Administrator'}</span>
            {user?.role !== 'department' && (
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[8px] uppercase tracking-tighter border border-primary/20">ROOT</span>
            )}
          </p>
          <p className="text-[10px] text-primary font-bold mt-1 uppercase tracking-widest opacity-70">
            {user?.role === 'department' ? 'Unit Controller' : (user?.role || 'Global Admin')}
          </p>
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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('rms_sidebar_collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('rms_sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans antialiased">
      <Navbar user={user} />
      
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside 
          className={`h-[calc(100vh-64px)] border-r border-border/50 bg-white/50 backdrop-blur-md sticky top-16 hidden lg:flex flex-col transition-all duration-300 ease-in-out group/sidebar ${isCollapsed ? 'w-20' : 'w-64'}`}
        >
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 mt-2 animate-in fade-in duration-500">
                  Main Navigation
                </p>
              )}
              <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} isCollapsed={isCollapsed} />
              <SidebarItem icon={FileText} label="Memo Management" active={currentView === 'memos'} onClick={() => onViewChange('memos')} isCollapsed={isCollapsed} />
              <SidebarItem icon={ClipboardCheck} label="Requisitions" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} isCollapsed={isCollapsed} />
              <SidebarItem icon={History} label="My Activity" active={currentView === 'activity'} onClick={() => onViewChange('activity')} isCollapsed={isCollapsed} />
              <SidebarItem icon={PenTool} label="Document Studio" active={currentView === 'document_studio'} onClick={() => onViewChange('document_studio')} isCollapsed={isCollapsed} />
            </div>

            {user?.role !== 'department' && (
              <div className="mt-8 space-y-1">
                {!isCollapsed && (
                  <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 animate-in fade-in duration-500">
                    Administration
                  </p>
                )}
                <SidebarItem icon={Settings} label="Workflow Builder" active={currentView === 'workflow_builder'} onClick={() => onViewChange('workflow_builder')} isCollapsed={isCollapsed} />
                <SidebarItem icon={Briefcase} label="Dept Manager" active={currentView === 'department_manager'} onClick={() => onViewChange('department_manager')} isCollapsed={isCollapsed} />
                <SidebarItem icon={Activity} label="System Audit" active={currentView === 'audit_logs'} onClick={() => onViewChange('audit_logs')} isCollapsed={isCollapsed} />
              </div>
            )}
            
            <div className="mt-4 space-y-1">
               <SidebarItem icon={LogOut} label="Sign Out" onClick={logout} isCollapsed={isCollapsed} />
            </div>
          </div>

          {/* Collapse Toggle Button */}
          <div className="p-4 border-t border-border/50 bg-muted/20">
            <button 
              onClick={toggleSidebar}
              className="w-full h-10 flex items-center justify-center rounded-xl bg-white border border-border/60 shadow-sm hover:bg-muted hover:text-primary transition-all duration-300 group"
            >
              {isCollapsed ? (
                <ChevronRight size={18} className="group-hover:scale-125 transition-transform" />
              ) : (
                <>
                  <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="ml-2 text-xs font-bold uppercase tracking-widest overflow-hidden whitespace-nowrap">Collapse</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 p-4 pb-28 lg:p-8 lg:pb-8 overflow-y-auto relative z-10 w-full transition-all duration-300">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-border/50 lg:hidden flex items-center justify-around px-2 py-3 z-[100] shadow-[0_-4px_24px_rgba(0,0,0,0.05)] pb-safe">
        <SidebarItem icon={LayoutDashboard} label="Overview" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} mobile />
        <SidebarItem icon={ClipboardCheck} label="Requests" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} mobile />
        <SidebarItem icon={PenTool} label="Studio" active={currentView === 'document_studio'} onClick={() => onViewChange('document_studio')} mobile />
        {user?.role !== 'department' && (
          <SidebarItem icon={Settings} label="Admin" active={['workflow_builder', 'department_manager', 'audit_logs'].includes(currentView)} onClick={() => onViewChange('workflow_builder')} mobile />
        )}
        <SidebarItem icon={LogOut} label="Sign Out" onClick={logout} mobile />
      </nav>
    </div>
  );
};

export default Layout;
