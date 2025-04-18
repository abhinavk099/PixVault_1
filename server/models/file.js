const mongoose = require('mongoose');

// Define the file schema
const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  contentType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true
  },
  encryptionKey: {
    type: String,
    required: true
  },
  encryptionMetadata: {
    iv: {
      type: String,
      required: true
    },
    authTag: {
      type: String,
      required: true
    }
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['read', 'read_write'],
      default: 'read'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  uploadDate: {
    type: Date,
    default: Date.now
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes
fileSchema.index({ owner: 1 });
fileSchema.index({ 'sharedWith.user': 1 });
fileSchema.index({ uploadDate: -1 });

// Pre-save middleware to update lastAccessed
fileSchema.pre('save', function(next) {
  this.lastAccessed = new Date();
  next();
});

// Define the file access log schema
const fileAccessLogSchema = new mongoose.Schema({
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['upload', 'download', 'delete', 'share', 'view'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
});

// Create indexes for file access logs
fileAccessLogSchema.index({ file: 1, timestamp: -1 });
fileAccessLogSchema.index({ user: 1, timestamp: -1 });

// Create models
const File = mongoose.model('File', fileSchema);
const FileAccessLog = mongoose.model('FileAccessLog', fileAccessLogSchema);

module.exports = {
  File,
  FileAccessLog
};