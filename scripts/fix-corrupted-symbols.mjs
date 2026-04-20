/**
 * fix-corrupted-symbols.mjs
 * Fixes emoji/symbol corruption in ALL locale JSON files caused by prior
 * PowerShell Set-Content (Latin-1 mis-encoding of multibyte UTF-8).
 *
 * Run: node scripts/fix-corrupted-symbols.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const msg   = join(__dir, '..', 'messages')

// Keys with corrupted values and their correct per-locale values.
// Most emoji/symbols are the same across locales; only text differs.
const patches = {
  en: {
    NotificationsPage: {
      feedTab:         '🎤 Feed',
      preferencesTab:  '⚙️ Preferences',
      loading:         'Loading…',
      saving:          'Saving…',
      saved:           '✅ Preferences Saved',
    },
    training: {
      enrollCta: 'Enroll →',
    },
  },
  fr: {
    NotificationsPage: {
      feedTab:         '🎤 Fil',
      preferencesTab:  '⚙️ Préférences',
      loading:         'Chargement…',
      saving:          'Enregistrement…',
      saved:           '✅ Préférences enregistrées',
    },
    training: {
      enrollCta: "S'inscrire →",
    },
  },
  es: {
    NotificationsPage: {
      feedTab:         '🎤 Feed',
      preferencesTab:  '⚙️ Preferencias',
      loading:         'Cargando…',
      saving:          'Guardando…',
      saved:           '✅ Preferencias guardadas',
    },
    training: {
      enrollCta: 'Inscribirse →',
    },
  },
  pt: {
    NotificationsPage: {
      feedTab:         '🎤 Feed',
      preferencesTab:  '⚙️ Preferências',
      loading:         'Carregando…',
      saving:          'Salvando…',
      saved:           '✅ Preferências salvas',
    },
    training: {
      enrollCta: 'Inscrever-se →',
    },
  },
  de: {
    NotificationsPage: {
      feedTab:         '🎤 Feed',
      preferencesTab:  '⚙️ Einstellungen',
      loading:         'Laden…',
      saving:          'Speichern…',
      saved:           '✅ Einstellungen gespeichert',
    },
    training: {
      enrollCta: 'Anmelden →',
    },
  },
  ar: {
    NotificationsPage: {
      feedTab:         '🎤 التغذية',
      preferencesTab:  '⚙️ التفضيلات',
      loading:         'جارٍ التحميل…',
      saving:          'جارٍ الحفظ…',
      saved:           '✅ تم حفظ التفضيلات',
    },
    training: {
      enrollCta: 'التسجيل →',
    },
  },
  hi: {
    NotificationsPage: {
      feedTab:         '🎤 फ़ीड',
      preferencesTab:  '⚙️ प्राथमिकताएं',
      loading:         'लोड हो रहा है…',
      saving:          'सहेजा जा रहा है…',
      saved:           '✅ प्राथमिकताएं सहेजी गईं',
    },
    training: {
      enrollCta: 'नामांकन करें →',
    },
  },
  ja: {
    NotificationsPage: {
      feedTab:         '🎤 フィード',
      preferencesTab:  '⚙️ 設定',
      loading:         '読み込み中…',
      saving:          '保存中…',
      saved:           '✅ 設定を保存しました',
    },
    training: {
      enrollCta: '登録する →',
    },
  },
  ko: {
    NotificationsPage: {
      feedTab:         '🎤 피드',
      preferencesTab:  '⚙️ 환경설정',
      loading:         '로딩 중…',
      saving:          '저장 중…',
      saved:           '✅ 환경설정이 저장되었습니다',
    },
    training: {
      enrollCta: '등록하기 →',
    },
  },
  zh: {
    NotificationsPage: {
      feedTab:         '🎤 动态',
      preferencesTab:  '⚙️ 偏好设置',
      loading:         '加载中…',
      saving:          '保存中…',
      saved:           '✅ 偏好设置已保存',
    },
    training: {
      enrollCta: '报名 →',
    },
  },
  ru: {
    NotificationsPage: {
      feedTab:         '🎤 Лента',
      preferencesTab:  '⚙️ Настройки',
      loading:         'Загрузка…',
      saving:          'Сохранение…',
      saved:           '✅ Настройки сохранены',
    },
    training: {
      enrollCta: 'Записаться →',
    },
  },
}

const locales = Object.keys(patches)

for (const locale of locales) {
  const file = join(msg, `${locale}.json`)
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const localePatch = patches[locale]

  for (const [namespace, keys] of Object.entries(localePatch)) {
    if (!data[namespace]) {
      console.warn(`  ⚠️  ${locale}: namespace "${namespace}" not found — skipping`)
      continue
    }
    for (const [key, value] of Object.entries(keys)) {
      data[namespace][key] = value
    }
  }

  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' })
  console.log(`✅ ${locale}.json patched`)
}

console.log('\n✅ All symbol corruptions fixed.')
