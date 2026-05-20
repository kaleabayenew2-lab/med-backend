const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Get IPv4 for smtp.gmail.com
dns.lookup('smtp.gmail.com', { family: 4 }, (err, address) => {
  if (err) {
    console.error('Failed to resolve smtp.gmail.com');
    process.exit(1);
  }
  
  console.log(`Resolved smtp.gmail.com to IPv4: ${address}`);

  const utilsPath = path.join(__dirname, 'src', 'utils', 'emailService.js');
  const servicesPath = path.join(__dirname, 'src', 'services', 'emailService.js');

  const fixFile = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Replace host: 'smtp.gmail.com' with the resolved IP
    // and add tls: { servername: 'smtp.gmail.com' } to prevent cert errors
    
    // We'll replace the whole createTransport block to be safe
    // Instead of complex regex, let's just do string replacement
    
    // Regex to match host: 'smtp.gmail.com'
    code = code.replace(/host:\s*['"]smtp\.gmail\.com['"]/g, `host: '${address}',\n      tls: { servername: 'smtp.gmail.com', rejectUnauthorized: false }`);
    
    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`Fixed ${filePath}`);
  };

  fixFile(utilsPath);
  fixFile(servicesPath);
});
