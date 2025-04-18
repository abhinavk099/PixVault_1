import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { permissions } from '../services/api';
import { Permissions, Roles } from '../constants/permissions';

// Create the permissions context
const PermissionsContext = createContext();

export const PermissionsProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user permissions from the server
  const fetchUserPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await permissions.getUserPermissions();
      setUserRole(data.role);
      setUserPermissions(data.permissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setError('Failed to fetch user permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user has a specific permission
  const hasPermission = useCallback((permissionName) => {
    if (userRole === Roles.ADMIN) return true;
    return userPermissions.some(p => p.name === permissionName);
  }, [userRole, userPermissions]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback((permissionNames) => {
    if (userRole === Roles.ADMIN) return true;
    return permissionNames.some(name => hasPermission(name));
  }, [userRole, hasPermission]);

  // Check if user has all of the specified permissions
  const hasAllPermissions = useCallback((permissionNames) => {
    if (userRole === Roles.ADMIN) return true;
    return permissionNames.every(name => hasPermission(name));
  }, [userRole, hasPermission]);

  // Fetch permissions when component mounts or token changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserPermissions();
    } else {
      setUserRole(null);
      setUserPermissions([]);
      setLoading(false);
    }
  }, [fetchUserPermissions]);

  return (
    <PermissionsContext.Provider value={{
      userRole,
      userPermissions,
      loading,
      error,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      fetchUserPermissions,
      Permissions,
      Roles
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

// Custom hook to use the permissions context
export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

export default PermissionsContext;