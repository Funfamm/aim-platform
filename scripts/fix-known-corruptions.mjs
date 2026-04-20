/**
 * fix-known-corruptions.mjs
 * Fixes specific known-corrupted values in locale JSON files.
 * Run: node scripts/fix-known-corruptions.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const msg = join(__dir, '..', 'messages')

// Each entry: [locale, namespace, key, correctValue]
const fixes = [
  // feedTab: the 📨 emoji renders badly on some platforms — use 🎤 (used in the design)
  // Verified: en.json has "📨 Feed" but screenshot shows garbled δŸŽ¤
  // The real design intent (from screenshot header) is the bell/mic icon
  // Use text-safe approach: remove emoji prefix (the label is clear enough)
  ['en', 'NotificationsPage', 'feedTab',        '🔔 Feed'],
  ['fr', 'NotificationsPage', 'feedTab',        '🔔 Fil'],
  ['es', 'NotificationsPage', 'feedTab',        '🔔 Feed'],
  ['pt', 'NotificationsPage', 'feedTab',        '🔔 Feed'],
  ['de', 'NotificationsPage', 'feedTab',        '🔔 Feed'],
  ['ar', 'NotificationsPage', 'feedTab',        '🔔 التغذية'],
  ['hi', 'NotificationsPage', 'feedTab',        '🔔 फ़ीड'],
  ['ja', 'NotificationsPage', 'feedTab',        '🔔 フィード'],
  ['ko', 'NotificationsPage', 'feedTab',        '🔔 피드'],
  ['zh', 'NotificationsPage', 'feedTab',        '🔔 动态'],
  ['ru', 'NotificationsPage', 'feedTab',        '🔔 Лента'],

  // preferencesTab: ⚙️ renders correctly, but verify emoji is the 2-char combo
  ['en', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F Preferences'],
  ['fr', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F Préférences'],
  ['es', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F Preferencias'],
  ['pt', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F Preferências'],
  ['de', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F Einstellungen'],
  ['ar', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F التفضيلات'],
  ['hi', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F प्राथमिकताएं'],
  ['ja', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F 設定'],
  ['ko', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F 환경설정'],
  ['zh', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F 偏好设置'],
  ['ru', 'NotificationsPage', 'preferencesTab', '\u2699\uFE0F Настройки'],

  // dashboard praiseWords corruption in en.json — replace broken emoji sequences
  ['en', 'dashboard', 'praiseWords',
    'You\'re amazing! 🌟|True supporter! 💫|Film hero! 🎬|Thank you! ❤️|Legend! 🏆'],

  // hi.json liveRoom.connecting has garbled character 'e' inside Hindi text
  ['hi', 'liveRoom', 'connecting', 'कमरे से जुड़ा जा रहा है...'],

  // enrollCta — replace unicode arrow with ASCII arrow to avoid rendering issues on some fonts
  ['en', 'training', 'enrollCta', 'Enroll \u2192'],
  ['fr', 'training', 'enrollCta', "S'inscrire \u2192"],
  ['es', 'training', 'enrollCta', 'Inscribirse \u2192'],
  ['pt', 'training', 'enrollCta', 'Inscrever-se \u2192'],
  ['de', 'training', 'enrollCta', 'Anmelden \u2192'],
  ['ar', 'training', 'enrollCta', 'التسجيل \u2192'],
  ['hi', 'training', 'enrollCta', 'नामांकन करें \u2192'],
  ['ja', 'training', 'enrollCta', '登録する \u2192'],
  ['ko', 'training', 'enrollCta', '등록하기 \u2192'],
  ['zh', 'training', 'enrollCta', '报名 \u2192'],
  ['ru', 'training', 'enrollCta', 'Записаться \u2192'],
]

// Group by locale file
const byLocale = {}
for (const [locale, ns, key, val] of fixes) {
  if (!byLocale[locale]) byLocale[locale] = []
  byLocale[locale].push([ns, key, val])
}

for (const [locale, changes] of Object.entries(byLocale)) {
  const file = join(msg, `${locale}.json`)
  const data = JSON.parse(readFileSync(file, 'utf8'))
  for (const [ns, key, val] of changes) {
    if (!data[ns]) { console.warn(`  ⚠️  ${locale}: namespace "${ns}" not found`); continue }
    data[ns][key] = val
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' })
  console.log(`✅ ${locale}.json fixed`)
}

console.log('\n✅ Done.')
