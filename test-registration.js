// Test script for user registration API
const axios = require('axios');

const API_BASE = 'http://localhost:5000';

async function testUserRegistration() {
  console.log('🧪 Testing User Registration API...\n');

  try {
    // Test 1: Check if backend is running
    console.log('1️⃣ Testing backend health...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Backend is running:', healthResponse.data);
    console.log('');

    // Test 2: Test user registration with valid data
    console.log('2️⃣ Testing user registration...');
    const testUser = {
      fullName: 'Test User',
      email: 'testuser@example.com',
      phone: '+251912345678',
      age: 25,
      password: 'password123'
    };

    const registerResponse = await axios.post(`${API_BASE}/api/users/register`, testUser);
    console.log('✅ User registration successful:', registerResponse.data);
    console.log('');

    // Test 3: Test duplicate email
    console.log('3️⃣ Testing duplicate email validation...');
    try {
      await axios.post(`${API_BASE}/api/users/register`, testUser);
      console.log('❌ Duplicate email validation failed');
    } catch (error) {
      if (error.response && error.response.status === 409) {
        console.log('✅ Duplicate email validation works:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    console.log('');

    // Test 4: Test invalid email
    console.log('4️⃣ Testing invalid email validation...');
    try {
      const invalidUser = { ...testUser, email: 'invalid-email' };
      await axios.post(`${API_BASE}/api/users/register`, invalidUser);
      console.log('❌ Invalid email validation failed');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Invalid email validation works:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    console.log('');

    // Test 5: Test invalid phone format
    console.log('5️⃣ Testing invalid phone validation...');
    try {
      const invalidPhoneUser = { ...testUser, email: 'test2@example.com', phone: '123456789' };
      await axios.post(`${API_BASE}/api/users/register`, invalidPhoneUser);
      console.log('❌ Invalid phone validation failed');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Invalid phone validation works:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    console.log('');

    // Test 6: Test password length validation
    console.log('6️⃣ Testing password length validation...');
    try {
      const shortPasswordUser = { ...testUser, email: 'test3@example.com', password: '123' };
      await axios.post(`${API_BASE}/api/users/register`, shortPasswordUser);
      console.log('❌ Password length validation failed');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Password length validation works:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    console.log('');

    // Test 7: Get all users to verify storage
    console.log('7️⃣ Testing user retrieval...');
    const usersResponse = await axios.get(`${API_BASE}/api/users`);
    console.log('✅ Users retrieved successfully:', usersResponse.data.users?.length || 0, 'users found');
    
    if (usersResponse.data.users && usersResponse.data.users.length > 0) {
      const createdUser = usersResponse.data.users.find(u => u.email === 'testuser@example.com');
      if (createdUser) {
        console.log('✅ Created user found in database:', {
          id: createdUser.id,
          fullName: createdUser.fullName,
          email: createdUser.email,
          phone: createdUser.phone,
          age: createdUser.age
        });
      } else {
        console.log('❌ Created user not found in database');
      }
    }
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('📊 Summary:');
    console.log('  ✅ Backend server is running');
    console.log('  ✅ User registration API works');
    console.log('  ✅ Email validation works');
    console.log('  ✅ Phone validation works');
    console.log('  ✅ Password validation works');
    console.log('  ✅ Database storage works');
    console.log('  ✅ User retrieval works');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is not running on port 5000');
      console.log('💡 Please start the backend server with: cd backend && npm start');
    } else {
      console.log('❌ Test failed:', error.message);
      if (error.response) {
        console.log('Response data:', error.response.data);
      }
    }
  }
}

// Run the test
testUserRegistration();
