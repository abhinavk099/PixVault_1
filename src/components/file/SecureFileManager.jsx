import React, { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, RefreshCw, Share2, Lock, AlertCircle, Check, File, FileText, FileSpreadsheet, Image, Archive, Code, Music, Video, Upload } from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useSecurity } from '../../hooks/useSecurity';
import { Alert } from '@/components/ui/alert';
import { AlertDescription } from '@chakra-ui/react';

// Update API base URL to ensure it includes /api
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api';
const STORAGE_ENDPOINT = import.meta.env.VITE_STORAGE_ENDPOINT;

const SecureFileManager = ({ onActionComplete }) => {
  const { hasPermission, Permissions } = usePermissions();
  const { logSecurityEvent, SecurityEventType } = useSecurity();
  
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [downloadProgress, setProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch files from localStorage (for demo purposes)
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      // Get files from localStorage
      const storedFiles = JSON.parse(localStorage.getItem('secureFiles') || '[]');
      setFiles(storedFiles);
      setError('');

      // Log security event
      await logSecurityEvent(SecurityEventType.FILES_ACCESSED, {
        fileCount: storedFiles.length
      }).catch(() => console.log('Failed to log security event'));
    } catch (error) {
      console.error('Error fetching files:', error);
      setError('Failed to load files. Please try again.');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [logSecurityEvent, SecurityEventType]);

  useEffect(() => {
    fetchFiles();
    
    // Notify parent component that files have been loaded
    if (onActionComplete) onActionComplete();
  }, [fetchFiles, onActionComplete]);

  const handleDownload = async (fileId, filename) => {
    // For demo purposes, we'll use a simplified approach
    try {
      setDownloading(fileId);
      
      // Get files from localStorage
      const storedFiles = JSON.parse(localStorage.getItem('secureFiles') || '[]');
      const fileData = storedFiles.find(f => f.id === fileId);
      
      if (!fileData) {
        throw new Error('File not found');
      }
      
      // Simulate progress
      setProgress(30);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simulate decryption - convert base64 data back to binary
      let fileContent;
      try {
        // If we have actual file content stored in base64 format
        if (fileData.content) {
          setProgress(60);
          // Convert base64 to binary data
          const binaryData = atob(fileData.content);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }
          fileContent = bytes.buffer;
        } else {
          // Fallback for files without content
          throw new Error('No file content available');
        }
      } catch (decryptError) {
        console.error('Error decrypting file:', decryptError);
        // Fallback to the original file if available
        if (fileData.originalFile) {
          fileContent = fileData.originalFile;
        } else {
          // Create a text file with error information as last resort
          const errorContent = `Unable to decrypt file: ${filename}

This is likely because the file was uploaded in demo mode without actual content.

File details:
ID: ${fileId}
Size: ${fileData.size} bytes
Uploaded: ${new Date(fileData.upload_date).toLocaleString()}`;
          fileContent = new TextEncoder().encode(errorContent).buffer;
        }
      }
      
      setProgress(90);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create a blob with the appropriate content type
      const blob = new Blob([fileContent], { type: fileData.type || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      setError('');
      setSuccessMessage('File downloaded successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Notify parent component that action is complete
      if (onActionComplete) onActionComplete();
    } catch (err) {
      setError('Failed to download file: ' + err.message);
      console.error('Download error:', err);
      
      // For demo purposes, we'll skip the security logging
    } finally {
      setDownloading(null);
      setProgress(0);
    }
  };

  const handleDelete = async (fileId, filename) => {
    if (!hasPermission(Permissions.FILE_DELETE)) {
      setError('You do not have permission to delete files');
      
      // Log unauthorized access attempt
      await logSecurityEvent(SecurityEventType.UNAUTHORIZED_ACCESS, {
        action: 'file_delete',
        file_id: fileId
      });
      
      return;
    }
    
    // Ask for confirmation
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Log delete attempt
      await logSecurityEvent(SecurityEventType.FILE_ACCESS, {
        action: 'file_delete_start',
        file_id: fileId,
        filename: filename
      });
      
      // For demo purposes, we'll delete the file from localStorage
      // Get files from localStorage
      const storedFiles = JSON.parse(localStorage.getItem('secureFiles') || '[]');
      const updatedFiles = storedFiles.filter(f => f.id !== fileId);
      
      // Save updated files back to localStorage
      localStorage.setItem('secureFiles', JSON.stringify(updatedFiles));
      
      // Update file list
      await fetchFiles();
      
      // Log successful deletion
      await logSecurityEvent(SecurityEventType.FILE_DELETED, {
        file_id: fileId,
        filename: filename,
        status: 'success'
      });
      
      setError('');
      setSuccessMessage('File deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Notify parent component that action is complete
      if (onActionComplete) onActionComplete();
    } catch (err) {
      setError('Failed to delete file: ' + err.message);
      console.error('Delete error:', err);
      
      // Log deletion failure
      await logSecurityEvent(SecurityEventType.FILE_ACCESS_FAILURE, {
        action: 'file_delete',
        file_id: fileId,
        filename: filename,
        error: err.message
      });
    }
  };

  const handleShare = async (fileId, filename) => {
    if (!hasPermission(Permissions.FILE_SHARE)) {
      setError('You do not have permission to share files');
      
      // Log unauthorized access attempt
      await logSecurityEvent(SecurityEventType.UNAUTHORIZED_ACCESS, {
        action: 'file_share',
        file_id: fileId
      });
      
      return;
    }
    
    // In a real app, this would open a sharing dialog
    // For this example, we'll just show a message
    alert('Sharing functionality would be implemented here');
    
    // Log share attempt
    await logSecurityEvent(SecurityEventType.FILE_SHARE, {
      file_id: fileId,
      filename: filename
    });
    
    // Notify parent component that action is complete
    if (onActionComplete) onActionComplete();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get file type icon and color
  const getFileTypeInfo = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    
    const typeMap = {
      // Documents
      pdf: { color: 'bg-red-100 text-red-700', icon: 'FileText' },
      doc: { color: 'bg-blue-100 text-blue-700', icon: 'FileText' },
      docx: { color: 'bg-blue-100 text-blue-700', icon: 'FileText' },
      txt: { color: 'bg-gray-100 text-gray-700', icon: 'FileText' },
      rtf: { color: 'bg-gray-100 text-gray-700', icon: 'FileText' },
      
      // Spreadsheets
      xls: { color: 'bg-green-100 text-green-700', icon: 'FileSpreadsheet' },
      xlsx: { color: 'bg-green-100 text-green-700', icon: 'FileSpreadsheet' },
      csv: { color: 'bg-green-100 text-green-700', icon: 'FileSpreadsheet' },
      
      // Images
      jpg: { color: 'bg-purple-100 text-purple-700', icon: 'Image' },
      jpeg: { color: 'bg-purple-100 text-purple-700', icon: 'Image' },
      png: { color: 'bg-purple-100 text-purple-700', icon: 'Image' },
      gif: { color: 'bg-purple-100 text-purple-700', icon: 'Image' },
      svg: { color: 'bg-purple-100 text-purple-700', icon: 'Image' },
      
      // Archives
      zip: { color: 'bg-yellow-100 text-yellow-700', icon: 'Archive' },
      rar: { color: 'bg-yellow-100 text-yellow-700', icon: 'Archive' },
      '7z': { color: 'bg-yellow-100 text-yellow-700', icon: 'Archive' },
      tar: { color: 'bg-yellow-100 text-yellow-700', icon: 'Archive' },
      gz: { color: 'bg-yellow-100 text-yellow-700', icon: 'Archive' },
      
      // Code
      js: { color: 'bg-yellow-100 text-yellow-700', icon: 'Code' },
      jsx: { color: 'bg-yellow-100 text-yellow-700', icon: 'Code' },
      ts: { color: 'bg-blue-100 text-blue-700', icon: 'Code' },
      tsx: { color: 'bg-blue-100 text-blue-700', icon: 'Code' },
      html: { color: 'bg-orange-100 text-orange-700', icon: 'Code' },
      css: { color: 'bg-blue-100 text-blue-700', icon: 'Code' },
      py: { color: 'bg-blue-100 text-blue-700', icon: 'Code' },
      java: { color: 'bg-red-100 text-red-700', icon: 'Code' },
      
      // Audio
      mp3: { color: 'bg-pink-100 text-pink-700', icon: 'Music' },
      wav: { color: 'bg-pink-100 text-pink-700', icon: 'Music' },
      ogg: { color: 'bg-pink-100 text-pink-700', icon: 'Music' },
      
      // Video
      mp4: { color: 'bg-indigo-100 text-indigo-700', icon: 'Video' },
      avi: { color: 'bg-indigo-100 text-indigo-700', icon: 'Video' },
      mov: { color: 'bg-indigo-100 text-indigo-700', icon: 'Video' },
      wmv: { color: 'bg-indigo-100 text-indigo-700', icon: 'Video' },
    };
    
    return typeMap[extension] || { color: 'bg-gray-100 text-gray-700', icon: 'File' };
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading files...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto p-6">
      <div className="mb-6 flex justify-end">
        <button
          onClick={fetchFiles}
          className="p-3 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors duration-200 flex items-center"
          title="Refresh file list"
        >
          <RefreshCw size={18} className="text-blue-600" />
        </button>
      </div>

      {/* Search and filter bar */}
      <div className="mb-6 flex items-center justify-end bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center space-x-3">
          <select className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
            <option>All Files</option>
            <option>Documents</option>
            <option>Images</option>
            <option>Videos</option>
            <option>Audio</option>
            <option>Archives</option>
            <option>Code</option>
          </select>
          <select className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
            <option>Date: Newest</option>
            <option>Date: Oldest</option>
            <option>Name: A-Z</option>
            <option>Name: Z-A</option>
            <option>Size: Largest</option>
            <option>Size: Smallest</option>
          </select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {successMessage && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <Check className="h-4 w-4 mr-2 text-green-600" />
          <AlertDescription className="text-green-600">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {files.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Lock className="mx-auto h-16 w-16 text-gray-300" />
          <p className="mt-4 text-gray-600 font-medium">No files uploaded yet</p>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            Your files will be encrypted before upload and securely stored. Only you can access them.
          </p>
          <button 
            onClick={() => document.querySelector('[title="Upload"]')?.click()}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center mx-auto"
          >
            <Upload size={16} className="mr-2" />
            Upload Your First File
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col"
            >
              <div className="p-5 flex items-start space-x-4">
                {(() => {
                  const fileInfo = getFileTypeInfo(file.filename);
                  const IconComponent = eval(fileInfo.icon);
                  return (
                    <div className={`p-3 rounded-lg ${fileInfo.color}`}>
                      <IconComponent size={22} />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium truncate text-gray-800">
                    {file.filename}
                  </h3>
                  <div className="flex flex-wrap text-sm text-gray-500 mt-1">
                    <span className="mr-4 flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1"></span>
                      {formatDate(file.upload_date)}
                    </span>
                    <span className="flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"></span>
                      {file.size / (1024 * 1024) < 1 ? 
                        `${(file.size / 1024).toFixed(2)} KB` : 
                        `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-auto border-t border-gray-100 bg-gray-50 p-2 flex justify-end items-center space-x-1">
                {/* Always show download button for demo purposes */}
                <button
                  onClick={() => handleDownload(file.id, file.filename)}
                  disabled={downloading === file.id}
                  className={`p-2 rounded-full hover:bg-blue-100 text-blue-600 ${
                    downloading === file.id ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Download file"
                >
                  {downloading === file.id ? (
                    <div className="flex items-center">
                      <RefreshCw size={18} className="animate-spin" />
                      <span className="ml-1 text-xs font-medium">{downloadProgress}%</span>
                    </div>
                  ) : (
                    <Download size={18} />
                  )}
                </button>
                
                {hasPermission(Permissions.FILE_SHARE) && (
                  <button
                    onClick={() => handleShare(file.id, file.filename)}
                    className="p-2 rounded-full hover:bg-green-100 text-green-600"
                    title="Share file"
                  >
                    <Share2 size={18} />
                  </button>
                )}
                
                {hasPermission(Permissions.FILE_DELETE) && (
                  <button
                    onClick={() => handleDelete(file.id, file.filename)}
                    className="p-2 rounded-full hover:bg-red-100 text-red-600"
                    title="Delete file"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecureFileManager;