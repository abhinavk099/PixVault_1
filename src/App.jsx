import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  ChakraProvider,
  Box,
  Container,
  useColorModeValue
} from '@chakra-ui/react';
import { SecurityProvider } from './contexts/SecurityContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { AuthProvider } from './contexts/AuthContext';
import SecurityLogger from './components/security/SecurityLogger';
import SecurityLogViewer from './components/security/SecurityLogViewer';
import AuthContainer from './components/auth/AuthContainer';
import SecureFileManager from './components/file/SecureFileManager';
import SecureFileUploader from './components/file/SecureFileUploader';
import FileManagerDashboard from './components/file/FileManagerDashboard';
import RoleManager from './components/rbac/RoleManager';
import ProtectedRoute from './components/common/ProtectedRoute';
import Dashboard from './components/dashboard/Dashboard';

function App() {
  const bgColor = useColorModeValue('gray.50', 'gray.800');

  return (
    <ChakraProvider>
      <AuthProvider>
        <SecurityProvider>
          <PermissionsProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Box minH="100vh" bg={bgColor}>
                <SecurityLogger />
                <Container maxW="container.xl" py={5}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/auth" element={<AuthContainer onAuthenticated={(token) => {
                      console.log('Authentication successful, token received:', !!token);
                      // Store the token in localStorage if it exists
                      if (token) {
                        localStorage.setItem('authToken', token);
                        // Fetch user data from API if needed
                        // This could be done here or in the useAuth hook
                      }
                      // Use a short timeout to ensure state is updated before redirect
                      // Using window.location for a full page refresh to ensure clean state
                      setTimeout(() => {
                        window.location.href = '/';
                      }, 300);
                    }}/>} />
                    
                    {/* Protected routes */}
                    <Route path="/" element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/files" element={
                      <ProtectedRoute>
                        <FileManagerDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/files/manager" element={
                      <ProtectedRoute>
                        <SecureFileManager />
                      </ProtectedRoute>
                    } />
                    <Route path="/files/upload" element={
                      <ProtectedRoute>
                        <SecureFileUploader />
                      </ProtectedRoute>
                    } />
                    <Route path="/security-logs" element={
                      <ProtectedRoute>
                        <SecurityLogViewer />
                      </ProtectedRoute>
                    } />
                    <Route path="/role-manager" element={
                      <ProtectedRoute>
                        <RoleManager />
                      </ProtectedRoute>
                    } />
                    
                    {/* Redirect any unknown routes to home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Container>
              </Box>
            </Router>
          </PermissionsProvider>
        </SecurityProvider>
      </AuthProvider>
    </ChakraProvider>
  );
}

export default App;