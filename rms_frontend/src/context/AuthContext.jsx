import React, { createContext, useContext, useState, useEffect } from 'react';
import { logActivity, validateDepartmentLogin } from '../lib/store';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehydrate from localStorage
    const stored = localStorage.getItem('rms_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = async (systemId, password) => {
    const result = await authAPI.login(systemId, password);
    setUser(result);
    localStorage.setItem('rms_user', JSON.stringify(result));
    logActivity('Logged In', `${result.name} (Admin) authenticated at ${new Date().toLocaleTimeString()}`);
    return result;
  };

  const deptLogin = async (deptName, accessCode) => {
    const dept = await validateDepartmentLogin(deptName, accessCode);
    if (!dept) throw new Error("Invalid Department or Access Code");
    
    const result = {
      id: `dept_${dept.id}`,
      name: dept.name,
      role: 'department',
      deptId: dept.id,
      email: `${dept.name.toLowerCase().replace(/\s/g, '')}@cssgroup.local`
    };
    
    setUser(result);
    localStorage.setItem('rms_user', JSON.stringify(result));
    logActivity('Dept Logged In', `${dept.name} department authenticated at ${new Date().toLocaleTimeString()}`);
    return result;
  };

  const logout = async () => {
    logActivity('Logged Out', `User signed out`);
    await authAPI.logout();
    setUser(null);
    localStorage.removeItem('rms_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, deptLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
