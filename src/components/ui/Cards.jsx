import React from 'react';
import { Box, useColorModeValue } from '@chakra-ui/react';

export const Card = ({ children, variant = 'elevated', ...rest }) => {
  const bgColor = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Define styles based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'outline':
        return {
          boxShadow: 'none',
          border: '1px solid',
          borderColor: borderColor
        };
      case 'filled':
        return {
          boxShadow: 'none',
          bg: useColorModeValue('gray.100', 'gray.700')
        };
      case 'unstyled':
        return {
          boxShadow: 'none',
          bg: 'transparent'
        };
      case 'elevated':
      default:
        return {
          boxShadow: 'md'
        };
    }
  };

  return (
    <Box
      bg={bgColor}
      borderRadius="lg"
      overflow="hidden"
      p={4}
      {...getVariantStyles()}
      {...rest}
    >
      {children}
    </Box>
  );
};

export const CardHeader = ({ children, ...rest }) => (
  <Box pb={4} mb={4} borderBottomWidth="1px" {...rest}>
    {children}
  </Box>
);

export const CardBody = ({ children, ...rest }) => (
  <Box {...rest}>
    {children}
  </Box>
);

export const CardFooter = ({ children, ...rest }) => (
  <Box pt={4} mt={4} borderTopWidth="1px" {...rest}>
    {children}
  </Box>
);