import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Search, Download, Filter } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSecurity } from '../../hooks/useSecurity';
import { usePermissions } from '../../contexts/PermissionsContext';
import {
  Box,
  Flex,
  Heading,
  Input,
  Select,
  Button,
  IconButton,
  Container,
  VStack,
  Text,
  Spinner
} from '@chakra-ui/react';

const SecurityLogViewer = () => {
  const { securityLogs, loading, fetchSecurityLogs } = useSecurity();
  const { hasPermission, Permissions } = usePermissions();
  
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hasPermission(Permissions.SECURITY_LOGS_VIEW)) {
      setError('You do not have permission to view security logs');
      return;
    }

    fetchSecurityLogs();
  }, [fetchSecurityLogs, hasPermission, Permissions.SECURITY_LOGS_VIEW]);

  // Apply filters whenever logs, search term or filters change
  useEffect(() => {
    let filtered = [...securityLogs];

    // Apply event type filter
    if (eventTypeFilter) {
      filtered = filtered.filter(log => log.event_type === eventTypeFilter);
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(log => new Date(log.timestamp) >= startDate);
    }

    // Apply search term filter
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.event_type.toLowerCase().includes(searchTermLower) ||
        (log.user_id && log.user_id.toLowerCase().includes(searchTermLower)) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(searchTermLower)) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTermLower))
      );
    }

    setFilteredLogs(filtered);
  }, [securityLogs, searchTerm, eventTypeFilter, dateFilter]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const uniqueEventTypes = Array.from(new Set(securityLogs.map(log => log.event_type)));

  const downloadLogs = () => {
    const jsonString = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `security_logs_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!hasPermission(Permissions.SECURITY_LOGS_VIEW)) {
    return (
      <Container maxW="4xl" p={4}>
        <Alert status="error">
          <AlertDescription>
            You do not have permission to view security logs
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxW="4xl" p={4}>
      <Flex mb={6} justify="space-between" align="center">
        <Heading size="lg">Security Logs</Heading>
        <Flex gap={2}>
          <IconButton
            icon={<RefreshCw />}
            onClick={fetchSecurityLogs}
            isLoading={loading}
            aria-label="Refresh logs"
            title="Refresh logs"
          />
          <IconButton
            icon={<Download />}
            onClick={downloadLogs}
            aria-label="Download logs"
            title="Download filtered logs"
          />
        </Flex>
      </Flex>
      
      {error && (
        <Alert status="error" mb={4}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Flex mb={4} gap={4} direction={{ base: 'column', md: 'row' }}>
        <Box flex={1} position="relative">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            pl={10}
          />
          <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" pointerEvents="none">
            <Search size={16} />
          </Box>
        </Box>
        
        <Box flex={1} position="relative">
          <Select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            pl={10}
          >
            <option value="">All Event Types</option>
            {uniqueEventTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </option>
            ))}
          </Select>
          <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" pointerEvents="none">
            <Filter size={16} />
          </Box>
        </Box>
        
        <Box flex={1}>
          <Select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
          </Select>
        </Box>
      </Flex>
      
      {loading ? (
        <VStack py={8} spacing={4}>
          <Spinner size="xl" />
          <Text color="gray.500">Loading security logs...</Text>
        </VStack>
      ) : filteredLogs.length === 0 ? (
        <VStack py={8} spacing={2} bg="gray.50" borderRadius="md" border="1px" borderColor="gray.200">
          <Text color="gray.500">No security logs found</Text>
          {(searchTerm || eventTypeFilter || dateFilter !== 'all') && (
            <Text fontSize="sm" color="gray.400">
              Try adjusting your filters
            </Text>
          )}
        </VStack>
      ) : (
        <VStack spacing={4} align="stretch">
          {filteredLogs.map((log, index) => (
            <Box
              key={index}
              p={4}
              borderRadius="md"
              border="1px"
              borderColor="gray.200"
              _hover={{ bg: 'gray.50' }}
            >
              <Flex justify="space-between" align="flex-start" mb={2}>
                <Text fontWeight="bold" color="blue.600">
                  {log.event_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {formatDate(log.timestamp)}
                </Text>
              </Flex>
              
              <Text fontSize="sm" mb={2}>
                User: {log.user_id || 'Anonymous'} | IP: {log.ip_address || 'Unknown'}
              </Text>
              
              {log.details && (
                <Box
                  mt={2}
                  p={2}
                  bg="gray.50"
                  borderRadius="sm"
                  fontSize="sm"
                  fontFamily="mono"
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          ))}
        </VStack>
      )}
      
      <Text mt={4} fontSize="sm" color="gray.500">
        Showing {filteredLogs.length} of {securityLogs.length} logs
      </Text>
    </Container>
  );
};

export default SecurityLogViewer;