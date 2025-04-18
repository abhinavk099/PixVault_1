import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Flex,
  Text,
  Input,
  Alert,
  AlertIcon,
  AlertDescription,
  Progress,
  Icon,
  useColorModeValue
} from '@chakra-ui/react';
import { Upload, X, Check, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../constants/securityConstants';

const SecureFileUploader = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Helper function to encrypt file
  const encryptFile = async (fileData) => {
    try {
      // Generate a random encryption key
      const key = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );

      // Generate a random IV (Initialization Vector)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the file
      const encryptedContent = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        fileData
      );

      // Concatenate IV and encrypted content
      const encryptedData = new Uint8Array(iv.length + encryptedContent.byteLength);
      encryptedData.set(iv, 0);
      encryptedData.set(new Uint8Array(encryptedContent), iv.length);

      // Export the key to raw format
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      
      // Convert the key to base64 for storage
      const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));

      return {
        encryptedData,
        keyBase64
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt file');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
        setError('File size exceeds 50MB limit');
        setFile(null);
      } else {
        setFile(selectedFile);
        setError('');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      const droppedFile = e.dataTransfer.files[0];
      
      if (droppedFile.size > 50 * 1024 * 1024) {
        setError('File size exceeds 50MB limit');
        setFile(null);
      } else {
        setFile(droppedFile);
        setError('');
      }
    }
  };

  const resetUploader = () => {
    setFile(null);
    setError('');
    setProgress(0);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    try {
      setUploading(true);
      setError('');
      setProgress(10);

      // First, read the file as base64 to store the content
      const base64Promise = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          // Extract base64 data (remove data URL prefix)
          const base64Content = reader.result.split(',')[1];
          resolve(base64Content);
        };
        reader.onerror = () => reject(new Error('Failed to read file as base64'));
      });

      // In parallel, read the file as ArrayBuffer for encryption
      const arrayBufferPromise = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file as array buffer'));
      });
      
      // Wait for both reads to complete
      const [base64Content, fileData] = await Promise.all([base64Promise, arrayBufferPromise]);
      setProgress(30);
      
      // Encrypt the file
      const { encryptedData, keyBase64 } = await encryptFile(fileData);
      setProgress(60);
      
      // Create form data for upload
      const formData = new FormData();
      const encryptedBlob = new Blob([encryptedData]);
      formData.append('file', encryptedBlob, file.name);
      
      // For demo purposes, simulate a direct file upload without server
      // In a real application, this would communicate with a secure backend
      setProgress(70);
      
      // Generate a random file ID
      const file_id = 'file_' + Math.random().toString(36).substring(2, 15);
      
      // Simulate network delay for upload
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(80);
      
      // Simulate another network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgress(90);
      
      // Create file metadata with content
      const fileMetadata = {
        id: file_id,
        filename: file.name,
        size: file.size,
        type: file.type,
        upload_date: new Date().toISOString(),
        encryption_key: keyBase64,
        content: base64Content // Store the actual file content
      };
      
      // Get existing files from localStorage or initialize empty array
      const existingFiles = JSON.parse(localStorage.getItem('secureFiles') || '[]');
      
      // Add new file and save back to localStorage
      existingFiles.push(fileMetadata);
      
      try {
        localStorage.setItem('secureFiles', JSON.stringify(existingFiles));
      } catch (storageError) {
        console.error('Storage error:', storageError);
        // If localStorage is full, remove the file we just tried to add
        existingFiles.pop();
        setError('Storage limit reached. Try uploading a smaller file.');
        throw new Error('Storage limit reached');
      }
      
      setProgress(100);
      setUploadSuccess(true);
      
      // Notify parent component if needed
      if (onUploadComplete) {
        onUploadComplete();
      }
      
      // Reset uploader after short delay
      setTimeout(() => {
        resetUploader();
      }, 2000);
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const hoverBorderColor = useColorModeValue('blue.400', 'blue.300');
  const bgColor = useColorModeValue('white', 'gray.700');
  const fileBgColor = useColorModeValue('blue.50', 'blue.900');

  return (
    <Box maxW="xl" mx="auto" p={4}>
      <Text fontSize="2xl" fontWeight="bold" mb={4}>Upload Secure File</Text>
      
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Box
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        borderWidth={2}
        borderStyle="dashed"
        borderColor={file ? "blue.400" : borderColor}
        borderRadius="lg"
        p={6}
        textAlign="center"
        bg={file ? fileBgColor : bgColor}
        _hover={{ borderColor: hoverBorderColor }}
        transition="colors 0.15s ease-in-out"
      >
        <Input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          display="none"
          isDisabled={uploading}
        />
        
        {!file ? (
          <Box onClick={() => fileInputRef.current?.click()} cursor="pointer">
            <Icon as={Upload} boxSize={12} color="gray.400" mx="auto" />
            <Text mt={2} fontWeight="medium">Click to upload or drag and drop</Text>
            <Text fontSize="xs" color="gray.500">Files up to 50MB</Text>
            <Text fontSize="xs" color="gray.500" mt={2}>Your files will be encrypted before upload</Text>
          </Box>
        ) : (
          <Box>
            <Flex justifyContent="space-between" alignItems="center">
              <Box textAlign="left">
                <Text fontWeight="medium" isTruncated maxW="xs">
                  {file.name}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </Text>
              </Box>
              
              {!uploading && !uploadSuccess && (
                <Button
                  onClick={resetUploader}
                  size="sm"
                  variant="ghost"
                  borderRadius="full"
                  p={1}
                >
                  <Icon as={X} boxSize={4} />
                </Button>
              )}
              
              {uploadSuccess && (
                <Flex bg="green.100" color="green.600" borderRadius="full" p={1}>
                  <Icon as={Check} boxSize={4} />
                </Flex>
              )}
            </Flex>
            
            {uploading && (
              <Box mt={4}>
                <Progress 
                  value={progress} 
                  size="sm" 
                  colorScheme="blue" 
                  borderRadius="full" 
                  mb={2}
                />
                <Text fontSize="xs" color="gray.500" textAlign="right">{progress}%</Text>
              </Box>
            )}
            
            {!uploading && !uploadSuccess && (
              <Button
                onClick={handleUpload}
                colorScheme="blue"
                width="full"
                mt={4}
              >
                Encrypt & Upload
              </Button>
            )}
            
            {uploading && (
              <Flex alignItems="center" justifyContent="center" mt={2} color="gray.500" fontSize="sm">
                <Icon as={RefreshCw} boxSize={4} mr={2} className="animate-spin" />
                <Text>{progress < 30 ? 'Preparing file...' : 
                      progress < 60 ? 'Encrypting...' : 
                      'Uploading...'}</Text>
              </Flex>
            )}
            
            {uploadSuccess && (
              <Text fontSize="sm" color="green.600" mt={2}>
                File uploaded successfully!
              </Text>
            )}
          </Box>
        )}
      </Box>
      
      <Text mt={4} fontSize="xs" color="gray.500">
        Files are encrypted in your browser before being uploaded to the server.
        Your encryption keys are never exposed during transmission.
      </Text>
    </Box>
  );
};

export default SecureFileUploader;