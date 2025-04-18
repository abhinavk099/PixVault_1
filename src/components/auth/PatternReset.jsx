import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  VStack,
  Heading,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
  Progress,
  Center
} from '@chakra-ui/react';
import { auth } from '../../services/api';
import PassMatrix from './PassMatrix';

const PatternReset = ({ username, sessionToken, onSuccess, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('create'); // 'create', 'success'
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

  // Handle pattern creation success
  const handlePatternCreated = useCallback(async (patternHash) => {
    setLoading(true);
    setError('');
    
    try {
      // Reset the pattern using the OTP session token
      const response = await auth.resetPattern({
        username,
        sessionToken,
        patternHash
      });
      
      if (response.data.success) {
        setStage('success');
        toast({
          title: 'Pattern Reset',
          description: 'Your pattern has been successfully reset.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      handleApiError(error, 'resetting pattern');
    } finally {
      setLoading(false);
    }
  }, [username, sessionToken, handleApiError, toast]);

  // Handle back to sign in
  const handleBackToSignIn = () => {
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Box w="100%" maxW="500px" p={4}>
      <VStack spacing={6} align="stretch">
        {stage === 'create' ? (
          <>
            <Heading size="lg" textAlign="center">
              Create New Pattern
            </Heading>
            
            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Text textAlign="center">
              Please create a new pattern by selecting 5 points on the image grid.
              Remember this pattern as you will need it to sign in next time.
            </Text>
            
            <PassMatrix 
              mode="create"
              username={username}
              sessionToken={sessionToken}
              onPatternCreated={handlePatternCreated}
              onError={setError}
              isResetFlow={true}
            />
            
            <Button variant="ghost" onClick={onBack} isDisabled={loading}>
              Back
            </Button>
          </>
        ) : (
          <>
            <Heading size="lg" textAlign="center">
              Pattern Reset Successful
            </Heading>
            
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              <AlertDescription>
                Your pattern has been successfully reset. You can now sign in with your new pattern.
              </AlertDescription>
            </Alert>
            
            <Center>
              <Button 
                colorScheme="blue" 
                onClick={handleBackToSignIn}
                mt={4}
              >
                Back to Sign In
              </Button>
            </Center>
          </>
        )}
      </VStack>
    </Box>
  );
};

export default PatternReset;
