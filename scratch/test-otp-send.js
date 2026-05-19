const axios = require('axios');

async function testOtpSend() {
  console.log('Sending OTP request to backend...');
  try {
    const res = await axios.post('http://localhost:5000/api/otp/send-registration', {
      email: 'kaleabayenew12@gmail.com'
    });
    console.log('Response from API:');
    console.log(res.data);
  } catch (error) {
    console.error('Error hitting registration OTP endpoint:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testOtpSend();
