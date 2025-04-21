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

// Token management functions
const tokenManager = {
  getAccessToken: () => {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  },
  getRefreshToken: () => {
    return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
  },
  saveTokens: (accessToken, refreshToken, rememberMe = false) => {
    if (rememberMe) {
      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('authTokenExpiry', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()); // 30 days
    } else {
      sessionStorage.setItem('authToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('authTokenExpiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()); // 24 hours
    }
  },
  clearTokens: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authTokenExpiry');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('authTokenExpiry');
  },
  isTokenExpired: () => {
    const expiry = localStorage.getItem('authTokenExpiry') || sessionStorage.getItem('authTokenExpiry');
    if (!expiry) return true;
    return new Date(expiry) < new Date();
  }
};

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Flag to prevent multiple refresh token requests
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Response interceptor to handle auth responses and token refresh
api.interceptors.response.use(
  (response) => {
    // If login was successful and token is in response, save it
    if ((response.config.url.endsWith('/auth/signin') || 
         response.config.url.endsWith('/auth/verify-otp') || 
         response.config.url.endsWith('/auth/get-token')) && 
        response.data?.token) {
      // Check if the request included rememberMe parameter
      const requestData = JSON.parse(response.config.data || '{}');
      const shouldRemember = requestData.rememberMe === true;
      
      // Save both access and refresh tokens
      tokenManager.saveTokens(response.data.token, response.data.refreshToken, shouldRemember);
      
      // Also save user data if available
      if (response.data.user) {
        localStorage.setItem('currentUser', JSON.stringify(response.data.user));
        console.log('Saved user data to localStorage:', response.data.user);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 Unauthorized and we haven't already tried to refresh the token
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If we're already refreshing, add this request to the queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const refreshToken = tokenManager.getRefreshToken();
        
        if (!refreshToken) {
          // No refresh token, clear tokens and redirect to login
          tokenManager.clearTokens();
          window.location.href = '/auth';
          return Promise.reject(error);
        }
        
        // Try to refresh the token
        const response = await api.post('/auth/refresh-token', { refreshToken });
        
        if (response.data?.token) {
          // Save the new tokens
          tokenManager.saveTokens(response.data.token, response.data.refreshToken);
          
          // Update authorization header for the original request
          originalRequest.headers['Authorization'] = `Bearer ${response.data.token}`;
          
          // Process any queued requests
          processQueue(null, response.data.token);
          
          // Retry the original request
          return api(originalRequest);
        } else {
          // Refresh failed, clear tokens and redirect to login
          tokenManager.clearTokens();
          window.location.href = '/auth';
          return Promise.reject(error);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        tokenManager.clearTokens();
        processQueue(refreshError, null);
        window.location.href = '/auth';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // For other errors, just reject the promise
    return Promise.reject(error);
  }
);

// Auth endpoints
export const auth = {
  signin: (credentials) => api.post('/auth/signin', credentials),
  register: (userData) => api.post('/auth/signup', userData),
  logout: () => {
    return api.post('/auth/signout').finally(() => {
      tokenManager.clearTokens();
    });
  },
  validateSession: (token) => {
    // If token is provided, set it in the headers for this specific request
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`
      };
    }
    return api.get('/auth/me', config);
  },
  refreshToken: (refreshToken) => api.post('/auth/refresh-token', { refreshToken }),
  
  // PassMatrix endpoints
  getMatrixImages: (params) => api.get('/auth/matrix-images', { params }),
  createPatternSession: (data) => api.post('/auth/create-pattern-session', data),
  storePatternHash: (data) => {
    // Ensure the hash parameter is correctly named for the server
    const serverData = { ...data };
    if (data.patternHash) {
      serverData.hash = data.patternHash;
      delete serverData.patternHash;
    }
    return api.post('/auth/store-pattern-hash', serverData);
  },
  verifyPattern: (data) => {
    // Ensure the hash parameter is correctly named for the server
    const serverData = { ...data };
    if (data.patternHash) {
      serverData.hash = data.patternHash;
      delete serverData.patternHash;
    }
    return api.post('/auth/verify-pattern', serverData);
  },
  completeRegistration: (data) => api.post('/auth/complete-registration', data),
  
  // User verification endpoints
  checkUsername: (username, params) => api.get(`/auth/check-username/${username}`, { params }),
  sendOtp: (data) => api.post('/auth/send-otp', data),
  verifyOtp: (data) => api.post('/auth/verify-otp', data),
  getToken: (data) => api.post('/auth/get-token', data),
  
  // Pattern recovery endpoints
  requestRecoveryOtp: (data) => api.post('/auth/request-recovery-otp', data),
  verifyRecoveryOtp: (data) => api.post('/auth/verify-recovery-otp', data),
  resetPattern: (data) => {
    // Ensure the hash parameter is correctly named for the server
    const serverData = { ...data };
    if (data.patternHash) {
      serverData.hash = data.patternHash;
      delete serverData.patternHash;
    }
    return api.post('/auth/reset-pattern', serverData);
  }
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
  addLog: async ({ event_type, details, sessionToken }) => {
    try {
      // Make sure we have all required parameters
      if (!event_type) {
        console.warn('Missing required parameters for security logging');
        return { success: false, message: 'Missing required parameters' };
      }

      // Add authorization header if we have a session token
      const headers = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      // Skip security logging in development if it's causing issues
      console.log('Security event:', { event_type, details });
      return { success: true };
      
      /* Uncomment if security logging endpoint is available
      const response = await axios.post(`${API_BASE_URL}/security/log`, {
        event_type,
        details: details || '',
        timestamp: new Date().toISOString()
      }, { headers });

      return response.data;
      */
    } catch (error) {
      console.error('Security logging error:', error.message);
      // Non-critical - return error but don't throw
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }
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
