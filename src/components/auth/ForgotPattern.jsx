import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Heading,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
  FormErrorMessage
} from '@chakra-ui/react';
import { auth } from '../../services/api';

const ForgotPattern = ({ onBack, onOtpVerified }) => {
  const [step, setStep] = useState('request'); // 'request', 'verify'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0); // Countdown for OTP resend
  const [otpSent, setOtpSent] = useState(false); // Track if OTP was sent
  const [recoveryMethod, setRecoveryMethod] = useState('email'); // 'email' or 'phone'
  const toast = useToast();

  // Handle API errors consistently
  const handleApiError = useCallback((error, context) => {
    console.error(`Error in ${context}:`, error);
    
    let errorMessage = '';
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else {
      errorMessage = `Failed during ${context}`;
    }
    
    // Check for specific error types
    if (error.response?.status === 429) {
      errorMessage = 'Too many attempts. Please try again later.';
    }
    
    setError(errorMessage);
    setLoading(false);
    
    toast({
      title: 'Error',
      description: errorMessage,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  }, [toast]);

  // Start countdown timer for OTP resend
  const startCountdown = useCallback(() => {
    const COUNTDOWN_TIME = 60; // 60 seconds before resend is allowed
    setCountdown(COUNTDOWN_TIME);
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Effect to handle countdown timer
  useEffect(() => {
    if (otpSent) {
      const clearTimer = startCountdown();
      return clearTimer;
    }
  }, [otpSent, startCountdown]);
  
  // Request OTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    
    // Validate input based on recovery method
    if (recoveryMethod === 'email') {
      if (!email) {
        setError('Please enter your email address');
        return;
      }
    } else if (recoveryMethod === 'phone') {
      if (!username) {
        setError('Please enter your username');
        return;
      }
    }
    
    setLoading(true);
    
    try {
      const response = await auth.sendOtp({ 
        username, 
        email,
        method: recoveryMethod
      });
      
      if (response.data.success) {
        setStep('verify');
        setOtpSent(true);
        
        toast({
          title: 'OTP Sent',
          description: `If the account exists, a verification code has been sent to your ${recoveryMethod === 'email' ? 'email' : 'phone'}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      handleApiError(error, 'requesting OTP');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate input with better validation
    if (!otp) {
      setError('Please enter the verification code');
      return;
    }
    
    // Check if OTP is 6 digits
    if (!/^\d{6}$/.test(otp)) {
      setError('Verification code must be 6 digits');
      return;
    }
    
    setLoading(true);
    
    try {
      // Determine which parameter to send based on recovery method
      const verifyData = { otp };
      if (recoveryMethod === 'email') {
        verifyData.email = email;
      } else {
        verifyData.username = username;
      }
      
      const response = await auth.verifyOtp(verifyData);
      
      if (response.data.success) {
        toast({
          title: 'OTP Verified',
          description: 'Verification successful. You can now reset your pattern.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Call the callback with username and session token
        if (onOtpVerified) {
          // Pass both username and email to ensure we have all needed data
          onOtpVerified(
            recoveryMethod === 'email' ? response.data.username : username, 
            response.data.sessionToken
          );
        }
      }
    } catch (error) {
      handleApiError(error, 'verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      w="100%" 
      maxW="400px" 
      p={6} 
      borderWidth={1}
      borderRadius="md"
      boxShadow="md"
      bg="white"
      aria-labelledby="forgot-pattern-heading"
      role="region"
    >
      <VStack spacing={6} align="stretch">
        <Heading size="lg" textAlign="center">
          {step === 'request' ? 'Forgot Pattern' : 'Verify Code'}
        </Heading>
        
        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {step === 'request' ? (
          <form onSubmit={handleRequestOtp}>
            <VStack spacing={4}>
              <Text textAlign="center">
                Choose a recovery method to receive a verification code
              </Text>
              
              {/* Recovery Method Selection */}
              <FormControl mb={4}>
                <FormLabel id="recovery-method-label">Recovery Method</FormLabel>
                <HStack spacing={4} role="radiogroup" aria-labelledby="recovery-method-label">
                  <Button
                    variant={recoveryMethod === 'email' ? 'solid' : 'outline'}
                    colorScheme="blue"
                    onClick={() => setRecoveryMethod('email')}
                    isDisabled={loading}
                    flex={1}
                    aria-checked={recoveryMethod === 'email'}
                    role="radio"
                    _hover={{ bg: recoveryMethod === 'email' ? 'blue.500' : 'blue.50' }}
                    leftIcon={<Box as="span" w="1em" h="1em" borderRadius="full" bg={recoveryMethod === 'email' ? 'white' : 'transparent'} border="1px solid" mr="2" />}
                  >
                    Email
                  </Button>
                  <Button
                    variant={recoveryMethod === 'phone' ? 'solid' : 'outline'}
                    colorScheme="blue"
                    onClick={() => setRecoveryMethod('phone')}
                    isDisabled={loading}
                    flex={1}
                    aria-checked={recoveryMethod === 'phone'}
                    role="radio"
                    _hover={{ bg: recoveryMethod === 'phone' ? 'blue.500' : 'blue.50' }}
                    leftIcon={<Box as="span" w="1em" h="1em" borderRadius="full" bg={recoveryMethod === 'phone' ? 'white' : 'transparent'} border="1px solid" mr="2" />}
                  >
                    Phone
                  </Button>
                </HStack>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  {recoveryMethod === 'email' 
                    ? "We'll send a verification code to your registered email address" 
                    : "We'll send a verification code to your registered phone number"}
                </Text>
              </FormControl>
              
              {recoveryMethod === 'email' ? (
                <FormControl isRequired>
                  <FormLabel>Email Address</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    isDisabled={loading}
                  />
                </FormControl>
              ) : (
                <FormControl isRequired>
                  <FormLabel>Username</FormLabel>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    isDisabled={loading}
                  />
                </FormControl>
              )}
              
              <Button
                type="submit"
                colorScheme="blue"
                width="full"
                isLoading={loading}
                loadingText="Sending..."
                mt={4}
              >
                Send Verification Code
              </Button>
              
              <Button variant="ghost" onClick={onBack} isDisabled={loading}>
                Back to Sign In
              </Button>
            </VStack>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <VStack spacing={4}>
              <Text textAlign="center">
                Enter the verification code sent to your {recoveryMethod === 'email' ? 'email' : 'phone'}
              </Text>
              
              <FormControl isRequired isInvalid={!!error}>
                <FormLabel htmlFor="otp-input">Verification Code</FormLabel>
                <Input
                  id="otp-input"
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    // Only allow digits and limit to 6 characters
                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setOtp(value);
                  }}
                  placeholder="Enter 6-digit code"
                  autoComplete="one-time-code"
                  isDisabled={loading}
                  autoFocus
                  maxLength={6}
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  aria-describedby="otp-helper-text"
                />
                {error ? (
                  <FormErrorMessage>{error}</FormErrorMessage>
                ) : (
                  <Text id="otp-helper-text" fontSize="sm" color="gray.500" mt={1}>
                    Enter the 6-digit code we sent to your {recoveryMethod === 'email' ? 'email address' : 'phone number'}
                  </Text>
                )}
              </FormControl>
              
              <Button
                type="submit"
                colorScheme="blue"
                width="full"
                isLoading={loading}
                loadingText="Verifying..."
                mt={4}
              >
                Verify Code
              </Button>
              
              <Button 
                variant="outline" 
                colorScheme="blue"
                width="full"
                onClick={handleRequestOtp} 
                isDisabled={loading || countdown > 0}
                mt={2}
              >
                {countdown > 0 ? `Resend Code (${countdown}s)` : 'Resend Code'}
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => setStep('request')} 
                isDisabled={loading}
              >
                Back
              </Button>
            </VStack>
          </form>
        )}
      </VStack>
    </Box>
  );
};

export default ForgotPattern;
