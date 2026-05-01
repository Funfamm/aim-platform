/**
 * Replace ALL em-dashes (—) with hyphens (-) in locale JSON files.
 * Uses fs.writeFileSync with utf8 (no BOM).
 * Run: node scripts/fix-emdashes.js
 */
const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const files = fs.readdirSync(MESSAGES_DIR).filter(f => f.endsWith('.json'));

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(MESSAGES_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf8');
  const count = (raw.match(/\u2014/g) || []).length;
  
  if (count > 0) {
    const fixed = raw.replace(/\u2014/g, '-');
    fs.writeFileSync(filePath, fixed, 'utf8');
    totalFixed += count;
    console.log(`${file}: replaced ${count} em-dashes`);
  } else {
    console.log(`${file}: clean`);
  }
}

console.log(`\nTotal em-dashes replaced: ${totalFixed}`);
