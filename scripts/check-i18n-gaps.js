/**
 * i18n gap checker — verifies:
 * 1. All locale files have the same top-level sections as en.json
 * 2. Every key in en.json exists in every other locale
 * 3. No locale has empty string values
 */
const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const locales = ['en', 'es', 'fr', 'de', 'pt', 'ar', 'zh', 'hi', 'ja', 'ko', 'ru'];

// Load all locale files
const messages = {};
for (const locale of locales) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    messages[locale] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

const en = messages.en;
let totalGaps = 0;
let totalEmpty = 0;

console.log('=== i18n Gap Analysis ===\n');

// Check each section + key in en.json against all other locales
for (const [section, keys] of Object.entries(en)) {
    if (typeof keys !== 'object' || keys === null) continue;

    for (const locale of locales) {
        if (locale === 'en') continue;

        if (!messages[locale][section]) {
            console.log(`❌ [MISSING SECTION] ${locale}: "${section}" — entire section missing`);
            totalGaps += Object.keys(keys).length;
            continue;
        }

        for (const key of Object.keys(keys)) {
            if (typeof keys[key] !== 'string') continue; // skip nested objects
            
            if (!messages[locale][section][key]) {
                console.log(`❌ [MISSING KEY] ${locale}: ${section}.${key}`);
                totalGaps++;
            } else if (messages[locale][section][key].trim() === '') {
                console.log(`⚠️  [EMPTY VALUE] ${locale}: ${section}.${key}`);
                totalEmpty++;
            }
        }
    }
}

// Check for extra keys in non-en locales that don't exist in en
console.log('\n--- Extra keys in non-en locales (not in en.json) ---');
let extraKeys = 0;
for (const locale of locales) {
    if (locale === 'en') continue;
    for (const [section, keys] of Object.entries(messages[locale])) {
        if (typeof keys !== 'object' || keys === null) continue;
        if (!en[section]) {
            console.log(`⚠️  [EXTRA SECTION] ${locale}: "${section}" — not in en.json`);
            continue;
        }
        for (const key of Object.keys(keys)) {
            if (typeof keys[key] !== 'string') continue;
            if (!en[section][key]) {
                // Don't flag — just count
                extraKeys++;
            }
        }
    }
}
if (extraKeys === 0) console.log('   None found.');

console.log('\n=== Summary ===');
console.log(`Missing keys: ${totalGaps}`);
console.log(`Empty values: ${totalEmpty}`);
console.log(`Extra keys (non-en only): ${extraKeys}`);

if (totalGaps === 0 && totalEmpty === 0) {
    console.log('\n✅ All locales are in sync with en.json — no gaps!');
} else {
    console.log(`\n⚠️  Found ${totalGaps} missing keys and ${totalEmpty} empty values.`);
}
