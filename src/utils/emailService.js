const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log('📧 [Utils Email Service] Email service credentials not configured. Using console fallback mode.');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 5000, // 5 seconds
      greetingTimeout: 3000,   // 3 seconds
      socketTimeout: 10000,    // 10 seconds
      dns: {
        cacheTtl: 300, // 5 minutes cache
      }
    });
  }
  return transporter;
};

// Send OTP via email
const sendEmailOTP = async (email, otp, type = 'login') => {
  const startTime = Date.now();
  const subject = type === 'reset' ? 'Password Reset Code' : 'Login Code';
  const message = type === 'reset' 
    ? `Your FindMed password reset code is: ${otp}. It expires in 30 minutes.`
    : `Your FindMed login code is: ${otp}. It expires in 15 minutes.`;

  console.log(`\n📧 [Utils Email Service] Attempting to send OTP email`);
  console.log(`📧 EMAIL: ${email}`);
  console.log(`📧 TYPE: ${type}`);
  console.log(`🔢 OTP: ${otp}`);

  const activeTransporter = getTransporter();

  if (activeTransporter) {
    const mailOptions = {
      from: `"Find Med" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `FindMed - ${subject}`,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🔐 FindMed Security</h1>
            <p style="margin: 10px 0; font-size: 16px;">${subject}</p>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 20px 0;">
            <p style="font-size: 16px; color: #666;">${message}</p>
            <div style="background: #fff; border: 2px dashed #ddd; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
              <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="color: #999; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
        </div>
      `,
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'X-Mailer': 'FindMe-App',
        'Precedence': 'first-class'
      },
      messageId: `<${Date.now()}@findmed.app>`,
      date: new Date()
    };

    try {
      const emailPromise = activeTransporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email sending timeout')), 10000)
      );

      const info = await Promise.race([emailPromise, timeoutPromise]);
      const endTime = Date.now();
      
      console.log('\x1b[32m%s\x1b[0m', `📧 EMAIL SENT SUCCESSFULLY TO: ${email}`);
      console.log('\x1b[32m%s\x1b[0m', `📧 Message ID: ${info.messageId}`);
      console.log(`⚡ Email sent in ${endTime - startTime}ms`);
      
      return { success: true, messageId: info.messageId, processingTime: `${endTime - startTime}ms` };
    } catch (error) {
      console.error('📧 SMTP Email sending failed:', error.message);
      
      // Fallback display in console
      console.log('\x1b[32m%s\x1b[0m', `🔢 FALLBACK OTP CODE: ${otp}`);
      console.log('\x1b[32m%s\x1b[0m', '📧 Use this code as backup!\n');
      
      return { success: false, error: error.message, processingTime: `${Date.now() - startTime}ms` };
    }
  } else {
    // Console fallback
    console.log('\x1b[33m%s\x1b[0m', '📧 EMAIL SERVICE NOT CONFIGURED - Using console fallback');
    console.log(`📧 OTP would be sent to: ${email}`);
    console.log('\x1b[32m%s\x1b[0m', `🔢 OTP CODE: ${otp}`);
    
    return { success: true, method: 'console', processingTime: `${Date.now() - startTime}ms` };
  }
};

module.exports = { sendEmailOTP };
