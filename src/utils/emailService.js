const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!emailUser || !emailPass) {
    console.log('📧 [Utils Email Service] Email service credentials not configured. Using console fallback mode.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 15000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
    family: 4,
  });

  transporter.verify().then(() => {
    console.log('📧 [Utils Email Service] Nodemailer transporter verified');
  }).catch((err) => {
    console.warn('⚠️ [Utils Email Service] Nodemailer verify warning:', err && err.message ? err.message : err);
    console.warn('⚠️ [Utils Email Service] Full error:', err);
  });

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

  const transporter = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  if (!transporter) {
    console.log('\x1b[33m%s\x1b[0m', '📧 EMAIL SERVICE NOT CONFIGURED - Using console fallback');
    console.log(`📧 OTP would be sent to: ${email}`);
    console.log('\x1b[32m%s\x1b[0m', `🔢 OTP CODE: ${otp}`);
    return { success: true, method: 'console', processingTime: `${Date.now() - startTime}ms` };
  }

  const mailOptions = {
    from: `"Find Med" <${fromEmail}>`,
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
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    const endTime = Date.now();
    console.log('\x1b[32m%s\x1b[0m', `📧 EMAIL SENT SUCCESSFULLY TO: ${email}`);
    console.log('\x1b[32m%s\x1b[0m', `📧 Message ID: ${info.messageId}`);
    console.log(`⚡ Email sent in ${endTime - startTime}ms`);
    return { success: true, messageId: info.messageId, processingTime: `${endTime - startTime}ms` };
  } catch (error) {
    console.error('📧 SMTP Email sending failed:', error && error.message ? error.message : error);
    console.log('\x1b[32m%s\x1b[0m', `🔢 FALLBACK OTP CODE: ${otp}`);
    console.log('\x1b[32m%s\x1b[0m', '📧 Use this code as backup!\n');
    return { success: false, error: error && error.message ? error.message : String(error), processingTime: `${Date.now() - startTime}ms` };
  }
};

module.exports = { sendEmailOTP };