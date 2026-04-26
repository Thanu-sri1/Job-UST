import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
};

export const taskAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  getStats: () => api.get('/tasks/stats'),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  getUnread: () => api.get('/notifications/unread'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  sendTestEmail: (message) => api.post('/notifications/test-email', { message }),
};

export const analyticsAPI = {
  getSummary: () => api.get('/analytics/me/summary'),
  getCompleted: (range = 'week') => api.get('/analytics/me/tasks-completed', { params: { range } }),
  getAdminProductivity: () => api.get('/analytics/admin/users/productivity'),
  getAdminOverview: () => api.get('/analytics/admin/tasks/overview'),
};

export const fileAPI = {
  upload: (taskId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/files/tasks/${taskId}`, formData);
  },
  getByTask: (taskId) => api.get(`/files/tasks/${taskId}`),
  download: (fileId) => api.get(`/files/${fileId}/download`, { responseType: 'blob' }),
  delete: (fileId) => api.delete(`/files/${fileId}`),
};

export const searchAPI = {
  tasks: (params) => api.get('/search/tasks', { params }),
  suggestions: (q) => api.get('/search/suggestions', { params: { q } }),
};

export const commentAPI = {
  create: (taskId, data) => api.post(`/comments/tasks/${taskId}`, data),
  getByTask: (taskId) => api.get(`/comments/tasks/${taskId}`),
  reply: (commentId, data) => api.post(`/comments/${commentId}/replies`, data),
  update: (commentId, data) => api.patch(`/comments/${commentId}`, data),
  delete: (commentId) => api.delete(`/comments/${commentId}`),
};

export const reminderAPI = {
  create: (taskId, data) => api.post(`/reminders/tasks/${taskId}`, data),
  getMine: () => api.get('/reminders/me'),
  update: (id, data) => api.patch(`/reminders/${id}`, data),
  delete: (id) => api.delete(`/reminders/${id}`),
};

export default api;
