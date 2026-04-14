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
  async (error) => {
    console.error("API Error Response:", error);
    const originalRequest = error.config;
    
    // Prevent infinite loops on authenticating/refresh requests
    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/dept-login') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await api.post('/auth/refresh');
        if (refreshResponse && refreshResponse.token) {
          localStorage.setItem('rms_token', refreshResponse.token);
          localStorage.setItem('rms_user', JSON.stringify(refreshResponse.user));
          originalRequest.headers.Authorization = `Bearer ${refreshResponse.token}`;
          // Re-fire original request with new token
          const res = await axios(originalRequest);
          return res.data; // Note: originalRequest uses raw axios which doesn't auto-unpack .data like our custom instance
        }
      } catch (refreshErr) {
        console.warn('Silent refresh failed, terminating session.', refreshErr);
        localStorage.removeItem('rms_token');
        localStorage.removeItem('rms_user');
        window.location.reload();
      }
    } else if (error.response?.status === 401) {
      // If we already retried and failed again, log out
      localStorage.removeItem('rms_token');
      localStorage.removeItem('rms_user');
      window.location.reload();
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
  },
  async clearAll() {
    return api.delete('/notifications/clear-all');
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
  async forward(requisitionId, { targetDepartmentId, note, returnToSender }) {
    return api.post(`/requisitions/${requisitionId}/forward`, {
      targetDepartmentId: targetDepartmentId || null,
      note: note || '',
      returnToSender: !!returnToSender
    });
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
  async updateRequisition(id, data) {
    return api.put(`/requisitions/${id}`, data);
  },
  async deleteRequisition(id) {
    return api.delete(`/requisitions/${id}`);
  },
  async deleteMultipleRequisitions(ids) {
    return api.post('/requisitions/bulk-delete', { ids });
  },
  async approveRequisition(id, remarks) {
    return api.post(`/requisitions/${id}/approve`, { remarks });
  },
  async rejectRequisition(id, remarks) {
    return api.post(`/requisitions/${id}/reject`, { remarks });
  },
  async getSignedPdf(id) {
    return api.get(`/requisitions/${id}/signed-pdf`, { responseType: 'blob' });
  },
  async getDynamicPdf(id, upToEventId = null) {
    const params = upToEventId ? `?upToEventId=${encodeURIComponent(upToEventId)}` : '';
    return api.get(`/requisitions/${id}/dynamic-pdf${params}`, { responseType: 'blob' });
  },
  async getDeptProfile() {
    return api.get('/department/profile');
  },
  async updateDeptProfile(data) {
    return api.put('/department/profile', data);
  },
  async uploadDeptSignature(file) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/department/signature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
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

export const aiAPI = {
  async refineDraft(rawDescription, mode = 'auto') {
    try {
      return await api.post('/ai/refine-requisition', { rawDescription, mode });
    } catch (err) {
      // 422 = AI blocked the content — return the body as a normal value so callers can read res.blocked
      if (err?.response?.status === 422 && err?.response?.data?.blocked) {
        return err.response.data;
      }
      throw err;
    }
  },
  async transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return api.post('/ai/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000
    });
  }
};

export default api;

