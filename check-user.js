const { db } = require('./src/config/db');
const { encrypt, decrypt } = require('./src/utils/encryption');

async function checkUser() {
  try {
    console.log('🔍 Checking database for user: kaleabayenew2@gmail.com');
    
    // Check all users in database
    const allUsers = await db('users').select('*');
    console.log('📊 Total users in database: ' + allUsers.length);
    
    // Show all users (with decrypted emails)
    for (const user of allUsers) {
      const decryptedEmail = user.email ? decrypt(user.email) : 'NULL';
      console.log('👤 User ID: ' + user.id + ', Email: ' + decryptedEmail + ', Name: ' + user.fullName);
    }
    
    // Try to find the specific user
    console.log('\n🔍 Looking for kaleabayenew2@gmail.com...');
    
    // Test encryption
    const testEmail = 'kaleabayenew2@gmail.com';
    const encryptedEmail = encrypt(testEmail.toLowerCase());
    console.log('📧 Original email: ' + testEmail);
    console.log('🔐 Encrypted email: ' + encryptedEmail);
    
    // Query with encrypted email
    const foundUser = await db('users').where({ email: encryptedEmail }).first();
    if (foundUser) {
      console.log('✅ User found with encrypted email!');
      console.log('👤 User ID: ' + foundUser.id);
      console.log('📧 Email: ' + decrypt(foundUser.email));
      console.log('👤 Name: ' + foundUser.fullName);
      console.log('🔑 Password hash: ' + foundUser.passwordHash);
    } else {
      console.log('❌ User not found with encrypted email');
    }
    
    // Also test the User model method
    console.log('\n🔍 Testing User.findByEmail method...');
    const User = require('./src/models/user');
    const userModel = await User.findByEmail(testEmail.toLowerCase());
    if (userModel) {
      console.log('✅ User found via User model!');
      console.log('👤 User ID: ' + userModel.id);
      console.log('📧 Email: ' + userModel.email);
      console.log('👤 Name: ' + userModel.fullName);
    } else {
      console.log('❌ User not found via User model');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking user:', error);
    process.exit(1);
  }
}

checkUser();
