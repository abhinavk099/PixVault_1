import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Flex,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Icon,
  SimpleGrid
} from '@chakra-ui/react';
import { FiUpload, FiHardDrive, FiClock, FiFile } from 'react-icons/fi';
import SecureFileUploader from './SecureFileUploader';
import SecureFileManager from './SecureFileManager';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useSecurity } from '../../hooks/useSecurity';


const FileManagerDashboard = () => {
  const { hasPermission, Permissions } = usePermissions();
  const { logSecurityEvent, SecurityEventType } = useSecurity();
  const bgColor = useColorModeValue('white', 'gray.700');
  const statBgColor = useColorModeValue('blue.50', 'blue.900');
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [fileStats, setFileStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    recentUploads: 0,
    filesList: []
  });
  
  const [loading, setLoading] = useState(true);
  
  // Fetch file statistics from localStorage
  const fetchFileStats = useCallback(async () => {
    if (!hasPermission(Permissions.FILE_VIEW)) return;
    
    try {
      setLoading(true);
      
      // Get files from localStorage
      const storedFiles = JSON.parse(localStorage.getItem('secureFiles') || '[]');
      console.log("Fetched files:", storedFiles);
      console.log("Total files count:", storedFiles.length);
      
      // Calculate total size
      const totalSize = storedFiles.reduce((sum, file) => sum + file.size, 0);
      
      // Calculate recent uploads (last 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const recentUploads = storedFiles.filter(file => {
        const uploadDate = new Date(file.upload_date);
        return uploadDate >= oneWeekAgo;
      }).length;
      
      // Update state with file statistics
      setFileStats({
        totalFiles: storedFiles.length,
        totalSize: totalSize,
        recentUploads: recentUploads,
        filesList: storedFiles
      });
      
      await logSecurityEvent(SecurityEventType.STATS_ACCESSED, {
        component: 'FileManagerDashboard'
      }).catch(() => console.log('Failed to log security event'));
      
    } catch (error) {
      console.error('Error fetching file stats:', error);
      console.error('Failed to load file statistics');
    } finally {
      setLoading(false);
    }
  }, [hasPermission, Permissions.FILE_VIEW, logSecurityEvent, SecurityEventType]);
  
  useEffect(() => {
    fetchFileStats();
  }, [fetchFileStats]);
  
  // Format bytes to human-readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  // Call this function after file upload or delete
  const handleUploadComplete = () => {
    console.log('Upload complete, fetching updated stats');
    fetchFileStats();
  };
  
  return (
    <Container maxW="container.xl" py={6}>
      <Flex mb={8} justify="space-between" align="center">
        <Box>
          <Heading size="lg" bgGradient="linear(to-r, blue.600, blue.400)" bgClip="text">
            Secure File Management
          </Heading>
          <Text mt={2} color="gray.600" fontSize="md">
            Upload, manage, and securely share your encrypted files
          </Text>
        </Box>
        
        {hasPermission(Permissions.FILE_UPLOAD) && (
          <Button
            leftIcon={<FiUpload />}
            colorScheme="blue"
            size="lg"
            onClick={onOpen}
            boxShadow="md"
            _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
            transition="all 0.2s"
          >
            Upload New File
          </Button>
        )}
      </Flex>
      
      {/* File Statistics */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={6}>
        <Stat 
          bg={statBgColor} 
          p={5} 
          borderRadius="xl" 
          boxShadow="md" 
          borderWidth="1px" 
          borderColor="blue.100"
          transition="transform 0.2s"
          _hover={{ transform: 'translateY(-5px)' }}
        >
          <Box position="relative" zIndex="1">
            <StatLabel display="flex" alignItems="center" fontSize="md" fontWeight="medium" mb={1}>
              <Icon as={FiFile} mr={2} color="blue.500" />
              Total Files
            </StatLabel>
            <StatNumber fontSize="3xl" fontWeight="bold" color="blue.700">
              {loading ? '...' : fileStats.totalFiles}
            </StatNumber>
            <Text fontSize="md" color="blue.600" mt={2} display="flex" alignItems="center">
              <Icon as={FiFile} mr={1} />
              {loading ? 'Loading...' : `${fileStats.totalFiles} ${fileStats.totalFiles === 1 ? 'file' : 'files'}`}
            </Text>

          </Box>
          <Box 
            position="absolute" 
            top="0" 
            right="0" 
            bottom="0" 
            width="30%" 
            bg="blue.100" 
            opacity="0.3" 
            borderRightRadius="xl"
          />
        </Stat>
        
        <Stat 
          bg={statBgColor} 
          p={5} 
          borderRadius="xl" 
          boxShadow="md" 
          borderWidth="1px" 
          borderColor="blue.100"
          transition="transform 0.2s"
          _hover={{ transform: 'translateY(-5px)' }}
        >
          <Box position="relative" zIndex="1">
            <StatLabel display="flex" alignItems="center" fontSize="md" fontWeight="medium" mb={1}>
              <Icon as={FiHardDrive} mr={2} color="blue.500" />
              Storage Used
            </StatLabel>
            <StatNumber fontSize="3xl" fontWeight="bold" color="blue.700">
              {loading ? '...' : formatBytes(fileStats.totalSize)}
            </StatNumber>
            <Text fontSize="md" color="blue.600" mt={2} display="flex" alignItems="center">
              <Icon as={FiHardDrive} mr={1} />
              {loading ? 'Loading...' : formatBytes(fileStats.totalSize)}
            </Text>

          </Box>
          <Box 
            position="absolute" 
            top="0" 
            right="0" 
            bottom="0" 
            width="30%" 
            bg="blue.100" 
            opacity="0.3" 
            borderRightRadius="xl"
          />
        </Stat>
        
        <Stat 
          bg={statBgColor} 
          p={5} 
          borderRadius="xl" 
          boxShadow="md" 
          borderWidth="1px" 
          borderColor="blue.100"
          transition="transform 0.2s"
          _hover={{ transform: 'translateY(-5px)' }}
        >
          <Box position="relative" zIndex="1">
            <StatLabel display="flex" alignItems="center" fontSize="md" fontWeight="medium" mb={1}>
              <Icon as={FiClock} mr={2} color="blue.500" />
              Recent Uploads
            </StatLabel>
            <StatNumber fontSize="3xl" fontWeight="bold" color="blue.700">
              {loading ? '...' : fileStats.recentUploads}
              <Badge ml={2} colorScheme="green" fontSize="xs" verticalAlign="middle" borderRadius="full" px={2}>
                Last 7 days
              </Badge>
            </StatNumber>
            <Text fontSize="sm" color="blue.600" mt={1}>
              Recently added files
            </Text>
          </Box>
          <Box 
            position="absolute" 
            top="0" 
            right="0" 
            bottom="0" 
            width="30%" 
            bg="blue.100" 
            opacity="0.3" 
            borderRightRadius="xl"
          />
        </Stat>
      </SimpleGrid>
      
      {/* Main Content */}
      <Box bg={bgColor} borderRadius="xl" boxShadow="lg" overflow="hidden" borderWidth="1px" borderColor="gray.100">
        <Tabs variant="soft-rounded" colorScheme="blue" size="lg">
          <Box px={6} pt={5} pb={3} borderBottomWidth="1px" borderColor="gray.100" bg="gray.50">
            <TabList gap={2}>
              <Tab _selected={{ bg: 'blue.500', color: 'white' }} px={5} py={2}>
                <Icon as={FiFile} mr={2} />
                My Files
              </Tab>
              <Tab _selected={{ bg: 'blue.500', color: 'white' }} px={5} py={2}>
                <Icon as={FiUpload} mr={2} />
                Upload
              </Tab>
            </TabList>
          </Box>
          
          <TabPanels>
            <TabPanel px={6} py={4}>
              <SecureFileManager onActionComplete={fetchFileStats} />
            </TabPanel>
            <TabPanel px={6} py={4}>
              <SecureFileUploader onUploadComplete={handleUploadComplete} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
      
      {/* Upload Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl" motionPreset="slideInBottom">
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent borderRadius="xl" boxShadow="xl">
          <ModalHeader bgGradient="linear(to-r, blue.600, blue.400)" bgClip="text">
            Upload New File
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text color="gray.600" mb={4}>
              Your files will be encrypted in the browser before being uploaded, ensuring end-to-end security.
            </Text>
            <SecureFileUploader 
              onUploadComplete={() => {
                handleUploadComplete();
                onClose();
              }} 
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default FileManagerDashboard;
