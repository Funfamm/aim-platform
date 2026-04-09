import { readFileSync, writeFileSync } from 'fs'

const LOCALES = ['en','ar','de','es','fr','hi','ja','ko','pt','ru','zh']

const securedByPaypal = {
  en: 'Secured by PayPal',
  ar: 'محمي بواسطة PayPal',
  de: 'Gesichert durch PayPal',
  es: 'Protegido por PayPal',
  fr: 'Sécurisé par PayPal',
  hi: 'PayPal द्वारा सुरक्षित',
  ja: 'PayPalで保護されています',
  ko: 'PayPal로 보안 처리됨',
  pt: 'Protegido pelo PayPal',
  ru: 'Защищено PayPal',
  zh: '通过PayPal保障安全',
}

for (const loc of LOCALES) {
  const path = `messages/${loc}.json`
  const msgs = JSON.parse(readFileSync(path, 'utf8'))
  if (!msgs.donate) msgs.donate = {}
  msgs.donate.securedByPaypal = securedByPaypal[loc]
  writeFileSync(path, JSON.stringify(msgs, null, 2))
  console.log(`Updated ${path}`)
}
console.log('Done.')
