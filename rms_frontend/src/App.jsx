import React, { useState, useEffect, useCallback, createContext, useContext, Suspense } from 'react'
import Login from './components/Login'
import PublicVerify from './components/PublicVerify'
import DepartmentHeadModal from './components/DepartmentHeadModal'
import Layout from './components/Layout'

// ── Error Boundary — catches failed lazy-chunk imports so the app never goes blank ──
class ChunkErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false, error: null }; }
  static getDerivedStateFromError(error) { return { failed: true, error }; }
  componentDidCatch(error) {
    // If it's a chunk-load failure, a hard reload usually fixes it
    if (/Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError/i.test(error?.message || '')) {
      // Give React one tick to paint the error UI before reloading
      setTimeout(() => window.location.reload(), 3000);
    }
  }
  render() {
    if (this.state.failed) {
      const isChunk = /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError/i.test(this.state.error?.message || '');
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-foreground">
              {isChunk ? 'New version available' : 'Something went wrong'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {isChunk
                ? 'The app was updated. The page will reload automatically in a moment…'
                : 'An unexpected error occurred. Please refresh the page.'}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
          >
            Reload Now
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Dashboard = React.lazy(() => import('./components/Dashboard'))
const WorkflowBuilder = React.lazy(() => import('./components/WorkflowBuilder'))
const DepartmentManager = React.lazy(() => import('./components/DepartmentManager'))
const AuditLogs = React.lazy(() => import('./components/AuditLogs'))
const DocumentStudio = React.lazy(() => import('./components/DocumentStudio'))
const RequisitionsPage = React.lazy(() => import('./components/RequisitionsPage'))
const MemoManagement = React.lazy(() => import('./components/MemoManagement'))
const DepartmentProfile = React.lazy(() => import('./components/DepartmentProfile'))
const MyActivity = React.lazy(() => import('./components/MyActivity'))

// ── HR Portal modules ──────────────────────────────────────────────────────────
const HRDashboard = React.lazy(() => import('./components/HRDashboard'))
const EmployeeDirectory = React.lazy(() => import('./components/EmployeeDirectory'))
const LeaveManagement = React.lazy(() => import('./components/LeaveManagement'))
const AttendanceTracker = React.lazy(() => import('./components/AttendanceTracker'))
const PayrollOverview = React.lazy(() => import('./components/PayrollOverview'))
const RecruitmentPipeline = React.lazy(() => import('./components/RecruitmentPipeline'))

import { AuthProvider, useAuth } from './context/AuthContext'
import { AIFeaturesProvider } from './context/AIFeaturesContext'
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
          toast.success('Connection Restored. Syncing pending actions…', {
            icon: <img src="/CSS_Group.png" className="w-8 h-5 object-cover rounded" alt="" />
          });
          flushSyncQueue();
        }
      } catch (err) {
        if (isOnline) {
          setIsOnline(false);
          toast.error('Offline Mode Active. Drafts will save locally.', {
            icon: <img src="/CSS_Group.png" className="w-8 h-5 object-cover rounded grayscale opacity-50" alt="" />,
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
  'dashboard', 'requisitions', 'memos', 'activity',
  'workflow_builder', 'department_manager', 'audit_logs',
  'document_studio', 'dept_profile',
  // HR Portal views
  'hr_dashboard', 'hr_employees', 'hr_leaves', 'hr_attendance', 'hr_payroll', 'hr_recruitment'
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
            <img src="/CSS_Group.png" className="w-24 h-14 object-cover rounded-xl animate-pulse" alt="Loading" />
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

  // Security Guard: Prevent department users from accessing admin/HR views,
  // and prevent non-HR users from accessing HR portal views.
  const isAdminView = ['workflow_builder', 'department_manager', 'audit_logs'].includes(currentView);
  const isHRView = ['hr_dashboard', 'hr_employees', 'hr_leaves', 'hr_attendance', 'hr_payroll', 'hr_recruitment'].includes(currentView);
  const activeView = (user.role === 'department' && (isAdminView || isHRView)) ? 'dashboard'
    : (user.role !== 'hr' && user.role !== 'global_admin' && isHRView) ? 'dashboard'
    : currentView;

  const views = {
    dashboard: <Dashboard onViewChange={navigate} />,
    requisitions: <RequisitionsPage onViewChange={navigate} initialReqId={deepLinkReqId} onDeepLinkConsumed={() => setDeepLinkReqId(null)} />,
    memos: <MemoManagement onViewChange={navigate} />,
    activity: <MyActivity onViewChange={navigate} />,
    workflow_builder: <WorkflowBuilder onViewChange={navigate} />,
    department_manager: <DepartmentManager onViewChange={navigate} />,
    audit_logs: <AuditLogs onViewChange={navigate} />,
    document_studio: <DocumentStudio user={user} onViewChange={navigate} />,
    dept_profile: <DepartmentProfile user={user} onViewChange={navigate} />,
    // HR Portal
    hr_dashboard:   <HRDashboard onViewChange={navigate} />,
    hr_employees:   <EmployeeDirectory onViewChange={navigate} />,
    hr_leaves:      <LeaveManagement onViewChange={navigate} />,
    hr_attendance:  <AttendanceTracker onViewChange={navigate} />,
    hr_payroll:     <PayrollOverview onViewChange={navigate} />,
    hr_recruitment: <RecruitmentPipeline onViewChange={navigate} />,
  };

  return (
    <>
    <Layout user={user} currentView={activeView} onViewChange={navigate}>
      <ChunkErrorBoundary>
        <Suspense fallback={
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="mt-4 text-xs font-mono text-muted-foreground animate-pulse">Loading module...</p>
          </div>
        }>
          {views[activeView] || views.dashboard}
        </Suspense>
      </ChunkErrorBoundary>
    </Layout>
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
              background: '#ffffff',
              color: '#1a1f2e',
              border: '1px solid rgba(26, 92, 26, 0.15)',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '600',
              boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.12), 0 4px 10px -3px rgba(0,0,0,0.06)'
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
        <AIFeaturesProvider>
          <AppContent />
        </AIFeaturesProvider>
      </AuthProvider>
    </NetworkProvider>
  )
}

export default App
