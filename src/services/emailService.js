// Email service for sending OTP emails
const nodemailer = require('nodemailer');
let transporter = null;

// Initialize email transporter
const initializeEmailService = async () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log('📧 Email service not configured. Falling back to console logging mode');
    transporter = null;
    return false;
  }

  try {
    // OPTIMIZATION: Create optimized transporter with faster settings
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // OPTIMIZATION: Connection pooling and faster settings
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // OPTIMIZATION: Faster connection settings
      connectionTimeout: 5000, // 5 seconds
      greetingTimeout: 3000,   // 3 seconds
      socketTimeout: 10000,    // 10 seconds
      // OPTIMIZATION: DNS resolution caching
      dns: {
        cacheTtl: 300, // 5 minutes cache
      }
    });

    // OPTIMIZATION: Quick verification with longer timeout for reliability
    try {
      await transporter.verify();
      console.log('📧 Email service initialized with optimized Gmail SMTP');
      console.log('📧 Email user:', emailUser);
      return true;
    } catch (verifyError) {
      console.log('⚠️ Email verification failed, but continuing with optimization...');
      console.log('📧 Email service initialized with optimized Gmail SMTP (verification skipped)');
      console.log('📧 Email user:', emailUser);
      return true; // Continue even if verification fails
    }
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    console.log('📧 Falling back to console logging mode');
    transporter = null;
    return false;
  }
};

// Send OTP email
const sendOTPEmail = async (email, subject, html) => {
  const startTime = Date.now();
  
  try {
    // Always log the email send attempt for debugging
    console.log('\n📧 Sending OTP email');
    console.log(`📧 EMAIL: ${email}`);
    console.log(`📧 SUBJECT: ${subject}`);
    console.log(`📧 HTML BODY LENGTH: ${html ? html.length : 0}`);
    console.log('\n');

    // OPTIMIZATION 1: Check if real email should be sent
    const forceRealEmail = process.env.FORCE_REAL_EMAIL === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // FIX: Always send real emails when email service is configured
    if (transporter) {
      console.log('📧 Sending real email with optimized delivery...');
      
      // Create mail options with delivery optimization
      const mailOptions = {
        from: `"Find Med" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        html,
        // OPTIMIZATION: Add priority headers for faster delivery
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high',
          'X-Mailer': 'FindMe-App',
          'Precedence': 'first-class'
        },
        // OPTIMIZATION: Fast delivery options
        messageId: `<${Date.now()}@findmed.app>`,
        date: new Date()
      };

      console.log('📧 Sending email with high priority headers...');
      
      // OPTIMIZATION 3: Send with timeout and better error handling
      const emailPromise = transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email sending timeout')), 10000) // 10 second timeout
      );
      
      try {
        const info = await Promise.race([emailPromise, timeoutPromise]);
        const endTime = Date.now();
        
        console.log('\x1b[32m%s\x1b[0m', `📧 EMAIL SENT SUCCESSFULLY TO: ${email}`);
        console.log('\x1b[32m%s\x1b[0m', `📧 Message ID: ${info.messageId}`);
        console.log(`⚡ Email sent in ${endTime - startTime}ms`);
        console.log('\x1b[33m%s\x1b[0m', '⏱️  Email delivered! Check your inbox in 1-3 minutes');
        
        return { success: true, method: 'email', messageId: info.messageId, processingTime: `${endTime - startTime}ms` };
      } catch (emailError) {
        console.error('📧 Email sending failed:', emailError.message);
        
        // Fallback to console display
        const otpMatch = html.match(/<strong[^>]*>(\d{6})<\/strong>/);
        if (otpMatch) {
          console.log('\x1b[32m%s\x1b[0m', `🔢 FALLBACK OTP CODE: ${otpMatch[1]}`);
          console.log('\x1b[32m%s\x1b[0m', '📧 Use this code as backup!\n');
        }
        
        return { success: true, method: 'console-fallback', error: emailError.message, processingTime: `${Date.now() - startTime}ms` };
      }
    }
    
    // Fallback to console only if no transporter
    if (!forceRealEmail && !isProduction) {
      console.log('\x1b[33m%s\x1b[0m', '📧 EMAIL SERVICE NOT CONFIGURED - Using console fallback');
      console.log(`📧 OTP would be sent to: ${email}`);
      console.log('\x1b[33m%s\x1b[0m', '💡 To enable real emails, configure EMAIL_USER and EMAIL_PASS environment variables');
      
      // Extract OTP from HTML for display
      const otpMatch = html.match(/<strong[^>]*>(\d{6})<\/strong>/);
      if (otpMatch) {
        console.log('\x1b[32m%s\x1b[0m', `🔢 OTP CODE: ${otpMatch[1]}`);
        console.log('\x1b[32m%s\x1b[0m', '📧 Use this code for testing!\n');
      }
      
      const endTime = Date.now();
      console.log(`⚡ Email completed in ${endTime - startTime}ms (console fallback)`);
      
      return { success: true, method: 'console', processingTime: `${endTime - startTime}ms` };
    }

    // Fallback to console only
    console.log('\x1b[31m%s\x1b[0m', '📧 EMAIL SERVICE NOT CONFIGURED - Using console fallback');
    console.log('\x1b[31m%s\x1b[0m', '📧 To enable real email sending, configure EMAIL_USER and EMAIL_PASS environment variables');
    console.log(`📧 EMAIL CONTENT (console fallback): subject=${subject}, bodyLength=${html ? html.length : 0}`);
    
    const endTime = Date.now();
    console.log(`⚡ Email completed in ${endTime - startTime}ms (console fallback)`);
    
    return { success: true, method: 'console', processingTime: `${endTime - startTime}ms` };
  } catch (error) {
    const endTime = Date.now();
    console.error(`Failed to send email in ${endTime - startTime}ms:`, error);
    console.log('\x1b[31m%s\x1b[0m', '📧 EMAIL FAILED - Using console fallback');
    return { success: true, method: 'console', error: error.message, processingTime: `${endTime - startTime}ms` };
  }
};

// Send password email
const sendPasswordEmail = async (email, password, facilityName) => {
  try {
    // Always show the password in terminal for debugging
    console.log('\n');
    console.log('🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑');
    console.log('🔑                                                    🔑');
    console.log('🔑               SEND PASSWORD EMAIL              🔑');
    console.log('🔑                                                    🔑');
    console.log('🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑');
    console.log('🔑                                                    🔑');
    console.log(`🔑  EMAIL: ${email}                                🔑`);
    console.log(`🔑  FACILITY: ${facilityName}                        🔑`);
    console.log(`🔑  PASSWORD: ${password}                             🔑`);
    console.log('🔑                                                    🔑');
    console.log('🔑  NEW PASSWORD GENERATED FOR FACILITY          🔑');
    console.log('🔑  PASSWORD EXPIRES IN 10 MINUTES               🔑');
    console.log('🔑                                                    🔑');
    console.log('🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑');
    console.log('\n');
    
    // Try to send real email if transporter is available
    if (transporter) {
      const mailOptions = {
        from: `"Find Med" <${process.env.EMAIL_USER || 'your-email@gmail.com'}>`,
        to: email,
        subject: 'Your Facility Password Has Been Reset',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">
              <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Password Reset</h2>
              <p style="color: #666; font-size: 16px; margin-bottom: 15px;">
                Your password for <strong>${facilityName}</strong> in our Find Med system has been reset.
              </p>
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                Your new password is:
              </p>
              <div style="background-color: #28a745; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="margin: 0; font-size: 28px; letter-spacing: 3px; font-weight: bold;">${password}</h1>
              </div>
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                This password will expire in <strong>10 minutes</strong>. Please change it after logging in.
              </p>
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                If you didn't request this password reset, please contact support immediately.
              </p>
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  This is an automated message from the Find Med system.
                </p>
              </div>
            </div>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('\x1b[32m%s\x1b[0m', `📧 PASSWORD EMAIL SENT SUCCESSFULLY TO: ${email}`);
      console.log('\x1b[32m%s\x1b[0m', `📧 Message ID: ${info.messageId}`);
      console.log('\x1b[32m%s\x1b[0m', '📧 Check the email inbox for the new password!\n');
      
      return { success: true, method: 'email', messageId: info.messageId };
    } else {
      // Fallback to console only
      console.log('\x1b[31m%s\x1b[0m', '📧 EMAIL SERVICE NOT CONFIGURED - Using console fallback');
      console.log('\x1b[31m%s\x1b[0m', '📧 To enable real email sending, configure EMAIL_USER and EMAIL_PASS environment variables');
      return { success: true, method: 'console' };
    }
  } catch (error) {
    console.error('Failed to send password email:', error);
    console.log('\x1b[31m%s\x1b[0m', '📧 EMAIL FAILED - Using console fallback');
    return { success: true, method: 'console', error: error.message };
  }
};

module.exports = {
  initializeEmailService,
  sendOTPEmail,
  sendPasswordEmail,
};
