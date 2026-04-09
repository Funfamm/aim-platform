import { readFileSync, writeFileSync } from 'fs'

const LOCALES = ['en','ar','de','es','fr','hi','ja','ko','pt','ru','zh']

const hidePassword = {
  en: 'Hide password', ar: 'إخفاء كلمة المرور', de: 'Passwort verbergen',
  es: 'Ocultar contraseña', fr: 'Masquer le mot de passe', hi: 'पासवर्ड छुपाएं',
  ja: 'パスワードを隠す', ko: '비밀번호 숨기기', pt: 'Ocultar senha',
  ru: 'Скрыть пароль', zh: '隐藏密码',
}
const showPassword = {
  en: 'Show password', ar: 'إظهار كلمة المرور', de: 'Passwort anzeigen',
  es: 'Mostrar contraseña', fr: 'Afficher le mot de passe', hi: 'पासवर्ड दिखाएं',
  ja: 'パスワードを表示', ko: '비밀번호 표시', pt: 'Mostrar senha',
  ru: 'Показать пароль', zh: '显示密码',
}

for (const loc of LOCALES) {
  const path = `messages/${loc}.json`
  const msgs = JSON.parse(readFileSync(path, 'utf8'))
  if (!msgs.register) msgs.register = {}
  msgs.register.hidePassword = hidePassword[loc]
  msgs.register.showPassword = showPassword[loc]
  writeFileSync(path, JSON.stringify(msgs, null, 2))
}
console.log('Done adding hidePassword/showPassword to register namespace in all locales.')
