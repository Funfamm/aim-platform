const fs = require('fs')

let content = fs.readFileSync('src/lib/email-i18n.ts', 'utf8')

const additions = {
    en: { subject: "Subscription confirmed! Welcome to AIM Studio 🎉", footer: "You received this email because you subscribed to updates from AIM Studio." },
    es: { subject: "¡Suscripción confirmada! Bienvenido a AIM Studio 🎉", footer: "Has recibido este correo porque te has suscrito a las actualizaciones de AIM Studio." },
    fr: { subject: "Abonnement confirmé ! Bienvenue sur AIM Studio 🎉", footer: "Vous avez reçu cet e-mail car vous vous êtes abonné aux mises à jour d'AIM Studio." },
    ar: { subject: "اكتمل الاشتراك! مرحباً بك في AIM Studio 🎉", footer: "لقد تلقيت هذا البريد الإلكتروني لأنك اشتركت في تحديثات AIM Studio." },
    zh: { subject: "订阅成功！欢迎来到 AIM Studio 🎉", footer: "您收到此邮件是因为您订阅了 AIM Studio 的更新。" },
    hi: { subject: "सदस्यता की पुष्टि! AIM Studio में आपका स्वागत है 🎉", footer: "आपको यह ईमेल इसलिए मिला है क्योंकि आपने AIM Studio के अपडेट की सदस्यता ली है।" },
    pt: { subject: "Assinatura confirmada! Bem-vindo ao AIM Studio 🎉", footer: "Você recebeu este e-mail porque se inscreveu nas atualizações do AIM Studio." },
    ru: { subject: "Подписка подтверждена! Добро пожаловать в AIM Studio 🎉", footer: "Вы получили это письмо, потому что подписались на обновления AIM Studio." },
    ja: { subject: "登録完了！AIM Studioへようこそ 🎉", footer: "このメールは、AIM Studioの更新を購読されたため送信しています。" },
    de: { subject: "Abonnement bestätigt! Willkommen bei AIM Studio 🎉", footer: "Sie haben diese E-Mail erhalten, weil Sie Aktualisierungen von AIM Studio abonniert haben." },
    ko: { subject: "구독 확인! AIM Studio에 오신 것을 환영합니다 🎉", footer: "AIM Studio의 업데이트를 구독하셨기 때문에 이 이메일을 받으셨습니다." }
}

// target the 'subscribe:' section
let subscribeStartIndex = content.indexOf('subscribe: {')
let before = content.substring(0, subscribeStartIndex)
let subscribeBlock = content.substring(subscribeStartIndex, content.indexOf('trainingEnrollment: {', subscribeStartIndex))
let after = content.substring(content.indexOf('trainingEnrollment: {', subscribeStartIndex))

for (const [lang, ObjectFields] of Object.entries(additions)) {
    const r = new RegExp(`(\\b${lang}: \\{\\r?\\n)`, 'i')
    subscribeBlock = subscribeBlock.replace(r, `$1            subject:    "${ObjectFields.subject}",\n            footer:     "${ObjectFields.footer}",\n`)
}

fs.writeFileSync('src/lib/email-i18n.ts', before + subscribeBlock + after, 'utf8')
console.log('Fixed subject and footers inside the subscribe dictionary')
