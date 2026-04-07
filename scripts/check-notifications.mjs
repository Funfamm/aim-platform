import { readFileSync } from 'fs';

// Extract all t('...') keys used in the notifications page
const src = readFileSync('./src/app/[locale]/notifications/page.tsx', 'utf8');
const matches = [...src.matchAll(/t\('([^']+)'\)/g)].map(m => m[1]);
const unique = [...new Set(matches)].sort();

console.log(`NotificationsPage keys used (${unique.length}):`);
unique.forEach(k => console.log(`  ${k}`));
console.log('');

const locales = ['ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh'];

let allGood = true;
for (const loc of locales) {
  const raw = readFileSync(`./messages/${loc}.json`);
  const msg = JSON.parse(raw.toString('utf8'));
  const section = msg.NotificationsPage || {};
  const missing = unique.filter(k => section[k] === undefined);
  if (missing.length) {
    console.log(`❌ ${loc} missing (${missing.length}): ${missing.join(', ')}`);
    allGood = false;
  } else {
    console.log(`✅ ${loc}: all ${unique.length} keys present`);
  }
}

if (allGood) console.log('\n🎉 NotificationsPage fully translated in all locales.');
