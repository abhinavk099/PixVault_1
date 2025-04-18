import React, { useState } from 'react';
import { Center, useColorModeValue, Button, Flex, VStack, Heading, Box, useBreakpointValue, useToast } from '@chakra-ui/react';
import PassMatrix from './PassMatrix';
import SignIn from './SignIn';
import SignUp from './SignUp';
import ForgotPattern from './ForgotPattern';
import PatternReset from './PatternReset';

const AuthContainer = ({ onAuthenticated }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [authStage, setAuthStage] = useState('initial'); // 'initial', 'passmatrix', 'forgot', 'reset'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [sessionId, setSessionId] = useState(''); // Added to track session ID
  const [rememberMe, setRememberMe] = useState(false); // Added to track Remember Me preference
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const headingColor = useColorModeValue('blue.600', 'blue.200');
  const toast = useToast(); // Initialize toast for feedback
  
  // Responsive sizing
  const containerWidth = useBreakpointValue({ base: "95%", sm: "90%", md: "600px" });
  const headingSize = useBreakpointValue({ base: "xl", md: "2xl" });
  const contentPadding = useBreakpointValue({ base: 4, md: 8 });

  const toggleAuthMode = () => {
    setIsSignUp(prev => !prev);
    setAuthStage('initial');
    // Clear previous authentication data
    setUsername('');
    setEmail('');
    setPhoneNumber('');
    setSessionToken('');
    setSessionId('');
  };

  const handleSignInSuccess = (username, sessionToken, rememberMe = false) => {
    setUsername(username);
    setSessionToken(sessionToken);
    setRememberMe(rememberMe);
    setAuthStage('passmatrix');
    
    toast({
      title: 'Username Verified',
      description: 'Please complete authentication with PassMatrix',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };
  
  const handleSignUpSuccess = (username, email, phoneNumber, sessionToken) => {
    setUsername(username);
    setEmail(email);
    setPhoneNumber(phoneNumber);
    setSessionToken(sessionToken);
    setAuthStage('passmatrix');
    
    toast({
      title: 'Account Created',
      description: 'Please set up your PassMatrix pattern',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };
  
  // Handle session ID updates from PassMatrix
  const handleSessionIdUpdate = (id) => {
    setSessionId(id);
  };
  
  // Handle authentication errors
  const handleAuthError = (errorMessage) => {
    toast({
      title: 'Authentication Error',
      description: errorMessage || 'Please try again',
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
    setAuthStage('initial');
  };

  // Handle OTP verification success
  const handleOtpVerified = (username, sessionToken) => {
    setUsername(username);
    setSessionToken(sessionToken);
    setAuthStage('reset');
  };

  // Handle pattern reset success
  const handleResetSuccess = () => {
    setAuthStage('signin');
  };

  return (
    <Center minH="100vh" bg={bgColor} p={contentPadding}>
      <VStack 
        spacing={6} 
        w="full" 
        maxW={containerWidth} 
        mx="auto" 
        align="center"
        px={contentPadding}
      >
        <Heading 
          as="h1" 
          size={headingSize} 
          color={headingColor} 
          textAlign="center" 
          mb={4}
          fontWeight="bold"
          letterSpacing="tight"
        >
          PixVault
        </Heading>
        <Box w="full" maxW={containerWidth} mx="auto">
          {authStage === 'initial' ? (
            isSignUp ? (
              <SignUp 
                onToggleAuth={toggleAuthMode} 
                onSignUpSuccess={handleSignUpSuccess}
              />
            ) : (
              <SignIn 
                onToggleAuth={toggleAuthMode} 
                onSignInSuccess={handleSignInSuccess} 
                onForgotClick={() => setAuthStage('forgot')}
              />
            )
          ) : authStage === 'forgot' ? (
            <ForgotPattern
              onBack={() => setAuthStage('initial')}
              onOtpVerified={handleOtpVerified}
            />
          ) : authStage === 'reset' ? (
            <PatternReset
              username={username}
              sessionToken={sessionToken}
              onSuccess={handleResetSuccess}
              onBack={() => setAuthStage('forgot')}
            />
          ) : (
            <PassMatrix 
              username={username}
              sessionToken={sessionToken}
              sessionId={sessionId}
              onSessionIdUpdate={handleSessionIdUpdate}
              onSuccess={onAuthenticated}
              onError={handleAuthError}
              isSignUp={isSignUp}
              initialEmail={email}
              initialPhoneNumber={phoneNumber}
              rememberMe={rememberMe}
            />
          )}
        </Box>
        
        {authStage === 'initial' && (
          <Flex justifyContent="center" w="full" mt={2}>
            <Button variant="link" colorScheme="blue" onClick={toggleAuthMode}>
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </Button>
          </Flex>
        )}
      </VStack>
    </Center>
  );
};

export default AuthContainer;
