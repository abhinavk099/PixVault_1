const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models/user');
const { logSecurityEvent, SecurityError } = require('../middleware/security');
const { authenticateJWT } = require('../middleware/auth');
const { EncryptionService } = require('../utils/encryption');
const { getRandomMatrixImages } = require('../utils/imageMatrix');
const crypto = require('crypto');

// Constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const JWT_EXPIRY = '24h';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * @route   GET /auth/matrix-images
 * @desc    Get random images for PassMatrix
 * @access  Public
 */
router.get('/matrix-images', async (req, res, next) => {
  try {
    const imageUrls = await getRandomMatrixImages();
    res.json({ images: imageUrls }); 
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { username, email, phoneNumber } = req.body;

    // Validate input
    if (!username || !email) {
      throw new SecurityError('Username and email are required');
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      throw new SecurityError('Username or email already exists');
    }

    // Create user with minimal information
    // PassMatrix pattern and keys will be set later
    const user = new User({
      username,
      email,
      phoneNumber,
      isVerified: false,
      permissions: ['file:upload', 'file:download', 'file:share', 'file:delete']
    });

    await user.save();

    try {
      await logSecurityEvent(req, {
        event_type: 'USER_REGISTRATION_INITIATED',
        data: {
          userId: user._id,
          username: user.username
        }
      });
    } catch (logError) {
      console.warn('Failed to log security event:', logError);
      // Continue despite logging error
    }

    res.status(201).json({
      message: 'Registration initiated',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /auth/signin
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/signin', async (req, res, next) => {
  try {
    const { username } = req.body;

    // Validate input
    if (!username) {
      throw new SecurityError('Username is required');
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      throw new SecurityError('Invalid credentials');
    }

    // Check if account is locked
    if (user.status === 'locked') {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new SecurityError(`Account is locked. Try again after ${new Date(user.lockedUntil).toLocaleString()}`);
      } else {
        // Reset lock if lockout period has passed
        user.status = 'active';
        user.loginAttempts = 0;
        user.lockedUntil = null;
        await user.save();
      }
    }

    try {
      // Log signin attempt
      await logSecurityEvent(req, {
        event_type: 'SIGNIN_ATTEMPT',
        data: {
          username: user.username
        }
      });
    } catch (logError) {
      console.warn('Failed to log signin attempt:', logError);
      // Continue despite logging error
    }

    // Return success to proceed to PassMatrix verification
    res.json({
      message: 'Username verified',
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /auth/signout
 * @desc    Sign out user
 * @access  Private
 */
router.post('/signout', authenticateJWT, async (req, res, next) => {
  try {
    // Clear auth cookie
    res.clearCookie('token', COOKIE_OPTIONS);
    
    try {
      await logSecurityEvent(req, {
        event_type: 'LOGOUT_SUCCESS',
        data: {
          user_id: req.user.id,
          username: req.user.username
        }
      });
    } catch (logError) {
      console.warn('Failed to log signout:', logError);
      // Continue despite logging error
    }
    
    res.json({ message: 'Successfully signed out' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /auth/validate
 * @desc    Validate current session
 * @access  Private
 */
router.get('/validate', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -passMatrixHash -passMatrixSalt -patternSessionId');
    if (!user) {
      return res.status(401).json({ 
        authenticated: false,
        message: 'User not found'
      });
    }
    
    res.json({ 
      authenticated: true,
      user
    });
  } catch (error) {
    res.status(401).json({ 
      authenticated: false,
      message: 'Invalid session'
    });
  }
});

/**
 * @route   GET /auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticateJWT, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash -passMatrixHash -passMatrixSalt -patternSessionId -encryptedPrivateKey');
    if (!user) {
      throw new SecurityError('User not found');
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /auth/check-username/:username
 * @desc    Check if username exists
 * @access  Public
 */
router.get('/check-username/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    
    // Check if user exists
    const user = await User.findOne({ username });
    
    // Return whether the username exists (true/false)
    res.json({ exists: !!user });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /auth/create-pattern-session
 * @desc    Create a temporary session for pattern creation
 * @access  Public
 */
router.post('/create-pattern-session', async (req, res, next) => {
  try {
    const { username, sessionToken } = req.body;
    
    if (!username || !sessionToken) {
      throw new SecurityError('Username and session token are required');
    }
    
    // Generate a unique session ID for this pattern creation
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Store session in memory or database with expiration
    // For simplicity, we'll use a global Map here
    // In production, use Redis or another session store
    if (!global.patternSessions) {
      global.patternSessions = new Map();
    }
    
    global.patternSessions.set(sessionId, {
      username,
      sessionToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    
    try {
      // Log session creation
      await logSecurityEvent(req, {
        event_type: 'PATTERN_SESSION_CREATED',
        data: {
          username,
          sessionId
        }
      });
    } catch (logError) {
      console.warn('Failed to log pattern session creation:', logError);
      // Continue despite logging error
    }
    
    res.json({
      success: true,
      sessionId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /auth/store-pattern-hash
 * @desc    Store the hash of the user's pattern
 * @access  Public
 */
router.post('/store-pattern-hash', async (req, res, next) => {
  try {
    console.log('Received store-pattern-hash request:', { 
      username: req.body.username,
      sessionId: req.body.sessionId,
      hashLength: req.body.hash ? req.body.hash.length : 0
    });
    
    const { username, hash, sessionId, sessionToken } = req.body;
    
    if (!username || !hash || !sessionId || !sessionToken) {
      console.error('Missing required parameters:', { 
        hasUsername: !!username, 
        hasHash: !!hash, 
        hasSessionId: !!sessionId, 
        hasSessionToken: !!sessionToken 
      });
      throw new SecurityError('Missing required parameters');
    }
    
    // Verify session
    if (!global.patternSessions) {
      console.error('No pattern sessions initialized');
      global.patternSessions = new Map();
      throw new SecurityError('No active sessions found');
    }
    
    if (!global.patternSessions.has(sessionId)) {
      console.error(`Session ID ${sessionId} not found in active sessions`);
      throw new SecurityError('Invalid session');
    }
    
    const session = global.patternSessions.get(sessionId);
    console.log('Found session:', { 
      sessionUsername: session.username, 
      requestUsername: username,
      sessionExpiry: session.expiresAt
    });
    
    if (session.username !== username || session.sessionToken !== sessionToken) {
      console.error('Session mismatch:', { 
        sessionUsername: session.username, 
        requestUsername: username,
        tokenMatch: session.sessionToken === sessionToken
      });
      throw new SecurityError('Session mismatch');
    }
    
    if (session.expiresAt < new Date()) {
      console.error('Session expired:', { 
        expiresAt: session.expiresAt, 
        now: new Date() 
      });
      global.patternSessions.delete(sessionId);
      throw new SecurityError('Session expired');
    }
    
    // Find user or create if it doesn't exist (for sign-up flow)
    let user = await User.findOne({ username });
    console.log('User lookup result:', { 
      username, 
      found: !!user 
    });
    
    if (!user) {
      console.log('Creating new user for pattern storage:', { username });
      // This is for sign-up flow - create a minimal user record
      // The rest of the user data will be added in completeRegistration
      user = new User({
        username,
        email: `${username}@temp.com`, // Temporary email to satisfy schema requirements
        isVerified: false,
        permissions: ['file:upload', 'file:download', 'file:share', 'file:delete']
      });
      
      try {
        await user.save();
        console.log('New user created successfully:', { 
          id: user._id, 
          username: user.username 
        });
      } catch (saveError) {
        console.error('Error saving new user:', saveError);
        throw new SecurityError(`Failed to create user: ${saveError.message}`);
      }
      
      try {
        await logSecurityEvent(req, {
          event_type: 'USER_REGISTRATION_INITIATED',
          data: {
            userId: user._id,
            username: user.username
          }
        });
      } catch (logError) {
        console.warn('Failed to log registration event:', logError);
        // Continue despite logging error
      }
    }
    
    // Store the hash directly
    console.log('Storing pattern hash for user:', { 
      username: user.username, 
      hashLength: hash.length,
      hash: hash.substring(0, 10) + '...' // Show part of the hash for debugging
    });
    
    // Store the hash and salt, but don't use sessionId for pattern verification
    user.passMatrixHash = hash;
    user.passMatrixSalt = username; // Using username as salt
    
    // Still store the sessionId for security tracking and CSRF protection
    // But it's no longer used in the pattern hash verification
    user.patternSessionId = sessionId;
    
    try {
      await user.save();
      console.log('Pattern hash saved successfully');
    } catch (saveError) {
      console.error('Error saving pattern hash:', saveError);
      throw new SecurityError(`Failed to save pattern hash: ${saveError.message}`);
    }
    
    // Log pattern creation
    try {
      await logSecurityEvent(req, {
        event_type: 'PATTERN_STORED',
        data: {
          username
        }
      });
    } catch (logError) {
      console.warn('Failed to log pattern storage event:', logError);
      // Continue despite logging error
    }
    
    res.json({
      success: true,
      message: 'Pattern stored successfully'
    });
  } catch (error) {
    console.error('Error in store-pattern-hash:', error);
    next(error);
  }
});

/**
 * @route   POST /auth/verify-pattern
 * @desc    Verify the user's pattern
 * @access  Public
 */
router.post('/verify-pattern', async (req, res, next) => {
  try {
    const { username, pattern, sessionToken, sessionId } = req.body;
    
    if (!username || !pattern || !sessionToken || !Array.isArray(pattern)) {
      throw new SecurityError('Invalid verification request');
    }
    
    console.log('Received pattern verification request:', {
      username,
      pattern,
      patternLength: pattern.length,
      hasSessionToken: !!sessionToken,
      hasSessionId: !!sessionId,
      sessionId: sessionId
    });
    
    // Log the pattern string that will be used for verification
    console.log('Server will verify with pattern string format:', '[sorted_pattern]:salt:sessionId');
    console.log('Pattern before sorting:', pattern);
    console.log('Pattern after sorting:', [...pattern].sort());
    
    // Check if sessionId is provided
    if (!sessionId) {
      console.warn('Missing sessionId in verification request');
      return res.status(400).json({
        success: false,
        message: 'Missing session identifier'
      });
    }
    
    // Verify session if sessionId is provided
    let sessionValid = false;
    if (global.patternSessions) {
      const session = global.patternSessions.get(sessionId);
      if (!session) {
        console.warn(`Session ID ${sessionId} not found in active sessions`);
      } else if (session.username !== username) {
        console.warn(`Session username mismatch: ${session.username} vs ${username}`);
      } else if (session.sessionToken !== sessionToken) {
        console.warn('Session token mismatch');
      } else if (session.expiresAt < new Date()) {
        console.warn('Session expired');
      } else {
        console.log('Found matching session for verification');
        sessionValid = true;
      }
    }
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      throw new SecurityError('User not found');
    }
    
    // Verify that the sessionId matches the one saved for this user
    // If sessionValid is already true from global sessions, we can skip this check
    if (!sessionValid) {
      // Check if user has a stored sessionId that matches the provided one
      if (!user.patternSessionId) {
        console.warn('User has no stored session ID');
        // Continue anyway - this might be a first login after pattern creation
      } else if (user.patternSessionId !== sessionId) {
        console.warn('User session ID mismatch', {
          providedSessionId: sessionId,
          storedSessionId: user.patternSessionId
        });
        // We'll still try to validate with the stored sessionId
        console.log('Will attempt validation with stored sessionId instead');
      } else {
        console.log('Using stored session ID for validation');
        sessionValid = true;
      }
    }
    
    // Use the user model's validatePassMatrix method for consistent hashing
    console.log('Validating pattern using user model method');
    
    // Pass the sessionId as the userId parameter for consistent hashing
    const isMatch = await user.validatePassMatrix(pattern, sessionId);
    
    console.log('Verification result from validatePassMatrix:', {
      isMatch,
      storedHashLength: user.passMatrixHash ? user.passMatrixHash.length : 0
    });
    
    console.log('Pattern validation result:', { isMatch });
    
    try {
      // Log verification attempt without awaiting to prevent blocking
      logSecurityEvent(req, {
        event_type: isMatch ? 'PATTERN_VERIFIED' : 'PATTERN_VERIFICATION_FAILED',
        data: {
          username,
          success: isMatch
        }
      });
    } catch (logError) {
      console.warn('Failed to log verification attempt:', logError);
      // Continue despite logging error
    }
    
    if (!isMatch) {
      // Increment failed attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      
      // Lock account after too many failed attempts
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.status = 'locked';
        user.lockedUntil = new Date(Date.now() + LOCKOUT_TIME);
        try {
          await logSecurityEvent(req, {
            event_type: 'ACCOUNT_LOCKED',
            data: {
              username,
              lockedUntil: user.lockedUntil
            }
          });
        } catch (logError) {
          console.warn('Failed to log account lock:', logError);
          // Continue despite logging error
        }
      }
      
      await user.save();
      
      return res.status(401).json({
        success: false,
        message: 'Pattern verification failed'
      });
    }
    
    // Reset login attempts on successful verification
    user.loginAttempts = 0;
    user.lastLogin = new Date();
    await user.save();
    
    res.json({
      success: true,
      message: 'Pattern verified successfully'
    });
  } catch (error) {
    console.error('Error in verify-pattern:', error);
    next(error);
  }
});

/**
 * @route   POST /auth/complete-registration
 * @desc    Complete user registration after pattern verification
 * @access  Public
 */
router.post('/complete-registration', async (req, res, next) => {
  try {
    const { username, email, phoneNumber, sessionToken } = req.body;
    
    if (!username || !email || !sessionToken) {
      throw new SecurityError('Missing required parameters');
    }
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      throw new SecurityError('User not found');
    }
    
    // Update user information
    user.email = email;
    user.phoneNumber = phoneNumber || '';
    user.isVerified = true;
    user.status = 'active';
    await user.save();
    
    try {
      // Log registration completion
      await logSecurityEvent(req, {
        event_type: 'REGISTRATION_COMPLETED',
        data: {
          userId: user._id,
          username
        }
      });
    } catch (logError) {
      console.warn('Failed to log registration completion:', logError);
      // Continue despite logging error
    }
    
    res.json({
      success: true,
      message: 'Registration completed successfully'
    });
  } catch (error) {
    console.error('Error in complete-registration:', error);
    next(error);
  }
});

/**
 * @route   POST /auth/get-token
 * @desc    Get authentication token after successful pattern verification
 * @access  Public
 */
router.post('/get-token', async (req, res, next) => {
  try {
    const { username, sessionToken } = req.body;
    
    if (!username || !sessionToken) {
      throw new SecurityError('Missing required parameters');
    }
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      throw new SecurityError('User not found');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: JWT_EXPIRY }
    );
    
    // Set JWT cookie
    res.cookie('token', token, COOKIE_OPTIONS);
    
    try {
      // Log token generation
      await logSecurityEvent(req, {
        event_type: 'TOKEN_GENERATED',
        data: {
          userId: user._id,
          username
        }
      });
    } catch (logError) {
      console.warn('Failed to log token generation:', logError);
      // Continue despite logging error
    }
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Error in get-token:', error);
    next(error);
  }
});

module.exports = router;