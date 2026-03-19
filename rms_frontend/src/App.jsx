import React, { useState } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import WorkflowBuilder from './components/WorkflowBuilder'
import DepartmentManager from './components/DepartmentManager'
import AuditLogs from './components/AuditLogs'
import DocumentStudio from './components/DocumentStudio'
import { AuthProvider, useAuth } from './context/AuthContext'

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, workflow_builder, department_manager, audit_logs

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <img src="/favicon.png" className="w-10 h-10 object-contain animate-pulse" alt="Loading" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-bold text-white tracking-widest uppercase animate-pulse">Initializing Portal</p>
          <p className="text-[10px] text-zinc-500 font-mono">Securing Odoo Session...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const views = {
    dashboard: <Dashboard onViewChange={setCurrentView} />,
    workflow_builder: <WorkflowBuilder onViewChange={setCurrentView} />,
    department_manager: <DepartmentManager onViewChange={setCurrentView} />,
    audit_logs: <AuditLogs onViewChange={setCurrentView} />,
    document_studio: <DocumentStudio user={user} onViewChange={setCurrentView} />
  };

  return views[currentView] || views.dashboard;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
