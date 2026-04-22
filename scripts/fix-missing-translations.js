const fs = require('fs')
const path = require('path')

const messagesDir = path.join(__dirname, '../src/messages')

// The accentColourDesc key that was added to en.json but not other locales
const translations = {
  en: { accentColourDesc: "Your chosen colour applies to highlights, buttons, and glows across the platform." },
  fr: { accentColourDesc: "Votre couleur choisie s'applique aux surbrillances, boutons et effets lumineux sur la plateforme." },
  de: { accentColourDesc: "Ihre gewählte Farbe wird auf Hervorhebungen, Schaltflächen und Leuchteffekte angewendet." },
  es: { accentColourDesc: "El color elegido se aplica a los resaltados, botones y brillos en toda la plataforma." },
  pt: { accentColourDesc: "A cor escolhida é aplicada a destaques, botões e brilhos em toda a plataforma." },
  ar: { accentColourDesc: "اللون الذي اخترته يُطبّق على الإبرازات والأزرار والتوهجات في جميع أنحاء المنصة." },
  hi: { accentColourDesc: "आपका चुना हुआ रंग पूरे प्लेटफ़ॉर्म पर हाइलाइट, बटन और ग्लो पर लागू होता है।" },
  ja: { accentColourDesc: "選択したカラーはハイライト、ボタン、グロー効果に適用されます。" },
  ko: { accentColourDesc: "선택한 색상이 하이라이트, 버튼, 글로우 효과에 적용됩니다." },
  ru: { accentColourDesc: "Выбранный цвет применяется к подсветке, кнопкам и эффектам свечения." },
  zh: { accentColourDesc: "所选颜色将应用于高亮、按钮和发光效果。" },
}

Object.entries(translations).forEach(([locale, keys]) => {
  const filePath = path.join(messagesDir, `${locale}.json`)
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!json.profileTab) json.profileTab = {}
  Object.assign(json.profileTab, keys)
  fs.writeFileSync(filePath, JSON.stringify(json, null, 4), { encoding: 'utf8' })
  console.log(`✅ ${locale}.json — added accentColourDesc`)
})

console.log('\nDone.')
