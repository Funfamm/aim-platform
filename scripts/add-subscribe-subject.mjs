import { readFileSync, writeFileSync } from 'fs'

const subjects = {
  en: "You're subscribed to AIM Studio! 🎬",
  ar: 'أنت مشترك في AIM Studio! 🎬',
  de: 'Sie haben AIM Studio abonniert! 🎬',
  es: '¡Estás suscrito a AIM Studio! 🎬',
  fr: 'Vous êtes abonné à AIM Studio ! 🎬',
  hi: 'आप AIM Studio के सदस्य बन गए! 🎬',
  ja: 'AIM Studioへの登録が完了しました！🎬',
  ko: 'AIM Studio를 구독했습니다! 🎬',
  pt: 'Você está inscrito no AIM Studio! 🎬',
  ru: 'Вы подписаны на AIM Studio! 🎬',
  zh: '您已订阅 AIM Studio！🎬',
}

let content = readFileSync('src/lib/email-i18n.ts', 'utf8')

// For each locale, find the subscribe section entry and insert subject if missing
for (const [loc, subject] of Object.entries(subjects)) {
  // Pattern: inside subscribe: { ... <loc>: { ... heading: ...
  // We need to add subject: '...' before heading:
  const locPattern = new RegExp(
    `(subscribe:\\s*\\{[^}]*?${loc}:\\s*\\{\\s*)`,
    'gs'
  )
  // More targeted: find "<locale>: {" inside the subscribe block then "heading:"
  // Approach: find "heading:" line in each locale block and prepend subject
  const headingPattern = new RegExp(
    `(//[^\\n]*Subscription[^\\n]*\\n[\\s\\S]*?${loc}:\\s*\\{\\s*\\n)(\\s*heading:)`,
    'm'
  )
  if (headingPattern.test(content)) {
    content = content.replace(headingPattern, (match, before, headingLine) => {
      // Only add if subject not already there
      if (before.includes(`subject:`) && before.split(loc + ':')[1]?.includes('subject:')) {
        return match
      }
      const indent = headingLine.match(/^(\s*)/)[1]
      return `${before}${indent}subject:    '${subject}',\n${headingLine}`
    })
    console.log(`✓ ${loc}: Added subject`)
  } else {
    console.log(`✗ ${loc}: Pattern not found`)
  }
}

writeFileSync('src/lib/email-i18n.ts', content)
console.log('Done.')
