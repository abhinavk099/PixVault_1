import { useState, useEffect, useCallback } from 'react';
import { auth } from '../services/api';
import { useSecurity } from '../hooks/useSecurity';

/**
 * Custom hook for authentication state and operations
 */
const useAuth = () => {
  const { logSecurityEvent, SecurityEventType } = useSecurity();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to get user from localStorage first for faster UI rendering
        const storedUser = localStorage.getItem('currentUser');
        const authToken = localStorage.getItem('authToken');
        
        console.log('Checking authentication state:', { 
          hasStoredUser: !!storedUser, 
          hasAuthToken: !!authToken 
        });
        
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        
        // If we have a token but no stored user, try to get user info
        let result;
        if (authToken && !storedUser) {
          try {
            console.log('Token found but no user data, fetching user profile...');
            // Validate the session with the token
            const userResponse = await auth.validateSession(authToken);
            console.log('User validation response:', userResponse.data);
            
            if (userResponse.data?.user) {
              console.log('User data retrieved successfully');
              setUser(userResponse.data.user);
              localStorage.setItem('currentUser', JSON.stringify(userResponse.data.user));
              setIsAuthenticated(true);
            } else if (userResponse.data) {
              // Some APIs might return the user directly without nesting under 'user'
              console.log('User data found at root level');
              setUser(userResponse.data);
              localStorage.setItem('currentUser', JSON.stringify(userResponse.data));
              setIsAuthenticated(true);
            }
            result = userResponse;
          } catch (tokenError) {
            console.error('Error validating token:', tokenError);
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            setIsAuthenticated(false);
          }
        } else if (storedUser && authToken) {
          // We have both token and user data, consider authenticated
          console.log('Both token and user data found, setting authenticated state');
          setIsAuthenticated(true);
          result = { authenticated: true, user: JSON.parse(storedUser) };
        } else {
          // Regular session validation
          console.log('Performing regular session validation');
          try {
            result = await auth.validateSession(authToken);
          } catch (error) {
            console.error('Session validation error:', error);
            result = { authenticated: false };
          }
        }
        
        if (result && result.authenticated && result.user) {
          setUser(result.user);
          setIsAuthenticated(true);
          console.log('Authentication validated successfully');
        } else {
          // Clear user if not authenticated
          setUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('currentUser');
          console.log('Authentication validation failed, clearing user data');
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setUser(null);
        setError('Authentication session expired');
        localStorage.removeItem('currentUser');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Login with graphical password pattern
  const login = useCallback(async (patternPoints) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await auth.login(patternPoints);
      
      if (response.authenticated && response.user) {
        setUser(response.user);
        setIsAuthenticated(true);
        
        // Save user data to localStorage for persistence
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        console.log('Login successful, user data saved to localStorage');
        
        // Log security event
        await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
          user_id: response.user.id,
          username: response.user.username
        });
        
        return response;
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      
      // Log security event
      await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        error: err.message
      });
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [logSecurityEvent, SecurityEventType]);

  // Register with graphical password pattern
  const register = useCallback(async (patternPoints, userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await auth.register(userData);
      
      if (response.registered && response.user) {
        // Don't auto login after registration
        return response;
      } else {
        throw new Error('Registration failed');
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // Log security event before clearing user
      if (user) {
        await logSecurityEvent(SecurityEventType.LOGOUT, {
          user_id: user.id,
          username: user.username
        });
      }
      
      await auth.logout();
      
      // Clear user state and authentication
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      console.log('Logout successful, cleared all auth data');
      
      return true;
    } catch (err) {
      console.error('Logout error:', err);
      
      // Still clear user on error
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      console.log('Logout failed but still cleared auth data');
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, logSecurityEvent, SecurityEventType]);

  // Get current user's permissions
  const getUserPermissions = useCallback(async () => {
    try {
      if (!user) {
        return { role: 'guest', permissions: [] };
      }
      
      const response = await auth.validatePattern(user.pattern);
      return response.permissions;
    } catch (err) {
      console.error('Error fetching permissions:', err);
      return { role: 'guest', permissions: [] };
    }
  }, [user]);

  // Update user profile
  const updateProfile = useCallback(async (profileData) => {
    try {
      setLoading(true);
      setError(null);
      
      // This would be implemented in a real application
      // const result = await auth.updateProfile(profileData);
      
      // For demo purposes:
      const updatedUser = { ...user, ...profileData };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      // Log security event
      await logSecurityEvent(SecurityEventType.PROFILE_UPDATE, {
        user_id: user.id
      });
      
      return true;
    } catch (err) {
      setError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, logSecurityEvent, SecurityEventType]);

  // Update user pattern
  const updatePattern = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      throw new Error('Pattern update not implemented');
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Change graphical password
  const changePassword = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      throw new Error('Password change not implemented');
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear authentication errors
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    getUserPermissions,
    updateProfile,
    updatePattern,
    changePassword,
    clearError
  };
};

export default useAuth;