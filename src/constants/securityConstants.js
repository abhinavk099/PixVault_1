export const SecurityEventType = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  FILE_UPLOAD: 'file_upload',
  FILE_DOWNLOAD: 'file_download',
  FILE_DELETE: 'file_delete',
  PASSWORD_CHANGE: 'password_change',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SECURITY_SETTING_CHANGE: 'security_setting_change'
};

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api';
