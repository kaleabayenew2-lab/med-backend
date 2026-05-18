const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sendEmailOTP } = require('../utils/emailService');

// Store OTPs in memory (in production, use Redis or database)
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Clean expired OTPs
const cleanExpiredOTPs = () => {
  const now = Date.now();
  for (const [key, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(key);
    }
  }
};

// Send OTP
router.post('/send', async (req, res) => {
  try {
    const { identifier, method, facilityName } = req.body;
    
    if (!identifier) {
      return res.status(400).json({ 
        success: false, 
        message: 'Identifier (email) is required' 
      });
    }

    if (method !== 'email') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only email method is supported' 
      });
    }

    // Clean expired OTPs first
    cleanExpiredOTPs();

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    const key = `${method}:${identifier}`;

    // Store OTP
    otpStore.set(key, {
      otp,
      expiresAt,
      identifier,
      method,
      facilityName: facilityName || 'Facility'
    });

    // Send OTP via email
    const emailResult = await sendEmailOTP(identifier, otp, 'facility');
    
    if (emailResult.success) {
      const response = {
        success: true,
        message: `OTP sent to ${identifier}`,
        via: 'email'
      };

      // Include OTP in development for testing
      if (process.env.NODE_ENV === 'development' || process.env.DEV_RETURN_OTP === 'true') {
        response.developmentOTP = otp;
      }

      res.json(response);
    } else {
      // Clean up stored OTP if email failed
      otpStore.delete(key);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify OTP
router.post('/verify', async (req, res) => {
  try {
    const { identifier, code, method } = req.body;
    
    if (!identifier || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Identifier and OTP code are required' 
      });
    }

    if (method !== 'email') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only email method is supported' 
      });
    }

    const key = `${method}:${identifier}`;
    const storedData = otpStore.get(key);

    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'No OTP request found or expired' 
      });
    }

    // Check if OTP is expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    // Verify OTP
    if (storedData.otp !== code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP code' 
      });
    }

    // OTP is valid - remove it from store
    otpStore.delete(key);

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Clean up expired OTPs periodically (every 5 minutes)
setInterval(cleanExpiredOTPs, 5 * 60 * 1000);

module.exports = router;
