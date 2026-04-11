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
  login: async (email, password) => {
    return api.post('/auth/login', { email, password });
  },
  deptLogin: async (departmentName, accessCode, mfaCode) => {
    return api.post('/auth/dept-login', { departmentName, accessCode, mfaCode });
  },
  async checkSession() {
    return api.get('/auth/me');
  },
  
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Server unreachable — still clear local session
    }
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_user');
  }
};

export const workflowAPI = {
  async getStages() {
    return api.get('/workflow-stages');
  },
  async updateStages(stages) {
    return api.post('/workflow-stages', stages);
  }
};

export const typeAPI = {
  getTypes: async () => {
    return api.get('/requisition-types');
  },
  addType: async (data) => {
    return api.post('/requisition-types', data);
  },
  deleteType: async (id) => {
    return api.delete(`/requisition-types/${id}`);
  }
};

export const notificationAPI = {
  async getNotifications() {
    return api.get('/notifications');
  },
  async markRead(id) {
    return api.put(`/notifications/${id}/read`);
  },
  async markAllRead() {
    return api.put('/notifications/read-all');
  }
};

export const deptAPI = {
  async getDepartments() {
    return api.get('/departments');
  },
  async getDepartment(id) {
    return api.get(`/departments/${id}`);
  },
  async checkActivation(id) {
    return api.get(`/departments/${id}/activation`);
  },
  async addDepartment(dept) {
    return api.post('/departments', dept);
  },
  async deleteDepartment(id) {
    return api.delete(`/departments/${id}`);
  },
  async uploadStamp(deptId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/departments/${deptId}/stamp`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  async updateHead(deptId, payload) {
    return api.put(`/departments/${deptId}/head`, payload);
  }
};

export const forwardAPI = {
  async forward(id, payload) {
    return api.post(`/requisitions/${id}/forward`, payload);
  }
};

export const auditAPI = {
  async getAuditLogs() {
    return api.get('/audit-logs');
  }
};

export const reqAPI = {
  async getRequisitions() {
    return api.get('/requisitions');
  },
  async getRequisition(id) {
    return api.get(`/requisitions/${id}`);
  },
  async addRequisition(data) {
    return api.post('/requisitions', data);
  },
  async approveRequisition(id, remarks) {
    return api.post(`/requisitions/${id}/approve`, { remarks });
  },
  async rejectRequisition(id, remarks) {
    return api.post(`/requisitions/${id}/reject`, { remarks });
  },
  async getSignedPdf(id) {
    return api.get(`/requisitions/${id}/signed-pdf`, { responseType: 'blob' });
  }
};

export const userAPI = {
  async uploadSignature(userId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/users/${userId}/signature`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export default api;
