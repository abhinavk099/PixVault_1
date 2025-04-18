import React, { createContext, useState, useEffect } from 'react';
import { auth } from '../services/api';
import tokenManager from '../utils/tokenManager';

// Create the authentication context
const AuthContext = createContext(null);

// Provider component that wraps the app and makes auth object available to any child component that calls useAuth().
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Function to validate the current session
  const validateSession = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if we have a token
      const token = tokenManager.getAccessToken();
      if (!token) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      
      // Check if token is expired
      if (tokenManager.isTokenExpired()) {
        // Try to refresh the token
        const refreshToken = tokenManager.getRefreshToken();
        if (!refreshToken) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setLoading(false);
          return;
        }
        
        try {
          // Attempt to refresh the token
          await auth.refreshToken(refreshToken);
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          setIsAuthenticated(false);
          setCurrentUser(null);
          setLoading(false);
          return;
        }
      }
      
      // Validate the session with the server
      const response = await auth.validateSession();
      
      if (response.data.authenticated) {
        setCurrentUser(response.data.user);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Session validation error:', error);
      setError('Failed to validate session');
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle logout
  const logout = async () => {
    try {
      await auth.logout();
      setCurrentUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to logout');
    }
  };

  // Validate session on component mount and set up periodic validation
  useEffect(() => {
    validateSession();
    
    // Set up periodic validation (every 5 minutes)
    const intervalId = setInterval(() => {
      validateSession();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // The value that will be provided to consumers of this context
  const value = {
    currentUser,
    loading,
    error,
    isAuthenticated,
    validateSession,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Export the context for direct access if needed
export { AuthContext };
