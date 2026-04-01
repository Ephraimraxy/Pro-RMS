import React, { useState, useEffect, createContext, useContext } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import WorkflowBuilder from './components/WorkflowBuilder'
import DepartmentManager from './components/DepartmentManager'
import AuditLogs from './components/AuditLogs'
import DocumentStudio from './components/DocumentStudio'
import RequisitionsPage from './components/RequisitionsPage'
import MemoManagement from './components/MemoManagement'
import MyActivity from './components/MyActivity'
import DepartmentHeadModal from './components/DepartmentHeadModal'
import PublicVerify from './components/PublicVerify'
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

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [deptProfile, setDeptProfile] = useState(null);
  const [showDeptModal, setShowDeptModal] = useState(false);

  useEffect(() => {
    // Reset to dashboard whenever user session changes (login or logout)
    setCurrentView('dashboard');
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
  const activeView = (user.role === 'department' && isAdminView) ? 'dashboard' : currentView;

  const views = {
    dashboard: <Dashboard onViewChange={setCurrentView} />,
    requisitions: <RequisitionsPage onViewChange={setCurrentView} />,
    memos: <MemoManagement onViewChange={setCurrentView} />,
    activity: <MyActivity onViewChange={setCurrentView} />,
    workflow_builder: <WorkflowBuilder onViewChange={setCurrentView} />,
    department_manager: <DepartmentManager onViewChange={setCurrentView} />,
    audit_logs: <AuditLogs onViewChange={setCurrentView} />,
    document_studio: <DocumentStudio user={user} onViewChange={setCurrentView} />
  };

  return (
    <>
      {views[activeView] || views.dashboard}
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
