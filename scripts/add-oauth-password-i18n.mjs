/**
 * Add OAuth password-setup i18n keys to all locale files.
 * Run: node scripts/add-oauth-password-i18n.mjs
 */
import fs from 'fs'
import path from 'path'

const MESSAGES_DIR = path.resolve('messages')

const newKeys = {
  en: {
    oauthNoPassword: "You signed in with {provider}. Your account does not have a password yet. You can create one below to also log in with email and password.",
    createPasswordBtn: "Create Password",
    setPasswordBtn: "Set Password",
    passwordSetSuccess: "Password created successfully! You can now log in with your email and password.",
    codeSentToEmail: "A 6-digit verification code has been sent to your email.",
    verificationCode: "Verification Code",
    minCharsError: "Password must be at least 6 characters",
  },
  ar: {
    oauthNoPassword: "لقد سجلت الدخول باستخدام {provider}. حسابك لا يحتوي على كلمة مرور حتى الان. يمكنك انشاء واحدة ادناه لتسجيل الدخول ايضا بالبريد الالكتروني وكلمة المرور.",
    createPasswordBtn: "انشاء كلمة مرور",
    setPasswordBtn: "تعيين كلمة المرور",
    passwordSetSuccess: "تم انشاء كلمة المرور بنجاح! يمكنك الان تسجيل الدخول بالبريد الالكتروني وكلمة المرور.",
    codeSentToEmail: "تم ارسال رمز تحقق مكون من 6 ارقام الى بريدك الالكتروني.",
    verificationCode: "رمز التحقق",
    minCharsError: "يجب ان تكون كلمة المرور 6 احرف على الاقل",
  },
  de: {
    oauthNoPassword: "Sie haben sich mit {provider} angemeldet. Ihr Konto hat noch kein Passwort. Sie koennen unten eines erstellen, um sich auch mit E-Mail und Passwort anzumelden.",
    createPasswordBtn: "Passwort erstellen",
    setPasswordBtn: "Passwort festlegen",
    passwordSetSuccess: "Passwort erfolgreich erstellt! Sie koennen sich jetzt mit E-Mail und Passwort anmelden.",
    codeSentToEmail: "Ein 6-stelliger Verifizierungscode wurde an Ihre E-Mail gesendet.",
    verificationCode: "Verifizierungscode",
    minCharsError: "Passwort muss mindestens 6 Zeichen lang sein",
  },
  es: {
    oauthNoPassword: "Iniciaste sesion con {provider}. Tu cuenta aun no tiene contrasena. Puedes crear una a continuacion para tambien iniciar sesion con correo y contrasena.",
    createPasswordBtn: "Crear contrasena",
    setPasswordBtn: "Establecer contrasena",
    passwordSetSuccess: "Contrasena creada exitosamente! Ahora puedes iniciar sesion con tu correo y contrasena.",
    codeSentToEmail: "Se ha enviado un codigo de verificacion de 6 digitos a tu correo.",
    verificationCode: "Codigo de verificacion",
    minCharsError: "La contrasena debe tener al menos 6 caracteres",
  },
  fr: {
    oauthNoPassword: "Vous vous etes connecte avec {provider}. Votre compte n'a pas encore de mot de passe. Vous pouvez en creer un ci-dessous pour vous connecter aussi avec e-mail et mot de passe.",
    createPasswordBtn: "Creer un mot de passe",
    setPasswordBtn: "Definir le mot de passe",
    passwordSetSuccess: "Mot de passe cree avec succes ! Vous pouvez maintenant vous connecter avec votre e-mail et mot de passe.",
    codeSentToEmail: "Un code de verification a 6 chiffres a ete envoye a votre e-mail.",
    verificationCode: "Code de verification",
    minCharsError: "Le mot de passe doit contenir au moins 6 caracteres",
  },
  hi: {
    oauthNoPassword: "Aapne {provider} se sign in kiya hai. Aapke account mein abhi koi password nahi hai. Neeche ek password banayein taaki aap email aur password se bhi login kar sakein.",
    createPasswordBtn: "Password banayein",
    setPasswordBtn: "Password set karein",
    passwordSetSuccess: "Password safaltapoorvak bana diya gaya! Ab aap apne email aur password se login kar sakte hain.",
    codeSentToEmail: "Aapke email par 6 ank ka verification code bheja gaya hai.",
    verificationCode: "Verification Code",
    minCharsError: "Password kam se kam 6 akshar ka hona chahiye",
  },
  ja: {
    oauthNoPassword: "{provider} でサインインしました。アカウントにはまだパスワードがありません。以下からパスワードを作成して、メールとパスワードでもログインできるようにしましょう。",
    createPasswordBtn: "パスワードを作成",
    setPasswordBtn: "パスワードを設定",
    passwordSetSuccess: "パスワードが正常に作成されました！メールとパスワードでログインできます。",
    codeSentToEmail: "6桁の認証コードがメールに送信されました。",
    verificationCode: "認証コード",
    minCharsError: "パスワードは6文字以上にしてください",
  },
  ko: {
    oauthNoPassword: "{provider}(으)로 로그인했습니다. 계정에 아직 비밀번호가 없습니다. 아래에서 비밀번호를 만들어 이메일과 비밀번호로도 로그인하세요.",
    createPasswordBtn: "비밀번호 만들기",
    setPasswordBtn: "비밀번호 설정",
    passwordSetSuccess: "비밀번호가 성공적으로 생성되었습니다! 이제 이메일과 비밀번호로 로그인할 수 있습니다.",
    codeSentToEmail: "6자리 인증 코드가 이메일로 전송되었습니다.",
    verificationCode: "인증 코드",
    minCharsError: "비밀번호는 최소 6자 이상이어야 합니다",
  },
  pt: {
    oauthNoPassword: "Voce entrou com {provider}. Sua conta ainda nao tem uma senha. Crie uma abaixo para tambem fazer login com e-mail e senha.",
    createPasswordBtn: "Criar senha",
    setPasswordBtn: "Definir senha",
    passwordSetSuccess: "Senha criada com sucesso! Agora voce pode fazer login com e-mail e senha.",
    codeSentToEmail: "Um codigo de verificacao de 6 digitos foi enviado para seu e-mail.",
    verificationCode: "Codigo de verificacao",
    minCharsError: "A senha deve ter pelo menos 6 caracteres",
  },
  ru: {
    oauthNoPassword: "Vy voshli cherez {provider}. U vashego akkaunta poka net parolya. Sozdajte ego nizhe, chtoby takzhe vhodit po e-mail i parolyu.",
    createPasswordBtn: "Sozdat parol",
    setPasswordBtn: "Ustanovit parol",
    passwordSetSuccess: "Parol uspeshno sozdan! Teper vy mozhete vhodit s pomoshchyu e-mail i parolya.",
    codeSentToEmail: "Na vashu pochtu otpravlen 6-znachnyj kod podtverzhdeniya.",
    verificationCode: "Kod podtverzhdeniya",
    minCharsError: "Parol dolzhen soderzhat ne menee 6 simvolov",
  },
  zh: {
    oauthNoPassword: "您通过 {provider} 登录。您的账户目前没有密码。您可以在下方创建一个密码，以便也能用邮箱和密码登录。",
    createPasswordBtn: "创建密码",
    setPasswordBtn: "设置密码",
    passwordSetSuccess: "密码创建成功！您现在可以使用邮箱和密码登录。",
    codeSentToEmail: "6位验证码已发送至您的邮箱。",
    verificationCode: "验证码",
    minCharsError: "密码至少需要6个字符",
  },
}

for (const [locale, keys] of Object.entries(newKeys)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  if (!fs.existsSync(filePath)) { console.log(`⏭️  Skipping ${locale} — file not found`); continue }
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!json.profileTab) { json.profileTab = {} }
  let added = 0
  for (const [k, v] of Object.entries(keys)) {
    if (!json.profileTab[k]) { json.profileTab[k] = v; added++ }
  }
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf-8')
  console.log(`✅ ${locale}.json — added ${added} keys`)
}

console.log('\nDone!')
