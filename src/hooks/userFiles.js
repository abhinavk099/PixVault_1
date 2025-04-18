import { useState, useEffect, useCallback } from 'react';
import fileService from '../services/fileService';
import { useSecurity } from '../contexts/SecurityContext';

/**
 * Custom hook for file operations
 */
const useFiles = () => {
  const { logSecurityEvent, SecurityEventType } = useSecurity();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch user's files on mount
  useEffect(() => {
    fetchFiles();
  }, []);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fileService.listFiles();
      setFiles(data);
      
      return data;
    } catch (err) {
      console.error('Error fetching files:', err);
      setError('Failed to load files: ' + err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload file with encryption
  const uploadFile = useCallback(async (file) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);
      
      // Handle progress updates
      const handleProgress = (progress) => {
        setUploadProgress(progress);
      };
      
      // Upload the file
      const result = await fileService.uploadFile(file, handleProgress);
      
      // Refresh the file list
      await fetchFiles();
      
      // Log security event
      await logSecurityEvent(SecurityEventType.FILE_UPLOAD, {
        file_id: result.file_id,
        filename: file.name
      });
      
      return result;
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed: ' + err.message);
      
      // Log security event
      await logSecurityEvent(SecurityEventType.FILE_UPLOAD_FAILURE, {
        filename: file?.name,
        error: err.message
      });
      
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [fetchFiles, logSecurityEvent, SecurityEventType]);

  // Download file with decryption
  const downloadFile = useCallback(async (fileId, filename) => {
    try {
      setLoading(true);
      setError(null);
      
      // Log download attempt
      await logSecurityEvent(SecurityEventType.FILE_ACCESS, {
        action: 'file_download_start',
        file_id: fileId,
        filename
      });
      
      // Download and decrypt the file
      const { blob, filename: name } = await fileService.downloadFile(fileId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      // Log successful download
      await logSecurityEvent(SecurityEventType.FILE_DOWNLOAD, {
        file_id: fileId,
        filename,
        status: 'success'
      });
      
      return true;
    } catch (err) {
      console.error('Download error:', err);
      setError('Download failed: ' + err.message);
      
      // Log download failure
      await logSecurityEvent(SecurityEventType.FILE_ACCESS_FAILURE, {
        action: 'file_download',
        file_id: fileId,
        filename,
        error: err.message
      });
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [logSecurityEvent, SecurityEventType]);

  // Delete file
  const deleteFile = useCallback(async (fileId, filename) => {
    try {
      setLoading(true);
      setError(null);
      
      // Log delete attempt
      await logSecurityEvent(SecurityEventType.FILE_ACCESS, {
        action: 'file_delete_start',
        file_id: fileId,
        filename
      });
      
      // Delete the file
      await fileService.deleteFile(fileId);
      
      // Update files list
      setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
      
      // Log successful deletion
      await logSecurityEvent(SecurityEventType.FILE_DELETE, {
        file_id: fileId,
        filename,
        status: 'success'
      });
      
      return true;
    } catch (err) {
      console.error('Delete error:', err);
      setError('Delete failed: ' + err.message);
      
      // Log deletion failure
      await logSecurityEvent(SecurityEventType.FILE_ACCESS_FAILURE, {
        action: 'file_delete',
        file_id: fileId,
        filename,
        error: err.message
      });
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [logSecurityEvent, SecurityEventType]);

  // Share file with another user
  const shareFile = useCallback(async (fileId, filename, recipientUserId, permission = 'read') => {
    try {
      setLoading(true);
      setError(null);
      
      // Share the file
      const result = await fileService.shareFile(fileId, recipientUserId, permission);
      
      // Log security event
      await logSecurityEvent(SecurityEventType.FILE_SHARE, {
        file_id: fileId,
        filename,
        recipient_id: recipientUserId,
        permission
      });
      
      return result;
    } catch (err) {
      console.error('Share error:', err);
      setError('Share failed: ' + err.message);
      
      // Log sharing failure
      await logSecurityEvent(SecurityEventType.FILE_SHARE_FAILURE, {
        file_id: fileId,
        filename,
        recipient_id: recipientUserId,
        error: err.message
      });
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [logSecurityEvent, SecurityEventType]);

  // Get file details
  const getFileDetails = useCallback((fileId) => {
    return files.find(file => file.id === fileId) || null;
  }, [files]);

  // Clear errors
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    files,
    loading,
    error,
    uploadProgress,
    isUploading,
    fetchFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    shareFile,
    getFileDetails,
    clearError
  };
};

export default useFiles;