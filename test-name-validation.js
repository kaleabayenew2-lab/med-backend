// Test script to verify name validation fix
const { connectToDatabase, initializeDatabase } = require('./src/database/connection');

async function testNameValidation() {
  try {
    console.log('🧪 Testing name validation fix...\n');
    
    // Connect to database
    const db = connectToDatabase();
    initializeDatabase();
    
    console.log('📋 Current facilities in database:');
    const allFacilities = db.prepare('SELECT name, type FROM facilities').all();
    allFacilities.forEach(facility => {
      console.log(`  - ${facility.name} (${facility.type})`);
    });
    
    console.log('\n🔍 Testing name uniqueness validation:');
    
    // Test cases
    const testCases = [
      { name: 'kaleab', type: 'hospital', expected: true, description: 'Exact match with existing "kaleab"' },
      { name: 'kaleab1', type: 'hospital', expected: false, description: 'Different name "kaleab1" should be unique' },
      { name: 'KALEAB', type: 'hospital', expected: true, description: 'Case-insensitive match' },
      { name: 'kaleab hospital', type: 'hospital', expected: false, description: 'Different name should be unique' },
      { name: 'kaleab', type: 'pharmacy', expected: false, description: 'Same name but different type should be unique' },
      { name: 'test hospital', type: 'hospital', expected: false, description: 'Completely new name should be unique' },
      { name: 'kaleab ', type: 'hospital', expected: true, description: 'Name with trailing space should match' },
      { name: ' kaleab', type: 'hospital', expected: true, description: 'Name with leading space should match' }
    ];
    
    for (const testCase of testCases) {
      const result = db.prepare('SELECT id FROM facilities WHERE LOWER(name) = LOWER(?) AND type = ?').get([testCase.name.trim(), testCase.type]);
      const exists = !!result;
      const passed = exists === testCase.expected;
      
      console.log(`\n${passed ? '✅' : '❌'} ${testCase.description}`);
      console.log(`   Input: "${testCase.name}" (${testCase.type})`);
      console.log(`   Expected: ${testCase.expected ? 'Exists' : 'Unique'}`);
      console.log(`   Actual: ${exists ? 'Exists' : 'Unique'}`);
      console.log(`   Result: ${passed ? 'PASS' : 'FAIL'}`);
    }
    
    console.log('\n✅ Name validation test complete');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testNameValidation().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
