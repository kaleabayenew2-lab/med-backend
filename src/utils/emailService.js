const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send OTP via email
const sendEmailOTP = async (email, otp, type = 'login') => {
  try {
    const subject = type === 'reset' ? 'Password Reset Code' : 'Login Code';
    const message = type === 'reset' 
      ? `Your FindMed password reset code is: ${otp}. It expires in 30 minutes.`
      : `Your FindMed login code is: ${otp}. It expires in 15 minutes.`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `FindMed - ${subject}`,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">FindMed - ${subject}</h2>
          <p style="font-size: 18px; color: #666;">${message}</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 3px;">${otp}</span>
          </div>
          <p style="color: #999; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmailOTP };
