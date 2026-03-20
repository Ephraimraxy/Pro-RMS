import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, FileText, ClipboardCheck, History, Settings, 
  LogOut, Bell, Briefcase, Activity, User as UserIcon, PenTool,
  ChevronLeft, ChevronRight, Menu
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active = false, onClick, mobile = false, isCollapsed = false }) => (
  <div 
    onClick={onClick}
    title={isCollapsed ? label : ''}
    className={mobile
      ? `flex flex-col items-center justify-center p-2.5 rounded-2xl cursor-pointer transition-all active:scale-90 ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
      : `flex items-center group relative px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-300 ${isCollapsed ? 'justify-center mx-1' : 'space-x-4 mx-1'} ${active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[0.98]' : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`
    }
  >
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
      <Icon size={mobile ? 20 : 18} />
    </div>
    {!mobile && !isCollapsed && (
      <span className="font-bold text-[13px] tracking-tight whitespace-nowrap overflow-hidden transition-all duration-300">
        {label}
      </span>
    )}
    {isCollapsed && !mobile && (
       <div className="absolute left-full ml-4 px-3 py-2 bg-foreground text-background text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 shadow-xl whitespace-nowrap z-[100] uppercase tracking-widest">
         {label}
       </div>
    )}
    {mobile && <span className={`text-[9px] font-black mt-1.5 uppercase tracking-tighter transition-all ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>}
  </div>
);

const Navbar = ({ user, toggleSidebar, isCollapsed }) => (
  <nav className="h-14 border-b border-border/40 bg-white/70 backdrop-blur-xl sticky top-0 z-[60] flex items-center justify-between px-4 lg:px-6">
    <div className="flex items-center space-x-3 lg:space-x-5">
      <button onClick={toggleSidebar} className="hidden lg:flex p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors mr-1">
        <Menu size={18} />
      </button>
      <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shadow-inner">
         <img src="/favicon.png" alt="Logo" className="w-5 h-5 object-contain" />
      </div>
      <div>
        <h1 className="text-xs font-black text-foreground tracking-widest uppercase flex items-center">
          CSS <span className="text-primary italic ml-1">RMS</span>
          <span className="ml-3 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10 text-[8px] text-primary/60 font-mono hidden md:inline-block">V1.0.4</span>
        </h1>
      </div>
    </div>

    <div className="flex items-center space-x-3 lg:space-x-5">
      <div className="hidden md:flex items-center space-x-2 text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 hover:bg-muted/50 transition-colors cursor-default group">
        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse group-hover:scale-125 transition-transform"></div>
        <span className="group-hover:text-foreground transition-colors">NODE: ONLINE</span>
      </div>
      
      <button className="relative text-muted-foreground hover:text-primary transition-all p-1.5 hover:bg-muted rounded-lg">
        <Bell size={18} />
        <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border-2 border-background shadow-sm"></span>
      </button>

      <div className="flex items-center space-x-3 pl-4 lg:pl-5 border-l border-border/30">
        <div className="text-right hidden sm:block">
          <p className="text-[11px] font-black text-foreground leading-none flex items-center justify-end space-x-1.5">
            <span>{user?.name || 'Administrator'}</span>
          </p>
          <p className="text-[9px] text-primary font-black mt-1 uppercase tracking-tighter opacity-80">
            {user?.role === 'department' ? 'Controller' : (user?.role || 'Admin Account')}
          </p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center text-primary/70 shadow-sm overflow-hidden group hover:border-primary/30 transition-all cursor-pointer">
           <UserIcon size={16} className="group-hover:scale-110 transition-transform" />
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
    <div className="min-h-screen bg-[#FAF9F6] text-foreground selection:bg-primary/30 font-sans antialiased overflow-x-hidden">
      <Navbar user={user} toggleSidebar={toggleSidebar} isCollapsed={isCollapsed} />
      
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        {/* Desktop Sidebar App-Tile Navigation */}
        <aside 
          className={`border-r border-border/30 bg-white/40 backdrop-blur-3xl sticky top-0 hidden lg:flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isCollapsed ? 'w-20' : 'w-56'}`}
        >
          <div className="p-3 pt-5 flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
            <div className="space-y-1.5">
              {!isCollapsed && (
                <p className="px-4 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em] mb-4 ml-1 animate-in fade-in slide-in-from-left-2 duration-700">
                  Workspace
                </p>
              )}
              <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} isCollapsed={isCollapsed} />
              <SidebarItem icon={FileText} label="Management" active={currentView === 'memos'} onClick={() => onViewChange('memos')} isCollapsed={isCollapsed} />
              <SidebarItem icon={ClipboardCheck} label="Requisitions" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} isCollapsed={isCollapsed} />
              <SidebarItem icon={History} label="My Activity" active={currentView === 'activity'} onClick={() => onViewChange('activity')} isCollapsed={isCollapsed} />
              <SidebarItem icon={PenTool} label="Studio" active={currentView === 'document_studio'} onClick={() => onViewChange('document_studio')} isCollapsed={isCollapsed} />
            </div>

            {user?.role !== 'department' && (
              <div className="mt-8 space-y-1.5">
                {!isCollapsed && (
                  <p className="px-4 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em] mb-4 ml-1 animate-in fade-in slide-in-from-left-2 duration-700">
                    Control Center
                  </p>
                )}
                <SidebarItem icon={Settings} label="Workflows" active={currentView === 'workflow_builder'} onClick={() => onViewChange('workflow_builder')} isCollapsed={isCollapsed} />
                <SidebarItem icon={Briefcase} label="Departments" active={currentView === 'department_manager'} onClick={() => onViewChange('department_manager')} isCollapsed={isCollapsed} />
                <SidebarItem icon={Activity} label="System Audit" active={currentView === 'audit_logs'} onClick={() => onViewChange('audit_logs')} isCollapsed={isCollapsed} />
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border/20 mb-2">
             <SidebarItem icon={LogOut} label="Log Out" onClick={logout} isCollapsed={isCollapsed} />
          </div>
        </aside>

        {/* Dynamic Content Area with Stress-Free Scrolling */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 w-full bg-[#FAF9F6]/50">
          <div className="p-5 lg:p-10 max-w-7xl mx-auto animate-slide-up">
            {children}
          </div>
        </main>
      </div>

      {/* Modern Floating Mobile App-Bar Navigation (Glassmorphism) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md lg:hidden z-[100] animate-in slide-in-from-bottom-5 duration-500">
        <nav className="glass bg-white/60 backdrop-blur-2xl border border-white/40 rounded-[2.5rem] flex items-center justify-around px-4 py-2 shadow-2xl shadow-primary/10">
          <SidebarItem icon={LayoutDashboard} label="Home" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} mobile />
          <SidebarItem icon={ClipboardCheck} label="Inbox" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} mobile />
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 -translate-y-4 border-4 border-[#FAF9F6]" onClick={() => onViewChange('document_studio')}>
             <PenTool size={20} />
          </div>
          <SidebarItem icon={Briefcase} label="Admin" active={['workflow_builder', 'department_manager', 'audit_logs'].includes(currentView)} onClick={() => onViewChange('workflow_builder')} mobile />
          <SidebarItem icon={LogOut} label="Exit" onClick={logout} mobile />
        </nav>
      </div>
    </div>
  );
};

export default Layout;
