const jwt = require('jsonwebtoken');
const { User } = require('../models/user');
const { SecurityError } = require('./security');

/**
 * Middleware to authenticate JWT tokens from Authorization header or cookies
 */
const authenticateJWT = async (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    let token = req.cookies.token;
    
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No authentication token provided'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Check if user exists and token is not invalidated
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'User not found'
      });
    }

    if (user.tokenInvalidatedAt && 
        new Date(decoded.iat * 1000) < new Date(user.tokenInvalidatedAt)) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Token has been invalidated, please login again'
      });
    }
    
    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'Authentication failed',
        message: `Your account is ${user.status}. Please contact support.`
      });
    }

    // Set user info on request object
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions || []
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Middleware to check if user has required role
 * @param {string[]} roles - Array of allowed roles
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login first'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has required permission
 * @param {string[]} requiredPermissions - Array of required permissions
 */
const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Please login first'
        });
      }

      // Get user with permissions
      const user = await User.findById(req.user.id).populate('permissions');
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Authentication failed',
          message: 'User not found'
        });
      }

      // Admin always has all permissions
      if (user.role === 'admin') {
        return next();
      }

      // Check if user has all required permissions
      const userPermissions = user.permissions.map(p => p.name);
      const hasAllPermissions = requiredPermissions.every(p => 
        userPermissions.includes(p)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have the necessary permissions'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ 
        error: 'Server error',
        message: 'An unexpected error occurred'
      });
    }
  };
};

module.exports = { 
  authenticateJWT,
  checkRole,
  checkPermission
};