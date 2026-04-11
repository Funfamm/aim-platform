const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'messages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let count = 0;
for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it ends with the literal characters backslash and 'n'
    if (content.endsWith('\\n')) {
        content = content.slice(0, -2);
        fs.writeFileSync(filePath, content, 'utf8');
        count++;
    } else if (content.endsWith('\\n\\n')) {
        content = content.slice(0, -4);
        fs.writeFileSync(filePath, content, 'utf8');
        count++;
    }
}
console.log(`Fixed ${count} broken JSON files.`);
