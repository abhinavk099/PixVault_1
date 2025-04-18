const nodemailer = require('nodemailer');

/**
 * Email service for sending notifications and recovery emails
 */
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text content
   * @param {string} options.html - HTML content
   * @returns {Promise} - Nodemailer send result
   */
  async sendEmail({ to, subject, text, html }) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"PixVault" <noreply@pixvault.com>',
        to,
        subject,
        text,
        html
      };

      return await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send OTP email for password recovery
   * @param {Object} options - OTP email options
   * @param {string} options.email - Recipient email
   * @param {string} options.username - User's username
   * @param {string} options.otp - One-time password
   * @returns {Promise} - Email send result
   */
  async sendOtpEmail({ email, username, otp }) {
    const subject = 'PixVault Password Recovery';
    const text = `Hello ${username},\n\nYour one-time password for PixVault account recovery is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.\n\nRegards,\nThe PixVault Team`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a5568;">PixVault Password Recovery</h2>
        <p>Hello ${username},</p>
        <p>Your one-time password for PixVault account recovery is:</p>
        <div style="background-color: #f8f9fa; padding: 12px; border-radius: 4px; text-align: center; font-size: 24px; letter-spacing: 4px; margin: 20px 0;">
          <strong>${otp}</strong>
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you did not request this code, please ignore this email.</p>
        <p>Regards,<br>The PixVault Team</p>
      </div>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send account activity notification
   * @param {Object} options - Notification options
   * @param {string} options.email - Recipient email
   * @param {string} options.username - User's username
   * @param {string} options.activityType - Type of activity
   * @param {string} options.ipAddress - IP address of the activity
   * @param {string} options.deviceInfo - Device information
   * @param {Date} options.timestamp - Time of activity
   * @returns {Promise} - Email send result
   */
  async sendActivityNotification({ email, username, activityType, ipAddress, deviceInfo, timestamp }) {
    const subject = 'PixVault Account Activity';
    const formattedTime = new Date(timestamp).toLocaleString();
    
    const text = `Hello ${username},\n\nWe detected a new activity on your PixVault account:\n\nActivity: ${activityType}\nTime: ${formattedTime}\nIP Address: ${ipAddress}\nDevice: ${deviceInfo}\n\nIf this wasn't you, please secure your account immediately by changing your pattern.\n\nRegards,\nThe PixVault Team`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a5568;">PixVault Account Activity</h2>
        <p>Hello ${username},</p>
        <p>We detected a new activity on your PixVault account:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Activity</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${activityType}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Time</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${formattedTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>IP Address</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${ipAddress}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Device</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${deviceInfo}</td>
          </tr>
        </table>
        <p>If this wasn't you, please secure your account immediately by changing your pattern.</p>
        <p>Regards,<br>The PixVault Team</p>
      </div>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }
}

module.exports = new EmailService();
