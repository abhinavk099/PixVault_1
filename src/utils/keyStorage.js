/**
 * Secure key storage utility using Web Crypto API
 */

const STORAGE_KEY = 'pixvault_keys';
const ITERATION_COUNT = 100000;
const HASH_LENGTH = 256;
const SALT_LENGTH = 16;

/**
 * Generate a random salt
 * @returns {Uint8Array} Random salt
 */
const generateSalt = () => {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
};

/**
 * Derive a key from a password
 * @param {string} password - User's password
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} Derived key
 */
const deriveKey = async (password, salt) => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATION_COUNT,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: HASH_LENGTH
    },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt data with a key
 * @param {CryptoKey} key - Encryption key
 * @param {ArrayBuffer} data - Data to encrypt
 * @returns {Promise<{encrypted: ArrayBuffer, iv: Uint8Array}>} Encrypted data and IV
 */
const encrypt = async (key, data) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    data
  );

  return { encrypted, iv };
};

/**
 * Decrypt data with a key
 * @param {CryptoKey} key - Decryption key
 * @param {ArrayBuffer} encrypted - Encrypted data
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<ArrayBuffer>} Decrypted data
 */
const decrypt = async (key, encrypted, iv) => {
  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encrypted
  );
};

/**
 * Store encrypted keys in localStorage
 * @param {Object} keys - Keys to store
 * @param {string} password - Password to encrypt keys
 */
export const storeKeys = async (keys, password) => {
  try {
    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(keys));
    
    const { encrypted, iv } = await encrypt(key, data);

    // Store encrypted data with salt and IV
    const storage = {
      encrypted: Array.from(new Uint8Array(encrypted)),
      salt: Array.from(salt),
      iv: Array.from(iv)
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error('Error storing keys:', error);
    throw new Error('Failed to store keys securely');
  }
};

/**
 * Retrieve decrypted keys from localStorage
 * @param {string} password - Password to decrypt keys
 * @returns {Promise<Object>} Decrypted keys
 */
export const retrieveKeys = async (password) => {
  try {
    const storage = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!storage) {
      throw new Error('No stored keys found');
    }

    const { encrypted, salt, iv } = storage;
    const key = await deriveKey(password, new Uint8Array(salt));

    const decrypted = await decrypt(
      key,
      new Uint8Array(encrypted).buffer,
      new Uint8Array(iv)
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error('Error retrieving keys:', error);
    throw new Error('Failed to retrieve keys');
  }
};

/**
 * Clear stored keys from localStorage
 */
export const clearKeys = () => {
  localStorage.removeItem(STORAGE_KEY);
};
