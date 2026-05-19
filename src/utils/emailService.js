const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY || 're_b3RQ3hbN_M3s3aeA2NQH2n3C9HsVWf1WR';
const resend = new Resend(resendApiKey);

// Send OTP via email
const sendEmailOTP = async (email, otp, type = 'login') => {
  const startTime = Date.now();
  const subject = type === 'reset' ? 'Password Reset Code' : 'Login Code';
  const message = type === 'reset' 
    ? `Your FindMed password reset code is: ${otp}. It expires in 30 minutes.`
    : `Your FindMed login code is: ${otp}. It expires in 15 minutes.`;

  console.log(`\n📧 [Utils Email Service] Attempting to send OTP email via Resend`);
  console.log(`📧 EMAIL: ${email}`);
  console.log(`📧 TYPE: ${type}`);
  console.log(`🔢 OTP: ${otp}`);

  const html = `
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
  `;

  try {
    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: `FindMed - ${subject}`,
      text: message,
      html: html,
    });

    if (data.error) {
      throw new Error(data.error.message);
    }

    const endTime = Date.now();
    
    console.log('\x1b[32m%s\x1b[0m', `📧 EMAIL SENT SUCCESSFULLY TO: ${email}`);
    console.log('\x1b[32m%s\x1b[0m', `📧 Message ID: ${data.data ? data.data.id : ''}`);
    console.log(`⚡ Email sent in ${endTime - startTime}ms`);
    
    return { success: true, messageId: data.data ? data.data.id : null, processingTime: `${endTime - startTime}ms` };
  } catch (error) {
    console.error('📧 Resend Email sending failed:', error.message || error);
    
    // Fallback display in console
    console.log('\x1b[32m%s\x1b[0m', `🔢 FALLBACK OTP CODE: ${otp}`);
    console.log('\x1b[32m%s\x1b[0m', '📧 Use this code as backup!\n');
    
    return { success: false, error: error.message || String(error), processingTime: `${Date.now() - startTime}ms` };
  }
};

module.exports = { sendEmailOTP };
