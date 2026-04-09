import { readFileSync, writeFileSync } from 'fs'

const LOCALES = ['en','ar','de','es','fr','hi','ja','ko','pt','ru','zh']

// Localized email placeholder — descriptive in each language
const emailPlaceholder = {
  en: 'your@email.com',
  ar: 'بريدك@الإلكتروني.com',
  de: 'ihre@email.com',
  es: 'tu@correo.com',
  fr: 'votre@email.com',
  hi: 'आपका@ईमेल.com',
  ja: 'あなたの@メール.com',
  ko: '이메일@주소.com',
  pt: 'seu@email.com',
  ru: 'ваш@email.com',
  zh: '您的@邮箱.com',
}

for (const loc of LOCALES) {
  const path = `messages/${loc}.json`
  const msgs = JSON.parse(readFileSync(path, 'utf8'))
  
  for (const ns of ['login', 'register', 'forgotPassword']) {
    if (msgs[ns]) {
      msgs[ns].emailPlaceholder = emailPlaceholder[loc]
    }
  }
  
  writeFileSync(path, JSON.stringify(msgs, null, 2))
  console.log(`Updated ${path}`)
}
console.log('Done updating emailPlaceholder in all locales.')
