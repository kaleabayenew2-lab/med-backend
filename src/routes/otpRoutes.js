// OTP routes for backend API
const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, sendRegistrationOtp, verifyRegistrationOtp, checkUserExists } = require('../controllers/otpController');

// POST /api/otp/send - Send OTP
router.post('/send', sendOTP);

// POST /api/otp/verify - Verify OTP
router.post('/verify', verifyOTP);

// POST /api/otp/send-registration - Send registration OTP
router.post('/send-registration', sendRegistrationOtp);

// POST /api/otp/verify-registration - Verify registration OTP
router.post('/verify-registration', verifyRegistrationOtp);

// POST /api/otp/check-user-exists - Check if email or phone already exists
router.post('/check-user-exists', checkUserExists);

module.exports = router;
