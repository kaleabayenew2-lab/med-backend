const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sendEmailOTP } = require('../src/utils/emailService');

async function runTest() {
  const emailUser = process.env.EMAIL_USER;
  console.log('Testing sendEmailOTP from src/utils/emailService.js to', emailUser);
  
  const result = await sendEmailOTP(emailUser, '987654', 'login');
  console.log('Result:', result);
}

runTest();
