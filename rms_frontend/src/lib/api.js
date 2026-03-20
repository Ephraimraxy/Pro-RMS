import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("API Error Response:", error);
    if (error.response?.status === 401) {
      // Handle unauthorized (expired token)
      // Do not reload if the error is from a login attempt
      const configUrl = error.config?.url || '';
      if (!configUrl.includes('/auth/login') && !configUrl.includes('/auth/dept-login')) {
        localStorage.removeItem('rms_token');
        localStorage.removeItem('rms_user');
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  async login(email, password) {
    return api.post('/auth/login', { email, password });
  },
  
  async deptLogin(departmentName, accessCode) {
    return api.post('/auth/dept-login', { departmentName, accessCode });
  },

  async checkSession() {
    return api.get('/auth/me');
  },
  
  async logout() {
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_user');
  }
};

export const deptAPI = {
  async getDepartments() {
    return api.get('/departments');
  }
};

export const reqAPI = {
  async getRequisitions() {
    return api.get('/requisitions');
  },
  async addRequisition(data) {
    return api.post('/requisitions', data);
  }
};

export default api;
