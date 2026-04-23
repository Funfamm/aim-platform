/**
 * Adds new account-locking translation keys to all locale JSON files.
 * Run with: node scripts/add-lock-translations.js
 */

const fs = require('fs')
const path = require('path')

const messagesDir = path.join(__dirname, '..', 'messages')

// New keys per locale — manually translated (no API calls)
const newKeys = {
    en: {
        accountSuspended: 'Your account has been suspended. Please contact support.',
        accountLocked: 'Account temporarily locked due to too many failed attempts. Try again in {minutes} minute{plural}.',
        attemptsRemaining: 'Invalid email or password. {remaining} attempt{plural} remaining before lockout.',
        tooManyAttempts: 'Too many failed attempts. Your account is locked for {minutes} minutes.',
        adminOauthDisallowed: 'Admin accounts must sign in with email and password. Please use the form below.',
        oauthNotConfigured: 'OAuth login is not configured. Please contact an administrator.',
        oauthFailed: 'OAuth sign-in failed. Please try again or use email and password.',
    },
    es: {
        accountSuspended: 'Tu cuenta ha sido suspendida. Por favor, contacta al soporte.',
        accountLocked: 'Cuenta temporalmente bloqueada por demasiados intentos fallidos. Inténtalo de nuevo en {minutes} minuto{plural}.',
        attemptsRemaining: 'Correo electrónico o contraseña inválidos. {remaining} intento{plural} restante{plural} antes del bloqueo.',
        tooManyAttempts: 'Demasiados intentos fallidos. Tu cuenta está bloqueada por {minutes} minutos.',
        adminOauthDisallowed: 'Las cuentas de administrador deben iniciar sesión con correo electrónico y contraseña.',
        oauthNotConfigured: 'El inicio de sesión OAuth no está configurado. Contacta a un administrador.',
        oauthFailed: 'El inicio de sesión OAuth falló. Inténtalo de nuevo o usa correo electrónico y contraseña.',
    },
    fr: {
        accountSuspended: 'Votre compte a été suspendu. Veuillez contacter le support.',
        accountLocked: 'Compte temporairement verrouillé en raison de trop nombreuses tentatives échouées. Réessayez dans {minutes} minute{plural}.',
        attemptsRemaining: 'E-mail ou mot de passe incorrect. {remaining} tentative{plural} restante{plural} avant le verrouillage.',
        tooManyAttempts: 'Trop de tentatives échouées. Votre compte est verrouillé pour {minutes} minutes.',
        adminOauthDisallowed: 'Les comptes administrateur doivent se connecter avec un e-mail et un mot de passe.',
        oauthNotConfigured: "La connexion OAuth n'est pas configurée. Contactez un administrateur.",
        oauthFailed: 'La connexion OAuth a échoué. Réessayez ou utilisez un e-mail et un mot de passe.',
    },
    ar: {
        accountSuspended: 'تم تعليق حسابك. يرجى الاتصال بالدعم الفني.',
        accountLocked: 'تم تأمين الحساب مؤقتًا بسبب كثرة محاولات تسجيل الدخول الفاشلة. حاول مرة أخرى خلال {minutes} دقيقة.',
        attemptsRemaining: 'البريد الإلكتروني أو كلمة المرور غير صحيحة. {remaining} محاولة متبقية قبل تأمين الحساب.',
        tooManyAttempts: 'محاولات فاشلة كثيرة جدًا. تم تأمين حسابك لمدة {minutes} دقيقة.',
        adminOauthDisallowed: 'يجب على حسابات المشرف تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.',
        oauthNotConfigured: 'تسجيل الدخول عبر OAuth غير مُهيأ. يرجى التواصل مع المسؤول.',
        oauthFailed: 'فشل تسجيل الدخول عبر OAuth. حاول مرة أخرى أو استخدم البريد الإلكتروني وكلمة المرور.',
    },
    zh: {
        accountSuspended: '您的账户已被停用，请联系客服支持。',
        accountLocked: '由于多次登录失败，账户已暂时锁定。请在 {minutes} 分钟后重试。',
        attemptsRemaining: '邮箱或密码错误，锁定前还剩 {remaining} 次尝试机会。',
        tooManyAttempts: '尝试次数过多，您的账户已被锁定 {minutes} 分钟。',
        adminOauthDisallowed: '管理员账户必须使用邮箱和密码登录。',
        oauthNotConfigured: 'OAuth 登录未配置，请联系管理员。',
        oauthFailed: 'OAuth 登录失败，请重试或使用邮箱和密码登录。',
    },
    hi: {
        accountSuspended: 'आपका खाता निलंबित कर दिया गया है। कृपया सहायता से संपर्क करें।',
        accountLocked: 'बहुत अधिक असफल प्रयासों के कारण खाता अस्थायी रूप से लॉक कर दिया गया है। {minutes} मिनट बाद पुनः प्रयास करें।',
        attemptsRemaining: 'अमान्य ईमेल या पासवर्ड। लॉकआउट से पहले {remaining} प्रयास शेष हैं।',
        tooManyAttempts: 'बहुत अधिक असफल प्रयास। आपका खाता {minutes} मिनट के लिए लॉक कर दिया गया है।',
        adminOauthDisallowed: 'व्यवस्थापक खातों को ईमेल और पासवर्ड से साइन इन करना होगा।',
        oauthNotConfigured: 'OAuth लॉगिन कॉन्फ़िगर नहीं है। कृपया किसी व्यवस्थापक से संपर्क करें।',
        oauthFailed: 'OAuth साइन-इन विफल। पुनः प्रयास करें या ईमेल और पासवर्ड का उपयोग करें।',
    },
    pt: {
        accountSuspended: 'Sua conta foi suspensa. Por favor, entre em contato com o suporte.',
        accountLocked: 'Conta temporariamente bloqueada devido a muitas tentativas falhadas. Tente novamente em {minutes} minuto{plural}.',
        attemptsRemaining: 'E-mail ou senha inválidos. {remaining} tentativa{plural} restante{plural} antes do bloqueio.',
        tooManyAttempts: 'Muitas tentativas falhadas. Sua conta está bloqueada por {minutes} minutos.',
        adminOauthDisallowed: 'Contas de administrador devem entrar com e-mail e senha.',
        oauthNotConfigured: 'O login OAuth não está configurado. Por favor, contacte um administrador.',
        oauthFailed: 'O login OAuth falhou. Tente novamente ou use e-mail e senha.',
    },
    ru: {
        accountSuspended: 'Ваш аккаунт заблокирован. Пожалуйста, свяжитесь со службой поддержки.',
        accountLocked: 'Аккаунт временно заблокирован из-за слишком большого количества неудачных попыток. Повторите попытку через {minutes} минут.',
        attemptsRemaining: 'Неверный адрес электронной почты или пароль. Осталось {remaining} попыток до блокировки.',
        tooManyAttempts: 'Слишком много неудачных попыток. Ваш аккаунт заблокирован на {minutes} минут.',
        adminOauthDisallowed: 'Учётные записи администратора должны входить с использованием электронной почты и пароля.',
        oauthNotConfigured: 'Вход через OAuth не настроен. Пожалуйста, обратитесь к администратору.',
        oauthFailed: 'Вход через OAuth не выполнен. Повторите попытку или используйте электронную почту и пароль.',
    },
    ja: {
        accountSuspended: 'アカウントが停止されています。サポートにお問い合わせください。',
        accountLocked: 'ログイン試行に何度も失敗したため、アカウントが一時的にロックされました。{minutes}分後に再試行してください。',
        attemptsRemaining: 'メールアドレスまたはパスワードが無効です。あと{remaining}回で入力がロックされます。',
        tooManyAttempts: '試行回数が多すぎます。アカウントは{minutes}分間ロックされています。',
        adminOauthDisallowed: '管理者アカウントはメールアドレスとパスワードでサインインする必要があります。',
        oauthNotConfigured: 'OAuthログインが設定されていません。管理者にお問い合わせください。',
        oauthFailed: 'OAuthサインインに失敗しました。再試行するか、メールアドレスとパスワードを使用してください。',
    },
    de: {
        accountSuspended: 'Ihr Konto wurde gesperrt. Bitte wenden Sie sich an den Support.',
        accountLocked: 'Konto vorübergehend gesperrt aufgrund zu vieler fehlgeschlagener Versuche. Versuchen Sie es in {minutes} Minute{plural} erneut.',
        attemptsRemaining: 'Ungültige E-Mail-Adresse oder ungültiges Passwort. Noch {remaining} Versuch{plural} vor der Sperrung.',
        tooManyAttempts: 'Zu viele fehlgeschlagene Versuche. Ihr Konto ist für {minutes} Minuten gesperrt.',
        adminOauthDisallowed: 'Administrator-Konten müssen sich mit E-Mail und Passwort anmelden.',
        oauthNotConfigured: 'OAuth-Anmeldung ist nicht konfiguriert. Bitte wenden Sie sich an einen Administrator.',
        oauthFailed: 'OAuth-Anmeldung fehlgeschlagen. Versuchen Sie es erneut oder verwenden Sie E-Mail und Passwort.',
    },
    ko: {
        accountSuspended: '계정이 정지되었습니다. 고객 지원에 문의해 주세요.',
        accountLocked: '로그인 시도가 너무 많아 계정이 일시적으로 잠겼습니다. {minutes}분 후에 다시 시도하세요.',
        attemptsRemaining: '잘못된 이메일 또는 비밀번호입니다. 잠금까지 {remaining}번의 시도가 남았습니다.',
        tooManyAttempts: '시도 횟수가 너무 많습니다. 계정이 {minutes}분 동안 잠겼습니다.',
        adminOauthDisallowed: '관리자 계정은 이메일과 비밀번호로 로그인해야 합니다.',
        oauthNotConfigured: 'OAuth 로그인이 구성되지 않았습니다. 관리자에게 문의하세요.',
        oauthFailed: 'OAuth 로그인에 실패했습니다. 다시 시도하거나 이메일과 비밀번호를 사용하세요.',
    },
}

let updated = 0
let errors = 0

for (const [locale, keys] of Object.entries(newKeys)) {
    const filePath = path.join(messagesDir, `${locale}.json`)
    try {
        const raw = fs.readFileSync(filePath, 'utf8')
        const data = JSON.parse(raw)
        if (!data.login) data.login = {}
        // Merge new keys (never overwrite existing manual translations)
        for (const [key, value] of Object.entries(keys)) {
            if (!data.login[key]) {
                data.login[key] = value
            }
        }
        // Write back with UTF8 NO BOM (critical for Next.js / next-intl)
        const content = JSON.stringify(data, null, 2)
        // Use Buffer to ensure no BOM
        fs.writeFileSync(filePath, Buffer.from(content, 'utf8'))
        console.log(`✅ ${locale}.json — added missing keys`)
        updated++
    } catch (err) {
        console.error(`❌ ${locale}.json — ${err.message}`)
        errors++
    }
}

console.log(`\nDone: ${updated} files updated, ${errors} errors`)
