const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runTest() {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  console.log('Testing pooled SMTP connection with credentials from .env:');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 5000,
    greetingTimeout: 3000,
    socketTimeout: 10000,
  });

  try {
    console.log('Verifying pooled connection transport...');
    await transporter.verify();
    console.log('✅ Success! Pooled SMTP transporter verified successfully.');
    transporter.close();
  } catch (error) {
    console.error('❌ Pooled SMTP Test Failed:', error);
  }
}

runTest();
