import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Heading,
  Button,
  useColorModeValue,
  Tooltip,
  Flex,
  Icon,
  Divider,
  Alert,
  AlertIcon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure
} from '@chakra-ui/react';
import { InfoIcon, CopyIcon, CheckIcon } from '@chakra-ui/icons';
import { Download } from 'lucide-react';

// Predefined word lists for different categories
const WORD_LISTS = {
  animals: ['dog', 'cat', 'lion', 'tiger', 'elephant', 'zebra', 'giraffe', 'monkey', 'bear', 'fox', 'wolf', 'eagle', 'hawk', 'fish', 'shark', 'dolphin', 'whale', 'turtle', 'snake', 'frog'],
  colors: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'black', 'white', 'gray', 'gold', 'silver', 'teal', 'navy', 'maroon', 'violet', 'indigo', 'cyan', 'magenta'],
  fruits: ['apple', 'banana', 'orange', 'grape', 'strawberry', 'pineapple', 'mango', 'kiwi', 'peach', 'pear', 'cherry', 'watermelon', 'lemon', 'lime', 'coconut', 'avocado', 'blueberry', 'raspberry', 'blackberry', 'plum'],
  places: ['mountain', 'beach', 'forest', 'desert', 'island', 'river', 'lake', 'ocean', 'valley', 'hill', 'canyon', 'cave', 'waterfall', 'glacier', 'volcano', 'meadow', 'cliff', 'reef', 'jungle', 'oasis'],
  actions: ['run', 'jump', 'swim', 'climb', 'dance', 'sing', 'laugh', 'smile', 'sleep', 'eat', 'drink', 'write', 'read', 'draw', 'paint', 'build', 'create', 'explore', 'travel', 'discover']
};

/**
 * MnemonicHelper component generates memorable phrases to help users remember their pattern
 * It takes the selected pattern coordinates and generates a mnemonic phrase
 */
const MnemonicHelper = ({ selectedPoints, isOpen, onClose, onSave }) => {
  const [mnemonic, setMnemonic] = useState([]);
  const [copied, setCopied] = useState(false);
  const explanationDisclosure = useDisclosure();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Generate mnemonic when selected points change
  useEffect(() => {
    if (selectedPoints && selectedPoints.length > 0) {
      generateMnemonic(selectedPoints);
    }
  }, [selectedPoints]);
  
  // Generate a mnemonic phrase from the pattern
  const generateMnemonic = (points) => {
    if (!points || points.length === 0) return;
    
    // Get categories for our mnemonic
    const categories = Object.keys(WORD_LISTS);
    const usedCategories = [];
    
    // Create a mnemonic phrase with words from different categories
    const newMnemonic = points.map((point, index) => {
      // Extract row and column from the point (format: "row,col")
      const [row, col] = point.split(',').map(Number);
      
      // Use the coordinates to determine which category to use
      // Ensure we don't repeat categories unless necessary
      let categoryIndex = (row + col) % categories.length;
      let attempts = 0;
      
      while (usedCategories.includes(categories[categoryIndex]) && attempts < categories.length) {
        categoryIndex = (categoryIndex + 1) % categories.length;
        attempts++;
      }
      
      const category = categories[categoryIndex];
      usedCategories.push(category);
      
      // Use coordinates to select a word from the category
      const wordList = WORD_LISTS[category];
      const wordIndex = (row * 5 + col) % wordList.length;
      const word = wordList[wordIndex];
      
      return {
        word,
        category,
        position: index + 1,
        coordinates: point
      };
    });
    
    setMnemonic(newMnemonic);
  };
  
  // Handle copying mnemonic to clipboard
  const handleCopy = () => {
    const mnemonicText = mnemonic.map(item => item.word).join(' ');
    navigator.clipboard.writeText(mnemonicText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Generate a downloadable text file with the mnemonic
  const handleDownload = () => {
    const mnemonicText = `Your PixVault Pattern Mnemonic:\n\n${mnemonic.map(item => `${item.position}. ${item.word} (${item.category})`).join('\n')}\n\nIMPORTANT: Keep this information secure and private.`;
    
    const blob = new Blob([mnemonicText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pixvault-mnemonic.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const renderExplanationModal = () => (
    <Modal isOpen={explanationDisclosure.isOpen} onClose={explanationDisclosure.onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>How to Use Your Mnemonic</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="start">
            <Text>
              Your pattern has been converted into a series of memorable words to help you remember it.
              Each word corresponds to a specific position in your pattern.
            </Text>
            
            <Heading size="sm">How to Remember Your Pattern:</Heading>
            <Text>
              1. Create a story or mental image using these words in order.
            </Text>
            <Text>
              2. Associate each word with its position in your pattern (1st selection, 2nd selection, etc.).
            </Text>
            <Text>
              3. Practice recalling your pattern using these words a few times.
            </Text>
            
            <Alert status="warning">
              <AlertIcon />
              <Text>Never share these words with anyone. Keep this information private and secure.</Text>
            </Alert>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={explanationDisclosure.onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Your Pattern Mnemonic</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Text>These words will help you remember your pattern. Keep them private!</Text>
            </Alert>
            
            <Box 
              p={4} 
              borderWidth="1px" 
              borderRadius="md" 
              borderColor={borderColor}
              bg={bgColor}
            >
              <VStack spacing={3} align="stretch">
                <Flex justify="space-between" align="center">
                  <Heading size="sm">Your Mnemonic Phrase</Heading>
                  <HStack>
                    <Tooltip label={copied ? "Copied!" : "Copy to clipboard"}>
                      <Button 
                        size="sm" 
                        leftIcon={copied ? <CheckIcon /> : <CopyIcon />} 
                        onClick={handleCopy}
                      >
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </Tooltip>
                    <Tooltip label="Download as text file">
                      <Button 
                        size="sm" 
                        leftIcon={<Icon as={Download} />}
                        onClick={handleDownload}
                      >
                        Save
                      </Button>
                    </Tooltip>
                  </HStack>
                </Flex>
                
                <Divider />
                
                <HStack spacing={2} flexWrap="wrap">
                  {mnemonic.map((item, index) => (
                    <Badge 
                      key={index} 
                      colorScheme="blue" 
                      fontSize="md" 
                      py={1} 
                      px={2}
                      borderRadius="md"
                    >
                      {item.word}
                    </Badge>
                  ))}
                </HStack>
              </VStack>
            </Box>
            
            <Box>
              <Heading size="sm" mb={2}>Details:</Heading>
              <VStack spacing={2} align="stretch">
                {mnemonic.map((item, index) => (
                  <HStack key={index} justify="space-between" p={2} bg={bgColor === 'white' ? 'gray.50' : 'gray.700'} borderRadius="md">
                    <Text><strong>{item.position}.</strong> {item.word}</Text>
                    <Badge colorScheme="purple">{item.category}</Badge>
                  </HStack>
                ))}
              </VStack>
            </Box>
            
            <Flex justify="center">
              <Button 
                leftIcon={<InfoIcon />} 
                variant="ghost" 
                onClick={explanationDisclosure.onOpen}
              >
                How to use this mnemonic
              </Button>
            </Flex>
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onSave}>
            I've Saved My Mnemonic
          </Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
      
      {renderExplanationModal()}
    </Modal>
  );
};

export default MnemonicHelper;
