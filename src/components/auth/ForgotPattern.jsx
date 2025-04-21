import React, { useState, useCallback, useEffect } from 'react';
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
    
    // Validate input
    if (!username || !email) {
      setError('Please enter both username and email address');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await auth.requestRecoveryOtp({ 
        username, 
        email
      });
      
      if (response.data.success) {
        setStep('verify');
        setOtpSent(true);
        
        toast({
          title: 'OTP Sent',
          description: response.data.message || 'If a matching account was found, a verification code has been sent to your email',
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
    
    // Validate input
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
      const response = await auth.verifyRecoveryOtp({
        username,
        otp
      });
      
      if (response.data.success) {
        // If successful, pass the session token to the parent component
        // which will show the pattern reset component
        if (onOtpVerified) {
          onOtpVerified({
            username: response.data.username,
            sessionToken: response.data.resetSessionToken
          });
        }
        
        toast({
          title: 'Verification Successful',
          description: response.data.message || 'You can now reset your pattern',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      handleApiError(error, 'verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      p={6}
      borderWidth={1}
      borderRadius='lg'
      boxShadow='md'
      bg='white'
      width='100%'
      maxW='400px'
      mx='auto'
    >
      <VStack spacing={4} align='stretch'>
        <Heading size='md' textAlign='center' mb={2}>
          {step === 'request' ? 'Recover Your Pattern' : 'Verify OTP Code'}
        </Heading>
        
        {error && (
          <Alert status='error' borderRadius='md'>
            <AlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {step === 'request' ? (
          <form onSubmit={handleRequestOtp}>
            <VStack spacing={4}>
              <Text textAlign='center'>
                Enter your account details to receive a verification code
              </Text>
              
              <FormControl isRequired mb={4}>
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
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Enter the email associated with your account
                </Text>
              </FormControl>
              
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
              
              <Button 
                variant="ghost" 
                onClick={onBack} 
                isDisabled={loading}
              >
                Back to Sign In
              </Button>
            </VStack>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <VStack spacing={4}>
              <Text textAlign="center">
                Enter the verification code sent to your email
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
                    Enter the 6-digit code we sent to your email address
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
