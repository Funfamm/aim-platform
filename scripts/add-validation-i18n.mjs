import { readFileSync, writeFileSync } from 'fs'

const LOCALES = ['en','ar','de','es','fr','hi','ja','ko','pt','ru','zh']

// Translations for "Please fill out this field."
const fillRequired = {
  en: 'Please fill out this field.',
  ar: 'يرجى ملء هذا الحقل.',
  de: 'Bitte füllen Sie dieses Feld aus.',
  es: 'Por favor, complete este campo.',
  fr: 'Veuillez remplir ce champ.',
  hi: 'कृपया यह फ़ील्ड भरें।',
  ja: 'このフィールドを入力してください。',
  ko: '이 필드를 입력해 주세요.',
  pt: 'Por favor, preencha este campo.',
  ru: 'Пожалуйста, заполните это поле.',
  zh: '请填写此字段。',
}

// Translations for "Please enter a valid email."
const emailInvalid = {
  en: 'Please enter a valid email address.',
  ar: 'يرجى إدخال بريد إلكتروني صالح.',
  de: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  es: 'Por favor, ingrese un correo válido.',
  fr: 'Veuillez entrer une adresse email valide.',
  hi: 'कृपया एक वैध ईमेल पता दर्ज करें।',
  ja: '有効なメールアドレスを入力してください。',
  ko: '유효한 이메일 주소를 입력해 주세요.',
  pt: 'Por favor, insira um endereço de e-mail válido.',
  ru: 'Пожалуйста, введите действительный адрес электронной почты.',
  zh: '请输入有效的电子邮件地址。',
}

// Translations for "Password must be at least 6 characters."
const pwTooShort = {
  en: 'Password must be at least 6 characters.',
  ar: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.',
  de: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
  es: 'La contraseña debe tener al menos 6 caracteres.',
  fr: 'Le mot de passe doit comporter au moins 6 caractères.',
  hi: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए।',
  ja: 'パスワードは6文字以上でなければなりません。',
  ko: '비밀번호는 6자 이상이어야 합니다.',
  pt: 'A senha deve ter pelo menos 6 caracteres.',
  ru: 'Пароль должен содержать не менее 6 символов.',
  zh: '密码必须至少6个字符。',
}

// Inject keys into all locale message files
for (const loc of LOCALES) {
  const path = `messages/${loc}.json`
  const msgs = JSON.parse(readFileSync(path, 'utf8'))

  for (const ns of ['login', 'register', 'forgotPassword']) {
    if (!msgs[ns]) msgs[ns] = {}
    msgs[ns].fillRequired = fillRequired[loc]
    msgs[ns].emailInvalid = emailInvalid[loc]
    if (ns === 'register' || ns === 'forgotPassword') {
      msgs[ns].pwTooShort = pwTooShort[loc]
    }
  }

  writeFileSync(path, JSON.stringify(msgs, null, 2))
  console.log(`Updated ${path}`)
}

console.log('Done injecting fillRequired/emailInvalid/pwTooShort keys.')
