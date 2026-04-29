/**
 * i18n gap checker — DEEP version
 * Recursively checks ALL nesting levels, not just top-level sections.
 *
 * Verifies:
 * 1. Every key path in en.json exists in every other locale (at any depth)
 * 2. No locale has empty string values for keys that have content in en
 * 3. Reports extra keys in non-en locales
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

// Deep key extraction: returns flat array like ['pay.title', 'pay.deposit.amount']
function flatKeys(obj, prefix) {
    let keys = [];
    for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            keys = keys.concat(flatKeys(v, full));
        } else {
            keys.push(full);
        }
    }
    return keys;
}

// Resolve a dot-path key in an object
function getNestedValue(obj, keyPath) {
    const parts = keyPath.split('.');
    let val = obj;
    for (const p of parts) {
        if (val === undefined || val === null) return undefined;
        val = val[p];
    }
    return val;
}

const enKeys = flatKeys(messages.en, '');
let totalMissing = 0;
let totalEmpty = 0;

console.log('=== i18n Deep Gap Analysis ===');
console.log(`Reference: en.json — ${enKeys.length} keys (all nesting levels)\n`);

// Check every en key against all other locales
for (const locale of locales) {
    if (locale === 'en') continue;
    const localeKeys = new Set(flatKeys(messages[locale], ''));

    for (const key of enKeys) {
        if (!localeKeys.has(key)) {
            console.log(`❌ [MISSING] ${locale}: ${key}`);
            totalMissing++;
        } else {
            const val = getNestedValue(messages[locale], key);
            if (typeof val === 'string' && val.trim() === '') {
                console.log(`⚠️  [EMPTY]  ${locale}: ${key}`);
                totalEmpty++;
            }
        }
    }
}

// Check for extra keys in non-en locales
console.log('\n--- Extra keys (in locale but not in en.json) ---');
const enKeySet = new Set(enKeys);
let extraKeys = 0;
for (const locale of locales) {
    if (locale === 'en') continue;
    const localeKeys = flatKeys(messages[locale], '');
    for (const key of localeKeys) {
        if (!enKeySet.has(key)) extraKeys++;
    }
}
console.log(extraKeys > 0 ? `   ${extraKeys} extra keys (harmless, locale-specific)` : '   None found.');

// Summary
console.log('\n=== Summary ===');
console.log(`Total en keys:   ${enKeys.length}`);
console.log(`Total checked:   ${enKeys.length * (locales.length - 1)} (${enKeys.length} keys × ${locales.length - 1} locales)`);
console.log(`Missing keys:    ${totalMissing}`);
console.log(`Empty values:    ${totalEmpty}`);
console.log(`Extra keys:      ${extraKeys}`);

if (totalMissing === 0 && totalEmpty === 0) {
    console.log('\n✅ ZERO GAPS — 100% translation parity!');
} else {
    console.log(`\n❌ Found ${totalMissing} missing keys and ${totalEmpty} empty values.`);
    process.exit(1);
}
