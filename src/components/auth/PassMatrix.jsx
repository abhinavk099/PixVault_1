import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Grid,
  GridItem,
  Heading,
  Text,
  Flex,
  Alert,
  AlertIcon,
  AlertDescription,
  Image,
  Progress,
  VStack,
  FormControl,
  FormLabel,
  Input,
  useToast,
  Checkbox,
  HStack,
  Tooltip,
  useDisclosure,
  Icon
} from '@chakra-ui/react';
import { RefreshCw, HelpCircle } from 'lucide-react';
import { auth, security } from '../../services/api';
import MnemonicHelper from './MnemonicHelper';

// Add API base URL for image paths
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TIME_LIMIT = 30; // 30 seconds to complete authentication
const GRID_SIZE = 5; // 5x5 grid

// Authentication stages
const STAGES = {
  USERNAME: 'username',
  PATTERN_SELECT: 'pattern_select',
  PATTERN_VERIFY: 'pattern_verify'
};

const PassMatrix = ({ onSuccess, onError, isSignUp = false, username: initialUsername = '', sessionToken: initialSessionToken = '', initialEmail = '', initialPhoneNumber = '', onSessionIdUpdate = () => {}, sessionId: initialSessionId = '', rememberMe = false }) => {
  const [grid, setGrid] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]); // Store selected image IDs
  const [selectedPoints, setSelectedPoints] = useState([]); // Stores selected coordinates
  const [stage, setStage] = useState(initialUsername ? (isSignUp ? STAGES.PATTERN_SELECT : STAGES.PATTERN_VERIFY) : STAGES.USERNAME);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [sessionToken, setSessionToken] = useState(initialSessionToken); // For CSRF protection
  const [imageMap, setImageMap] = useState({}); // Map of image URLs to stable IDs
  const [patternSessionId, setPatternSessionId] = useState(initialSessionId); // Store session ID for verification
  const [useMnemonic, setUseMnemonic] = useState(true); // Option to use mnemonic
  const timerRef = useRef(null);
  const toast = useToast();
  const mnemonicDisclosure = useDisclosure(); // For mnemonic modal

  // Generate a session token for CSRF protection if not provided
  useEffect(() => {
    if (!sessionToken) {
      const generateToken = async () => {
        const buffer = new Uint8Array(32);
        window.crypto.getRandomValues(buffer);
        const token = Array.from(buffer)
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join('');
        setSessionToken(token);
      };
      generateToken();
    }
  }, [sessionToken]);

  // Hash the selected pattern with proper security
  const hashPattern = async (selectedIndices, salt) => {
    try {
      // Sort indices to ensure order-independence in pattern
      const sortedIndices = [...selectedIndices].sort();
      
      // Combine the indices with username salt only (no sessionId)
      // This makes the hash consistent across different sessions
      const patternString = `${sortedIndices.join('|')}:${salt}`;
      
      console.log('Client hashing pattern with string:', patternString);
      console.log('Pattern before sorting:', selectedIndices);
      console.log('Pattern after sorting:', sortedIndices);
      console.log('Salt used for hashing:', salt);
      
      // Hash using Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(patternString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convert hash to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
      
      console.log('Client generated hash:', hashHex);
      console.log('Hash length:', hashHex.length);
      return hashHex;
    } catch (error) {
      console.error('Error hashing pattern:', error);
      throw new Error('Failed to secure pattern');
    }
  };

  // Log security events
  const logSecurityEvent = useCallback(async (eventType, details) => {
    try {
      await security.addLog({
        event_type: eventType,
        details,
        sessionToken
      }).catch(error => {
        console.warn('Security logging failed:', error.message);
        // Non-critical - continue execution even if logging fails
      });
    } catch (error) {
      console.warn('Failed to log security event:', error);
      // We don't store security logs locally as that's not secure
    }
  }, [sessionToken]);

  // Create an image map to give each image a stable ID regardless of URL
  const createImageMap = useCallback((images) => {
    const newMap = {};
    images.forEach((image) => {
      // Extract the filename from the URL to use as a stable ID
      const filename = image.split('/').pop();
      newMap[image] = filename;
    });
    setImageMap(newMap);
    return newMap;
  }, []);

  // Generate random grid of images
  const generateGrid = useCallback(async () => {
    try {
      setLoading(true);
      
      // Request images from server
      const { data } = await auth.getMatrixImages({
        sessionToken // Pass session token for CSRF protection
      });
      
      if (!data || !data.images || !Array.isArray(data.images) || data.images.length === 0) {
        throw new Error('Failed to retrieve image matrix from server');
      }
      
      // Shuffle and prepare images for grid
      let shuffledImages = [...data.images].sort(() => Math.random() - 0.5);
      
      // Handle case when server doesn't provide enough images
      while (shuffledImages.length < GRID_SIZE * GRID_SIZE) {
        shuffledImages = [...shuffledImages, ...data.images].sort(() => Math.random() - 0.5);
      }
      
      // Take the first 25 images and add API base URL
      const gridImages = shuffledImages
        .slice(0, GRID_SIZE * GRID_SIZE)
        .map(imagePath => `${API_BASE_URL}${imagePath}`);
      
      // Create a stable mapping for these images
      createImageMap(gridImages);
      
      // Set the grid state
      setGrid(gridImages);
      
      // Log security event (don't await to avoid slowing down the UI)
      logSecurityEvent('matrix_images_generated', 'PassMatrix grid generated for authentication')
        .catch(console.warn);
    } catch (error) {
      console.error('Error generating matrix:', error);
      setError('Failed to generate image grid. Please try again.');
      logSecurityEvent('matrix_generation_error', error.message)
        .catch(console.warn);
    } finally {
      setLoading(false);
    }
  }, [createImageMap, sessionToken, logSecurityEvent]);

  // Handle form submission
  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleUsernameSubmit();
  };

  // Handle username submission
  const handleUsernameSubmit = async () => {
    if (!username) {
      setError('Username is required');
      return;
    }

    if (isSignUp && !email) {
      setError('Email is required for sign up');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // For sign up, check if username exists
      if (isSignUp) {
        try {
          const checkResponse = await auth.checkUsername(username, { sessionToken });
          const userExists = checkResponse.data?.exists === true;
          
          if (userExists) {
            setError('Username already exists');
            setLoading(false);
            return;
          }
          
          // For sign up, create the user first
          await auth.register({
            username,
            email,
            phoneNumber: phoneNumber || '',
            sessionToken
          });
          
          console.log('User registration initiated successfully');
        } catch (error) {
          console.error('Error in registration:', error);
          setError('Could not create user account. Please try again.');
          setLoading(false);
          return;
        }
      }

      // For sign in, verify the username exists
      if (!isSignUp) {
        try {
          const checkResponse = await auth.checkUsername(username, { sessionToken });
          const userExists = checkResponse.data?.exists === true;
          
          if (!userExists) {
            setError('Username not found');
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error checking username:', error);
          setError('Could not verify username. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Move to pattern selection
      setStage(STAGES.PATTERN_SELECT);
      await generateGrid();
      
      // Log the authentication attempt (non-blocking)
      logSecurityEvent(
        isSignUp ? 'signup_attempt' : 'signin_attempt',
        `User ${username} attempted to ${isSignUp ? 'sign up' : 'sign in'}`
      ).catch(console.warn);
    } catch (error) {
      console.error('Error in username submission:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle image selection
  const handleImageClick = async (image, index) => {
    if (loading) return;
    
    try {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      const point = `${row},${col}`;

      if (selectedPoints.includes(point)) {
        setError('You cannot select the same image twice');
        return;
      }

      if (selectedImages.length >= 5) {
        setError('You can only select 5 images');
        return;
      }

      // Use the stable image ID from imageMap (filename)
      const imageId = imageMap[image];
      console.log(`Selected image at index ${index}, ID: ${imageId}`);
      
      setSelectedImages([...selectedImages, imageId]);
      setSelectedPoints([...selectedPoints, point]);

      // If we've selected 5 images in the pattern select phase
      if (selectedImages.length === 4 && stage === STAGES.PATTERN_SELECT) {
        try {
          setLoading(true);
          
          // Create temporary server-side session
          console.log('Creating pattern session for:', username);
          const sessionResponse = await auth.createPatternSession({
            username,
            sessionToken
          }).catch(error => {
            console.error('Failed to create pattern session:', error);
            throw new Error(`Session creation failed: ${error.response?.data?.message || error.message}`);
          });
          
          const { data: sessionData } = sessionResponse;
          
          if (!sessionData || !sessionData.sessionId) {
            console.error('Invalid session data received:', sessionData);
            throw new Error('Failed to create pattern session: Invalid response');
          }
          
          // Use the server-provided session ID for the hash and save it for verification
          const sessionId = sessionData.sessionId;
          setPatternSessionId(sessionId); // Save it for verification phase
          if (onSessionIdUpdate) {
            onSessionIdUpdate(sessionId);
          }
          console.log('Session created successfully:', { sessionId });
          
          // Hash the pattern (including the new selection)
          console.log('Hashing pattern with', selectedImages.length + 1, 'images');
          const hash = await hashPattern(
            [...selectedImages, imageId], 
            username // Only use username as salt, no sessionId
          ).catch(error => {
            console.error('Pattern hashing failed:', error);
            throw new Error(`Failed to secure pattern: ${error.message}`);
          });
          
          console.log('Pattern hashed successfully, hash length:', hash.length);
          
          // Send the hash to the server for storage
          console.log('Storing pattern hash on server');
          await auth.storePatternHash({
            username,
            hash,
            sessionId,
            sessionToken
          }).catch(error => {
            console.error('Failed to store pattern hash:', error);
            console.error('Response data:', error.response?.data);
            throw new Error(`Failed to save pattern: ${error.response?.data?.message || error.message}`);
          });
          
          console.log('Pattern stored successfully');
          
          // Log security event (non-blocking)
          logSecurityEvent('pattern_created', 'User created PassMatrix pattern')
            .catch(error => console.warn('Failed to log security event:', error));
          
          // Move to verification phase
          toast({
            title: 'Pattern Created',
            description: 'Now verify your pattern.',
            status: 'info',
            duration: 3000,
            isClosable: true,
          });
          
          // If mnemonic is enabled, show the mnemonic helper
          if (useMnemonic) {
            // Show mnemonic helper with a short delay
            setTimeout(() => {
              mnemonicDisclosure.onOpen();
            }, 500);
          } else {
            // Move directly to verification stage
            setTimeout(() => {
              setStage(STAGES.PATTERN_VERIFY);
              setSelectedImages([]);
              setSelectedPoints([]);
              generateGrid();
            }, 500);
          }
        } catch (error) {
          console.error('Error in pattern creation flow:', error);
          setError(`Failed to save pattern: ${error.message}`);
        } finally {
          setLoading(false);
        }
      }

      // If this completes the verification phase (5 images selected)
      if (selectedImages.length === 4 && stage === STAGES.PATTERN_VERIFY) {
        try {
          setLoading(true);
          const pattern = [...selectedImages, imageId];
          console.log('Verifying pattern:', pattern);
          console.log('Using session token:', sessionToken);
          console.log('Using session ID:', patternSessionId);
          
          // Log pattern verification details
          console.log('Verifying pattern with server:', {
            username,
            pattern,
            patternLength: pattern.length,
            sessionId: patternSessionId
          });
          
          // Log client pattern string for comparison with server
          console.log('Client pattern string for verification:', `${[...pattern].sort().join('|')}:${username}`);
          
          
          // Verify pattern with server - IMPORTANT: Include sessionId
          try {
            const verifyResult = await auth.verifyPattern({
              username,
              pattern,
              sessionToken,
              sessionId: patternSessionId // Include this for proper verification
            });
            
            if (verifyResult.data?.success) {
              // Log successful verification (non-blocking)
              logSecurityEvent('pattern_verified', 'User successfully verified PassMatrix pattern')
                .catch(console.warn);
              
              // For sign-up, complete the registration
              if (isSignUp) {
                await auth.completeRegistration({
                  username,
                  email,
                  phoneNumber: phoneNumber || '',
                  sessionToken
                });
              }
              
              // Get authentication token from server
              const { data: authData } = await auth.getToken({
                username,
                sessionToken,
                rememberMe
              });
              
              // Store the token in memory for immediate use
              if (authData?.token) {
                console.log('Authentication successful, token received in PassMatrix');
                // Show success message before redirecting
                toast({
                  title: isSignUp ? 'Registration Successful' : 'Authentication Successful',
                  description: isSignUp ? 'Your account has been created successfully.' : 'Your identity has been verified.',
                  status: 'success',
                  duration: 3000,
                  isClosable: true,
                });
                
                // Short delay to ensure toast is visible before redirect
                setTimeout(() => {
                  // Use the token for immediate authentication
                  if (onSuccess) {
                    onSuccess(authData.token);
                  }
                }, 1000);
              } else {
                // If no token in response, the server should have set an httpOnly cookie
                // Just call onSuccess with null
                console.log('No token received, using httpOnly cookie authentication');
                if (onSuccess) {
                  onSuccess(null);
                }
              }
              
              // Toast is now shown above with a delay before redirect
              // No need for duplicate toast here
            } else {
              console.log('Pattern verification API error:', verifyResult.data);
              setError('Pattern does not match. Please try again.');
              setSelectedImages([]);
              setSelectedPoints([]);
              
              // Call onError if provided
              if (onError) {
                onError('Pattern verification failed. Please try again.');
              }
              
              // Log failed verification (non-blocking)
              logSecurityEvent('pattern_verification_failed', 'User failed to verify PassMatrix pattern')
                .catch(console.warn);
            }
          } catch (verifyError) {
            console.error('Error verifying pattern:', verifyError);
            if (verifyError.response?.data) {
              console.log('Pattern verification API error:', verifyError.response.data);
            }
            throw new Error(`Verification failed: ${verifyError.response?.data?.message || verifyError.message}`);
          }
        } catch (error) {
          console.error('Error verifying pattern:', error);
          setError('Failed to verify pattern. Please try again.');
          
          // Log the error (non-blocking)
          logSecurityEvent('pattern_error', error.message)
            .catch(console.warn);
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error in image selection:', error);
      setError('An error occurred. Please try again.');
      
      // Log the error (non-blocking)
      logSecurityEvent('pattern_error', error.message)
        .catch(console.warn);
      
      setLoading(false);
    }
  };

  // Create a session when entering verification mode for sign-in
  useEffect(() => {
    if (stage === STAGES.PATTERN_VERIFY && !isSignUp && !patternSessionId) {
      const createSession = async () => {
        try {
          setLoading(true);
          console.log('Creating pattern session for sign-in:', username);
          const sessionResponse = await auth.createPatternSession({
            username,
            sessionToken
          });
          
          const sessionId = sessionResponse.data.sessionId;
          console.log('Sign-in session created successfully:', { sessionId });
          setPatternSessionId(sessionId);
          if (onSessionIdUpdate) {
            onSessionIdUpdate(sessionId);
          }
          setLoading(false);
        } catch (error) {
          console.error('Failed to create verification session:', error);
          setError('Failed to initialize verification. Please try again.');
          setLoading(false);
        }
      };
      
      createSession();
    }
  }, [stage, isSignUp, patternSessionId, username, sessionToken, onSessionIdUpdate]);

  // Start timer for verification phase
  useEffect(() => {
    if (stage === STAGES.PATTERN_VERIFY) {
      setTimeLeft(TIME_LIMIT);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setError('Time expired. Please try again.');
            setSelectedImages([]);
            setSelectedPoints([]);
            generateGrid();
            return TIME_LIMIT;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [stage, generateGrid]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Render username input stage
  const renderUsernameStage = () => (
    <VStack spacing={4} w="full">
      <Heading size="lg" mb={2}>
        {isSignUp ? 'Create Your Account' : 'Welcome Back'}
      </Heading>
      <Text mb={4}>
        {isSignUp ? 'Sign up to access secure file storage.' : 'Sign in to access your secure files.'}
      </Text>
      
      {error && (
        <Alert status="error" borderRadius="md" mb={4}>
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleFormSubmit} style={{ width: '100%' }}>
        <VStack spacing={4} w="full">
          <FormControl isRequired>
            <FormLabel>Username</FormLabel>
            <Input 
              placeholder="Enter username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              isDisabled={loading}
            />
          </FormControl>
          
          {isSignUp && (
            <>
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input 
                  type="email" 
                  placeholder="Enter email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  isDisabled={loading}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Phone Number</FormLabel>
                <Input 
                  placeholder="Enter phone number (optional)" 
                  value={phoneNumber} 
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  isDisabled={loading}
                />
              </FormControl>
            </>
          )}
          
          <Button 
            type="submit"
            colorScheme="blue" 
            w="full" 
            mt={4}
            isLoading={loading}
            loadingText="Processing"
          >
            Continue
          </Button>
        </VStack>
      </form>
    </VStack>
  );

  // Render pattern selection/verification stage
  const renderPatternStage = () => (
    <VStack spacing={4} w="full">
      <Heading size="lg" mb={2}>
        {stage === STAGES.PATTERN_SELECT ? 'Select 5 Images' : 'Verify Pattern'}
      </Heading>
      
      <Text textAlign="center" mb={2}>
        {stage === STAGES.PATTERN_SELECT 
          ? 'Create your secure pattern by selecting 5 images' 
          : 'Please select your 5 images to verify your identity'}
      </Text>
      
      {stage === STAGES.PATTERN_VERIFY && (
        <Progress
          value={(timeLeft / TIME_LIMIT) * 100}
          w="full"
          colorScheme={timeLeft < 10 ? 'red' : 'blue'}
          mb={2}
        />
      )}
      
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Grid templateColumns={`repeat(${GRID_SIZE}, 1fr)`} gap={2} w="full">
        {grid.map((image, index) => (
          <GridItem key={index}>
            <Box
              position="relative"
              cursor={loading ? 'not-allowed' : 'pointer'}
              onClick={() => handleImageClick(image, index)}
              opacity={loading ? 0.5 : 1}
              transition="all 0.2s"
              _hover={{ transform: 'scale(1.05)' }}
            >
              <Image
                src={image}
                alt={`Matrix image ${index + 1}`}
                w="full"
                h="auto"
                aspectRatio={1}
                objectFit="cover"
                borderRadius="md"
                border="2px solid"
                borderColor={
                  selectedPoints.includes(`${Math.floor(index / GRID_SIZE)},${index % GRID_SIZE}`)
                    ? 'blue.500'
                    : 'transparent'
                }
              />
            </Box>
          </GridItem>
        ))}
      </Grid>

      <Flex justify="space-between" w="full" mt={4}>
        <Button
          leftIcon={<RefreshCw />}
          onClick={generateGrid}
          isLoading={loading}
          colorScheme="blue"
          variant="outline"
        >
          Refresh Grid
        </Button>
        <Text>
          Selected: {selectedImages.length} / 5
        </Text>
      </Flex>
      
      {/* Mnemonic option for pattern creation */}
      {stage === STAGES.PATTERN_SELECT && isSignUp && (
        <Checkbox
          isChecked={useMnemonic}
          onChange={(e) => setUseMnemonic(e.target.checked)}
          colorScheme="blue"
          mt={2}
        >
          <Tooltip label="Generate a mnemonic phrase to help remember your pattern">
            <Flex align="center">
              <Text>Generate mnemonic helper</Text>
              <Icon as={HelpCircle} ml={1} boxSize={4} />
            </Flex>
          </Tooltip>
        </Checkbox>
      )}
    </VStack>
  );

  // Render the appropriate stage
  const renderStage = () => {
    switch (stage) {
      case STAGES.USERNAME:
        return renderUsernameStage();
      case STAGES.PATTERN_SELECT:
      case STAGES.PATTERN_VERIFY:
        return renderPatternStage();
      default:
        return renderUsernameStage();
    }
  };

  // Handle mnemonic modal close
  const handleMnemonicClose = () => {
    mnemonicDisclosure.onClose();
    // Move to verification stage
    setSelectedPoints([]);
    setSelectedImages([]);
    generateGrid();
    setStage(STAGES.PATTERN_VERIFY);
  };

  // Handle mnemonic saved confirmation
  const handleMnemonicSaved = () => {
    toast({
      title: 'Mnemonic Saved',
      description: 'Now verify your pattern to complete registration',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    handleMnemonicClose();
  };

  return (
    <VStack spacing={4} w="full" maxW="500px" mx="auto" p={4}>
      {renderStage()}
      
      {/* Mnemonic Helper Modal */}
      <MnemonicHelper
        selectedPoints={selectedPoints}
        isOpen={mnemonicDisclosure.isOpen}
        onClose={handleMnemonicClose}
        onSave={handleMnemonicSaved}
      />
    </VStack>
  );
};

export default PassMatrix;