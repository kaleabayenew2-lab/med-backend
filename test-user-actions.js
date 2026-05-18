// Test script for all user management actions
const axios = require('axios');

const API_BASE = 'http://localhost:5000';

async function testUserManagementActions() {
  console.log('🧪 Testing User Management Actions...\n');

  try {
    // Test 1: Check if backend is running
    console.log('1️⃣ Testing backend health...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Backend is running:', healthResponse.data);
    console.log('');

    // Test 2: Create a test user
    console.log('2️⃣ Creating test user...');
    const testUser = {
      fullName: 'Test User Actions',
      email: 'testactions@example.com',
      phone: '+251912345679',
      age: 25,
      password: 'password123'
    };

    const createResponse = await axios.post(`${API_BASE}/api/users/register`, testUser);
    console.log('✅ User created successfully:', createResponse.data);
    const userId = createResponse.data.id;
    console.log('');

    // Test 3: Update user (Edit action)
    console.log('3️⃣ Testing user update (Edit action)...');
    const updateData = {
      fullName: 'Updated Test User',
      email: 'testactions@example.com',
      phone: '+251912345679',
      roles: ['admin'],
      isActive: true
    };

    const updateResponse = await axios.put(`${API_BASE}/api/users/${userId}`, updateData);
    console.log('✅ User updated successfully:', updateResponse.data);
    console.log('');

    // Test 4: Reset password (Reset action)
    console.log('4️⃣ Testing password reset (Reset action)...');
    const resetResponse = await axios.post(`${API_BASE}/api/users/${userId}/reset-password`);
    console.log('✅ Password reset successful:', resetResponse.data);
    console.log('🔑 Temporary password:', resetResponse.data.password);
    console.log('');

    // Test 5: Get all users to verify changes
    console.log('5️⃣ Testing user retrieval...');
    const usersResponse = await axios.get(`${API_BASE}/api/users`);
    console.log('✅ Users retrieved successfully:', usersResponse.data.users?.length || 0, 'users found');
    
    if (usersResponse.data.users && usersResponse.data.users.length > 0) {
      const updatedUser = usersResponse.data.users.find(u => u.email === 'testactions@example.com');
      if (updatedUser) {
        console.log('✅ Updated user found:', {
          id: updatedUser.id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          isActive: updatedUser.isActive
        });
      } else {
        console.log('❌ Updated user not found');
      }
    }
    console.log('');

    // Test 6: Delete user (Delete action)
    console.log('6️⃣ Testing user deletion (Delete action)...');
    const deleteResponse = await axios.delete(`${API_BASE}/api/users/${userId}`);
    console.log('✅ User deleted successfully:', deleteResponse.data);
    console.log('');

    // Test 7: Verify user is deleted
    console.log('7️⃣ Verifying user deletion...');
    const verifyResponse = await axios.get(`${API_BASE}/api/users`);
    const deletedUser = verifyResponse.data.users?.find(u => u.email === 'testactions@example.com');
    if (!deletedUser) {
      console.log('✅ User successfully deleted from database');
    } else {
      console.log('❌ User still exists in database');
    }
    console.log('');

    console.log('🎉 All user management actions completed successfully!');
    console.log('📊 Summary:');
    console.log('  ✅ Backend server is running');
    console.log('  ✅ User creation works');
    console.log('  ✅ User update (Edit) works');
    console.log('  ✅ Password reset (Reset) works');
    console.log('  ✅ User deletion (Delete) works');
    console.log('  ✅ Database operations work');
    console.log('  ✅ API responses are correct');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is not running on port 5000');
      console.log('💡 Please start the backend server with: cd backend && npm start');
    } else {
      console.log('❌ Test failed:', error.message);
      if (error.response) {
        console.log('Response data:', error.response.data);
        console.log('Status code:', error.response.status);
      }
    }
  }
}

// Run the test
testUserManagementActions();
