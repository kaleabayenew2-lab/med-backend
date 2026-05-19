const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY || 're_b3RQ3hbN_M3s3aeA2NQH2n3C9HsVWf1WR';
const resend = new Resend(resendApiKey);

// Dummy createTransporter for backwards compatibility in case something calls it
function createTransporter() {
  return true;
}

// Send email function
async function sendEmail(to, subject, htmlContent) {
  try {
    console.log('📧 Attempting to send email via Resend API...');
    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to,
      subject,
      html: htmlContent,
    });

    if (data.error) {
      throw new Error(data.error.message);
    }

    console.log('✅ Email sent via Resend:', data.data ? data.data.id : data);
    return { success: true, method: 'resend', messageId: data.data ? data.data.id : null };
  } catch (error) {
    console.error('❌ Email failed:', error.message || error);
    
    const otpMatch = htmlContent && htmlContent.match(/(\d{6})/);
    const fallbackOtp = otpMatch ? otpMatch[1] : (Math.floor(100000 + Math.random() * 900000)).toString();
    console.log('🔢 FALLBACK OTP:', fallbackOtp);

    return {
      success: false,
      error: error.message || String(error),
      fallbackOtp,
    };
  }
}

// Helper wrappers used by other modules
async function sendOTPEmail(email, subject, html) {
  return await sendEmail(email, subject, html);
}

async function sendPasswordEmail(email, password, facilityName) {
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">
          <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Password Reset</h2>
          <p>Your password for <strong>${facilityName}</strong> has been reset.</p>
          <p><strong>New password:</strong> ${password}</p>
        </div>
      </div>
    `;

  return await sendEmail(email, 'Your Facility Password Has Been Reset', html);
}

module.exports = {
  createTransporter,
  sendEmail,
  sendOTPEmail,
  sendPasswordEmail,
};
