const db = require('../src/config/db');
const { decrypt } = require('../src/utils/encryption');

async function inspect() {
  try {
    const facilities = await db('facilities').select('id', 'name', 'email', 'phone');
    console.log('--- Database Inspection ---');
    for (const f of facilities) {
      let decEmail = 'error';
      let decPhone = 'error';
      try { decEmail = decrypt(f.email); } catch(e) { decEmail = `fail: ${e.message}`; }
      try { decPhone = decrypt(f.phone); } catch(e) { decPhone = `fail: ${e.message}`; }
      console.log(`ID: ${f.id} | Name: ${f.name}`);
      console.log(`  Raw Email: ${f.email}`);
      console.log(`  Dec Email: ${decEmail}`);
      console.log(`  Raw Phone: ${f.phone}`);
      console.log(`  Dec Phone: ${decPhone}`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

inspect();
