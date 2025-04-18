/**
 * Service for handling file operations with the API
 */
import { encryptFile, decryptFile } from '../utils/encryption';
import { validateFileSize, validateFileType, logSecurityEvent } from '../utils/security';
import { API_BASE_URL } from '../constants/securityConstants';

/**
 * Uploads a file with client-side encryption
 * @param {File} file - The file to upload
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Upload result
 */
export const uploadFile = async (file, onProgress = () => {}) => {
  try {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }
    
    // Validate file size (50MB limit)
    if (!validateFileSize(file.size, 50)) {
      throw new Error('File size exceeds the maximum limit (50MB)');
    }
    
    // Validate file type
    if (!validateFileType(file.type)) {
      throw new Error('File type not allowed');
    }
    
    // Update progress
    onProgress(10);
    
    // Read file as ArrayBuffer
    const fileBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
    
    // Update progress
    onProgress(20);
    
    // Encrypt file
    const { encryptedData, keyBase64 } = await encryptFile(fileBuffer);
    
    // Update progress
    onProgress(40);
    
    // Get upload URL from server
    const uploadUrlResponse = await fetch(`${API_BASE_URL}/files/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        filename: file.name,
        content_type: 'application/octet-stream', // Always use this for encrypted data
        size: encryptedData.byteLength,
      }),
    });
    
    if (!uploadUrlResponse.ok) {
      throw new Error('Failed to get upload URL');
    }
    
    const { upload_url, file_id } = await uploadUrlResponse.json();
    
    // Update progress
    onProgress(50);
    
    // Upload encrypted file to storage
    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      body: encryptedData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      // Track upload progress if available
      ...(typeof XMLHttpRequest !== 'undefined' && {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 40) / progressEvent.total);
          onProgress(50 + percentCompleted);
        },
      }),
    });
    
    if (!uploadResponse.ok) {
      throw new Error('Failed to upload encrypted file');
    }
    
    // Update progress
    onProgress(90);
    
    // Confirm upload and store encryption key
    const confirmResponse = await fetch(`${API_BASE_URL}/files/confirm-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        file_id,
        encryption_key: keyBase64,
        original_name: file.name,
        original_type: file.type,
        original_size: file.size,
      }),
    });
    
    if (!confirmResponse.ok) {
      throw new Error('Failed to confirm upload');
    }
    
    const result = await confirmResponse.json();
    
    // Update progress
    onProgress(100);
    
    // Log successful upload
    logSecurityEvent('file_upload', {
      file_id,
      filename: file.name,
      size: file.size,
      type: file.type
    });
    
    return result;
  } catch (error) {
    // Log error
    logSecurityEvent('file_upload_error', {
      filename: file?.name,
      error: error.message
    });
    
    throw error;
  }
};

/**
 * Downloads and decrypts a file
 * @param {string} fileId - ID of the file to download
 * @returns {Promise<Object>} Object with decrypted blob and file info
 */
export const downloadFile = async (fileId) => {
  try {
    // Get download URL and encryption key
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const { url, encryption_key, filename, content_type } = await response.json();

    // Download encrypted file
    const encryptedResponse = await fetch(url);
    
    if (!encryptedResponse.ok) {
      throw new Error('Failed to download encrypted file');
    }
    
    const encryptedData = await encryptedResponse.arrayBuffer();

    // Decrypt file
    const decryptedData = await decryptFile(
      new Uint8Array(encryptedData),
      encryption_key
    );

    // Create blob with original content type
    const blob = new Blob([decryptedData], { type: content_type || 'application/octet-stream' });

    // Log successful download
    logSecurityEvent('file_download', {
      file_id: fileId,
      filename
    });

    return {
      blob,
      filename,
      content_type
    };
  } catch (error) {
    // Log error
    logSecurityEvent('file_download_error', {
      file_id: fileId,
      error: error.message
    });
    
    throw error;
  }
};

/**
 * Gets a list of user's files
 * @returns {Promise<Array>} List of files
 */
export const listFiles = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/files/`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    return await response.json();
  } catch (error) {
    logSecurityEvent('file_list_error', {
      error: error.message
    });
    
    throw error;
  }
};

/**
 * Deletes a file
 * @param {string} fileId - ID of the file to delete
 * @returns {Promise<boolean>} True if delete was successful
 */
export const deleteFile = async (fileId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }

    // Log successful deletion
    logSecurityEvent('file_delete', {
      file_id: fileId
    });

    return true;
  } catch (error) {
    // Log error
    logSecurityEvent('file_delete_error', {
      file_id: fileId,
      error: error.message
    });
    
    throw error;
  }
};

/**
 * Shares a file with another user
 * @param {string} fileId - ID of the file to share
 * @param {string} recipientUserId - ID of the user to share with
 * @param {string} permission - Permission level ('read' or 'read_write')
 * @returns {Promise<Object>} Share result
 */
export const shareFile = async (fileId, recipientUserId, permission = 'read') => {
  try {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        recipient_id: recipientUserId,
        permission
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to share file');
    }

    const result = await response.json();

    // Log successful share
    logSecurityEvent('file_share', {
      file_id: fileId,
      recipient_id: recipientUserId,
      permission
    });

    return result;
  } catch (error) {
    // Log error
    logSecurityEvent('file_share_error', {
      file_id: fileId,
      recipient_id: recipientUserId,
      error: error.message
    });
    
    throw error;
  }
};

export default {
  uploadFile,
  downloadFile,
  listFiles,
  deleteFile,
  shareFile
};