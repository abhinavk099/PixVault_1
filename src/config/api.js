import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor for adding auth token
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

// Response interceptor to handle auth responses
api.interceptors.response.use(
  (response) => {
    // If login was successful and token is in response, save it
    if (response.config.url.endsWith('/auth/signin') && response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const auth = {
  login: (credentials) => api.post('/auth/signin', credentials),
  register: (userData) => api.post('/auth/signup', userData),
  logout: () => {
    return api.post('/auth/signout').finally(() => {
      localStorage.removeItem('token');
    });
  },
  validateSession: () => api.get('/auth/validate'),
  validatePattern: (pattern) => api.post('/auth/validate-pattern', { pattern }),
  getMatrixImages: () => api.get('/auth/matrix-images')
};

// User endpoints
export const user = {
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data)
};

// Security endpoints
export const security = {
  getLogs: () => api.get('/security/logs'),
  addLog: (event) => api.post('/security/log', event)
};

// Permissions endpoints
export const permissions = {
  getUserPermissions: () => api.get('/auth/permissions'),
  updateRole: (userId, role) => api.post('/auth/update-role', { userId, role })
};

// File endpoints
export const files = {
  upload: (formData) => api.post('/files/upload', formData),
  download: (fileId) => api.get(`/files/download/${fileId}`),
  delete: (fileId) => api.delete(`/files/${fileId}`),
  list: () => api.get('/files'),
  share: (fileId, users) => api.post(`/files/${fileId}/share`, { users })
};

export default api;