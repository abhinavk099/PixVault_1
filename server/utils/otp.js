const { authenticator } = require('otplib');
const crypto = require('crypto');

/**
 * OTP Service for generating and validating one-time passwords
 */
class OtpService {
  constructor() {
    // Configure OTP settings
    authenticator.options = {
      digits: 6,
      step: 600, // 10 minutes validity
      window: 1 // Allow 1 step before/after for clock drift
    };
  }

  /**
   * Generate a random secret for OTP
   * @returns {string} - Base32 encoded secret
   */
  generateSecret() {
    return authenticator.generateSecret(32); // 32 bytes of randomness
  }

  /**
   * Generate a numeric OTP code
   * @returns {string} - 6-digit OTP code
   */
  generateOtp() {
    // For simplicity, we'll generate a 6-digit numeric OTP
    // In production, you might want to use HOTP or TOTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a secure OTP using authenticator
   * @param {string} secret - Secret key for the user
   * @returns {string} - OTP code
   */
  generateSecureOtp(secret) {
    return authenticator.generate(secret);
  }

  /**
   * Verify an OTP code
   * @param {string} token - OTP code to verify
   * @param {string} secret - Secret key for the user
   * @returns {boolean} - Whether the OTP is valid
   */
  verifyOtp(token, secret) {
    return authenticator.verify({ token, secret });
  }

  /**
   * Hash an OTP for secure storage
   * @param {string} otp - OTP to hash
   * @returns {string} - Hashed OTP
   */
  hashOtp(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Verify a hashed OTP
   * @param {string} inputOtp - OTP to verify
   * @param {string} hashedOtp - Stored hashed OTP
   * @returns {boolean} - Whether the OTP is valid
   */
  verifyHashedOtp(inputOtp, hashedOtp) {
    const inputHash = this.hashOtp(inputOtp);
    return inputHash === hashedOtp;
  }
}

module.exports = new OtpService();
