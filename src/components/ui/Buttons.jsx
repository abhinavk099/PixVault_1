import React from 'react';
import {
  Button as ChakraButton,
  Icon,
  Spinner,
  Flex
} from '@chakra-ui/react';

export const Button = ({
  children,
  leftIcon,
  rightIcon,
  isLoading = false,
  loadingText,
  ...rest
}) => {
  // If using Lucide icons, we need to wrap them in Icon component
  const renderIcon = (iconComponent) => {
    if (!iconComponent) return null;
    
    // If it's a Lucide icon (function), render it within Chakra's Icon
    if (typeof iconComponent === 'function') {
      const LucideIconComponent = iconComponent;
      return <Icon as={LucideIconComponent} />;
    }
    
    // Otherwise, just return the icon as is (already JSX)
    return iconComponent;
  };

  // Custom loading state to support loadingText
  if (isLoading) {
    return (
      <ChakraButton
        isLoading={false} // We'll handle the spinner ourselves
        disabled={true}
        opacity="0.8"
        {...rest}
      >
        <Flex align="center" justify="center">
          <Spinner size="sm" mr={loadingText ? 2 : 0} />
          {loadingText || children}
        </Flex>
      </ChakraButton>
    );
  }

  // Regular button with optional icons
  return (
    <ChakraButton {...rest}>
      {leftIcon && (
        <Flex align="center" mr={2}>
          {renderIcon(leftIcon)}
        </Flex>
      )}
      {children}
      {rightIcon && (
        <Flex align="center" ml={2}>
          {renderIcon(rightIcon)}
        </Flex>
      )}
    </ChakraButton>
  );
};

export default Button;