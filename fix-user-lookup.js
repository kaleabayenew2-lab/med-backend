const { db } = require('./src/config/db');
const { encrypt, decrypt } = require('./src/utils/encryption');
const bcrypt = require('bcryptjs');

async function fixUserLookup() {
  try {
    console.log('🔍 Fixing user lookup for kaleabayenew2@gmail.com');
    
    // Get all users and find the one with the right email
    const allUsers = await db('users').select('*');
    let targetUser = null;
    
    for (const user of allUsers) {
      const decryptedEmail = user.email ? decrypt(user.email) : 'NULL';
      if (decryptedEmail === 'kaleabayenew2@gmail.com') {
        targetUser = user;
        break;
      }
    }
    
    if (targetUser) {
      console.log('✅ Found user in database!');
      console.log('👤 User ID: ' + targetUser.id);
      console.log('📧 Email: ' + decrypt(targetUser.email));
      console.log('👤 Name: ' + targetUser.fullName);
      console.log('🔑 Password hash: ' + targetUser.passwordHash);
      
      // Test password verification
      const testPassword = 'Kale@1513';
      const passwordMatch = await bcrypt.compare(testPassword, targetUser.passwordHash || '');
      console.log('🔍 Password test: ' + testPassword);
      console.log('🔍 Password match: ' + passwordMatch);
      
      if (passwordMatch) {
        console.log('✅ Password is correct! User should be able to login.');
      } else {
        console.log('❌ Password does not match.');
      }
    } else {
      console.log('❌ User not found in database');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixUserLookup();
