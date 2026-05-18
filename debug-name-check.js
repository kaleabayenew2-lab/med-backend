// Debug script to check name uniqueness issue
const { connectToDatabase, initializeDatabase } = require('./src/database/connection');

async function debugNameCheck() {
  try {
    console.log('🔍 Debugging name uniqueness issue...\n');
    
    // Connect to database
    const db = connectToDatabase();
    initializeDatabase();
    
    // Check what facilities exist in database
    console.log('📋 All facilities in database:');
    const allFacilities = db.prepare('SELECT name, type FROM facilities').all();
    allFacilities.forEach(facility => {
      console.log(`  - ${facility.name} (${facility.type})`);
    });
    
    console.log('\n🧪 Testing name uniqueness queries:');
    
    // Test query for "kaleab hospital"
    console.log('\n1. Testing "kaleab hospital":');
    const test1 = db.prepare('SELECT id, name, type FROM facilities WHERE LOWER(name) = LOWER(?)').get(['kaleab hospital']);
    console.log(`   Result: ${test1 ? `Found - ${test1.name} (${test1.type})` : 'Not found'}`);
    
    // Test query for "kaleab1"
    console.log('\n2. Testing "kaleab1":');
    const test2 = db.prepare('SELECT id, name, type FROM facilities WHERE LOWER(name) = LOWER(?)').get(['kaleab1']);
    console.log(`   Result: ${test2 ? `Found - ${test2.name} (${test2.type})` : 'Not found'}`);
    
    // Test query for "kaleab1" with type filter
    console.log('\n3. Testing "kaleab1" with type "hospital":');
    const test3 = db.prepare('SELECT id, name, type FROM facilities WHERE LOWER(name) = LOWER(?) AND type = ?').get(['kaleab1', 'hospital']);
    console.log(`   Result: ${test3 ? `Found - ${test3.name} (${test3.type})` : 'Not found'}`);
    
    // Test LIKE query (to see if there's a LIKE issue)
    console.log('\n4. Testing LIKE query for "kaleab%":');
    const test4 = db.prepare('SELECT id, name, type FROM facilities WHERE LOWER(name) LIKE LOWER(?)').all(['kaleab%']);
    console.log(`   Results: ${test4.length} found`);
    test4.forEach(facility => {
      console.log(`     - ${facility.name} (${facility.type})`);
    });
    
    console.log('\n✅ Debug complete');
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Run the debug
debugNameCheck().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});
