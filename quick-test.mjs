// Quick test for converter functionality
import fs from 'fs';

console.log('✅ Testing converter files...');

// Check if main files exist
const files = [
  './src/data/sample-workflow.yxmd',
  './src/components/XMLToJSONConverter.tsx'
];

files.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
    }
  } catch (error) {
    console.log(`❌ Error checking ${file}`);
  }
});

console.log('Test complete!');