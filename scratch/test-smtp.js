const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runTest() {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  console.log('Testing SMTP connection with credentials from .env:');
  console.log(`EMAIL_USER: ${emailUser}`);
  console.log(`EMAIL_PASS: ${emailPass ? '********' : 'undefined'}`);

  if (!emailUser || !emailPass) {
    console.error('Error: EMAIL_USER or EMAIL_PASS not defined in .env!');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  try {
    console.log('Verifying connection transport...');
    await transporter.verify();
    console.log('✅ Success! SMTP transporter verified successfully.');
    
    console.log('Sending a test email to', emailUser);
    const info = await transporter.sendMail({
      from: `"Find Med Test" <${emailUser}>`,
      to: emailUser,
      subject: 'FindMed SMTP Test Email',
      text: 'This is a test email from the FindMed SMTP test script.',
      html: '<p>This is a test email from the FindMed SMTP test script.</p>',
    });
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ SMTP Test Failed:');
    console.error(error);
  }
}

runTest();
