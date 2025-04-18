import React, { useState, useEffect, useCallback } from 'react';
import { SecurityContext } from './SecurityContextInstance';
import { security } from '../services/api';
import { SecurityEventType } from '../constants/security';

export const SecurityProvider = ({ children }) => {
  const [securityLogs, setSecurityLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [securityStatus, setSecurityStatus] = useState({
    lastLoginAttempt: null,
    failedLoginCount: 0,
    isLocked: false
  });

  // Function to log a security event
  const logSecurityEvent = useCallback(async (eventType, details = {}) => {
    try {
      // Check for authToken instead of token (which doesn't exist)
      if (!localStorage.getItem('authToken') && 
          eventType !== SecurityEventType.LOGIN_SUCCESS && 
          eventType !== SecurityEventType.LOGIN_FAILURE) {
        console.warn('Skipping security log - user not authenticated');
        return;
      }

      const event = {
        event_type: eventType,
        timestamp: new Date().toISOString(),
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        },
        ...details
      };

      // Add to local state immediately for responsive UI
      setSecurityLogs(prevLogs => [event, ...prevLogs]);

      // Send to server
      await security.addLog(event);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }, []);

  // Function to fetch security logs
  const fetchSecurityLogs = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await security.getLogs();
      setSecurityLogs(data);
    } catch (error) {
      console.error('Error fetching security logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch logs when component mounts
  useEffect(() => {
    if (localStorage.getItem('token')) {
      fetchSecurityLogs();
    }
  }, [fetchSecurityLogs]);

  // Update security status based on login attempts
  const updateSecurityStatus = useCallback((success) => {
    setSecurityStatus(prev => {
      const now = new Date();
      const newFailedCount = success ? 0 : prev.failedLoginCount + 1;
      const isLocked = newFailedCount >= 5;

      if (isLocked) {
        logSecurityEvent(SecurityEventType.ACCOUNT_LOCKED, {
          reason: 'Too many failed login attempts'
        });
      }

      return {
        lastLoginAttempt: now,
        failedLoginCount: newFailedCount,
        isLocked
      };
    });
  }, [logSecurityEvent]);

  return (
    <SecurityContext.Provider value={{
      securityLogs,
      loading,
      securityStatus,
      logSecurityEvent,
      fetchSecurityLogs,
      updateSecurityStatus,
      SecurityEventType
    }}>
      {children}
    </SecurityContext.Provider>
  );
};

export default SecurityProvider;