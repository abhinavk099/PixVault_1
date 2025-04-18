export const SecurityEventType = {
  // Authentication events
  LOGIN_SUCCESS: 'auth:login:success',
  LOGIN_FAILURE: 'auth:login:failure',
  LOGOUT: 'auth:logout',
  PASSWORD_CHANGE: 'auth:password:change',
  ACCOUNT_LOCKED: 'auth:account:locked',

  // Navigation events
  PAGE_VISIT: 'nav:page:visit',
  PAGE_NAVIGATION: 'nav:page:navigation',
  PAGE_EXIT: 'nav:page:exit',

  // File operations
  FILE_UPLOAD: 'file:upload',
  FILE_DOWNLOAD: 'file:download',
  FILE_DELETE: 'file:delete',
  FILE_SHARE: 'file:share',

  // Security events
  SECURITY_SETTING_CHANGE: 'security:setting:change',
  PERMISSION_CHANGE: 'security:permission:change',
  ROLE_CHANGE: 'security:role:change',
  SUSPICIOUS_ACTIVITY: 'security:suspicious:activity'
};
