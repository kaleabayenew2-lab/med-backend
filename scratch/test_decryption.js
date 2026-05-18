const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'please_change_this_to_a_secure_key';
const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

function decrypt(data) {
  if (data == null || data === '') return data;
  let current = data;
  let decryptedCount = 0;
  while (true) {
    if (typeof current !== 'string') break;
    const parts = current.split(':');
    if (parts.length !== 3) break; // not encrypted
    const [ivHex, tagHex, encrypted] = parts;
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(ivHex) || !hexRegex.test(tagHex) || !hexRegex.test(encrypted)) {
      break; 
    }
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(tag);
      let dec = decipher.update(encrypted, 'hex', 'utf8');
      dec += decipher.final('utf8');
      current = dec;
      decryptedCount++;
      if (decryptedCount > 5) break; // prevent infinite loops
    } catch(e) {
      break;
    }
  }
  return current;
}

const rawEmail = 'c4aa91e2717f0a04c8a876c1:125e142244ca2c98001d0afe9e5f27b0:d4971ae1def42f76eec15f5191ae1cb007d7f37d4ec618d4cc8052e38afd9ed2ff3380e4940cbe34577e0e58ef37066bef482890b2d87d4637ff50f42e9622d64ddfeaf20968e3bb6411cd53f4a3098b8742e2fd80e8dc19400d95b754ad9b1e8c0f86f3';
console.log('Decrypted Email:', decrypt(rawEmail));

const rawPhone = 'a70f493c2233a708d6734337:68d50971f7b2ba5ecb1b1c4cbaafdf37:8eb011efd5b8a8a6405ce65c96f4b380478a1e2a7a4dcacffae122842b288835bce5839e8559bffe6bc0cd5745856b31f9df43ef55c6bc1eb9c5c247e45e9abe9d3a1f2f72340d307751db7e926325e950770bae';
console.log('Decrypted Phone:', decrypt(rawPhone));
