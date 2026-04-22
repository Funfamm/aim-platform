const fs = require('fs')
const path = require('path')

const messagesDir = path.join(__dirname, '../src/messages')

// New colour translations per locale
// Keys: colorRose, colorViolet, colorCopper, colorPlatinum, colorCrimson
const colorTranslations = {
  en: { colorRose: 'Rose', colorViolet: 'Violet', colorCopper: 'Copper', colorPlatinum: 'Platinum', colorCrimson: 'Crimson' },
  fr: { colorRose: 'Rose', colorViolet: 'Violet', colorCopper: 'Cuivre', colorPlatinum: 'Platine', colorCrimson: 'Cramoisi' },
  de: { colorRose: 'Rosé', colorViolet: 'Violett', colorCopper: 'Kupfer', colorPlatinum: 'Platin', colorCrimson: 'Karmesin' },
  es: { colorRose: 'Rosa', colorViolet: 'Violeta', colorCopper: 'Cobre', colorPlatinum: 'Platino', colorCrimson: 'Carmesí' },
  pt: { colorRose: 'Rosa', colorViolet: 'Violeta', colorCopper: 'Cobre', colorPlatinum: 'Platina', colorCrimson: 'Carmesim' },
  ar: { colorRose: 'وردي', colorViolet: 'بنفسجي', colorCopper: 'نحاسي', colorPlatinum: 'بلاتيني', colorCrimson: 'قرمزي' },
  hi: { colorRose: 'गुलाबी', colorViolet: 'बैंगनी', colorCopper: 'तांबा', colorPlatinum: 'प्लेटिनम', colorCrimson: 'किरमिजी' },
  ja: { colorRose: 'ローズ', colorViolet: 'バイオレット', colorCopper: 'コパー', colorPlatinum: 'プラチナ', colorCrimson: 'クリムゾン' },
  ko: { colorRose: '로즈', colorViolet: '바이올렛', colorCopper: '코퍼', colorPlatinum: '플래티넘', colorCrimson: '크림슨' },
  ru: { colorRose: 'Роза', colorViolet: 'Фиолетовый', colorCopper: 'Медный', colorPlatinum: 'Платиновый', colorCrimson: 'Малиновый' },
  zh: { colorRose: '玫瑰', colorViolet: '紫罗兰', colorCopper: '铜色', colorPlatinum: '铂金', colorCrimson: '深红' },
}

// Also ensure the existing 5 colours are translated in all locales
const existingColorTranslations = {
  en: { colorGold: 'Gold', colorSilver: 'Silver', colorEmber: 'Ember', colorJade: 'Jade', colorAzure: 'Azure' },
  fr: { colorGold: 'Or', colorSilver: 'Argent', colorEmber: 'Braise', colorJade: 'Jade', colorAzure: 'Azur' },
  de: { colorGold: 'Gold', colorSilver: 'Silber', colorEmber: 'Glut', colorJade: 'Jade', colorAzure: 'Azurblau' },
  es: { colorGold: 'Oro', colorSilver: 'Plata', colorEmber: 'Brasa', colorJade: 'Jade', colorAzure: 'Azur' },
  pt: { colorGold: 'Ouro', colorSilver: 'Prata', colorEmber: 'Brasa', colorJade: 'Jade', colorAzure: 'Azul' },
  ar: { colorGold: 'ذهبي', colorSilver: 'فضي', colorEmber: 'جمري', colorJade: 'زمردي', colorAzure: 'أزرق سماوي' },
  hi: { colorGold: 'सोना', colorSilver: 'चांदी', colorEmber: 'अंगारा', colorJade: 'जेड', colorAzure: 'आसमानी' },
  ja: { colorGold: 'ゴールド', colorSilver: 'シルバー', colorEmber: 'エンバー', colorJade: 'ジェード', colorAzure: 'アジュール' },
  ko: { colorGold: '골드', colorSilver: '실버', colorEmber: '엠버', colorJade: '옥', colorAzure: '하늘색' },
  ru: { colorGold: 'Золото', colorSilver: 'Серебро', colorEmber: 'Тлеющий', colorJade: 'Нефрит', colorAzure: 'Лазурный' },
  zh: { colorGold: '金色', colorSilver: '银色', colorEmber: '琥珀', colorJade: '翡翠', colorAzure: '蔚蓝' },
}

const locales = Object.keys(colorTranslations)

locales.forEach(locale => {
  const filePath = path.join(messagesDir, `${locale}.json`)
  if (!fs.existsSync(filePath)) { console.log(`SKIP: ${locale}.json not found`); return }

  const content = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(content)

  // Ensure profileTab exists
  if (!json.profileTab) json.profileTab = {}

  // Merge all colour keys
  const allColors = { ...existingColorTranslations[locale], ...colorTranslations[locale] }
  Object.assign(json.profileTab, allColors)

  // Write back without BOM
  fs.writeFileSync(filePath, JSON.stringify(json, null, 4), { encoding: 'utf8' })
  console.log(`✅ ${locale}.json updated with ${Object.keys(allColors).length} colour keys`)
})

console.log('\nDone.')
