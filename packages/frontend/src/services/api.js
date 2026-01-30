import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Send cookies with requests
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Error de conexión';

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      toast.error('Sesión expirada. Por favor inicia sesión nuevamente.');
    } else {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  registerTenant: (data) =>
    api.post('/auth/register-tenant', data),

  refresh: (token) =>
    api.post('/auth/refresh', { token })
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  changePassword: (id, data) => api.put(`/users/${id}/password`, data),
  regenerateApiToken: (id) => api.post(`/users/${id}/regenerate-api-token`),
  getMe: () => api.get('/users/me')
};

// Tasks API
export const tasksAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  getHistory: (id) => api.get(`/tasks/${id}/history`),
  downloadTemplate: () => api.get('/tasks/template', { responseType: 'blob' }),
  importExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/tasks/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Telegram API
export const telegramAPI = {
  getStatus: () => api.get('/telegram/status'),
  configure: (data) => api.post('/telegram/configure', data),
  start: () => api.post('/telegram/start'),
  stop: () => api.post('/telegram/stop'),
  generateLinkCode: (userId, permissionIds) => api.post('/telegram/generate-link-code', { user_id: userId, permission_ids: permissionIds }),
  getContacts: () => api.get('/telegram/contacts'),
  getLinkCodes: () => api.get('/telegram/link-codes'),
  revokeLinkCode: (id) => api.delete(`/telegram/link-codes/${id}`),
  unlinkContact: (id) => api.put(`/telegram/contacts/${id}/unlink`),
  resetPin: (id) => api.put(`/telegram/contacts/${id}/reset-pin`),
  activateContact: (id) => api.put(`/telegram/contacts/${id}/activate`),
  deactivateContact: (id) => api.put(`/telegram/contacts/${id}/deactivate`),
  updateContactRole: (id, roles) => api.put(`/telegram/contacts/${id}/role`, { roles }),
  updateUserRole: (userId, roles) => api.put(`/telegram/users/${userId}/role`, { roles }),
  getPermissionsCatalog: (all = false) => api.get(`/telegram/permissions-catalog${all ? '?all=true' : ''}`),
  createPermission: (data) => api.post('/telegram/permissions-catalog', data),
  updatePermission: (id, data) => api.put(`/telegram/permissions-catalog/${id}`, data),
  deletePermission: (id) => api.delete(`/telegram/permissions-catalog/${id}`),
  updateContactPermissions: (id, permission_ids) => api.put(`/telegram/contacts/${id}/permissions`, { permission_ids })
};

// Property Types API
export const propertyTypesAPI = {
  getAll: (params) => api.get('/property-types', { params }),
  getById: (id) => api.get(`/property-types/${id}`),
  create: (data) => api.post('/property-types', data),
  update: (id, data) => api.put(`/property-types/${id}`, data),
  delete: (id) => api.delete(`/property-types/${id}`)
};

// Catalog API
export const catalogAPI = {
  getAll: (params) => api.get('/catalog', { params }),
  getById: (id) => api.get(`/catalog/${id}`),
  create: (data) => api.post('/catalog', data),
  update: (id, data) => api.put(`/catalog/${id}`, data),
  delete: (id) => api.delete(`/catalog/${id}`)
};

// Properties API
export const propertiesAPI = {
  getAll: (params) => api.get('/properties', { params }),
  getById: (id) => api.get(`/properties/${id}`),
  create: (data) => api.post('/properties', data),
  update: (id, data) => api.put(`/properties/${id}`, data),
  delete: (id) => api.delete(`/properties/${id}`),
  generateFromType: (typeId) => api.post(`/property-types/${typeId}/generate-properties`)
};

// Reservations API
export const reservationsAPI = {
  getAll: (params) => api.get('/reservations', { params }),
  getById: (id) => api.get(`/reservations/${id}`),
  create: (data) => api.post('/reservations', data),
  update: (id, data) => api.put(`/reservations/${id}`, data),
  delete: (id) => api.delete(`/reservations/${id}`),
  getBreakfastList: (date) => api.get('/reservations/breakfast-list', { params: { date } })
};

// Cleaning Tasks API
export const cleaningTasksAPI = {
  getAll: (params) => api.get('/cleaning-tasks', { params }),
  getToday: () => api.get('/cleaning-tasks/today'),
  getById: (id) => api.get(`/cleaning-tasks/${id}`),
  create: (data) => api.post('/cleaning-tasks', data),
  update: (id, data) => api.put(`/cleaning-tasks/${id}`, data),
  delete: (id) => api.delete(`/cleaning-tasks/${id}`),
  start: (id) => api.patch(`/cleaning-tasks/${id}/start`),
  complete: (id, notes) => api.patch(`/cleaning-tasks/${id}/complete`, { notes })
};
