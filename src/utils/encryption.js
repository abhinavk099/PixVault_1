/**
 * Encryption utility functions for secure file handling
 * Using Web Crypto API for client-side encryption
 */

/**
 * Generates a random encryption key
 * @returns {Promise<CryptoKey>} The generated AES-GCM key
 */
export const generateEncryptionKey = async () => {
    try {
      return await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      throw new Error('Encryption key generation failed');
    }
  };
  
  /**
   * Exports a CryptoKey to base64 string format
   * @param {CryptoKey} key - The key to export
   * @returns {Promise<string>} Base64 encoded key
   */
  export const exportKeyToBase64 = async (key) => {
    try {
      const rawKey = await window.crypto.subtle.exportKey('raw', key);
      const keyArray = Array.from(new Uint8Array(rawKey));
      const keyBase64 = btoa(String.fromCharCode.apply(null, keyArray));
      return keyBase64;
    } catch (error) {
      console.error('Failed to export key:', error);
      throw new Error('Key export failed');
    }
  };
  
  /**
   * Imports a base64 string key to CryptoKey
   * @param {string} keyBase64 - Base64 encoded key
   * @returns {Promise<CryptoKey>} The imported CryptoKey
   */
  export const importKeyFromBase64 = async (keyBase64) => {
    try {
      const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
      return await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to import key:', error);
      throw new Error('Key import failed');
    }
  };
  
  /**
   * Encrypts a file using AES-GCM
   * @param {ArrayBuffer} fileData - The file data to encrypt
   * @param {CryptoKey} key - The encryption key
   * @returns {Promise<Object>} Object containing encrypted data and IV
   */
  export const encryptFile = async (fileData, key = null) => {
    try {
      // Generate key if not provided
      const encryptionKey = key || await generateEncryptionKey();
      
      // Generate a random IV (Initialization Vector)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the file with AES-GCM
      const encryptedContent = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        encryptionKey,
        fileData
      );
      
      // Concatenate IV and encrypted content for storage
      const encryptedData = new Uint8Array(iv.length + encryptedContent.byteLength);
      encryptedData.set(iv, 0);
      encryptedData.set(new Uint8Array(encryptedContent), iv.length);
      
      // Export the key to base64 if it was newly generated
      const keyBase64 = key ? await exportKeyToBase64(key) : await exportKeyToBase64(encryptionKey);
      
      return {
        encryptedData,
        keyBase64,
        iv
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('File encryption failed');
    }
  };
  
  /**
   * Decrypts an encrypted file using AES-GCM
   * @param {Uint8Array} encryptedData - The encrypted data (IV + ciphertext)
   * @param {string} keyBase64 - Base64 encoded encryption key
   * @returns {Promise<ArrayBuffer>} The decrypted file data
   */
  export const decryptFile = async (encryptedData, keyBase64) => {
    try {
      // Import the key from base64
      const key = await importKeyFromBase64(keyBase64);
      
      // Extract IV and encrypted content
      const iv = encryptedData.slice(0, 12);
      const ciphertext = encryptedData.slice(12);
      
      // Decrypt the file
      const decryptedContent = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        key,
        ciphertext
      );
      
      return decryptedContent;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('File decryption failed');
    }
  };
  
  /**
   * Hashes data using SHA-256
   * @param {string} data - The data to hash
   * @returns {Promise<string>} Hex string of the hash
   */
  export const hashData = async (data) => {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('Hashing failed:', error);
      throw new Error('Data hashing failed');
    }
  };
  
  /**
   * Verifies if the browser supports the required crypto APIs
   * @returns {boolean} True if supported, false otherwise
   */
  export const isCryptoSupported = () => {
    return window.crypto && window.crypto.subtle && 
      typeof window.crypto.subtle.encrypt === 'function' &&
      typeof window.crypto.subtle.decrypt === 'function' &&
      typeof window.crypto.subtle.generateKey === 'function';
  };
  
  /**
   * Creates a secure password hash with salt for storage
   * @param {string} password - The password to hash
   * @returns {Promise<Object>} Object containing hash and salt
   */
  export const hashPassword = async (password) => {
    try {
      // Generate a random salt
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = btoa(String.fromCharCode.apply(null, salt));
      
      // Convert password to buffer with salt
      const encoder = new TextEncoder();
      const passwordWithSalt = encoder.encode(password + saltBase64);
      
      // Hash with SHA-256
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', passwordWithSalt);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return {
        hash: hashHex,
        salt: saltBase64
      };
    } catch (error) {
      console.error('Password hashing failed:', error);
      throw new Error('Password security processing failed');
    }
  };
  
  /**
   * Verifies a password against a stored hash and salt
   * @param {string} password - The password to verify
   * @param {string} storedHash - The stored hash
   * @param {string} storedSalt - The stored salt
   * @returns {Promise<boolean>} True if password matches, false otherwise
   */
  export const verifyPassword = async (password, storedHash, storedSalt) => {
    try {
      // Recreate hash with provided password and stored salt
      const encoder = new TextEncoder();
      const passwordWithSalt = encoder.encode(password + storedSalt);
      
      // Hash with SHA-256
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', passwordWithSalt);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Compare hashes (timing-safe comparison would be better in production)
      return hashHex === storedHash;
    } catch (error) {
      console.error('Password verification failed:', error);
      throw new Error('Password verification failed');
    }
  };