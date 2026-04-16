import React, { useState, useEffect, useCallback, createContext, useContext, Suspense } from 'react'
import Login from './components/Login'
import PublicVerify from './components/PublicVerify'
import DepartmentHeadModal from './components/DepartmentHeadModal'

const Dashboard = React.lazy(() => import('./components/Dashboard'))
const WorkflowBuilder = React.lazy(() => import('./components/WorkflowBuilder'))
const DepartmentManager = React.lazy(() => import('./components/DepartmentManager'))
const AuditLogs = React.lazy(() => import('./components/AuditLogs'))
const DocumentStudio = React.lazy(() => import('./components/DocumentStudio'))
const RequisitionsPage = React.lazy(() => import('./components/RequisitionsPage'))
const MemoManagement = React.lazy(() => import('./components/MemoManagement'))
const DepartmentProfile = React.lazy(() => import('./components/DepartmentProfile'))
const MyActivity = React.lazy(() => import('./components/MyActivity'))

import { AuthProvider, useAuth } from './context/AuthContext'
import { Wifi, WifiOff } from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'

import { flushSyncQueue, getDepartmentById, updateDepartmentHead } from './lib/store';

const NetworkContext = createContext({ isOnline: true });
export const useNetwork = () => useContext(NetworkContext);

const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let checkInterval;
    
    const checkConnectivity = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
        
        const response = await fetch('/health', { 
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok && !isOnline) {
          setIsOnline(true);
          toast.success('Connection Restored. Syncing drafts...', { 
            icon: <img src="/favicon.svg" className="w-5 h-5 object-contain" alt="" /> 
          });
          flushSyncQueue();
        }
      } catch (err) {
        if (isOnline) {
          setIsOnline(false);
          toast.error('Offline Mode Active. Drafts will save locally.', { 
            icon: <img src="/favicon.svg" className="w-5 h-5 object-contain grayscale opacity-50" alt="" />, 
            duration: 4000 
          });
        }
      }
    };

    // Initial check
    checkConnectivity();

    // Periodic heartbeat (every 10 seconds)
    checkInterval = setInterval(checkConnectivity, 10000);

    const handleBrowserStatusChange = () => {
      if (navigator.onLine) checkConnectivity();
      else setIsOnline(false);
    };

    window.addEventListener('online', handleBrowserStatusChange);
    window.addEventListener('offline', handleBrowserStatusChange);

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('online', handleBrowserStatusChange);
      window.removeEventListener('offline', handleBrowserStatusChange);
    };
  }, [isOnline]);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
};

// Valid view names — used to validate hash on load and popstate
const VALID_VIEWS = [
  'dashboard','requisitions','memos','activity',
  'workflow_builder','department_manager','audit_logs',
  'document_studio','dept_profile'
];

const getViewFromHash = () => {
  const hash = window.location.hash.replace('#', '');
  return VALID_VIEWS.includes(hash) ? hash : 'dashboard';
};

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState(getViewFromHash);
  const [deptProfile, setDeptProfile] = useState(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deepLinkReqId, setDeepLinkReqId] = useState(null);

  // navigate(view) — normal navigation
  // navigate('requisitions', { reqId: 31 }) — deep-link directly into a requisition
  const navigate = useCallback((view, opts = {}) => {
    const target = VALID_VIEWS.includes(view) ? view : 'dashboard';
    if (opts.reqId) setDeepLinkReqId(opts.reqId);
    setCurrentView(target);
    window.history.pushState({ view: target }, '', `#${target}`);
  }, []);

  // Handle browser back / forward buttons
  useEffect(() => {
    const onPopState = (e) => {
      const view = e.state?.view || getViewFromHash();
      setCurrentView(VALID_VIEWS.includes(view) ? view : 'dashboard');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    // Reset to dashboard whenever user session changes (login or logout)
    navigate('dashboard');
    setDeptProfile(null);
    setShowDeptModal(false);
  }, [user?.id]);

  useEffect(() => {
    const loadDept = async () => {
      if (!user || user.role !== 'department' || !user.deptId) return;
      const dept = await getDepartmentById(user.deptId);
      if (!dept) return;
      setDeptProfile(dept);
      if (!dept.headName || !dept.headTitle || !dept.headEmail) {
        setShowDeptModal(true);
      }
    };
    loadDept();
  }, [user?.role, user?.deptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <img src="/favicon.svg" className="w-12 h-12 object-contain animate-pulse" alt="Loading" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-bold text-primary tracking-widest uppercase animate-pulse">Initializing Portal</p>
          <p className="text-[10px] text-muted-foreground font-mono">Securing Session...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  // Security Guard: Prevent department users from accessing admin views
  const isAdminView = ['workflow_builder', 'department_manager', 'audit_logs'].includes(currentView);
  const activeView  = (user.role === 'department' && isAdminView) ? 'dashboard' : currentView;

  const views = {
    dashboard: <Dashboard onViewChange={navigate} />,
    requisitions: <RequisitionsPage onViewChange={navigate} initialReqId={deepLinkReqId} onDeepLinkConsumed={() => setDeepLinkReqId(null)} />,
    memos: <MemoManagement onViewChange={navigate} />,
    activity: <MyActivity onViewChange={navigate} />,
    workflow_builder: <WorkflowBuilder onViewChange={navigate} />,
    department_manager: <DepartmentManager onViewChange={navigate} />,
    audit_logs: <AuditLogs onViewChange={navigate} />,
    document_studio: <DocumentStudio user={user} onViewChange={navigate} />,
    dept_profile: <DepartmentProfile user={user} onViewChange={navigate} />
  };

  return (
    <>
      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-mono text-muted-foreground animate-pulse">Loading module...</p>
        </div>
      }>
        {views[activeView] || views.dashboard}
      </Suspense>
      <DepartmentHeadModal
        isOpen={showDeptModal}
        department={deptProfile}
        onSave={async (payload) => {
          if (!deptProfile) return;
          const updated = await updateDepartmentHead(deptProfile.id, payload);
          setDeptProfile(updated);
          setShowDeptModal(false);
        }}
      />
    </>
  );
};

function App() {
  if (window.location.pathname.startsWith('/verify')) {
    return (
      <>
        <Toaster 
          position="top-center" 
          toastOptions={{ 
            style: { 
              background: 'hsl(var(--card))', 
              color: 'hsl(var(--foreground))', 
              border: '1px solid hsl(var(--border))', 
              borderRadius: '12px', 
              fontSize: '14px', 
              fontWeight: '600',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
            } 
          }} 
        />
        <PublicVerify />
      </>
    )
  }
  return (
    <NetworkProvider>
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          style: { 
            background: 'hsl(var(--card))', 
            color: 'hsl(var(--foreground))', 
            border: '1px solid hsl(var(--border))', 
            borderRadius: '12px', 
            fontSize: '14px', 
            fontWeight: '600',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
          } 
        }} 
      />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NetworkProvider>
  )
}

export default App
