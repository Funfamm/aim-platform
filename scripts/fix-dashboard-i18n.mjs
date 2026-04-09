/**
 * Dashboard i18n completeness fix.
 * Adds all missing keys to the 'dashboard', 'profileTab', and 'dashboardHeader' namespaces
 * across all 11 locale files.
 *
 * Run: node scripts/fix-dashboard-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const messagesDir = join(__dirname, '..', 'messages')

const locales = ['en','ar','de','es','fr','hi','ja','ko','pt','ru','zh']

/** Keys to add/merge per namespace per locale */
const newKeys = {
    // ── dashboard namespace ──────────────────────────────────────
    dashboard: {
        en: {
            praiseWords: "You're amazing! 🌟|True supporter! 💫|Film hero! 🎬|Thank you! ❤️|Legend! 🏆",
            loadMoreDonations: "Load More Donations",
            receiptTitle: "Donation Receipt",
            receiptThankYou: "Thank you for your support",
            receiptDate: "Date",
            receiptDonor: "Donor",
            receiptMethod: "Method",
            receiptStatus: "Status",
            receiptMessage: "Message",
            receiptAnonymous: "Anonymous",
            receiptPrint: "Print Receipt",
            receiptFooter: "This receipt confirms your generous contribution. 100% goes toward bringing stories to life. 🎥",
        },
        ar: {
            praiseWords: "أنت مذهل! 🌟|داعم حقيقي! 💫|بطل السينما! 🎬|شكراً لك! ❤️|أسطورة! 🏆",
            loadMoreDonations: "تحميل المزيد من التبرعات",
            receiptTitle: "إيصال التبرع",
            receiptThankYou: "شكراً على دعمك",
            receiptDate: "التاريخ",
            receiptDonor: "المتبرع",
            receiptMethod: "الطريقة",
            receiptStatus: "الحالة",
            receiptMessage: "الرسالة",
            receiptAnonymous: "مجهول",
            receiptPrint: "طباعة الإيصال",
            receiptFooter: "يؤكد هذا الإيصال مساهمتك الكريمة. 100٪ يذهب نحو إحياء القصص. 🎥",
        },
        de: {
            praiseWords: "Du bist großartig! 🌟|Echter Unterstützer! 💫|Filmheld! 🎬|Danke! ❤️|Legende! 🏆",
            loadMoreDonations: "Mehr Spenden laden",
            receiptTitle: "Spendenquittung",
            receiptThankYou: "Danke für deine Unterstützung",
            receiptDate: "Datum",
            receiptDonor: "Spender",
            receiptMethod: "Methode",
            receiptStatus: "Status",
            receiptMessage: "Nachricht",
            receiptAnonymous: "Anonym",
            receiptPrint: "Quittung drucken",
            receiptFooter: "Diese Quittung bestätigt deinen großzügigen Beitrag. 100% fließt in die Verwirklichung von Geschichten. 🎥",
        },
        es: {
            praiseWords: "¡Eres increíble! 🌟|¡Verdadero apoyo! 💫|¡Héroe del cine! 🎬|¡Gracias! ❤️|¡Leyenda! 🏆",
            loadMoreDonations: "Cargar más donaciones",
            receiptTitle: "Recibo de donación",
            receiptThankYou: "Gracias por tu apoyo",
            receiptDate: "Fecha",
            receiptDonor: "Donante",
            receiptMethod: "Método",
            receiptStatus: "Estado",
            receiptMessage: "Mensaje",
            receiptAnonymous: "Anónimo",
            receiptPrint: "Imprimir recibo",
            receiptFooter: "Este recibo confirma tu generosa contribución. El 100% va hacia dar vida a las historias. 🎥",
        },
        fr: {
            praiseWords: "Tu es incroyable ! 🌟|Vrai supporter ! 💫|Héros du cinéma ! 🎬|Merci ! ❤️|Légende ! 🏆",
            loadMoreDonations: "Charger plus de dons",
            receiptTitle: "Reçu de don",
            receiptThankYou: "Merci pour votre soutien",
            receiptDate: "Date",
            receiptDonor: "Donateur",
            receiptMethod: "Méthode",
            receiptStatus: "Statut",
            receiptMessage: "Message",
            receiptAnonymous: "Anonyme",
            receiptPrint: "Imprimer le reçu",
            receiptFooter: "Ce reçu confirme votre généreuse contribution. 100% va à la réalisation d'histoires. 🎥",
        },
        hi: {
            praiseWords: "आप अद्भुत हैं! 🌟|सच्चे समर्थक! 💫|फिल्म नायक! 🎬|धन्यवाद! ❤️|किंवदंती! 🏆",
            loadMoreDonations: "और दान लोड करें",
            receiptTitle: "दान रसीद",
            receiptThankYou: "आपके समर्थन के लिए धन्यवाद",
            receiptDate: "तारीख",
            receiptDonor: "दाता",
            receiptMethod: "तरीका",
            receiptStatus: "स्थिति",
            receiptMessage: "संदेश",
            receiptAnonymous: "गुमनाम",
            receiptPrint: "रसीद प्रिंट करें",
            receiptFooter: "यह रसीद आपके उदार योगदान की पुष्टि करती है। 100% कहानियों को जीवंत करने में जाता है। 🎥",
        },
        ja: {
            praiseWords: "素晴らしい！🌟|真のサポーター！💫|映画の英雄！🎬|ありがとう！❤️|伝説！🏆",
            loadMoreDonations: "寄付をもっと読み込む",
            receiptTitle: "寄付領収書",
            receiptThankYou: "ご支援ありがとうございます",
            receiptDate: "日付",
            receiptDonor: "寄付者",
            receiptMethod: "方法",
            receiptStatus: "状態",
            receiptMessage: "メッセージ",
            receiptAnonymous: "匿名",
            receiptPrint: "領収書を印刷",
            receiptFooter: "この領収書はあなたの寛大な貢献を確認します。100%が物語を実現するために使われます。🎥",
        },
        ko: {
            praiseWords: "당신은 놀랍습니다! 🌟|진정한 후원자! 💫|영화 영웅! 🎬|감사합니다! ❤️|전설! 🏆",
            loadMoreDonations: "더 많은 기부 불러오기",
            receiptTitle: "기부 영수증",
            receiptThankYou: "지원에 감사드립니다",
            receiptDate: "날짜",
            receiptDonor: "기부자",
            receiptMethod: "방법",
            receiptStatus: "상태",
            receiptMessage: "메시지",
            receiptAnonymous: "익명",
            receiptPrint: "영수증 인쇄",
            receiptFooter: "이 영수증은 귀하의 관대한 기부를 확인합니다. 100%가 이야기를 실현하는 데 사용됩니다. 🎥",
        },
        pt: {
            praiseWords: "Você é incrível! 🌟|Verdadeiro apoiador! 💫|Herói do cinema! 🎬|Obrigado! ❤️|Lenda! 🏆",
            loadMoreDonations: "Carregar mais doações",
            receiptTitle: "Recibo de doação",
            receiptThankYou: "Obrigado pelo seu apoio",
            receiptDate: "Data",
            receiptDonor: "Doador",
            receiptMethod: "Método",
            receiptStatus: "Status",
            receiptMessage: "Mensagem",
            receiptAnonymous: "Anônimo",
            receiptPrint: "Imprimir recibo",
            receiptFooter: "Este recibo confirma sua generosa contribuição. 100% vai para dar vida às histórias. 🎥",
        },
        ru: {
            praiseWords: "Вы замечательны! 🌟|Настоящий сторонник! 💫|Герой кино! 🎬|Спасибо! ❤️|Легенда! 🏆",
            loadMoreDonations: "Загрузить больше пожертвований",
            receiptTitle: "Квитанция о пожертвовании",
            receiptThankYou: "Спасибо за вашу поддержку",
            receiptDate: "Дата",
            receiptDonor: "Жертвователь",
            receiptMethod: "Метод",
            receiptStatus: "Статус",
            receiptMessage: "Сообщение",
            receiptAnonymous: "Анонимно",
            receiptPrint: "Распечатать квитанцию",
            receiptFooter: "Эта квитанция подтверждает ваш щедрый вклад. 100% идёт на воплощение историй в жизнь. 🎥",
        },
        zh: {
            praiseWords: "你太棒了！🌟|真正的支持者！💫|电影英雄！🎬|谢谢！❤️|传奇！🏆",
            loadMoreDonations: "加载更多捐款",
            receiptTitle: "捐款收据",
            receiptThankYou: "感谢您的支持",
            receiptDate: "日期",
            receiptDonor: "捐助者",
            receiptMethod: "方式",
            receiptStatus: "状态",
            receiptMessage: "留言",
            receiptAnonymous: "匿名",
            receiptPrint: "打印收据",
            receiptFooter: "此收据确认您的慷慨贡献。100%用于将故事带入生活。🎥",
        },
    },
    // ── profileTab namespace ──────────────────────────────────────
    profileTab: {
        en: { theme: "Theme", accentColour: "Accent Colour" },
        ar: { theme: "المظهر", accentColour: "لون التمييز" },
        de: { theme: "Design", accentColour: "Akzentfarbe" },
        es: { theme: "Tema", accentColour: "Color de acento" },
        fr: { theme: "Thème", accentColour: "Couleur d'accentuation" },
        hi: { theme: "थीम", accentColour: "एक्सेंट रंग" },
        ja: { theme: "テーマ", accentColour: "アクセントカラー" },
        ko: { theme: "테마", accentColour: "강조 색상" },
        pt: { theme: "Tema", accentColour: "Cor de destaque" },
        ru: { theme: "Тема", accentColour: "Цвет акцента" },
        zh: { theme: "主题", accentColour: "强调色" },
    },
}

let totalAdded = 0

for (const locale of locales) {
    const filePath = join(messagesDir, `${locale}.json`)
    const data = JSON.parse(readFileSync(filePath, 'utf8'))
    let added = 0

    for (const [namespace, localeMap] of Object.entries(newKeys)) {
        const translations = localeMap[locale] || localeMap['en'] // fallback to English
        if (!data[namespace]) data[namespace] = {}
        for (const [key, value] of Object.entries(translations)) {
            if (!data[namespace][key]) {
                data[namespace][key] = value
                added++
            }
        }
    }

    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
    console.log(`✅ ${locale}.json — added ${added} keys`)
    totalAdded += added
}

console.log(`\nDone! Total keys added: ${totalAdded}`)
