const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Define the user schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  passwordHash: {
    type: String,
    required: false // Now optional since we're using PassMatrix
  },
  passMatrixHash: {
    type: String,
    required: false // Will be set during pattern selection
  },
  passMatrixSalt: {
    type: String,
    required: false // Will be set during pattern selection
  },
  publicKey: {
    type: String,
    required: false // Will be set after successful authentication
  },
  encryptedPrivateKey: {
    type: String,
    required: false // Will be set after successful authentication
  },
  otp: {
    type: String,
    required: false
  },
  otpExpiry: {
    type: Date,
    required: false
  },
  // Recovery OTP for password/pattern reset
  recoveryOtp: {
    type: String,
    required: false
  },
  recoveryOtpExpires: {
    type: Date,
    required: false
  },
  // Reset session token for pattern reset
  resetSessionToken: {
    type: String,
    required: false
  },
  resetSessionExpires: {
    type: Date,
    required: false
  },
  // Refresh tokens for authentication
  refreshTokens: [{
    type: String
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  permissions: [{
    type: String,
    enum: [
      'file:upload',
      'file:download',
      'file:share',
      'file:delete',
      'user:manage'
    ]
  }],
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'locked'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to validate password
userSchema.methods.validatePassword = async function(password) {
  try {
    return await bcrypt.compare(password, this.passwordHash);
  } catch (error) {
    throw new Error('Password validation failed');
  }
};

// Method to validate PassMatrix sequence
userSchema.methods.validatePassMatrix = async function(pattern, sessionId) {
  try {
    if (!this.passMatrixHash) {
      throw new Error('No pattern hash found for user');
    }
    
    // Sort pattern indices to ensure order-independence
    const sortedPattern = [...pattern].sort();
    
    // Hash the pattern using the same algorithm as the client
    console.log('Server validating pattern:', {
      sortedPattern,
      username: this.username,
      storedHashLength: this.passMatrixHash.length
    });
    
    // CRITICAL: Use the same salt as during pattern creation
    // The salt is stored as username in passMatrixSalt
    const salt = this.passMatrixSalt || this.username;
    
    // Create the same pattern string as used during creation
    // This must match EXACTLY what the client does - NO sessionId
    const patternString = `${sortedPattern.join('|')}:${salt}`;
    console.log('Server hashing pattern with string:', patternString);
    
    // Use Node.js crypto for hashing (compatible with Web Crypto API)
    const hash = crypto.createHash('sha256').update(patternString).digest('hex');
    console.log('Server generated hash:', hash);
    console.log('Stored hash:', this.passMatrixHash);
    
    // Compare with stored hash
    return hash === this.passMatrixHash;
  } catch (error) {
    console.error('PassMatrix validation error:', error);
    throw new Error('PassMatrix validation failed');
  }
};

// Method to increment failed login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  this.failedLoginAttempts += 1;
  
  if (this.failedLoginAttempts >= 5) {
    this.status = 'locked';
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }
  
  await this.save();
};

// Method to reset failed login attempts
userSchema.methods.resetLoginAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  this.status = 'active';
  await this.save();
};

// Method to update last login
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

// Static method to hash password
userSchema.statics.hashPassword = async function(password) {
  try {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

// Static method to hash PassMatrix sequence
userSchema.statics.hashPassMatrix = async function(pattern, username) {
  try {
    // Sort pattern indices to ensure order-independence
    const sortedPattern = [...pattern].sort();
    
    // Create pattern string with username as salt - NO userId/sessionId
    const patternString = `${sortedPattern.join('|')}:${username}`;
    
    console.log('Static hashPassMatrix using pattern string:', patternString);
    
    // Use Node.js crypto for hashing (compatible with Web Crypto API)
    const hash = crypto.createHash('sha256').update(patternString).digest('hex');
    
    console.log('Generated hash in static method:', hash);
    
    return { hash, salt: username };
  } catch (error) {
    console.error('Error hashing pattern:', error);
    throw new Error('Failed to hash pattern');
  }
};

// Create indexes
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1 });

const User = mongoose.model('User', userSchema);

module.exports = { User };