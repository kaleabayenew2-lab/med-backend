const fs = require('fs');
const path = require('path');

function searchFiles(dir, keyword) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchFiles(fullPath, keyword);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(keyword)) {
        console.log(`Found "${keyword}" in: ${fullPath}`);
        // Log the lines containing the keyword
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(keyword)) {
            console.log(`  Line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

const backendSrc = path.join(__dirname, '..', 'src');
console.log('Searching in src...');
searchFiles(backendSrc, 'sendOTP');
searchFiles(backendSrc, 'sendEmailOTP');
searchFiles(backendSrc, 'sendOTPEmail');
searchFiles(backendSrc, 'emailService');
