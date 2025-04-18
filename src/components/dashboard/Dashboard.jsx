import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Icon,
  useColorModeValue,
  Container
} from '@chakra-ui/react';
import { FiFile, FiUpload, FiShield, FiUsers, FiLogOut } from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';

const Dashboard = () => {
  const { currentUser, logout } = useAuth();
  const cardBg = useColorModeValue('white', 'gray.700');
  const cardHoverBg = useColorModeValue('gray.50', 'gray.600');

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect happens automatically via AuthContext
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    {
      title: 'File Manager',
      description: 'View, download, and manage your secure files',
      icon: FiFile,
      path: '/files',
    },
    {
      title: 'Upload Files',
      description: 'Securely upload and encrypt new files',
      icon: FiUpload,
      path: '/files/upload',
    },
    {
      title: 'Security Logs',
      description: 'View security events and activity logs',
      icon: FiShield,
      path: '/security-logs',
    },
    {
      title: 'Role Management',
      description: 'Manage user roles and permissions',
      icon: FiUsers,
      path: '/role-manager',
    },
  ];

  return (
    <Container maxW="container.xl" py={8}>
      <Flex mb={8} justify="space-between" align="center">
        <Box>
          <Heading size="lg">PixVault Dashboard</Heading>
          {currentUser && (
            <Text mt={2} color="gray.500">
              Welcome back, {currentUser.username}
            </Text>
          )}
        </Box>
        <Button
          leftIcon={<FiLogOut />}
          colorScheme="red"
          variant="outline"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mt={8}>
        {menuItems.map((item, index) => (
          <Card
            key={index}
            as={RouterLink}
            to={item.path}
            bg={cardBg}
            _hover={{ bg: cardHoverBg, transform: 'translateY(-5px)' }}
            transition="all 0.3s"
            boxShadow="md"
            borderRadius="lg"
            overflow="hidden"
            textDecoration="none"
          >
            <CardHeader>
              <Flex align="center">
                <Icon as={item.icon} boxSize={6} mr={2} color="blue.500" />
                <Heading size="md">{item.title}</Heading>
              </Flex>
            </CardHeader>
            <CardBody>
              <Text>{item.description}</Text>
            </CardBody>
            <CardFooter>
              <Button size="sm" colorScheme="blue" variant="ghost">
                Open
              </Button>
            </CardFooter>
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
};

export default Dashboard;
