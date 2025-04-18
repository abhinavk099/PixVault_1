/**
 * Security utility functions for application protection
 */

/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} input - The user input to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input) => {
    if (!input) return '';
    
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  /**
   * Detects potential security threats in user input
   * @param {string} input - The user input to check
   * @returns {boolean} True if suspicious patterns found
   */
  export const detectThreat = (input) => {
    if (!input) return false;
    
    // Check for common script injection patterns
    const scriptPattern = /<script|javascript:|onerror=|onload=|eval\(|setTimeout\(|setInterval\(|fetch\(|new\s+Function/i;
    
    // Check for SQL injection patterns
    const sqlPattern = /(\%27)|(\')|(\-\-)|(\%23)|(#)|(\/\*)|(\*\/)|(\bOR\b\s+\b[0-9a-zA-Z]+\b\s*=\s*\b[0-9a-zA-Z]+\b)/i;
    
    // Check for path traversal attempts
    const pathPattern = /(\.\.|\/\.\.\/|\.\.\/)/i;
    
    return scriptPattern.test(input) || sqlPattern.test(input) || pathPattern.test(input);
  };
  
  /**
   * Validates a filename for security
   * @param {string} filename - The filename to validate
   * @returns {boolean} True if filename is valid and safe
   */
  export const validateFilename = (filename) => {
    if (!filename) return false;
    
    // Check for valid characters and extensions
    const validFilenamePattern = /^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+$/;
    
    // Check for potentially dangerous extensions
    const dangerousExtensions = /\.(php|phtml|php3|php4|php5|exe|sh|bat|cmd|dll|jsp|jspx|asp|aspx|cgi|pl)$/i;
    
    return validFilenamePattern.test(filename) && !dangerousExtensions.test(filename);
  };
  
  /**
   * Generates a secure random token
   * @param {number} length - Length of the token to generate
   * @returns {string} Random token
   */
  export const generateSecureToken = (length = 32) => {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  
  /**
   * Validates file size is within allowed limits
   * @param {number} fileSize - Size of the file in bytes
   * @param {number} maxSizeMB - Maximum allowed size in MB
   * @returns {boolean} True if file size is acceptable
   */
  export const validateFileSize = (fileSize, maxSizeMB = 50) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return fileSize > 0 && fileSize <= maxSizeBytes;
  };
  
  /**
   * Validates file type against allowed MIME types
   * @param {string} fileType - MIME type of the file
   * @param {Array<string>} allowedTypes - Array of allowed MIME types
   * @returns {boolean} True if file type is allowed
   */
  export const validateFileType = (fileType, allowedTypes = []) => {
    if (allowedTypes.length === 0) {
      // Default allowed types if none specified
      allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/zip',
      ];
    }
    
    return allowedTypes.includes(fileType);
  };
  
  /**
   * Creates a content security policy nonce
   * @returns {string} CSP nonce value
   */
  export const generateCSPNonce = () => {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array));
  };
  
  /**
   * Validates a password strength
   * @param {string} password - The password to validate
   * @returns {Object} Validation result with score and feedback
   */
  export const validatePasswordStrength = (password) => {
    if (!password) {
      return { 
        valid: false, 
        score: 0,
        feedback: 'Password is required'
      };
    }
    
    let score = 0;
    const feedback = [];
    
    // Length check
    if (password.length < 8) {
      feedback.push('Password should be at least 8 characters long');
    } else {
      score += password.length > 12 ? 2 : 1;
    }
    
    // Check for mixed case
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should include both uppercase and lowercase letters');
    }
    
    // Check for numbers
    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should include at least one number');
    }
    
    // Check for special characters
    if (/[^a-zA-Z0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should include at least one special character');
    }
    
    // Check for common patterns
    if (/^(?:123|abc|qwerty|password|admin|letmein|welcome)/i.test(password)) {
      score = Math.max(0, score - 2);
      feedback.push('Password contains common patterns');
    }
    
    return {
      valid: score >= 3,
      score: score,
      feedback: feedback.length ? feedback : ['Password strength is good']
    };
  };
  
  /**
   * Detects if running in a potentially insecure environment
   * @returns {boolean} True if environment appears insecure
   */
  export const isInsecureEnvironment = () => {
    // Check if running on HTTPS
    const isNotHttps = window.location.protocol !== 'https:';
    
    // Check if running in a sandboxed iframe
    const isFramed = window !== window.top;
    
    // Check for developer tools (may indicate debugging/tampering)
    const devToolsOpen = window.outerHeight - window.innerHeight > 200 ||
                         window.outerWidth - window.innerWidth > 200;
    
    // For demo purposes, we'll just check HTTPS
    return isNotHttps && !window.location.hostname.includes('localhost');
  };
  
  /**
   * Logs a security event to the console and optionally to a remote endpoint
   * @param {string} eventType - Type of security event
   * @param {Object} details - Event details
   * @param {boolean} reportToServer - Whether to send to server
   */
  export const logSecurityEvent = (eventType, details = {}, reportToServer = true) => {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      details,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Log to console in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Security event:', event);
    }
    
    // Send to server in production
    if (reportToServer && process.env.NODE_ENV === 'production') {
      // In a real app, this would be an API call to log the event
      fetch('/api/security/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        credentials: 'include'
      }).catch(err => {
        console.error('Failed to report security event:', err);
      });
    }
    
    return event;
  };