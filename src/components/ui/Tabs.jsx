import React from 'react';
import {
  Tabs as ChakraTabs,
  TabList as ChakraTabList,
  Tab as ChakraTab,
  TabPanels as ChakraTabPanels,
  TabPanel as ChakraTabPanel,
  useColorModeValue
} from '@chakra-ui/react';

// Enhanced version of Chakra UI Tabs with consistent styling

export const Tabs = ({ children, variant = 'enclosed', colorScheme = 'blue', ...rest }) => {
  return (
    <ChakraTabs variant={variant} colorScheme={colorScheme} {...rest}>
      {children}
    </ChakraTabs>
  );
};

export const TabList = ({ children, ...rest }) => {
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  return (
    <ChakraTabList 
      borderColor={borderColor}
      mb={4}
      {...rest}
    >
      {children}
    </ChakraTabList>
  );
};

export const Tab = ({ children, ...rest }) => {
  const activeBg = useColorModeValue('white', 'gray.700');
  const inactiveBg = useColorModeValue('gray.50', 'gray.600');
  
  return (
    <ChakraTab
      _selected={{ 
        bg: activeBg, 
        borderColor: 'inherit',
        borderBottomColor: activeBg
      }}
      bg={inactiveBg}
      {...rest}
    >
      {children}
    </ChakraTab>
  );
};

export const TabPanels = ({ children, ...rest }) => {
  return (
    <ChakraTabPanels {...rest}>
      {children}
    </ChakraTabPanels>
  );
};

export const TabPanel = ({ children, ...rest }) => {
  return (
    <ChakraTabPanel px={0} {...rest}>
      {children}
    </ChakraTabPanel>
  );
};