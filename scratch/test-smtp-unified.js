// Unified SMTP testing script
require('dotenv').config();

const { sendEmailOTP } = require('../src/utils/emailService');
const { sendOTPEmail } = require('../src/services/emailService');

async function runTests() {
  console.log('🧪 Starting Unified SMTP Testing Suite...');
  console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
  console.log('🔑 EMAIL_PASS:', process.env.EMAIL_PASS ? 'configured (hidden)' : 'not configured');

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Error: EMAIL_USER and EMAIL_PASS environment variables are required.');
    process.exit(1);
  }

  const testEmail = process.env.EMAIL_USER; // Send to self

  // Test 1: utils/emailService.js
  console.log('\n--- Test 1: Testing utils/emailService (sendEmailOTP) ---');
  try {
    const res1 = await sendEmailOTP(testEmail, '123456', 'login');
    console.log('Result from utils/emailService:', res1);
    if (res1.success && res1.method !== 'console') {
      console.log('✅ Test 1 Passed: SMTP delivered via utils!');
    } else if (res1.method === 'console') {
      console.log('⚠️ Test 1 Fallback: Console fallback used (SMTP not loaded)');
    } else {
      console.log('❌ Test 1 Failed:', res1.error);
    }
  } catch (err) {
    console.error('💥 Test 1 Threw Error:', err);
  }

  // Test 2: services/emailService.js
  console.log('\n--- Test 2: Testing services/emailService (sendOTPEmail) ---');
  try {
    const subject = 'FindMe Test OTP';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Test OTP Code: <strong>654321</strong></h2>
        <p>This is a diagnostic SMTP test email.</p>
      </div>
    `;
    const res2 = await sendOTPEmail(testEmail, subject, html);
    console.log('Result from services/emailService:', res2);
    if (res2.success && res2.method !== 'console') {
      console.log('✅ Test 2 Passed: SMTP delivered via services!');
    } else if (res2.method === 'console') {
      console.log('⚠️ Test 2 Fallback: Console fallback used (SMTP not loaded)');
    } else {
      console.log('❌ Test 2 Failed:', res2.error);
    }
  } catch (err) {
    console.error('💥 Test 2 Threw Error:', err);
  }

  console.log('\n🏁 Unified SMTP Testing Finished!');
}

runTests();
