const nodemailer = require('nodemailer');

let transporter = null;

function createTransporter() {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!emailUser || !emailPass) {
    console.log('📧 EMAIL_USER/EMAIL_PASS not set — SMTP disabled');
    transporter = null;
    return null;
  }

  console.log('📧 Creating SMTP transporter with host:', host);
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

  transporter.verify()
    .then(() => console.log('📧 Nodemailer transporter verified'))
    .catch((err) => {
      console.warn('⚠️ Nodemailer verify warning:', err && err.message ? err.message : err);
      console.warn('⚠️ Full error:', err);
    });

  return transporter;
}

async function sendEmail(to, subject, htmlContent) {
  const startTime = Date.now();
  const transport = createTransporter();
  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  if (!transport) {
    console.log('\n📧 EMAIL SERVICE NOT CONFIGURED - Console fallback');
    console.log('📧 To:', to);
    console.log('📧 Subject:', subject);
    console.log('📧 Body length:', htmlContent ? htmlContent.length : 0);
    const otpMatch = htmlContent && htmlContent.match(/(\d{6})/);
    const fallbackOtp = otpMatch ? otpMatch[1] : (Math.floor(100000 + Math.random() * 900000)).toString();
    console.log('🔢 FALLBACK OTP:', fallbackOtp);
    return { success: true, method: 'console', fallbackOtp };
  }

  try {
    const info = await transport.sendMail({
      from: `"Find Med" <${fromEmail}>`,
      to,
      subject,
      text: htmlContent.replace(/<[^>]+>/g, ''),
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
  } finally {
    console.log(`⚡ Email processing time: ${Date.now() - startTime}ms`);
  }
}

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
