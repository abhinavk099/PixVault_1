const mongoose = require('mongoose');

// Define the security log schema with enhanced fields for authentication events
const securityLogSchema = new mongoose.Schema({
  event_type: {
    type: String,
    required: true,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'PASSWORD_RESET_REQUEST',
      'PASSWORD_RESET_SUCCESS',
      'PATTERN_CREATION',
      'PATTERN_VERIFICATION_SUCCESS',
      'PATTERN_VERIFICATION_FAILED',
      'TOKEN_GENERATED',
      'TOKEN_REFRESHED',
      'TOKEN_INVALIDATED',
      'OTP_GENERATED',
      'OTP_VERIFIED_SUCCESS',
      'OTP_VERIFIED_FAILED',
      'ACCOUNT_LOCKED',
      'ACCOUNT_UNLOCKED',
      'SECURITY_ERROR',
      'SUSPICIOUS_ACTIVITY',
      'USER_REGISTRATION_INITIATED',
      'USER_REGISTRATION_COMPLETED'
    ],
    index: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  username: {
    type: String,
    index: true
  },
  session_id: {
    type: String,
    index: true
  },
  ip_address: {
    type: String
  },
  user_agent: {
    type: String
  },
  location: {
    type: String
  },
  device_info: {
    type: String
  },
  details: {
    type: Object,
    default: {}
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Create indexes for better query performance
securityLogSchema.index({ event_type: 1, timestamp: -1 });
securityLogSchema.index({ user_id: 1, event_type: 1, timestamp: -1 });
securityLogSchema.index({ severity: 1, timestamp: -1 });

// Add a method to create a standardized security log entry
securityLogSchema.statics.createLog = async function(data) {
  try {
    const {
      event_type,
      user_id,
      username,
      session_id,
      ip_address,
      user_agent,
      location,
      device_info,
      details,
      severity
    } = data;

    // Create and save the log entry
    const logEntry = new this({
      event_type,
      user_id,
      username,
      session_id,
      ip_address,
      user_agent,
      location,
      device_info,
      details,
      severity: severity || getDefaultSeverity(event_type)
    });

    await logEntry.save();
    return logEntry;
  } catch (error) {
    console.error('Failed to create security log:', error);
    // Don't throw - logging should never break the application flow
    return null;
  }
};

// Helper function to determine default severity based on event type
function getDefaultSeverity(eventType) {
  const criticalEvents = [
    'SECURITY_ERROR',
    'SUSPICIOUS_ACTIVITY',
    'ACCOUNT_LOCKED'
  ];

  const errorEvents = [
    'LOGIN_FAILED',
    'PATTERN_VERIFICATION_FAILED',
    'OTP_VERIFIED_FAILED'
  ];

  const warningEvents = [
    'PASSWORD_RESET_REQUEST',
    'TOKEN_INVALIDATED'
  ];

  if (criticalEvents.includes(eventType)) return 'critical';
  if (errorEvents.includes(eventType)) return 'error';
  if (warningEvents.includes(eventType)) return 'warning';
  return 'info';
}

// Create model
const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);

module.exports = { SecurityLog };
