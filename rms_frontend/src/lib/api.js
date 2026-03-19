import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// For offline draft saving/queueing later
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("API Error Response:", error);
    // TODO: Intercept network failure for offline syncing queue
    return Promise.reject(error);
  }
);

export const authAPI = {
  async login(systemId, password) {
    // Temporary Mock until Node.js backend is up
    if (systemId === 'admin' && password === 'admin') {
       return { uid: 1, name: 'System Administrator', role: 'Global Admin', session_id: 'mock_token' };
    }
    throw new Error('Invalid Credentials');
    // return api.post('/auth/login', { systemId, password });
  },
  
  async checkSession() {
    // Temporary pass-through
    return null;
    // return api.get('/auth/session');
  },
  
  async logout() {
    // return api.post('/auth/logout');
  }
};

export default api;
