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
import { AuthProvider, useAuth } from './context/AuthContext'
import { Wifi, WifiOff } from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'

import { flushSyncQueue } from './lib/store';

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
            icon: <img src="/favicon.png" className="w-5 h-5 object-contain" alt="" /> 
          });
          flushSyncQueue();
        }
      } catch (err) {
        if (isOnline) {
          setIsOnline(false);
          toast.error('Offline Mode Active. Drafts will save locally.', { 
            icon: <img src="/favicon.png" className="w-5 h-5 object-contain grayscale opacity-50" alt="" />, 
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
      <div className={`fixed bottom-[90px] left-1/2 -translate-x-1/2 lg:bottom-6 lg:left-6 lg:translate-x-0 z-[100] px-3 py-1.5 lg:px-4 lg:py-2 rounded-full shadow-lg flex items-center space-x-2 backdrop-blur-md border transition-all duration-500 scale-90 origin-bottom lg:scale-100 ${
        isOnline 
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
          : 'bg-destructive/10 border-destructive text-destructive'
      }`}>
        {isOnline ? (
          <>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">RMS Global: Online</span>
          </>
        ) : (
          <>
            <WifiOff size={14} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Offline Mode Active</span>
          </>
        )}
      </div>
    </NetworkContext.Provider>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    // Reset to dashboard whenever user session changes (login or logout)
    setCurrentView('dashboard');
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <img src="/favicon.png" className="w-10 h-10 object-contain animate-pulse" alt="Loading" />
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

  return views[activeView] || views.dashboard;
};

function App() {
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
