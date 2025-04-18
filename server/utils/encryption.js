const crypto = require('crypto');
const fs = require('fs');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

class EncryptionService {
  /**
   * Generate a new encryption key
   * @returns {Buffer} The generated key
   */
  static async generateKey() {
    return crypto.randomBytes(KEY_LENGTH);
  }

  /**
   * Encrypt a file stream
   * @param {ReadableStream} readStream - Source file stream
   * @param {WriteableStream} writeStream - Destination file stream
   * @param {Buffer} key - Encryption key
   * @returns {Promise<{iv: Buffer, authTag: Buffer}>} Encryption metadata
   */
  static async encryptStream(readStream, writeStream, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Write the IV at the start of the output file
    writeStream.write(iv);

    await pipeline(
      readStream,
      cipher,
      writeStream
    );

    return {
      iv,
      authTag: cipher.getAuthTag()
    };
  }

  /**
   * Decrypt a file stream
   * @param {ReadableStream} readStream - Source encrypted file stream
   * @param {WriteableStream} writeStream - Destination file stream
   * @param {Buffer} key - Decryption key
   * @param {Buffer} iv - Initialization vector
   * @param {Buffer} authTag - Authentication tag
   * @returns {Promise<void>}
   */
  static async decryptStream(readStream, writeStream, key, iv, authTag) {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    await pipeline(
      readStream,
      decipher,
      writeStream
    );
  }

  /**
   * Encrypt a key with a user's public key
   * @param {Buffer} key - Key to encrypt
   * @param {string} publicKey - User's public key
   * @returns {string} Encrypted key in base64
   */
  static encryptKey(key, publicKey) {
    // Check if we're using password-based encryption instead of public key
    if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
      // Use password-based encryption instead
      return EncryptionService.encryptWithPassword(key, publicKey);
    }
    
    // Proceed with public key encryption
    const encryptedKey = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      key
    );
    return encryptedKey.toString('base64');
  }

  /**
   * Encrypt data with a password
   * @param {Buffer} data - Data to encrypt
   * @param {string} password - Password to use for encryption
   * @returns {string} Encrypted data in base64 (JSON format with iv and tag)
   */
  static encryptWithPassword(data, password) {
    // Derive key from password
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
    
    // Encrypt the data
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Return as JSON with all components needed for decryption
    return JSON.stringify({
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64')
    });
  }

  /**
   * Decrypt data with a password
   * @param {string} encryptedData - Encrypted data in JSON format with iv, tag and salt
   * @param {string} password - Password to use for decryption
   * @returns {Buffer} Decrypted data
   */
  static decryptWithPassword(encryptedData, password) {
    const { encrypted, iv, authTag, salt } = JSON.parse(encryptedData);
    
    // Derive key from password
    const key = crypto.pbkdf2Sync(
      password, 
      Buffer.from(salt, 'base64'), 
      100000, 
      KEY_LENGTH, 
      'sha512'
    );
    
    // Decrypt the data
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final()
    ]);
  }

  /**
   * Decrypt a key with a user's private key
   * @param {string} encryptedKey - Encrypted key in base64
   * @param {string} privateKey - User's private key
   * @returns {Buffer} Decrypted key
   */
  static decryptKey(encryptedKey, privateKey) {
    // Check if this is password-encrypted data (JSON format with iv and tag)
    if (encryptedKey.startsWith('{') && encryptedKey.includes('encrypted')) {
      // Use password-based decryption
      return EncryptionService.decryptWithPassword(encryptedKey, privateKey);
    }
    
    // Proceed with private key decryption
    const buffer = Buffer.from(encryptedKey, 'base64');
    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    );
  }

  /**
   * Generate a key pair for a user
   * @returns {Promise<{publicKey: string, privateKey: string}>}
   */
  static generateKeyPair() {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) reject(err);
        else resolve({ publicKey, privateKey });
      });
    });
  }

  /**
   * Validate file hash
   * @param {string} filePath - Path to the file
   * @param {string} expectedHash - Expected SHA-256 hash
   * @returns {Promise<boolean>} True if hash matches
   */
  static async validateFileHash(filePath, expectedHash) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => {
        const calculatedHash = hash.digest('hex');
        resolve(calculatedHash === expectedHash);
      });
    });
  }
}

const encrypt = (data, key) => {
  try {
    // Convert key from base64 if it's a string
    const keyBuffer = Buffer.from(key, 'base64');
    
    // Create random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    // Convert data to buffer if it's a string
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    
    // Encrypt data
    const encryptedData = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final()
    ]);
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('base64'),
      encryptedData: encryptedData.toString('base64'),
      tag: tag.toString('base64')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts data encrypted with AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} iv - Base64 encoded initialization vector
 * @param {string} tag - Base64 encoded authentication tag
 * @param {string} key - Base64 encoded encryption key
 * @returns {Buffer} Decrypted data
 */
const decrypt = (encryptedData, iv, tag, key) => {
  try {
    // Convert from base64
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');
    const keyBuffer = Buffer.from(key, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    decipher.setAuthTag(tagBuffer);
    
    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]);
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Generates a random encryption key
 * @returns {string} Base64 encoded encryption key
 */
const generateKey = () => {
  const key = crypto.randomBytes(32); // 256 bits
  return key.toString('base64');
};

/**
 * Hashes data with SHA-256
 * @param {string} data - Data to hash
 * @returns {string} Hex encoded hash
 */
const hash = (data) => {
  return crypto.createHash('sha256')
    .update(data)
    .digest('hex');
};

/**
 * Creates a secure password hash with PBKDF2
 * @param {string} password - The password to hash
 * @param {string} [salt] - Optional salt, will generate if not provided
 * @returns {object} Object containing salt and hash
 */
const hashPassword = (password, salt = null) => {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  
  const hash = crypto.pbkdf2Sync(
    password,
    useSalt,
    10000, // iterations
    64,    // key length
    'sha512'
  ).toString('hex');
  
  return {
    salt: useSalt,
    hash
  };
};

/**
 * Verifies a password against a hash
 * @param {string} password - Password to verify
 * @param {string} hash - Stored hash
 * @param {string} salt - Stored salt
 * @returns {boolean} True if password matches
 */
const verifyPassword = (password, hash, salt) => {
  const verifyHash = crypto.pbkdf2Sync(
    password,
    salt,
    10000,
    64,
    'sha512'
  ).toString('hex');
  
  return hash === verifyHash;
};

/**
 * Encrypts the client's encryption key with the server's master key
 * This allows the server to store the encryption key without being able to decrypt files
 * @param {string} clientKey - Client's encryption key (base64)
 * @returns {string} Encrypted key (base64)
 */
const encryptClientKey = (clientKey) => {
  const serverKey = process.env.SERVER_MASTER_KEY;
  if (!serverKey) {
    throw new Error('Server master key not configured');
  }
  
  const { iv, encryptedData, tag } = encrypt(clientKey, serverKey);
  
  // Store all components together
  return JSON.stringify({ iv, key: encryptedData, tag });
};

/**
 * Decrypts the client's encryption key
 * @param {string} encryptedClientKey - Encrypted client key (JSON string)
 * @returns {string} Decrypted client key (base64)
 */
const decryptClientKey = (encryptedClientKey) => {
  const serverKey = process.env.SERVER_MASTER_KEY;
  if (!serverKey) {
    throw new Error('Server master key not configured');
  }
  
  const { iv, key, tag } = JSON.parse(encryptedClientKey);
  const decrypted = decrypt(key, iv, tag, serverKey);
  
  return decrypted.toString();
};

module.exports = {
  encrypt,
  decrypt,
  generateKey,
  hash,
  hashPassword,
  verifyPassword,
  encryptClientKey,
  decryptClientKey,
  EncryptionService
};