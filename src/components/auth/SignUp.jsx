import React, { useState, useEffect, useCallback } from 'react';
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
  Link,
  useColorModeValue,
  Alert,
  AlertIcon,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { auth } from '../../services/api';

const SignUp = ({ onToggleAuth, onSignUpSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phoneNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Reset username availability when username changes
    if (name === 'username' && value.length > 0) {
      setUsernameAvailable(null);
    }
  };

  // Check if username is available
  const checkUsernameAvailability = useCallback(async () => {
    if (!formData.username || formData.username.length < 3) return;
    
    try {
      setUsernameChecking(true);
      const response = await auth.checkUsername(formData.username);
      setUsernameAvailable(!response.data.exists);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
    } finally {
      setUsernameChecking(false);
    }
  }, [formData.username]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (formData.username && formData.username.length >= 3) {
        checkUsernameAvailability();
      }
    }, 500); // Debounce for 500ms
    
    return () => clearTimeout(debounceTimer);
  }, [formData.username, checkUsernameAvailability]);

  const validateForm = () => {
    if (!formData.username || !formData.email) {
      setError('Username and email are required');
      return false;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }

    if (usernameAvailable === false) {
      setError('Username is already taken');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError('');
      
      // Generate a secure session token for CSRF protection
      const buffer = new Uint8Array(32);
      window.crypto.getRandomValues(buffer);
      const sessionToken = Array.from(buffer)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      
      // Register the user via API
      const response = await auth.register({
        username: formData.username,
        email: formData.email,
        phoneNumber: formData.phoneNumber || undefined
      });
      
      if (!response.data || response.data.error) {
        throw new Error(response.data?.message || 'Failed to create account');
      }
      
      toast({
        title: 'Account Created',
        description: 'Now create your PassMatrix pattern',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onSignUpSuccess(
        formData.username, 
        formData.email, 
        formData.phoneNumber, 
        sessionToken
      );
      
    } catch (error) {
      console.error('Sign up error:', error);
      setError(error.response?.data?.message || error.message || 'Failed to sign up');
      
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to create account',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
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
            Create PixVault Account
          </Heading>
          <Text textAlign="center" color="gray.500">
            Secure your files with PassMatrix authentication
          </Text>
          
          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
          )}
          
          <Box as="form" w="full" onSubmit={handleSubmit}>
            <VStack spacing={4} w="full">
              <FormControl id="username" isRequired>
                <FormLabel>Username</FormLabel>
                <Input
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                  size="lg"
                  focusBorderColor="blue.500"
                />
                {usernameChecking ? (
                  <Text fontSize="sm" color="gray.500">
                    Checking availability...
                  </Text>
                ) : usernameAvailable === false ? (
                  <Text fontSize="sm" color="red.500">
                    Username is already taken
                  </Text>
                ) : usernameAvailable === true ? (
                  <Text fontSize="sm" color="green.500">
                    Username is available
                  </Text>
                ) : null}
              </FormControl>
              
              <FormControl id="email" isRequired>
                <FormLabel>Email</FormLabel>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  size="lg"
                  focusBorderColor="blue.500"
                />
              </FormControl>
              
              <FormControl id="phoneNumber">
                <FormLabel>Phone Number (Optional)</FormLabel>
                <Input
                  name="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                  size="lg"
                  focusBorderColor="blue.500"
                />
              </FormControl>
              
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                w="full"
                isLoading={loading}
                loadingText="Creating Account"
                mt={4}
              >
                Continue to PassMatrix
              </Button>
            </VStack>
          </Box>
          
          <Text align="center" width="full">
            Already have an account?{' '}
            <Link color="blue.500" onClick={onToggleAuth} cursor="pointer">
              Sign In
            </Link>
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default SignUp;
