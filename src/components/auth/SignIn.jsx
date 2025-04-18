import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  InputGroup,
  InputRightElement,
  IconButton,
  Link,
  useColorModeValue,
  Card,
  CardBody,
  Alert,
  AlertIcon,
  Progress,
  Checkbox,
} from '@chakra-ui/react';
import { AlertTriangle } from 'lucide-react';
import { auth } from '../../services/api';

// Constants for rate limiting
const INITIAL_COOLDOWN = 30; // 30 seconds
const MAX_COOLDOWN = 300; // 5 minutes
const COOLDOWN_STORAGE_KEY = 'auth_cooldown_expiry';
const ATTEMPTS_STORAGE_KEY = 'auth_attempts_count';

const SignIn = ({ onToggleAuth, onSignInSuccess, onForgotClick }) => {
  const [formData, setFormData] = useState({
    username: '',
  });
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Initialize cooldown and attempts from localStorage on component mount
  useEffect(() => {
    // Check for stored cooldown
    const storedExpiry = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (storedExpiry) {
      const expiryTime = parseInt(storedExpiry, 10);
      const now = Date.now();
      if (expiryTime > now) {
        const remainingSeconds = Math.ceil((expiryTime - now) / 1000);
        setCooldown(remainingSeconds);
      } else {
        localStorage.removeItem(COOLDOWN_STORAGE_KEY);
      }
    }
    
    // Check for stored attempts
    const storedAttempts = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    if (storedAttempts) {
      setAttempts(parseInt(storedAttempts, 10));
    }
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => {
        const newCooldown = cooldown - 1;
        setCooldown(newCooldown);
        if (newCooldown === 0) {
          localStorage.removeItem(COOLDOWN_STORAGE_KEY);
        }
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const startCooldown = (attemptCount) => {
    // Exponential backoff: double the cooldown with each attempt
    const cooldownTime = Math.min(INITIAL_COOLDOWN * Math.pow(2, attemptCount - 1), MAX_COOLDOWN);
    setCooldown(cooldownTime);
    setAttempts(attemptCount);
    
    // Store expiry time in localStorage
    const expiryTime = Date.now() + (cooldownTime * 1000);
    localStorage.setItem(COOLDOWN_STORAGE_KEY, expiryTime.toString());
    localStorage.setItem(ATTEMPTS_STORAGE_KEY, attemptCount.toString());
    
    return cooldownTime;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username) {
      setError('Username is required');
      return;
    }

    if (cooldown > 0) {
      toast({
        title: 'Rate Limit Active',
        description: `Please wait ${cooldown} seconds before attempting to sign in again.`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Generate a session token for CSRF protection
      const buffer = new Uint8Array(32);
      window.crypto.getRandomValues(buffer);
      const sessionToken = Array.from(buffer)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      
      // First step: verify username exists
      const response = await auth.signin({
        username: formData.username,
        sessionToken,
        rememberMe // Pass the rememberMe preference to the API
      });

      if (response.data?.message === 'Username verified') {
        // Reset attempts on success
        setAttempts(0);
        localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
        
        toast({
          title: 'Username Verified',
          description: 'Please complete authentication with PassMatrix',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // Move to PassMatrix authentication with the username and rememberMe preference
        onSignInSuccess(formData.username, sessionToken, rememberMe);
      } else {
        throw new Error('Username verification failed');
      }
    } catch (error) {
      // Check if this is a rate limiting error (HTTP 429)
      if (error.response?.status === 429) {
        const newAttemptCount = attempts + 1;
        const cooldownTime = startCooldown(newAttemptCount);
        
        setError(`Your account has been temporarily locked due to too many login attempts. Please try again in ${cooldownTime} seconds.`);
        
        toast({
          title: 'Too Many Attempts',
          description: `Account temporarily locked. Please wait ${cooldownTime} seconds before trying again.`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } else {
        // For other errors, increment attempts but with a smaller cooldown
        const newAttemptCount = attempts + 1;
        if (newAttemptCount >= 3) {
          const cooldownTime = startCooldown(Math.floor(newAttemptCount / 2)); // Less aggressive cooldown for non-rate limit errors
          setError(`Authentication failed. Too many attempts. Please try again in ${cooldownTime} seconds.`);
        } else {
          setAttempts(newAttemptCount);
          localStorage.setItem(ATTEMPTS_STORAGE_KEY, newAttemptCount.toString());
          setError(error.response?.data?.message || error.message || 'Authentication failed');
        }
        
        toast({
          title: 'Error',
          description: error.response?.data?.message || error.message || 'Authentication failed',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card 
      w="full" 
      boxShadow="lg" 
      borderRadius="xl" 
      bg={cardBg} 
      borderWidth="1px" 
      borderColor={borderColor}
    >
      <CardBody p={8}>
        <VStack spacing={6} align="center" w="full">
          <Heading as="h2" size="lg" textAlign="center">
            Sign In to PixVault
          </Heading>
          <Text textAlign="center" color="gray.500">
            Secure your files with PassMatrix authentication
          </Text>
          
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <VStack spacing={4} align="flex-start" w="full">
              <FormControl id="username" isRequired>
                <FormLabel>Username</FormLabel>
                <Input
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  size="lg"
                  focusBorderColor="blue.500"
                />
              </FormControl>

              <FormControl>
                <Checkbox 
                  colorScheme="blue" 
                  isChecked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                >
                  Remember me
                </Checkbox>
              </FormControl>

              {error && (
                <Alert status="error" variant="solid">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                width="full"
                isLoading={loading}
                isDisabled={loading || cooldown > 0}
              >
                {cooldown > 0 ? `Sign In (${cooldown}s)` : 'Sign In'}
              </Button>

              {cooldown > 0 && (
                <Progress value={cooldown} max={INITIAL_COOLDOWN} size="xs" colorScheme="blue" />
              )}

              <Text align="center" w="full">
                Don't have an account?{' '}
                <Link
                  color="blue.500"
                  onClick={onToggleAuth}
                  _hover={{ textDecoration: 'underline' }}
                >
                  Sign Up
                </Link>
              </Text>
              <Text align="center" w="full">
                <Link
                  color="blue.500"
                  onClick={onForgotClick}
                  _hover={{ textDecoration: 'underline' }}
                >
                  Forgot Pattern?
                </Link>
              </Text>
            </VStack>
          </form>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default SignIn;
