const nodemailer = require('nodemailer');
const dns = require('dns');

// Force IPv4 preference globally when supported
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {
  // ignore if not supported
}

let transporter = null;
let sendGridClientLoaded = null;

function loadSendGridClient() {
  if (sendGridClientLoaded !== null) return sendGridClientLoaded;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    sendGridClientLoaded = false;
    return false;
  }

  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(apiKey);
    sendGridClientLoaded = sgMail;
    console.log('📧 SendGrid client loaded');
    return sgMail;
  } catch (err) {
    console.warn('⚠️ SendGrid client not available:', err && err.message ? err.message : err);
    sendGridClientLoaded = false;
    return false;
  }
}

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

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
    pool: true,
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { family: 4 }, callback);
    },
  });

  transporter.verify().then(() => {
    console.log('📧 Nodemailer transporter verified');
  }).catch((err) => {
    console.warn('⚠️ Nodemailer verify warning:', err && err.message ? err.message : err);
  });

  return transporter;
}

async function sendViaSendGrid(to, subject, htmlContent) {
  const sgMail = loadSendGridClient();
  if (!sgMail) {
    return { success: false, error: 'SendGrid unavailable' };
  }

  try {
    const msg = {
      to,
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      subject,
      html: htmlContent,
    };

    const response = await sgMail.send(msg);
    const messageId = Array.isArray(response) && response[0] && response[0].headers ? response[0].headers['x-message-id'] : null;
    console.log('✅ Email sent via SendGrid:', messageId || 'sent');
    return { success: true, method: 'sendgrid', messageId };
  } catch (error) {
    console.error('❌ SendGrid send failed:', error && error.message ? error.message : error);
    return { success: false, error: error && error.message ? error.message : String(error) };
  }
}

// Send email function
async function sendEmail(to, subject, htmlContent) {
  try {
    const sgMail = loadSendGridClient();
    if (sgMail) {
      const sendgridResult = await sendViaSendGrid(to, subject, htmlContent);
      if (sendgridResult.success) {
        return sendgridResult;
      }
      console.warn('⚠️ SendGrid fallback to SMTP due to error:', sendgridResult.error);
    }

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

    const fallbackOtp = Math.floor(100000 + Math.random() * 900000).toString();
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
