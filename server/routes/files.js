const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { File, FileAccessLog } = require('../models/file');
const { authenticateJWT, checkPermission } = require('../middleware/auth');
const { logSecurityEvent, SecurityError } = require('../middleware/security');
const { EncryptionService } = require('../utils/encryption');
const FileValidationService = require('../utils/fileValidation');

// Constants
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || path.join(__dirname, '../uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB default
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain'
]);

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userFolder = path.join(UPLOAD_FOLDER, req.user.id.toString());
    try {
      await fsPromises.mkdir(userFolder, { recursive: true });
      cb(null, userFolder);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// Configure upload middleware
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('File type not allowed'), false);
      return;
    }
    cb(null, true);
  }
});

/**
 * Helper function to log file access
 */
const logFileAccess = async (req, fileId, action) => {
  try {
    const accessLog = new FileAccessLog({
      file: fileId,
      user: req.user.id,
      action,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    await accessLog.save();
  } catch (error) {
    console.error('Error logging file access:', error);
  }
};

/**
 * Helper function to check file access
 */
const checkFileAccess = async (req, fileId, requireWriteAccess = false) => {
  const file = await File.findById(fileId);
  
  if (!file || file.isDeleted) {
    throw new SecurityError('File not found', 404);
  }
  
  // Check if user is the owner
  if (file.owner.toString() === req.user.id) {
    return file;
  }
  
  // Check if file is shared with the user
  const sharedWithUser = file.sharedWith.find(
    share => share.user.toString() === req.user.id
  );
  
  if (!sharedWithUser) {
    throw new SecurityError('Access denied', 403);
  }
  
  // Check write permission if required
  if (requireWriteAccess && sharedWithUser.permission !== 'read_write') {
    throw new SecurityError('You do not have write permission for this file', 403);
  }
  
  return file;
};

/**
 * @route   POST /files/upload
 * @desc    Upload and encrypt a file
 * @access  Private
 */
router.post('/upload', authenticateJWT, checkPermission(['file:upload']), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    // Validate file
    const validation = await FileValidationService.validateFile(req.file.path, req.file.originalname);
    if (!validation.isValid) {
      await fsPromises.unlink(req.file.path);
      throw new SecurityError(validation.error);
    }

    // Calculate file hash for integrity
    const fileHash = await FileValidationService.calculateFileHash(req.file.path);

    // Generate encryption key for the file
    const fileKey = await EncryptionService.generateKey();
    
    // Create encrypted file
    const encryptedFilePath = req.file.path + '.encrypted';
    const readStream = fs.createReadStream(req.file.path);
    const writeStream = fs.createWriteStream(encryptedFilePath);

    const { iv, authTag } = await EncryptionService.encryptStream(readStream, writeStream, fileKey);

    // Encrypt file key with user's public key
    const encryptedKey = EncryptionService.encryptKey(fileKey, req.user.publicKey);

    // Create file record
    const file = new File({
      filename: path.basename(encryptedFilePath),
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      size: req.file.size,
      path: encryptedFilePath,
      encryptionKey: encryptedKey,
      encryptionMetadata: {
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
      },
      hash: fileHash,
      owner: req.user.id
    });

    await file.save();

    // Delete original unencrypted file
    await fsPromises.unlink(req.file.path);

    // Log the upload
    await logSecurityEvent(req, 'FILE_UPLOAD', {
      fileId: file._id,
      filename: file.originalName,
      hash: fileHash
    });

    // Log file access
    await logFileAccess(req, file._id, 'upload');

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: file._id,
        name: file.originalName,
        size: file.size,
        type: file.contentType,
        hash: fileHash
      }
    });
  } catch (error) {
    // Clean up any uploaded files if there was an error
    if (req.file && req.file.path) {
      try {
        await fsPromises.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    next(error);
  }
});

/**
 * @route   GET /files/:id
 * @desc    Download a file
 * @access  Private
 */
router.get('/:id', authenticateJWT, checkPermission(['file:download']), async (req, res, next) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      throw new Error('File not found');
    }

    // Check access permission
    const hasAccess = file.owner.equals(req.user.id) || 
      file.sharedWith.some(share => share.user.equals(req.user.id));
    
    if (!hasAccess) {
      throw new SecurityError('Access denied');
    }

    // Create temporary decrypted file
    const tempPath = path.join(UPLOAD_FOLDER, `temp-${uuidv4()}`);
    const readStream = fs.createReadStream(file.path);
    const writeStream = fs.createWriteStream(tempPath);

    // Decrypt the file key
    const fileKey = EncryptionService.decryptKey(
      file.encryptionKey,
      req.user.privateKey
    );

    // Decrypt the file
    await EncryptionService.decryptStream(
      readStream,
      writeStream,
      fileKey,
      Buffer.from(file.encryptionMetadata.iv, 'base64'),
      Buffer.from(file.encryptionMetadata.authTag, 'base64')
    );

    // Verify file hash before sending
    const downloadHash = await FileValidationService.calculateFileHash(tempPath);
    if (downloadHash !== file.hash) {
      await fsPromises.unlink(tempPath);
      throw new SecurityError('File integrity check failed');
    }

    // Log access
    await logSecurityEvent(req, 'FILE_DOWNLOAD', {
      fileId: file._id,
      filename: file.originalName,
      hash: downloadHash
    });

    // Log file access
    await logFileAccess(req, file._id, 'download');

    res.download(tempPath, file.originalName, async (err) => {
      // Clean up temporary file after download
      await fsPromises.unlink(tempPath);
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /files
 * @desc    List user's files
 * @access  Private
 */
router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    // Get files owned by user and shared with user
    const files = await File.find({
      $or: [
        { owner: req.user.id },
        { 'sharedWith.user': req.user.id }
      ]
    }).select('-encryptionKey -encryptionMetadata -path');

    res.json(files);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /files/:id/share
 * @desc    Share a file with another user
 * @access  Private
 */
router.post('/:id/share', authenticateJWT, checkPermission(['file:share']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, permission = 'read' } = req.body;

    const file = await File.findById(id);
    if (!file) {
      throw new Error('File not found');
    }

    if (!file.owner.equals(req.user.id)) {
      throw new SecurityError('Only file owner can share');
    }

    // Check if already shared
    const existingShare = file.sharedWith.find(share => share.user.equals(userId));
    if (existingShare) {
      existingShare.permission = permission;
    } else {
      file.sharedWith.push({ user: userId, permission });
    }

    await file.save();

    await logSecurityEvent(req, 'FILE_SHARED', {
      fileId: file._id,
      filename: file.originalName,
      sharedWith: userId
    });

    // Log file access
    await logFileAccess(req, file._id, 'share');

    res.json({ message: 'File shared successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /files/:id
 * @desc    Delete a file
 * @access  Private
 */
router.delete('/:id', authenticateJWT, checkPermission(['file:delete']), async (req, res, next) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      throw new Error('File not found');
    }

    if (!file.owner.equals(req.user.id)) {
      throw new SecurityError('Only file owner can delete');
    }

    // Delete file from storage
    await fsPromises.unlink(file.path);
    await file.remove();

    await logSecurityEvent(req, 'FILE_DELETED', {
      fileId: file._id,
      filename: file.originalName
    });

    // Log file access
    await logFileAccess(req, file._id, 'delete');

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;