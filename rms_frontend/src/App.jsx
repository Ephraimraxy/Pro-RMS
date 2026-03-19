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

// Network Context for PWA Offline Functionality
const NetworkContext = createContext({ isOnline: true });
export const useNetwork = () => useContext(NetworkContext);

const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection Restored. Syncing drafts...', { icon: '🟢' });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Offline Mode Active. Drafts will save locally.', { icon: '🟡', duration: 4000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
      {!isOnline && (
        <div className="fixed bottom-20 lg:bottom-6 right-6 z-[100] bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 backdrop-blur-md">
          <WifiOff size={16} className="animate-pulse" />
          <span className="text-sm font-bold tracking-tight">Offline Mode</span>
        </div>
      )}
    </NetworkContext.Provider>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

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

  return views[currentView] || views.dashboard;
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
