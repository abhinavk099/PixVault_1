const { SecurityLog } = require('../models/securityLog');
const sanitize = require('sanitize-html');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Log security errors
  if (err.name === 'SecurityError' || err.status === 401 || err.status === 403) {
    logSecurityEvent(req, {
      event_type: 'SECURITY_ERROR',
      details: {
        error: err.message,
        path: req.path,
        method: req.method
      },
      severity: 'error'
    });
  }

  // Handle different types of errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error',
      message: err.message,
      details: err.errors
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      error: 'Authentication Error',
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      error: 'Authentication Error',
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: err.name || 'Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Log security events to database
 * @param {Object} req - Express request object
 * @param {Object} eventData - Event data
 */
const logSecurityEvent = async (req, eventData) => {
  try {
    // Extract request information
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];
    const user_id = req.user?.id;
    const username = req.user?.username || eventData.username;
    const session_id = req.body?.sessionId || eventData.sessionId;
    
    // Create log entry
    await SecurityLog.createLog({
      ...eventData,
      user_id,
      username,
      session_id,
      ip_address,
      user_agent,
      device_info: user_agent
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw - logging should never break the application flow
  }
};

/**
 * Middleware to log all requests
 */
const requestLogger = async (req, res, next) => {
  // Skip logging for certain paths
  const skipPaths = ['/health', '/favicon.ico'];
  if (skipPaths.includes(req.path)) {
    return next();
  }

  try {
    await logSecurityEvent(req, {
      event_type: 'api_request',
      details: {
        path: req.path,
        method: req.method,
        query: req.query
      }
    });
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to sanitize input data
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitize(req.body[key], {
          allowedTags: [],
          allowedAttributes: {}
        });
      }
    });
  }

  // Sanitize request query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitize(req.query[key], {
          allowedTags: [],
          allowedAttributes: {}
        });
      }
    });
  }

  next();
};

/**
 * Create a custom SecurityError
 */
class SecurityError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'SecurityError';
    this.status = status;
  }
}

module.exports = {
  errorHandler,
  logSecurityEvent,
  requestLogger,
  sanitizeInput,
  SecurityError
};