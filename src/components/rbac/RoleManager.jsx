import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, UserCheck, AlertCircle, Check, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useSecurity } from '../../hooks/useSecurity';
import { API_BASE_URL } from '../../constants/securityConstants';

const RoleManager = () => {
  const { hasPermission, Permissions, Roles, updateUserRole } = usePermissions();
  const { logSecurityEvent, SecurityEventType } = useSecurity();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingChanges, setPendingChanges] = useState({});

  // Fetch users from the API
  const fetchUsers = useCallback(async () => {
    if (!hasPermission(Permissions.USER_VIEW)) {
      setError('You do not have permission to view users');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/auth/users`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [hasPermission, Permissions.USER_VIEW]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle role change
  const handleRoleChange = (userId, newRole) => {
    // Store pending change
    setPendingChanges({
      ...pendingChanges,
      [userId]: newRole
    });
  };

  // Apply role change
  const applyRoleChange = async (userId) => {
    if (!hasPermission(Permissions.USER_EDIT)) {
      setError('You do not have permission to edit user roles');
      return;
    }

    const newRole = pendingChanges[userId];
    if (!newRole) return;

    try {
      setLoading(true);
      const success = await updateUserRole(userId, newRole);
      
      if (success) {
        // Update local state
        setUsers(users.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ));
        
        // Log the event
        await logSecurityEvent(SecurityEventType.SECURITY_SETTING_CHANGE, {
          action: 'role_update',
          user_id: userId,
          previous_role: users.find(u => u.id === userId)?.role,
          new_role: newRole
        });
        
        // Show success message
        setSuccessMessage(`Role updated for user ${userId}`);
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Clear pending change
        const { [userId]: _, ...remainingChanges } = pendingChanges;
        setPendingChanges(remainingChanges);
      } else {
        throw new Error('Failed to update role');
      }
    } catch (err) {
      console.error('Error updating role:', err);
      setError(`Failed to update role: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Cancel pending role change
  const cancelRoleChange = (userId) => {
    const { [userId]: _, ...remainingChanges } = pendingChanges;
    setPendingChanges(remainingChanges);
  };

  // Get an array of available roles
  const availableRoles = Object.values(Roles);

  if (!hasPermission(Permissions.USER_VIEW)) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4">
        <Alert variant="solid" status="error">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>
            You do not have permission to access role management
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Role Management</h2>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded flex items-center gap-1 text-sm"
          title="Refresh user list"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
      
      {error && (
        <Alert variant="solid" status="error" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {successMessage && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <Check className="h-4 w-4 mr-2 text-green-600" />
          <AlertDescription className="text-green-600">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}
      
      {loading && users.length === 0 ? (
        <div className="text-center py-8">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto text-gray-400" />
          <p className="mt-2 text-gray-500">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-gray-50">
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <UserCheck size={20} className="text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.username || user.name || user.id}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {user.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium
                      ${user.role === Roles.ADMIN ? 'bg-purple-100 text-purple-800' : 
                        user.role === Roles.MANAGER ? 'bg-blue-100 text-blue-800' :
                        user.role === Roles.USER ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'}`
                    }>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {hasPermission(Permissions.USER_EDIT) ? (
                      <select
                        value={pendingChanges[user.id] || user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                        disabled={loading}
                      >
                        {availableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-500">
                        No permission to edit
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {pendingChanges[user.id] && pendingChanges[user.id] !== user.role ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => applyRoleChange(user.id)}
                          disabled={loading}
                          className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100"
                          title="Apply role change"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => cancelRoleChange(user.id)}
                          disabled={loading}
                          className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                          title="Cancel role change"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">
                        No changes
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RoleManager;