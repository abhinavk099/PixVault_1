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
  Paper,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';

const steps = ['Account Details', 'Security Setup', 'Confirmation'];

const RegisterForm = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [passMatrixSequence, setPassMatrixSequence] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validatePassword = () => {
    if (formData.password.length < 12) {
      setError('Password must be at least 12 characters long');
      return false;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      return false;
    }
    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter');
      return false;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one number');
      return false;
    }
    if (!/[^A-Za-z0-9]/.test(formData.password)) {
      setError('Password must contain at least one special character');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');

    if (activeStep === 0) {
      if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
        setError('Please fill in all fields');
        return;
      }
      if (!validatePassword()) {
        return;
      }
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError('');
  };

  const handlePassMatrixComplete = (sequence) => {
    setPassMatrixSequence(sequence);
    handleNext();
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.post('/api/auth/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        passMatrixSequence: passMatrixSequence.join(',')
      });

      // Store encryption keys securely
      if (response.data.user.publicKey) {
        await storeKeys({
          publicKey: response.data.user.publicKey,
          encryptedPrivateKey: response.data.user.encryptedPrivateKey
        }, formData.password);
      }

      // Clear sensitive data
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      setPassMatrixSequence([]);

      // Navigate to login
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.response?.data?.message || 'Registration failed. Please try again.');
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box component="form">
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
              label="Email"
              name="email"
              type="email"
              value={formData.email}
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
              helperText="At least 12 characters, including uppercase, lowercase, number, and special character"
            />
            <TextField
              fullWidth
              margin="normal"
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
            />
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography variant="body1" gutterBottom>
              Set up your PassMatrix sequence
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select 5 images in sequence. Remember this sequence for login.
            </Typography>
            <PassMatrix
              onComplete={handlePassMatrixComplete}
              loading={loading}
              registration
            />
          </Box>
        );
      case 2:
        return (
          <Box>
            <Typography variant="body1" gutterBottom>
              Please review your information
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Username: {formData.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Email: {formData.email}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              PassMatrix sequence: Set
            </Typography>
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Register for PixVault
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {getStepContent(activeStep)}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          variant="outlined"
          disabled={activeStep === 0}
          onClick={handleBack}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={24} />
          ) : activeStep === steps.length - 1 ? (
            'Register'
          ) : (
            'Next'
          )}
        </Button>
      </Box>
    </Paper>
  );
};

export default RegisterForm;
