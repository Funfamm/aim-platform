/**
 * Translation script — adds missing i18n keys for the conversion funnel
 * Uses Node.js fs (no PowerShell) to write UTF-8 without BOM
 */
const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

// New keys to add per locale
const translations = {
  // === subscribe section new keys ===
  subscribe: {
    watchFreePrompt: {
      en: "Watch our films free — create your account",
      es: "Mira nuestras películas gratis — crea tu cuenta",
      fr: "Regardez nos films gratuitement — créez votre compte",
      de: "Unsere Filme kostenlos ansehen — erstelle dein Konto",
      pt: "Assista nossos filmes de graça — crie sua conta",
      ar: "شاهد أفلامنا مجانًا — أنشئ حسابك",
      zh: "免费观看我们的电影 — 创建您的账户",
      hi: "हमारी फ़िल्में मुफ़्त देखें — अपना खाता बनाएँ",
      ja: "映画を無料で視聴 — アカウントを作成",
      ko: "무료로 영화 감상 — 계정을 만드세요",
      ru: "Смотрите наши фильмы бесплатно — создайте аккаунт"
    },
    createAccountTitle: {
      en: "Watch Our Films Free",
      es: "Mira Nuestras Películas Gratis",
      fr: "Regardez Nos Films Gratuitement",
      de: "Unsere Filme Kostenlos Ansehen",
      pt: "Assista Nossos Filmes de Graça",
      ar: "شاهد أفلامنا مجانًا",
      zh: "免费观看我们的电影",
      hi: "हमारी फ़िल्में मुफ़्त देखें",
      ja: "映画を無料で視聴",
      ko: "무료로 영화 감상",
      ru: "Смотрите Наши Фильмы Бесплатно"
    },
    createAccountDesc: {
      en: "Create a free account to watch full films, apply for casting roles, and join the community.",
      es: "Crea una cuenta gratuita para ver películas completas, postularte a roles de casting y unirte a la comunidad.",
      fr: "Créez un compte gratuit pour regarder des films, postuler à des rôles et rejoindre la communauté.",
      de: "Erstelle ein kostenloses Konto, um Filme anzusehen, dich für Rollen zu bewerben und der Community beizutreten.",
      pt: "Crie uma conta gratuita para assistir filmes completos, candidatar-se a papéis e participar da comunidade.",
      ar: "أنشئ حسابًا مجانيًا لمشاهدة الأفلام الكاملة والتقدم لأدوار التمثيل والانضمام إلى المجتمع.",
      zh: "创建免费账户以观看完整电影、申请演员角色并加入社区。",
      hi: "पूरी फ़िल्में देखने, कास्टिंग रोल के लिए आवेदन करने और समुदाय में शामिल होने के लिए एक मुफ़्त खाता बनाएँ।",
      ja: "無料アカウントを作成して、映画を視聴し、キャスティングに応募し、コミュニティに参加しましょう。",
      ko: "무료 계정을 만들어 영화를 시청하고, 캐스팅에 지원하고, 커뮤니티에 참여하세요.",
      ru: "Создайте бесплатный аккаунт, чтобы смотреть фильмы, подавать заявки на роли и присоединиться к сообществу."
    },
    createAccountBtn: {
      en: "Create Your Free Account →",
      es: "Crea Tu Cuenta Gratis →",
      fr: "Créer Votre Compte Gratuit →",
      de: "Kostenloses Konto Erstellen →",
      pt: "Crie Sua Conta Grátis →",
      ar: "أنشئ حسابك المجاني ←",
      zh: "创建免费账户 →",
      hi: "अपना मुफ़्त खाता बनाएँ →",
      ja: "無料アカウントを作成 →",
      ko: "무료 계정 만들기 →",
      ru: "Создать Бесплатный Аккаунт →"
    }
  },

  // === projectDetail section new key ===
  projectDetail: {
    freeAccount: {
      en: "Watch Free — Create Account",
      es: "Ver Gratis — Crear Cuenta",
      fr: "Regarder Gratuitement — Créer un Compte",
      de: "Kostenlos Ansehen — Konto Erstellen",
      pt: "Assistir Grátis — Criar Conta",
      ar: "شاهد مجانًا — أنشئ حسابًا",
      zh: "免费观看 — 创建账户",
      hi: "मुफ़्त देखें — खाता बनाएँ",
      ja: "無料で視聴 — アカウント作成",
      ko: "무료 시청 — 계정 만들기",
      ru: "Смотреть Бесплатно — Создать Аккаунт"
    }
  },

  // === register section new keys ===
  register: {
    continueApple: {
      en: "Continue with Apple",
      es: "Continuar con Apple",
      fr: "Continuer avec Apple",
      de: "Weiter mit Apple",
      pt: "Continuar com Apple",
      ar: "المتابعة مع Apple",
      zh: "使用Apple继续",
      hi: "Apple से जारी रखें",
      ja: "Appleで続ける",
      ko: "Apple로 계속",
      ru: "Продолжить с Apple"
    },
    orRegisterEmail: {
      en: "or register with email",
      es: "o regístrate con email",
      fr: "ou inscrivez-vous par email",
      de: "oder mit E-Mail registrieren",
      pt: "ou registre-se com email",
      ar: "أو سجل بالبريد الإلكتروني",
      zh: "或使用邮箱注册",
      hi: "या ईमेल से पंजीकरण करें",
      ja: "またはメールで登録",
      ko: "또는 이메일로 가입",
      ru: "или зарегистрируйтесь по email"
    },
    valuePropFilms: {
      en: "Watch full films for free",
      es: "Mira películas completas gratis",
      fr: "Regardez des films complets gratuitement",
      de: "Filme kostenlos in voller Länge ansehen",
      pt: "Assista filmes completos de graça",
      ar: "شاهد الأفلام الكاملة مجانًا",
      zh: "免费观看完整电影",
      hi: "पूरी फ़िल्में मुफ़्त देखें",
      ja: "映画を全編無料で視聴",
      ko: "전체 영화 무료 시청",
      ru: "Смотрите полные фильмы бесплатно"
    },
    valuePropCasting: {
      en: "Apply for casting roles",
      es: "Postúlate a roles de casting",
      fr: "Postulez à des rôles de casting",
      de: "Bewirb dich für Casting-Rollen",
      pt: "Candidate-se a papéis de casting",
      ar: "تقدم لأدوار التمثيل",
      zh: "申请演员角色",
      hi: "कास्टिंग रोल के लिए आवेदन करें",
      ja: "キャスティングの役に応募",
      ko: "캐스팅 역할에 지원",
      ru: "Подайте заявку на кастинг"
    },
    valuePropCommunity: {
      en: "Join the community",
      es: "Únete a la comunidad",
      fr: "Rejoignez la communauté",
      de: "Tritt der Community bei",
      pt: "Junte-se à comunidade",
      ar: "انضم إلى المجتمع",
      zh: "加入社区",
      hi: "समुदाय में शामिल हों",
      ja: "コミュニティに参加",
      ko: "커뮤니티에 참여",
      ru: "Присоединяйтесь к сообществу"
    }
  }
};

const locales = ['en', 'es', 'fr', 'de', 'pt', 'ar', 'zh', 'hi', 'ja', 'ko', 'ru'];

for (const locale of locales) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);

  let changed = false;

  for (const [section, keys] of Object.entries(translations)) {
    if (!json[section]) {
      console.log(`  [WARN] Section "${section}" not found in ${locale}.json — skipping`);
      continue;
    }
    for (const [key, vals] of Object.entries(keys)) {
      if (!json[section][key]) {
        json[section][key] = vals[locale] || vals.en;
        changed = true;
        console.log(`  [ADD] ${locale}: ${section}.${key}`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    console.log(`✅ Updated ${locale}.json`);
  } else {
    console.log(`⏭ ${locale}.json — no changes needed`);
  }
}

console.log('\nDone! All locale files updated.');
