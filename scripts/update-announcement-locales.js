#!/usr/bin/env node
/**
 * update-announcement-locales.js
 * Injects rich-text announcement translation keys into all 11 locale JSON files.
 * Uses Node.js fs — NO PowerShell, NO BOM.
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

// Keys to add under announcements namespace in each locale
const TRANSLATIONS = {
    en: {
        announcements: {
            pageTitle: "Announcements",
            pageSubtitle: "Stay up to date with the latest news and updates from AIM Studio.",
            noAnnouncements: "No announcements yet",
            noAnnouncementsDesc: "Check back soon for updates from the studio.",
            readMore: "Read more",
            learnMore: "Learn more",
            postedOn: "Posted on",
            backToAnnouncements: "Back to Announcements",
        }
    },
    ar: {
        announcements: {
            pageTitle: "الإعلانات",
            pageSubtitle: "ابقَ على اطلاع بآخر الأخبار والتحديثات من AIM Studio.",
            noAnnouncements: "لا توجد إعلانات بعد",
            noAnnouncementsDesc: "تابعنا قريباً للاطلاع على آخر الأخبار من الاستوديو.",
            readMore: "اقرأ المزيد",
            learnMore: "اعرف المزيد",
            postedOn: "نُشر في",
            backToAnnouncements: "العودة إلى الإعلانات",
        }
    },
    fr: {
        announcements: {
            pageTitle: "Annonces",
            pageSubtitle: "Restez informé des dernières nouvelles et mises à jour d'AIM Studio.",
            noAnnouncements: "Aucune annonce pour l'instant",
            noAnnouncementsDesc: "Revenez bientôt pour les dernières nouvelles du studio.",
            readMore: "Lire la suite",
            learnMore: "En savoir plus",
            postedOn: "Publié le",
            backToAnnouncements: "Retour aux annonces",
        }
    },
    es: {
        announcements: {
            pageTitle: "Anuncios",
            pageSubtitle: "Mantente al día con las últimas noticias y actualizaciones de AIM Studio.",
            noAnnouncements: "Aún no hay anuncios",
            noAnnouncementsDesc: "Vuelve pronto para ver las novedades del estudio.",
            readMore: "Leer más",
            learnMore: "Saber más",
            postedOn: "Publicado el",
            backToAnnouncements: "Volver a anuncios",
        }
    },
    de: {
        announcements: {
            pageTitle: "Ankündigungen",
            pageSubtitle: "Bleib mit den neuesten Nachrichten und Updates von AIM Studio auf dem Laufenden.",
            noAnnouncements: "Noch keine Ankündigungen",
            noAnnouncementsDesc: "Schau bald wieder vorbei für Updates aus dem Studio.",
            readMore: "Mehr lesen",
            learnMore: "Mehr erfahren",
            postedOn: "Veröffentlicht am",
            backToAnnouncements: "Zurück zu Ankündigungen",
        }
    },
    pt: {
        announcements: {
            pageTitle: "Anúncios",
            pageSubtitle: "Fique por dentro das últimas notícias e atualizações do AIM Studio.",
            noAnnouncements: "Nenhum anúncio ainda",
            noAnnouncementsDesc: "Volte em breve para ver as novidades do estúdio.",
            readMore: "Leia mais",
            learnMore: "Saiba mais",
            postedOn: "Publicado em",
            backToAnnouncements: "Voltar aos anúncios",
        }
    },
    hi: {
        announcements: {
            pageTitle: "घोषणाएं",
            pageSubtitle: "AIM Studio की नवीनतम खबरों और अपडेट से अपडेट रहें।",
            noAnnouncements: "अभी तक कोई घोषणा नहीं",
            noAnnouncementsDesc: "स्टूडियो से अपडेट के लिए जल्द वापस आएं।",
            readMore: "और पढ़ें",
            learnMore: "अधिक जानें",
            postedOn: "पर पोस्ट किया गया",
            backToAnnouncements: "घोषणाओं पर वापस जाएं",
        }
    },
    ko: {
        announcements: {
            pageTitle: "공지사항",
            pageSubtitle: "AIM Studio의 최신 소식과 업데이트를 확인하세요.",
            noAnnouncements: "아직 공지사항이 없습니다",
            noAnnouncementsDesc: "스튜디오 업데이트를 위해 곧 다시 방문해 주세요.",
            readMore: "더 읽기",
            learnMore: "자세히 알아보기",
            postedOn: "게시일",
            backToAnnouncements: "공지사항으로 돌아가기",
        }
    },
    zh: {
        announcements: {
            pageTitle: "公告",
            pageSubtitle: "随时了解 AIM Studio 的最新动态和更新。",
            noAnnouncements: "暂无公告",
            noAnnouncementsDesc: "请稍后回来查看工作室的最新动态。",
            readMore: "阅读更多",
            learnMore: "了解更多",
            postedOn: "发布于",
            backToAnnouncements: "返回公告",
        }
    },
    ru: {
        announcements: {
            pageTitle: "Объявления",
            pageSubtitle: "Будьте в курсе последних новостей и обновлений AIM Studio.",
            noAnnouncements: "Пока нет объявлений",
            noAnnouncementsDesc: "Загляните скоро за новостями студии.",
            readMore: "Читать далее",
            learnMore: "Узнать больше",
            postedOn: "Опубликовано",
            backToAnnouncements: "Назад к объявлениям",
        }
    },
    ja: {
        announcements: {
            pageTitle: "お知らせ",
            pageSubtitle: "AIM Studioの最新ニュースとアップデートをご確認ください。",
            noAnnouncements: "まだお知らせはありません",
            noAnnouncementsDesc: "スタジオからのアップデートを近日中にご確認ください。",
            readMore: "続きを読む",
            learnMore: "詳しく見る",
            postedOn: "投稿日",
            backToAnnouncements: "お知らせに戻る",
        }
    },
}

let updated = 0
let skipped = 0

for (const [locale, newKeys] of Object.entries(TRANSLATIONS)) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${locale}.json — file not found`)
        skipped++
        continue
    }

    // Read with explicit UTF-8 (never use PowerShell for this)
    const raw = fs.readFileSync(filePath, 'utf8')
    // Strip UTF-8 BOM if present (0xEF 0xBB 0xBF / \uFEFF) — some files have double BOM
    const clean = raw.replace(/^\uFEFF+/, '')
    let data
    try {
        data = JSON.parse(clean)
    } catch (e) {
        console.error(`❌ JSON parse error in ${locale}.json:`, e.message)
        skipped++
        continue
    }

    // Deep merge — preserve existing keys, only add missing ones
    if (!data.announcements) {
        data.announcements = {}
    }
    let added = 0
    for (const [key, value] of Object.entries(newKeys.announcements)) {
        if (!data.announcements[key]) {
            data.announcements[key] = value
            added++
        }
    }

    if (added === 0) {
        console.log(`⏭  ${locale}.json — all keys already present`)
        skipped++
        continue
    }

    // Write UTF-8 NoBOM — NEVER use PowerShell Set-Content for this
    const output = JSON.stringify(data, null, 4)
    fs.writeFileSync(filePath, output, { encoding: 'utf8' })
    console.log(`✅ ${locale}.json — added ${added} key(s)`)
    updated++
}

console.log(`\nDone: ${updated} file(s) updated, ${skipped} skipped.`)
