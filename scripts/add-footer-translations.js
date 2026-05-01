/**
 * Adds missing footer translation keys to all locale JSON files.
 * Uses UTF-8 without BOM to avoid breaking Next.js / next-intl.
 */
const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '..', 'messages');

// New keys to add to the "footer" namespace
const newKeys = {
  ja: {
    watchFreeTitle: "映画を無料で視聴",
    watchFreeDesc: "無料アカウントを作成して、映画を視聴し、キャスティングに応募しましょう。",
    watchFreeBtn: "無料アカウントを作成 →"
  },
  es: {
    watchFreeTitle: "Mira nuestras películas gratis",
    watchFreeDesc: "Crea una cuenta gratuita para ver películas completas y postularte a roles de casting.",
    watchFreeBtn: "Crear Cuenta Gratis →"
  },
  fr: {
    watchFreeTitle: "Regardez nos films gratuitement",
    watchFreeDesc: "Créez un compte gratuit pour regarder nos films et postuler aux castings.",
    watchFreeBtn: "Créer un Compte Gratuit →"
  },
  ar: {
    watchFreeTitle: "شاهد أفلامنا مجاناً",
    watchFreeDesc: "أنشئ حساباً مجانياً لمشاهدة الأفلام الكاملة والتقدم لأدوار التمثيل.",
    watchFreeBtn: "إنشاء حساب مجاني ←"
  },
  zh: {
    watchFreeTitle: "免费观看我们的电影",
    watchFreeDesc: "创建免费账户，观看完整电影并申请演员角色。",
    watchFreeBtn: "创建免费账户 →"
  },
  hi: {
    watchFreeTitle: "हमारी फ़िल्में मुफ़्त देखें",
    watchFreeDesc: "पूरी फ़िल्में देखने और कास्टिंग भूमिकाओं के लिए आवेदन करने हेतु मुफ़्त खाता बनाएं।",
    watchFreeBtn: "मुफ़्त खाता बनाएं →"
  },
  pt: {
    watchFreeTitle: "Assista nossos filmes de graça",
    watchFreeDesc: "Crie uma conta gratuita para assistir filmes completos e se candidatar a papéis.",
    watchFreeBtn: "Criar Conta Grátis →"
  },
  ru: {
    watchFreeTitle: "Смотрите наши фильмы бесплатно",
    watchFreeDesc: "Создайте бесплатный аккаунт, чтобы смотреть полные фильмы и подавать заявки на кастинг.",
    watchFreeBtn: "Создать Бесплатный Аккаунт →"
  },
  de: {
    watchFreeTitle: "Unsere Filme kostenlos ansehen",
    watchFreeDesc: "Erstellen Sie ein kostenloses Konto, um Filme anzusehen und sich für Casting-Rollen zu bewerben.",
    watchFreeBtn: "Kostenloses Konto Erstellen →"
  },
  ko: {
    watchFreeTitle: "무료로 영화 보기",
    watchFreeDesc: "무료 계정을 만들어 전체 영화를 감상하고 캐스팅에 지원하세요.",
    watchFreeBtn: "무료 계정 만들기 →"
  }
};

let updated = 0;
let skipped = 0;

for (const [locale, keys] of Object.entries(newKeys)) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${locale}.json not found`);
    skipped++;
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);

  if (!json.footer) {
    console.log(`SKIP: ${locale}.json has no "footer" section`);
    skipped++;
    continue;
  }

  // Check if already present
  if (json.footer.watchFreeTitle) {
    console.log(`SKIP: ${locale}.json already has watchFreeTitle`);
    skipped++;
    continue;
  }

  // Add the new keys
  json.footer.watchFreeTitle = keys.watchFreeTitle;
  json.footer.watchFreeDesc = keys.watchFreeDesc;
  json.footer.watchFreeBtn = keys.watchFreeBtn;

  // Write back without BOM
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`UPDATED: ${locale}.json — added 3 footer keys`);
  updated++;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
