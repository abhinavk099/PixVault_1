import React, { useEffect } from 'react';
import { useSecurity } from '../../hooks/useSecurity';
import { usePermissions } from '../../contexts/PermissionsContext';
import { SecurityEventType } from '../../constants/security';

// This component doesn't render anything visible
// It just logs security events based on route changes and user actions
const SecurityLogger = () => {
  const { logSecurityEvent } = useSecurity();
  const { userRole } = usePermissions();

  useEffect(() => {
    // Only log navigation events if user is authenticated
    if (!localStorage.getItem('token')) {
      return;
    }

    // Log initial page load
    const logPageVisit = () => {
      const pathname = window.location.pathname;
      logSecurityEvent(SecurityEventType.PAGE_VISIT, { 
        path: pathname,
        userRole: userRole || 'unauthenticated'
      });
    };

    // Log navigation events
    const handleRouteChange = () => {
      const pathname = window.location.pathname;
      logSecurityEvent(SecurityEventType.PAGE_NAVIGATION, { 
        path: pathname,
        userRole: userRole || 'unauthenticated'
      });
    };

    // Log when the user closes or refreshes the page
    const handleBeforeUnload = () => {
      logSecurityEvent(SecurityEventType.PAGE_EXIT, {
        path: window.location.pathname,
        userRole: userRole || 'unauthenticated'
      });
    };

    // Set up history change listener for SPA navigation
    const { pushState, replaceState } = window.history;
    
    window.history.pushState = function() {
      pushState.apply(this, arguments);
      handleRouteChange();
    };

    window.history.replaceState = function() {
      replaceState.apply(this, arguments);
      handleRouteChange();
    };

    // Add event listeners
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Log initial visit
    logPageVisit();

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
    };
  }, [logSecurityEvent, userRole]);

  // Setup global error handler to log uncaught errors
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      return;
    }

    const handleError = (event) => {
      logSecurityEvent(SecurityEventType.UNCAUGHT_ERROR, {
        error: event.error?.message || 'Unknown error',
        stack: event.error?.stack,
        path: window.location.pathname
      });
    };

    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [logSecurityEvent]);

  // This component doesn't render anything visible
  return null;
};

export default SecurityLogger;