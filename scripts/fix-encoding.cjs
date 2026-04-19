// Fix all remaining mojibake in en.json
// The file has been double-corrupted: UTF-8 → Latin-1 → Windows-1252
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'messages', 'en.json');
let text = fs.readFileSync(filePath, 'utf8');

// Remove BOM if present
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

// These are the actual byte sequences found in the file (from hex dump)
const fixes = [
    // U+00E2 U+20AC U+00A6 → … (ellipsis U+2026)
    { bad: '\u00E2\u20AC\u00A6', good: '\u2026', label: 'ellipsis' },
    // U+00E2 U+2020 U+2019 → → (right arrow U+2192)
    { bad: '\u00E2\u2020\u2019', good: '\u2192', label: 'right arrow' },
    // U+00E2 U+2020 U+0090 → ← (left arrow U+2190)
    { bad: '\u00E2\u2020\u0090', good: '\u2190', label: 'left arrow' },
    // U+00F0 U+0178 U+017D U+2030 → 🎉 (party popper U+1F389)
    { bad: '\u00F0\u0178\u017D\u2030', good: '🎉', label: 'party popper' },
    // U+00F0 U+0178 U+201C U+00A8 → 📨 (envelope U+1F4E8)
    { bad: '\u00F0\u0178\u201C\u00A8', good: '📨', label: 'envelope' },
    // U+00E2 U+0161 U+2122 → ⚙ (gear U+2699)
    { bad: '\u00E2\u0161\u2122', good: '\u2699', label: 'gear' },
    // U+00E2 U+0153 U+2026 → ✅ (check U+2705)  
    { bad: '\u00E2\u0153\u2026', good: '\u2705', label: 'check mark' },
    // U+00F0 U+0178 U+017D U+00AC → 🎬 (clapper U+1F3AC)
    { bad: '\u00F0\u0178\u017D\u00AC', good: '🎬', label: 'clapper' },
    // U+00F0 U+0178 U+008F U+2020 → 🏆 (trophy U+1F3C6) — also check alternate forms
    { bad: '\u00F0\u0178\u008F\u2020', good: '🏆', label: 'trophy' },
    // U+00E2U+0080U+0094 → — (em dash)
    { bad: '\u00E2\u0080\u0094', good: '\u2014', label: 'em dash' },
    // U+00E2U+0080U+0093 → – (en dash)
    { bad: '\u00E2\u0080\u0093', good: '\u2013', label: 'en dash' },
    // U+00E2U+0080U+009C → " (left double quote)
    { bad: '\u00E2\u0080\u009C', good: '\u201C', label: 'left quote' },
    // U+00E2U+0080U+009D → " (right double quote)
    { bad: '\u00E2\u0080\u009D', good: '\u201D', label: 'right quote' },
    // Â· → · (middot) — already handled but belt-and-suspenders  
    { bad: '\u00C2\u00B7', good: '\u00B7', label: 'middot' },
];

let totalFixes = 0;
for (const { bad, good, label } of fixes) {
    let count = 0;
    while (text.includes(bad)) {
        text = text.replace(bad, good);
        count++;
    }
    if (count > 0) {
        totalFixes += count;
        console.log(`  Fixed ${count}x ${label} (${good})`);
    }
}

console.log(`\nTotal: ${totalFixes} replacements`);

// Validate
try {
    JSON.parse(text);
    console.log('✅ Valid JSON');
} catch (e) {
    console.error('❌ Invalid JSON:', e.message);
    process.exit(1);
}

fs.writeFileSync(filePath, text, 'utf8');
console.log('Saved:', filePath);

// Verify the specific lines
const lines = text.split('\n');
for (const [num, pat] of [[966, 'allCaughtUp'], [969, 'managePrefsArrow'], [974, 'feedTab']]) {
    const line = lines[num - 1];
    if (line) console.log(`Line ${num}: ${line.trim()}`);
}
