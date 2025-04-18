/**
 * Service for authentication and user management
 */
import { hashData, logSecurityEvent } from '../utils/security';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Authenticates a user with graphical password
 * @param {Array} patternPoints - Array of selected points from the pattern
 * @returns {Promise<Object>} Authentication result
 */
export const authenticateWithPattern = async (patternPoints) => {
  try {
    if (!patternPoints || patternPoints.length < 3) {
      throw new Error('Invalid pattern: minimum 3 points required');
    }

    // Hash the pattern before sending to server
    const patternString = patternPoints.join('|');
    const patternHash = await hashData(patternString);

    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        pattern_hash: patternHash,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Log failed login attempt
      logSecurityEvent('login_failure', {
        error: errorData.message || 'Authentication failed',
        status: response.status
      });
      
      throw new Error(errorData.message || 'Authentication failed');
    }

    const result = await response.json();
    
    // Log successful login
    logSecurityEvent('login_success', {
      user_id: result.user.id,
      username: result.user.username
    });
    
    // Store basic user info in localStorage (no sensitive data)
    localStorage.setItem('currentUser', JSON.stringify({
      id: result.user.id,
      username: result.user.username,
      role: result.user.role
    }));

    return result;
  } catch (error) {
    // Additional logging for client-side errors
    if (!error.message.includes('Authentication failed')) {
      logSecurityEvent('login_error', {
        error: error.message
      });
    }
    
    throw error;
  }
};

/**
 * Registers a new graphical password
 * @param {Array} patternPoints - Array of selected points from the pattern
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Registration result
 */
export const registerWithPattern = async (patternPoints, userData) => {
  try {
    if (!patternPoints || patternPoints.length < 3) {
      throw new Error('Invalid pattern: minimum 3 points required');
    }

    // Hash the pattern before sending to server
    const patternString = patternPoints.join('|');
    const patternHash = await hashData(patternString);

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pattern_hash: patternHash,
        ...userData
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Log registration failure
      logSecurityEvent('registration_failure', {
        error: errorData.message || 'Registration failed',
        status: response.status
      });
      
      throw new Error(errorData.message || 'Registration failed');
    }

    const result = await response.json();
    
    // Log successful registration
    logSecurityEvent('registration_success', {
      user_id: result.user.id,
      username: result.user.username
    });

    return result;
  } catch (error) {
    // Additional logging for client-side errors
    if (!error.message.includes('Registration failed')) {
      logSecurityEvent('registration_error', {
        error: error.message
      });
    }
    
    throw error;
  }
};

/**
 * Logs the user out
 * @returns {Promise<boolean>} Logout success
 */
export const logout = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    // Clear local storage
    localStorage.removeItem('currentUser');
    
    // Log logout event
    logSecurityEvent('logout', {});

    return response.ok;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still remove local storage on error
    localStorage.removeItem('currentUser');
    
    return false;
  }
};

/**
 * Verifies if user is authenticated
 * @returns {Promise<Object>} Verification result
 */
export const verifyAuth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Session invalid or expired');
    }

    const result = await response.json();
    
    // Update stored user info
    if (result.user) {
      localStorage.setItem('currentUser', JSON.stringify({
        id: result.user.id,
        username: result.user.username,
        role: result.user.role
      }));
    }

    return result;
  } catch (error) {
    // Clear local storage on authentication failure
    localStorage.removeItem('currentUser');
    throw error;
  }
};

/**
 * Gets a list of users (admin function)
 * @returns {Promise<Array>} List of users
 */
export const listUsers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/users`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    return await response.json();
  } catch (error) {
    logSecurityEvent('user_list_access_error', {
      error: error.message
    });
    
    throw error;
  }
};

/**
 * Updates a user's role (admin function)
 * @param {string} userId - ID of the user to update
 * @param {string} newRole - New role to assign
 * @returns {Promise<Object>} Update result
 */
export const updateUserRole = async (userId, newRole) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/update-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        user_id: userId,
        role: newRole
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update user role');
    }

    const result = await response.json();
    
    // Log role update
    logSecurityEvent('user_role_update', {
      user_id: userId,
      new_role: newRole
    });

    return result;
  } catch (error) {
    logSecurityEvent('user_role_update_error', {
      user_id: userId,
      new_role: newRole,
      error: error.message
    });
    
    throw error;
  }
};

/**
 * Gets user permissions
 * @returns {Promise<Object>} User permissions
 */
export const getUserPermissions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/permissions`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch permissions');
    }

    return await response.json();
  } catch (error) {
    logSecurityEvent('permission_fetch_error', {
      error: error.message
    });
    
    throw error;
  }
};

export default {
  authenticateWithPattern,
  registerWithPattern,
  logout,
  verifyAuth,
  listUsers,
  updateUserRole,
  getUserPermissions
};