import { readFileSync } from 'fs';

// Replicate exactly what request.ts does
function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null && typeof override[key] === 'object' && !Array.isArray(override[key]) &&
      base[key] !== null && typeof base[key] === 'object' && !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function flatKeys(obj, prefix = '') {
  return Object.keys(obj).flatMap(k => {
    const full = prefix ? `${prefix}.${k}` : k;
    return typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])
      ? flatKeys(obj[k], full)
      : [full];
  });
}

function load(path) {
  const raw = readFileSync(path);
  const hasBom = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF;
  return JSON.parse(hasBom ? raw.slice(3).toString('utf8') : raw.toString('utf8'));
}

const enRoot = load('./messages/en.json');
const enSrc  = load('./src/messages/en.json');
const enFull = deepMerge(enRoot, enSrc);
const enKeys = flatKeys(enFull);

console.log(`English total keys: ${enKeys.length}\n`);

const locales = ['ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh'];

let allGood = true;
for (const loc of locales) {
  const rootMsg = load(`./messages/${loc}.json`);
  const srcMsg  = load(`./src/messages/${loc}.json`);
  const localeFull = deepMerge(rootMsg, srcMsg);
  const merged = deepMerge(enFull, localeFull);  // final = what the user sees
  const locKeys = flatKeys(merged);

  const missing = enKeys.filter(k => !locKeys.includes(k));
  const stillEnglish = enKeys.filter(k => {
    const enVal = enKeys.includes(k) ? k.split('.').reduce((o, p) => o?.[p], enFull) : null;
    const locVal = k.split('.').reduce((o, p) => o?.[p], merged);
    return locVal === enVal && loc !== 'en';
  });

  if (missing.length) {
    console.log(`❌ ${loc}: ${missing.length} MISSING keys:`);
    missing.forEach(k => console.log(`   ${k}`));
    allGood = false;
  } else {
    console.log(`✅ ${loc}: all ${locKeys.length} keys present`);
  }
}

if (allGood) console.log('\n🎉 All locales fully covered — no raw keys will show.');
