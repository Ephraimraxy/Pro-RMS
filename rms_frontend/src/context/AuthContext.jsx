import React, { createContext, useContext, useState, useEffect } from 'react';
import odoo from '../lib/odoo';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if session exists on load
    const checkAuth = async () => {
      try {
        const session = await odoo.checkSession();
        if (session && session.uid) {
          setUser(session);
        }
      } catch (e) {
        console.error("Auth check failed", e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (systemId, password) => {
    const db = import.meta.env.VITE_ODOO_DB || 'RMS';
    const result = await odoo.login(db, systemId, password);
    setUser(result);
    return result;
  };

  const logout = () => {
    // TODO: Implement Odoo logout RPC
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
