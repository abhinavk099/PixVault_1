import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { storeKeys } from '../utils/keyStorage';
import PassMatrix from './PassMatrix';
import { 
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';

const LoginForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('credentials'); // 'credentials' or 'passmatrix'
  const [_sequence, setSequence] = useState([]); // Prefix with underscore to satisfy eslint

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    // Move to PassMatrix step
    setStep('passmatrix');
  };

  const handlePassMatrixComplete = async (selectedSequence) => {
    try {
      setLoading(true);
      setError('');
      setSequence(selectedSequence); // Store the sequence

      const response = await axios.post('/api/auth/login', {
        username: formData.username,
        password: formData.password,
        passMatrixSequence: selectedSequence.join(',')
      });

      // Store encryption keys securely
      if (response.data.user.publicKey) {
        await storeKeys({
          publicKey: response.data.user.publicKey,
          encryptedPrivateKey: response.data.user.encryptedPrivateKey
        }, formData.password);
      }

      // Clear sensitive data
      setFormData({ username: '', password: '' });
      setSequence([]); // Clear the sequence

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Login failed. Please try again.');
      setStep('credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Login to PixVault
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {step === 'credentials' ? (
        <Box component="form" onSubmit={handleCredentialsSubmit}>
          <TextField
            fullWidth
            margin="normal"
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            required
          />
          <Button
            fullWidth
            variant="contained"
            color="primary"
            type="submit"
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Next'}
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="body1" gutterBottom>
            Select your PassMatrix sequence
          </Typography>
          <PassMatrix
            onComplete={handlePassMatrixComplete}
            loading={loading}
          />
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setStep('credentials')}
            sx={{ mt: 2 }}
          >
            Back to Login
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default LoginForm;
