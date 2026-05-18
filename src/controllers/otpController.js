// OTP controller for backend API
const { connectToDatabase, initializeDatabase } = require('../database/connection');
const { initializeEmailService, sendOTPEmail } = require('../services/emailService');

// Store OTPs in memory (in production, use Redis or database)
const otpStore = new Map();

// Generate 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random()  * 900000).toString();
}

// Send OTP via email
async function sendOtpEmail(email, otp) {
  try {
    // Use existing email service
    const subject = 'FindMe - Verify Your Email';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🔐 Email Verification</h1>
          <p style="margin: 10px 0; font-size: 16px;">Welcome to FindMe!</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Your Verification Code</h2>
          <div style="background: #fff; border: 2px dashed #ddd; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; text-align: center; display: block;">
              ${otp}
            </span>
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-weight: bold;">⏰ This code expires in 10 minutes</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            <p style="color: #666; font-size: 14px;">For support, contact us at support@findme.com</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 15px;">
          <p style="margin: 0; color: #666; font-size: 12px;">© 2024 FindMe. All rights reserved.</p>
        </div>
      </div>
    `;

    // FIX: Don't re-initialize email service every time - it should already be initialized
    // await initializeEmailService(); // REMOVE THIS LINE
    
    const result = await sendOTPEmail(email, subject, html);
    return result.success;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

// Send OTP
async function sendOTP(req, res) {
  try {
    const { identifier, method, facilityName } = req.body;

    if (!identifier || !method) {
      return res.status(400).json({ message: 'Identifier and method are required' });
    }

    // Connect to database
    const db = await connectToDatabase();
    await initializeDatabase();

    // Check if user has exceeded attempt limit in the last 15 minutes
    const attemptCount = db.prepare(
      'SELECT SUM(attempts) as total_attempts FROM otp_codes WHERE identifier = ? AND method = ? AND created_at > datetime(\'now\', \'-15 minutes\')'
    ).get([identifier, method]);

    if (attemptCount && attemptCount.total_attempts >= 3) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP attempts. Please try again after 15 minutes.',
        locked: true
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP in database
    db.prepare('INSERT INTO otp_codes (identifier, method, code, expires_at) VALUES (?, ?, ?, ?)').run([identifier, method, otp, expiresAt.toISOString()]);

    // Log OTP for debugging
    console.log(`OTP for ${method} ${identifier}: ${otp} (expires: ${expiresAt})`);
    console.log(`OTP sent for facility: ${facilityName || 'Facility'}`);

    // Send OTP via email service
    let emailResult = { success: false };
    if (method === 'email') {
      // Fix: Send proper parameters to sendOTPEmail
      const emailSubject = 'Your OTP Verification Code';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Your OTP Code: ${otp}</h2>
          <p>This code expires in 10 minutes.</p>
          <p>Facility: ${facilityName || 'Facility'}</p>
        </div>
      `;
      emailResult = await sendOTPEmail(identifier, emailSubject, emailHtml);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: 600, // 10 minutes in seconds
      developmentOTP: process.env.NODE_ENV === 'development' ? otp : undefined, // Only in development
      emailSent: emailResult.success,
      emailMethod: emailResult.method || 'failed'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Error sending OTP' });
  }
}

// Verify OTP
async function verifyOTP(req, res) {
  try {
    const { identifier, code, method } = req.body;

    if (!identifier || !code || !method) {
      return res.status(400).json({ message: 'Identifier, code, and method are required' });
    }

    // Connect to database
    const db = await connectToDatabase();
    await initializeDatabase();

    // Find valid OTP
    const otpRecord = db.prepare(
      `SELECT * FROM otp_codes 
       WHERE identifier = ? AND method = ? AND code = ? 
       AND expires_at > datetime('now') AND is_used = 0`
    ).get([identifier, method, code]);

    if (!otpRecord) {
      // Increment attempts for failed verification
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE identifier = ? AND method = ?').run([identifier, method]);

      // Check if too many attempts
      const attemptCount = db.prepare(
        'SELECT SUM(attempts) as total_attempts FROM otp_codes WHERE identifier = ? AND method = ? AND created_at > datetime(\'now\', \'-15 minutes\')'
      ).get([identifier, method]);

      if (attemptCount && attemptCount.total_attempts >= 3) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Please try again after 15 minutes.',
          locked: true
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as used
    db.prepare('UPDATE otp_codes SET is_used = 1 WHERE id = ?').run([otpRecord.id]);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Error verifying OTP' });
  }
}

// Send OTP for registration
const sendRegistrationOtp = async (req, res) => {
  const startTime = Date.now();
  console.log('🔐 [OTP] Registration OTP request received');
  console.log(`📧 [OTP] Email: ${req.body.email}`);
  
  try {
    const { email } = req.body;

    if (!email) {
      console.log('❌ [OTP] Email missing in request');
      return res.status(400).json({ message: 'Email is required' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    console.log(`🔢 [OTP] Generated OTP: ${otp} (expires in 10 minutes)`);

    // Store OTP
    otpStore.set(email, {
      otp,
      expiresAt,
      purpose: 'registration',
      attempts: 0,
    });
    
    console.log(`💾 [OTP] OTP stored in memory for email: ${email}`);

    // Send email using the correct function signature
    const subject = 'FindMe - Registration OTP';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to FindMe!</h2>
        <p>Your registration OTP is: <strong style="font-size: 24px;">${otp}</strong></p>
        <p>This code expires in 10 minutes.</p>
        <p>Please use this code to complete your registration.</p>
      </div>
    `;

    console.log('📤 [OTP] Sending email...');
    
    // FIX: Don't re-initialize email service every time - it should already be initialized
    // await initializeEmailService(); // REMOVE THIS LINE
    
    const emailResult = await sendOTPEmail(email, subject, html);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    if (emailResult && emailResult.success) {
      console.log(`✅ [OTP] Email sent successfully in ${processingTime}ms`);
      console.log(`📊 [OTP] Email method: ${emailResult.method || 'unknown'}`);
      
      res.json({ 
        success: true, 
        message: 'OTP sent successfully',
        expiresIn: '10 minutes',
        processingTime: `${processingTime}ms`
      });
    } else {
      console.log(`❌ [OTP] Email failed to send in ${processingTime}ms`);
      console.log(`⚠️ [OTP] Email error: ${emailResult?.error || 'Unknown error'}`);
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP email' 
      });
    }
  } catch (error) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.error(`💥 [OTP] Error in ${processingTime}ms:`, error.message);
    console.error(`📋 [OTP] Full error:`, error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Verify OTP for registration
const verifyRegistrationOtp = async (req, res) => {
  const startTime = Date.now();
  console.log('\n🔐 [OTP] Registration OTP verification request received');
  console.log(`📧 [OTP] Email: ${req.body.email}`);
  console.log(`🔢 [OTP] OTP provided: ${req.body.otp}`);
  console.log(`👤 [OTP] User data: fullName=${req.body.fullName}, age=${req.body.age}, phone=${req.body.phone}`);
  
  try {
    const { email, otp, fullName, age, phone, password } = req.body;

    if (!email || !otp) {
      console.log('❌ [OTP] Email or OTP missing in request');
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const storedData = otpStore.get(email);
    console.log(`💾 [OTP] Stored data found: ${storedData ? 'YES' : 'NO'}`);

    if (!storedData) {
      console.log('❌ [OTP] No OTP data found for email');
      return res.status(400).json({ 
        success: false, 
        message: 'OTP not found or expired' 
      });
    }

    // Check expiration
    if (new Date() > storedData.expiresAt) {
      console.log('❌ [OTP] OTP has expired');
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      console.log('❌ [OTP] Too many attempts');
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'Too many attempts. Please request a new OTP.' 
      });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      console.log(`❌ [OTP] Invalid OTP. Expected: ${storedData.otp}, Got: ${otp}`);
      otpStore.set(email, {
        ...storedData,
        attempts: storedData.attempts + 1,
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    console.log('✅ [OTP] OTP verified successfully');
    
    // OTP is valid - remove it from store
    otpStore.delete(email);

    // If registration data is provided, create user
    if (fullName && age && password && phone) {
      console.log('👤 [OTP] Creating user account...');
      // Import User model to create the user
      const User = require('../models/user');

      try {
        const newUser = await User.create({
          fullName,
          age: parseInt(age),
          email,
          password,
          phone,
        });
        
        const endTime = Date.now();
        console.log(`✅ [OTP] User created successfully in ${endTime - startTime}ms`);
        console.log(`👤 [OTP] User ID: ${newUser.id}, Name: ${newUser.fullName}`);

        res.json({ 
          success: true, 
          message: 'Registration successful!',
          user: {
            id: newUser.id,
            fullName: newUser.fullName,
            email: newUser.email,
          },
          processingTime: `${endTime - startTime}ms`
        });
      } catch (userError) {
        console.error('❌ [OTP] User creation error:', userError);
        res.status(500).json({ 
          success: false, 
          message: 'Failed to create user account' 
        });
      }
    } else {
      console.log('⚠️ [OTP] No user data provided, only OTP verified');
      const endTime = Date.now();
      res.json({ 
        success: true, 
        message: 'OTP verified successfully',
        processingTime: `${endTime - startTime}ms`
      });
    }

  } catch (error) {
    const endTime = Date.now();
    console.error(`💥 [OTP] Verification error in ${endTime - startTime}ms:`, error.message);
    console.error(`📋 [OTP] Full error:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Check if email or phone already exists
const checkUserExists = async (req, res) => {
  const startTime = Date.now();
  console.log('🔍 [USER] Checking if user exists');
  console.log(`📧 [USER] Email: ${req.body.email}`);
  console.log(`📱 [USER] Phone: ${req.body.phone}`);
  
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      console.log('❌ [USER] Email or phone required');
      return res.status(400).json({ 
        message: 'Email or phone is required',
        exists: false 
      });
    }

    const User = require('../models/user');
    const conflicts = {};

    // Check email if provided
    if (email) {
      const emailUser = await User.findOne({ email });
      if (emailUser) {
        conflicts.email = 'Email already registered';
        console.log(`❌ [USER] Email conflict: ${email}`);
      } else {
        console.log(`✅ [USER] Email available: ${email}`);
      }
    }

    // Check phone if provided
    if (phone) {
      const phoneUser = await User.findOne({ phone });
      if (phoneUser) {
        conflicts.phone = 'Phone number already registered';
        console.log(`❌ [USER] Phone conflict: ${phone}`);
      } else {
        console.log(`✅ [USER] Phone available: ${phone}`);
      }
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    const hasConflicts = Object.keys(conflicts).length > 0;
    
    console.log(`⚡ [USER] Check completed in ${processingTime}ms`);
    console.log(`📊 [USER] Conflicts found: ${hasConflicts}`);

    res.json({
      success: true,
      exists: hasConflicts,
      conflicts,
      message: hasConflicts ? 'User already exists' : 'User available',
      processingTime: `${processingTime}ms`
    });

  } catch (error) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.error(`❌ [USER] Check error in ${processingTime}ms:`, error);
    
    res.status(500).json({
      message: 'Failed to check user availability',
      error: error.message,
      processingTime: `${processingTime}ms`
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  checkUserExists
};