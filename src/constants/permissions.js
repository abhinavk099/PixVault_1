// Define permission types for different operations
export const Permissions = {
  // File operations
  FILE_UPLOAD: 'file:upload',
  FILE_DOWNLOAD: 'file:download',
  FILE_DELETE: 'file:delete',
  FILE_SHARE: 'file:share',
  
  // User management
  USER_VIEW: 'user:view',
  USER_EDIT: 'user:edit',
  
  // Security operations
  SECURITY_LOGS: 'security:logs',
  
  // Admin operations
  ADMIN_ALL: 'admin:all'
};

// Predefined roles with their permissions
export const Roles = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  GUEST: 'guest'
};
