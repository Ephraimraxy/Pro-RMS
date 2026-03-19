import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../lib/api';
import { logActivity } from '../lib/store';

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
    logActivity('Logged In', `${result.name} authenticated at ${new Date().toLocaleTimeString()}`);
    return result;
  };

  const logout = async () => {
    logActivity('Logged Out', `User signed out`);
    await authAPI.logout();
    setUser(null);
    localStorage.removeItem('rms_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
