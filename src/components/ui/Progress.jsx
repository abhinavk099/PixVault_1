import React from 'react';
import {
  Progress as ChakraProgress,
  Box,
  Text,
  Flex
} from '@chakra-ui/react';

export const Progress = ({
  value = 0,
  showPercentage = false,
  label,
  size = 'md',
  colorScheme = 'blue',
  ...rest
}) => {
  // Height based on size
  const getHeight = () => {
    switch (size) {
      case 'xs': return '0.25rem';
      case 'sm': return '0.5rem';
      case 'lg': return '1rem';
      case 'md':
      default: return '0.75rem';
    }
  };

  return (
    <Box width="100%">
      {label && (
        <Flex justify="space-between" mb={1}>
          <Text fontSize="sm" fontWeight="medium">{label}</Text>
          {showPercentage && (
            <Text fontSize="sm" color="gray.500">{value}%</Text>
          )}
        </Flex>
      )}
      <ChakraProgress
        value={value}
        colorScheme={colorScheme}
        borderRadius="full"
        height={getHeight()}
        {...rest}
      />
      {!label && showPercentage && (
        <Text fontSize="xs" color="gray.500" textAlign="right" mt={1}>
          {value}%
        </Text>
      )}
    </Box>
  );
};

export default Progress;