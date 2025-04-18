import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert as ChakraAlert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton
} from '@chakra-ui/react';

export const Alert = ({
  status = 'info',
  variant = 'subtle',
  title,
  description,
  onClose,
  isClosable = false,
  children,
  ...rest
}) => {
  return (
    <ChakraAlert
      status={status}
      variant={variant}
      borderRadius="md"
      mb={4}
      {...rest}
    >
      <AlertIcon />
      {title && <AlertTitle mr={2}>{title}</AlertTitle>}
      {description && <AlertDescription>{description}</AlertDescription>}
      {children}
      {isClosable && (
        <CloseButton
          position="absolute"
          right="8px"
          top="8px"
          onClick={onClose}
        />
      )}
    </ChakraAlert>
  );
};

Alert.propTypes = {
  status: PropTypes.oneOf(['info', 'warning', 'success', 'error']),
  variant: PropTypes.oneOf(['subtle', 'solid', 'left-accent', 'top-accent']),
  title: PropTypes.string,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  onClose: PropTypes.func,
  isClosable: PropTypes.bool,
  children: PropTypes.node
};

export { AlertDescription };
export default Alert;