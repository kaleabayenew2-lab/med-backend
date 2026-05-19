const nodemailer = require('nodemailer');
const dns = require('dns');

// Force IPv4 only globally
dns.setDefaultResultOrder('ipv4first');

let transporter = null;

// Create transporter once (lazy-init)
function createTransporter() {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log('📧 EMAIL_USER/EMAIL_PASS not set — SMTP disabled');
    transporter = null;
    return null;
  }

  console.log('📧 Creating Gmail transporter with user:', emailUser);

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: 30000,
    socketTimeout: 30000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    tls: {
      rejectUnauthorized: false,
    },
    family: 4,
    dns: {
      family: 4,
    },
  });

  transporter.verify().then(() => {
    console.log('📧 Nodemailer transporter verified');
  }).catch((err) => {
    console.warn('⚠️ Nodemailer verify warning:', err && err.message ? err.message : err);
    console.warn('⚠️ Full error:', err);
  });

  return transporter;
}

// Send email function
async function sendEmail(to, subject, htmlContent) {
  try {
    const tr = createTransporter();

    if (!tr) {
      console.log('\n📧 EMAIL SERVICE NOT CONFIGURED - Console fallback');
      console.log('📧 To:', to);
      console.log('📧 Subject:', subject);
      console.log('📧 Body length:', htmlContent ? htmlContent.length : 0);
      const otpMatch = htmlContent && htmlContent.match(/(\d{6})/);
      const fallbackOtp = otpMatch ? otpMatch[1] : (Math.floor(100000 + Math.random() * 900000)).toString();
      console.log('🔢 FALLBACK OTP:', fallbackOtp);
      return { success: true, method: 'console', fallbackOtp };
    }

    console.log('📧 Attempting to send email via SMTP...');
    const info = await tr.sendMail({
      from: `"Find Me" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log('✅ Email sent:', info && info.messageId ? info.messageId : info);
    return { success: true, method: 'smtp', messageId: info.messageId };
  } catch (error) {
    const errorInfo = error && (error.code || error.message) ? (error.code || error.message) : String(error);
    console.error('❌ Email failed:', errorInfo);
    console.error('❌ Full error details:', error);

    const otpMatch = htmlContent && htmlContent.match(/(\d{6})/);
    const fallbackOtp = otpMatch ? otpMatch[1] : (Math.floor(100000 + Math.random() * 900000)).toString();
    console.log('🔢 FALLBACK OTP:', fallbackOtp);

    return {
      success: false,
      error: errorInfo,
      fallbackOtp,
    };
  }
}

// Helper wrappers used by other modules
async function sendOTPEmail(email, subject, html) {
  return await sendEmail(email, subject, html);
}

async function sendPasswordEmail(email, password, facilityName) {
  const html = `\n      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">\n        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">\n          <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Password Reset</h2>\n          <p>Your password for <strong>${facilityName}</strong> has been reset.</p>\n          <p><strong>New password:</strong> ${password}</p>\n        </div>\n      </div>\n    `;

  return await sendEmail(email, 'Your Facility Password Has Been Reset', html);
}

module.exports = {
  createTransporter,
  sendEmail,
  sendOTPEmail,
  sendPasswordEmail,
};
