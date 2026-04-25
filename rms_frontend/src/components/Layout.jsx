import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../App';
import {
  LayoutDashboard, FileText, ClipboardCheck, History, Settings,
  LogOut, Bell, Briefcase, Activity, User as UserIcon, PenTool,
  ChevronLeft, ChevronRight, Menu, Inbox, Clock, WifiOff, RefreshCcw,
  Building2, ShieldAlert, Users, CalendarDays, DollarSign, UserPlus,
  HeartHandshake
} from 'lucide-react';
import { getNotifications, getSyncQueueStatus, flushSyncQueue, markNotificationRead, markAllNotificationsRead, clearNotifications, getRequisitions } from '../lib/store';
import { reqAPI } from '../lib/api';

const normalizeRole = (r) => (r || '').toLowerCase().replace(/\s+/g, '_');

const SidebarItem = ({ icon: Icon, label, active = false, onClick, mobile = false, isCollapsed = false }) => (
  <div
    onClick={onClick}
    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
    tabIndex={0}
    title={isCollapsed ? label : ''}
    className={mobile
      ? `flex flex-col items-center justify-center p-2.5 rounded-2xl cursor-pointer transition-all active:scale-95 outline-none focus-electric-halo hover-orange-pulse ${active ? 'text-[#f97316] animate-electric-pulse' : 'text-white'}`
      : `flex items-center group relative px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-300 hover-shine-effect outline-none focus-electric-halo hover-orange-pulse ${isCollapsed ? 'justify-center mx-1' : 'space-x-4 mx-1'} ${active ? 'bg-white/10 text-[#f97316] shadow-lg shadow-black/20 scale-[0.98] animate-electric-pulse animate-active-hum' : 'text-white'}`
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
      <div className="absolute left-full ml-4 px-3 py-2 bg-white text-primary text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 shadow-xl whitespace-nowrap z-[100] uppercase tracking-widest">
        {label}
      </div>
    )}
    {mobile && <span className={`text-[9px] font-black mt-1.5 uppercase tracking-tighter transition-all ${active ? 'text-[#f97316]' : 'text-white'}`}>{label}</span>}
  </div>
);

const Navbar = ({ user, toggleSidebar, isCollapsed, notifications, setNotifications, showBell, setShowBell, onLogout, onViewChange, currentView, actionAlert }) => {
  const { isOnline } = useNetwork();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotifClick = async (n) => {
    // Mark as read (fire and forget — don't await so UI stays responsive)
    if (!n.isRead) {
      markNotificationRead(n.id).catch(() => { });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
    }

    setShowBell(false);

    let matchedId = null;
    if (n.link) {
      const match = n.link.match(/\/requisitions\/(\d+)/);
      if (match) matchedId = match[1];
    }

    if (matchedId) {
      // Persist the target so freshly-mounted RequisitionsPage can pick it up after load
      localStorage.setItem('rms_pending_requisition_id', matchedId);
      onViewChange('requisitions');
      // Fire at 100ms (component may already be mounted) and again at 700ms
      // (fallback for slow mount + data load). The localStorage approach also
      // catches it independently after loadData() resolves.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openRequisition', { detail: matchedId }));
      }, 100);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openRequisition', { detail: matchedId }));
      }, 700);
    } else {
      onViewChange('requisitions');
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleClearAll = async () => {
    await clearNotifications();
    setNotifications([]);
  };

  return (
    <nav className="h-14 border-b border-border/40 bg-white/70 backdrop-blur-xl sticky top-0 z-[60] flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center space-x-3 lg:space-x-5">
        <button onClick={toggleSidebar} className="hidden lg:flex p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors mr-1">
          <Menu size={18} />
        </button>
        <div className="w-20 h-11 rounded-xl overflow-hidden shrink-0 shadow-sm border border-primary/10">
          <img src="/CSS_Group.png" alt="Logo" className="w-full h-full object-cover object-center" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-[10px] font-black text-foreground tracking-[0.2em] uppercase flex items-center leading-none">
            <span className="text-primary italic ml-1">RMS</span>
            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-primary/5 border border-primary/10 text-[7px] text-primary/60 font-mono hidden md:inline-block">V1.0.4</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-widest">RMS PORTAL</span>
            <span className="text-[8px] text-muted-foreground/30">/</span>
            <span className="text-[8px] font-black text-primary uppercase tracking-widest">
              {currentView === 'dashboard' ? 'Overview' :
                currentView === 'requisitions' ? 'Requisition Directory' :
                  currentView === 'dept_profile' ? 'Authority Profile' :
                    currentView === 'memos' ? 'Document Management' :
                      currentView === 'activity' ? 'System Activity' :
                        currentView === 'document_studio' ? 'Document Studio' :
                          currentView === 'workflow_builder' ? 'Workflow Architecture' :
                            currentView === 'department_manager' ? 'Tenant Control' :
                              currentView === 'audit_logs' ? 'Security Audit' :
                                currentView === 'hr_dashboard' ? 'HR Overview' :
                                  currentView === 'hr_employees' ? 'Employee Directory' :
                                    currentView === 'hr_leaves' ? 'Leave Management' :
                                      currentView === 'hr_attendance' ? 'Attendance Tracker' :
                                        currentView === 'hr_payroll' ? 'Payroll Overview' :
                                          currentView === 'hr_recruitment' ? 'Recruitment Pipeline' : 'Portal'}
            </span>
          </div>
        </div>
      </div>

      {/* Centered Status Badge / Action Alert */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center">
        {actionAlert ? (
          <div
            onClick={() => onViewChange('requisitions')}
            className={`px-4 py-1.5 rounded-full border flex items-center gap-2.5 cursor-pointer transition-all duration-500 shadow-lg group hover:scale-105 active:scale-95 ${actionAlert.mode === 'desk'
              ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/30 animate-pulse'
              : 'bg-amber-500 text-white border-amber-600 shadow-amber-500/30'
              }`}>
            <ShieldAlert size={14} className={actionAlert.mode === 'desk' ? 'animate-bounce' : ''} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
              {actionAlert.mode === 'desk'
                ? `${actionAlert.count} Awaiting Your Signature`
                : `${actionAlert.count} Urgent In-Flight`}
            </span>
          </div>
        ) : (
          <div className={`px-4 py-1.5 rounded-full border flex items-center gap-2.5 transition-all duration-500 shadow-sm ${isOnline
            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 shadow-emerald-500/5'
            : 'bg-rose-500/5 border-rose-500/20 text-rose-500 shadow-rose-500/5'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[9px] font-black uppercase tracking-[0.25em]">
              {isOnline ? 'Neural Core: Online' : 'Neural Core: Offline'}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3 lg:space-x-5">
        <div className="relative">
          <button
            onClick={() => setShowBell(!showBell)}
            className={`relative transition-all p-1.5 rounded-lg ${showBell ? 'bg-foreground text-background shadow-md' : 'text-muted-foreground hover:bg-muted hover:text-primary'}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary rounded-full border-2 border-background text-[8px] font-black text-primary-foreground flex items-center justify-center px-0.5 shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showBell && (
            <div className="fixed inset-x-4 top-[60px] sm:absolute sm:inset-auto sm:right-0 sm:mt-3 sm:w-80 bg-white rounded-2xl border border-border/80 shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <div className="p-4 border-b border-border/40 bg-muted/30 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{unreadCount} Unread</span>
                )}
              </div>
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto opacity-50">
                      <Bell size={20} className="text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">No notifications yet.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`p-4 border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors cursor-pointer group ${!n.isRead ? 'bg-primary/[0.03]' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${!n.isRead ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          <Inbox size={14} />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className={`text-[11px] leading-tight ${!n.isRead ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>{n.message}</p>
                          <div className="flex items-center space-x-2 opacity-60">
                            <Clock size={10} />
                            <span className="text-[9px] font-medium">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 bg-muted/20 border-t border-border/40 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button onClick={handleMarkAllRead} className="text-[9px] font-black text-primary hover:text-primary/70 uppercase tracking-widest transition-colors">
                    Mark All Read
                  </button>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <button onClick={handleClearAll} className="text-[9px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors">
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 pl-4 lg:pl-5 border-l border-border/30">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-black text-foreground leading-none flex items-center justify-end space-x-1.5">
              <span>{user?.name || 'Administrator'}</span>
            </p>
            <p className="text-[9px] text-primary font-black mt-1 uppercase tracking-tighter opacity-80">
              {user?.role === 'department' ? 'Controller' : (user?.role || 'Admin Account')}
            </p>
          </div>

          {/* Mobile Log Out Button */}
          <button
            onClick={onLogout}
            className="lg:hidden p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>

          <button
            onClick={() => onViewChange('dept_profile')}
            title="My Profile"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm overflow-hidden font-black text-xs transition-all cursor-pointer
            ${currentView === 'dept_profile'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary'}`}
          >
            {user?.name ? user.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') : <UserIcon size={16} />}
          </button>
        </div>
      </div>
    </nav>
  );
};

const Layout = ({ children, user, currentView, onViewChange }) => {
  const { logout } = useAuth();
  const { isOnline } = useNetwork();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('rms_sidebar_collapsed');
    return saved === 'true';
  });
  const [notifications, setNotifications] = useState([]);
  const [showBell, setShowBell] = useState(false);
  const [syncPending, setSyncPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);
  const [showOversightMenu, setShowOversightMenu] = useState(false);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch (err) { console.error("Notif fetch error:", err); }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const [deptStatus, setDeptStatus] = useState({ isReady: true });
  useEffect(() => {
    if (user?.role === 'department') {
      const checkStats = async () => {
        try {
          const profile = await reqAPI.getDeptProfile();
          setDeptStatus({ isReady: profile.hasSignature && profile.headName && profile.headEmail });
        } catch (e) { }
      };
      checkStats();
    }
  }, [user]);

  useEffect(() => {
    const checkActions = async () => {
      if (!user?.deptId) return;
      try {
        const all = await getRequisitions();
        const userDeptId = Number(user.deptId);
        const userDeptName = user.departmentName || '';
        const isAdmin = normalizeRole(user.role) === 'global_admin';
        const isExecutive = isAdmin ||
          /ceo|chairman/i.test(userDeptName) ||
          /general\s*manager|\bgm\b/i.test(userDeptName);

        // Items actively waiting for MY action (Red Pulse: folder is on your desk)
        const pendingForMe = all.filter(r => {
          const isTargeted = Number(r.targetDepartmentId) === userDeptId && r.status === 'pending';
          const needsFinal = isExecutive && r.status === 'approved' && (!r.finalApprovalStatus || r.finalApprovalStatus === 'none');
          const isVetting = Number(r.currentVettingDeptId) === userDeptId && r.finalApprovalStatus === 'vetting';
          return isTargeted || needsFinal || isVetting;
        });

        if (pendingForMe.length > 0) {
          // Red Pulse Alert: folder is on your desk for your signature
          setActionAlert({ urgency: 'critical', count: pendingForMe.length, mode: 'desk' });
        } else {
          // Amber Alert: check if you have urgent in-flight items pending someone else's input
          const urgentElsewhere = all.filter(r => {
            const submittedByMe = Number(r.departmentId) === userDeptId;
            const isInFlight = r.status === 'pending' ||
              (r.finalApprovalStatus && !['treated', 'published', 'none'].includes(r.finalApprovalStatus));
            const isUrgent = ['urgent', 'critical'].includes((r.urgency || '').toLowerCase());
            return submittedByMe && isInFlight && isUrgent;
          });

          if (urgentElsewhere.length > 0) {
            // Amber Alert: urgent folder pending someone else's input
            setActionAlert({ urgency: 'urgent', count: urgentElsewhere.length, mode: 'elsewhere' });
          } else {
            setActionAlert(null); // Neural Core Online: all clear
          }
        }
      } catch (err) {
        console.warn("Action check failed:", err);
      }
    };

    checkActions();
    const interval = setInterval(checkActions, 30000);
    window.addEventListener('requisitionUpdated', checkActions);
    return () => {
      clearInterval(interval);
      window.removeEventListener('requisitionUpdated', checkActions);
    };
  }, [user?.deptId]);

  useEffect(() => {
    const loadSync = async () => {
      const status = await getSyncQueueStatus();
      setSyncPending(status.pending || 0);
    };
    loadSync();
    const interval = setInterval(loadSync, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const sync = async () => {
      setSyncing(true);
      await flushSyncQueue();
      const status = await getSyncQueueStatus();
      setSyncPending(status.pending || 0);
      setSyncing(false);
    };
    sync();
  }, [isOnline]);

  useEffect(() => {
    localStorage.setItem('rms_sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-foreground selection:bg-primary/30 font-sans antialiased overflow-x-hidden">
      <Navbar
        user={user}
        toggleSidebar={toggleSidebar}
        isCollapsed={isCollapsed}
        notifications={notifications}
        setNotifications={setNotifications}
        showBell={showBell}
        setShowBell={setShowBell}
        onLogout={logout}
        onViewChange={onViewChange}
        currentView={currentView}
        actionAlert={actionAlert}
      />

      {syncPending > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-bold px-4 py-2 flex items-center justify-between">
          <span>{isOnline ? `${syncPending} item(s) pending sync` : `${syncPending} item(s) queued (offline)`}</span>
          <button
            onClick={async () => {
              if (!isOnline || syncing) return;
              setSyncing(true);
              await flushSyncQueue({ force: true });
              const status = await getSyncQueueStatus();
              setSyncPending(status.pending || 0);
              setSyncing(false);
            }}
            className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-[10px] uppercase tracking-widest ${isOnline ? 'border-amber-300 hover:bg-amber-100' : 'border-amber-200 opacity-60 cursor-not-allowed'
              }`}
          >
            <RefreshCcw size={12} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing' : 'Sync Now'}</span>
          </button>
        </div>
      )}

      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        {/* Desktop Sidebar App-Tile Navigation */}
        <aside
          className={`border-r border-white/5 bg-[#206e33] sticky top-0 hidden lg:flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isCollapsed ? 'w-20' : 'w-64'}`}
        >
          <div className="p-4 pt-6 flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
            <div className="space-y-2">
              {!isCollapsed && (
                <p className="px-4 text-[9px] font-black text-white/30 uppercase tracking-[0.25em] mb-4 ml-1 animate-in fade-in slide-in-from-left-2 duration-700">
                  Main Network
                </p>
              )}
              <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} isCollapsed={isCollapsed} />
              <SidebarItem icon={ClipboardCheck} label="Requisitions" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} isCollapsed={isCollapsed} />

              {user?.role === 'department' && (
                <SidebarItem
                  icon={deptStatus.isReady ? Building2 : ShieldAlert}
                  label="Profile"
                  active={currentView === 'dept_profile'}
                  onClick={() => onViewChange('dept_profile')}
                  isCollapsed={isCollapsed}
                />
              )}

              <SidebarItem icon={FileText} label="MEMO" active={currentView === 'memos'} onClick={() => onViewChange('memos')} isCollapsed={isCollapsed} />
              <SidebarItem icon={History} label="My Activity" active={currentView === 'activity'} onClick={() => onViewChange('activity')} isCollapsed={isCollapsed} />
              <SidebarItem icon={PenTool} label="Studio" active={currentView === 'document_studio'} onClick={() => onViewChange('document_studio')} isCollapsed={isCollapsed} />
            </div>

            {(user?.role === 'hr' || user?.role === 'global_admin') && (
              <div className="mt-10 space-y-2">
                {!isCollapsed && (
                  <p className="px-4 text-[9px] font-black text-white/30 uppercase tracking-[0.25em] mb-4 ml-1 animate-in fade-in slide-in-from-left-2 duration-700">
                    HR Portal
                  </p>
                )}
                <SidebarItem icon={HeartHandshake} label="HR Overview" active={currentView === 'hr_dashboard'} onClick={() => onViewChange('hr_dashboard')} isCollapsed={isCollapsed} />
                <SidebarItem icon={Users} label="Employees" active={currentView === 'hr_employees'} onClick={() => onViewChange('hr_employees')} isCollapsed={isCollapsed} />
                <SidebarItem icon={CalendarDays} label="Leave" active={currentView === 'hr_leaves'} onClick={() => onViewChange('hr_leaves')} isCollapsed={isCollapsed} />
                <SidebarItem icon={Clock} label="Attendance" active={currentView === 'hr_attendance'} onClick={() => onViewChange('hr_attendance')} isCollapsed={isCollapsed} />
                <SidebarItem icon={DollarSign} label="Payroll" active={currentView === 'hr_payroll'} onClick={() => onViewChange('hr_payroll')} isCollapsed={isCollapsed} />
                <SidebarItem icon={UserPlus} label="Recruitment" active={currentView === 'hr_recruitment'} onClick={() => onViewChange('hr_recruitment')} isCollapsed={isCollapsed} />
              </div>
            )}

            {user?.role !== 'department' && user?.role !== 'hr' && (
              <div className="mt-10 space-y-2">
                {!isCollapsed && (
                  <p className="px-4 text-[9px] font-black text-white/30 uppercase tracking-[0.25em] mb-4 ml-1 animate-in fade-in slide-in-from-left-2 duration-700">
                    Oversight Center
                  </p>
                )}
                <SidebarItem icon={Settings} label="System Studio" active={currentView === 'workflow_builder'} onClick={() => onViewChange('workflow_builder')} isCollapsed={isCollapsed} />
                <SidebarItem icon={Briefcase} label="Departments" active={currentView === 'department_manager'} onClick={() => onViewChange('department_manager')} isCollapsed={isCollapsed} />
                <SidebarItem icon={Activity} label="System Audit" active={currentView === 'audit_logs'} onClick={() => onViewChange('audit_logs')} isCollapsed={isCollapsed} />
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border/20 mb-2">
            <SidebarItem icon={LogOut} label="Log Out" onClick={logout} isCollapsed={isCollapsed} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 w-full bg-[#FAF9F6]/50">
          <div className="p-3 lg:p-5 max-w-full mx-auto animate-slide-up">
            {children}
          </div>
        </main>
      </div>

      {/* Modern Floating Mobile App-Bar Navigation (Glassmorphism) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md lg:hidden z-[100] animate-in slide-in-from-bottom-5 duration-500">
        {/* Admin Oversight slide-up tray */}
        {showOversightMenu && user?.role !== 'department' && (
          <div className="mb-3 glass bg-white/80 backdrop-blur-2xl border border-white/40 rounded-[1.5rem] shadow-2xl shadow-primary/10 overflow-hidden animate-in slide-in-from-bottom-3 duration-200">
            <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em] px-4 pt-3 pb-1">Oversight Center</p>
            <div className="grid grid-cols-3 divide-x divide-border/20">
              <button onClick={() => { onViewChange('workflow_builder'); setShowOversightMenu(false); }}
                className={`flex flex-col items-center gap-1 py-3 px-2 text-[10px] font-bold transition-colors ${currentView === 'workflow_builder' ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'}`}>
                <Settings size={18} />
                System Studio
              </button>
              <button onClick={() => { onViewChange('department_manager'); setShowOversightMenu(false); }}
                className={`flex flex-col items-center gap-1 py-3 px-2 text-[10px] font-bold transition-colors ${currentView === 'department_manager' ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'}`}>
                <Briefcase size={18} />
                Departments
              </button>
              <button onClick={() => { onViewChange('audit_logs'); setShowOversightMenu(false); }}
                className={`flex flex-col items-center gap-1 py-3 px-2 text-[10px] font-bold transition-colors ${currentView === 'audit_logs' ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'}`}>
                <Activity size={18} />
                System Audit
              </button>
            </div>
          </div>
        )}
        <nav className="bg-[#206e33] border border-white/10 rounded-[2.5rem] flex items-center justify-around px-4 py-2 shadow-2xl shadow-black/30">
          {user?.role === 'department' ? (
            <>
              <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} mobile />
              <SidebarItem icon={FileText} label="MEMO" active={currentView === 'memos'} onClick={() => onViewChange('memos')} mobile />
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#206e33] shadow-lg hover:scale-110 transition-transform active:scale-95 -translate-y-4 border-4 border-[#FAF9F6] cursor-pointer" onClick={() => onViewChange('document_studio')}>
                <PenTool size={20} />
              </div>
              <SidebarItem icon={ClipboardCheck} label="Requisitions" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} mobile />
              <SidebarItem icon={History} label="Activity" active={currentView === 'activity'} onClick={() => onViewChange('activity')} mobile />
            </>
          ) : user?.role === 'hr' ? (
            <>
              <SidebarItem icon={HeartHandshake} label="HR Home" active={currentView === 'hr_dashboard'} onClick={() => onViewChange('hr_dashboard')} mobile />
              <SidebarItem icon={Users} label="People" active={currentView === 'hr_employees'} onClick={() => onViewChange('hr_employees')} mobile />
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#206e33] shadow-lg hover:scale-110 transition-transform active:scale-95 -translate-y-4 border-4 border-[#FAF9F6] cursor-pointer" onClick={() => onViewChange('hr_leaves')}>
                <CalendarDays size={20} />
              </div>
              <SidebarItem icon={DollarSign} label="Payroll" active={currentView === 'hr_payroll'} onClick={() => onViewChange('hr_payroll')} mobile />
              <SidebarItem icon={UserPlus} label="Recruit" active={currentView === 'hr_recruitment'} onClick={() => onViewChange('hr_recruitment')} mobile />
            </>
          ) : (
            <>
              <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} mobile />
              <SidebarItem icon={ClipboardCheck} label="Requisitions" active={currentView === 'requisitions'} onClick={() => onViewChange('requisitions')} mobile />
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#206e33] shadow-lg hover:scale-110 transition-transform active:scale-95 -translate-y-4 border-4 border-[#FAF9F6] cursor-pointer" onClick={() => onViewChange('document_studio')}>
                <PenTool size={20} />
              </div>
              <SidebarItem icon={FileText} label="MEMO" active={currentView === 'memos'} onClick={() => onViewChange('memos')} mobile />
              <button
                onClick={() => setShowOversightMenu(v => !v)}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-colors ${['workflow_builder', 'department_manager', 'audit_logs'].includes(currentView) || showOversightMenu ? 'text-white' : 'text-white/40'}`}
              >
                <Settings size={18} />
                <span className="text-[9px] font-bold">Oversight</span>
              </button>
            </>
          )}
        </nav>
      </div>

    </div>
  );
};

export default Layout;
