const fs = require('fs')
const path = require('path')

const messagesDir = path.join(__dirname, 'src', 'messages')

const navTranslations = {
  en: { home:'Home', works:'Works', upcoming:'Upcoming', casting:'Casting', scripts:'Scripts', training:'Training', donate:'Donate', dashboard:'Dashboard', signOut:'Sign Out', signIn:'Sign In', language:'Language', admin:'Admin', member:'Member', guest:'Guest', discover:'Discover', about:'About' },
  ar: { home:'الرئيسية', works:'الأعمال', upcoming:'القادم', casting:'الأدوار', scripts:'السيناريوهات', training:'التدريب', donate:'تبرع', dashboard:'لوحة التحكم', signOut:'تسجيل الخروج', signIn:'تسجيل الدخول', language:'اللغة', admin:'مسؤول', member:'عضو', guest:'زائر', discover:'استكشف', about:'حول' },
  de: { home:'Startseite', works:'Werke', upcoming:'Demnächst', casting:'Casting', scripts:'Drehbücher', training:'Training', donate:'Spenden', dashboard:'Dashboard', signOut:'Abmelden', signIn:'Anmelden', language:'Sprache', admin:'Admin', member:'Mitglied', guest:'Gast', discover:'Entdecken', about:'Über uns' },
  es: { home:'Inicio', works:'Obras', upcoming:'Próximamente', casting:'Casting', scripts:'Guiones', training:'Formación', donate:'Donar', dashboard:'Panel', signOut:'Cerrar sesión', signIn:'Iniciar sesión', language:'Idioma', admin:'Admin', member:'Miembro', guest:'Invitado', discover:'Explorar', about:'Acerca de' },
  fr: { home:'Accueil', works:'Œuvres', upcoming:'À venir', casting:'Casting', scripts:'Scénarios', training:'Formation', donate:'Faire un don', dashboard:'Tableau de bord', signOut:'Se déconnecter', signIn:'Se connecter', language:'Langue', admin:'Admin', member:'Membre', guest:'Invité', discover:'Découvrir', about:'À propos' },
  hi: { home:'होम', works:'काम', upcoming:'आगामी', casting:'कास्टिंग', scripts:'स्क्रिप्ट', training:'प्रशिक्षण', donate:'दान करें', dashboard:'डैशबोर्ड', signOut:'लॉग आउट', signIn:'लॉग इन', language:'भाषा', admin:'एडमिन', member:'सदस्य', guest:'अतिथि', discover:'खोजें', about:'हमारे बारे में' },
  ja: { home:'ホーム', works:'作品', upcoming:'近日公開', casting:'キャスティング', scripts:'脚本', training:'トレーニング', donate:'寄付', dashboard:'ダッシュボード', signOut:'サインアウト', signIn:'サインイン', language:'言語', admin:'管理者', member:'会員', guest:'ゲスト', discover:'発見する', about:'について' },
  ko: { home:'홈', works:'작품', upcoming:'예정', casting:'캐스팅', scripts:'대본', training:'교육', donate:'기부', dashboard:'대시보드', signOut:'로그아웃', signIn:'로그인', language:'언어', admin:'관리자', member:'회원', guest:'손님', discover:'탐색', about:'소개' },
  pt: { home:'Início', works:'Obras', upcoming:'Em breve', casting:'Casting', scripts:'Roteiros', training:'Treinamento', donate:'Doar', dashboard:'Painel', signOut:'Sair', signIn:'Entrar', language:'Idioma', admin:'Admin', member:'Membro', guest:'Convidado', discover:'Explorar', about:'Sobre' },
  ru: { home:'Главная', works:'Работы', upcoming:'Скоро', casting:'Кастинг', scripts:'Сценарии', training:'Обучение', donate:'Пожертвовать', dashboard:'Панель', signOut:'Выйти', signIn:'Войти', language:'Язык', admin:'Администратор', member:'Участник', guest:'Гость', discover:'Обзор', about:'О нас' },
  zh: { home:'首页', works:'作品', upcoming:'即将上线', casting:'选角', scripts:'剧本', training:'培训', donate:'捐款', dashboard:'仪表板', signOut:'退出登录', signIn:'登录', language:'语言', admin:'管理员', member:'成员', guest:'访客', discover:'探索', about:'关于' },
}

for (const [lang, navKeys] of Object.entries(navTranslations)) {
  const filePath = path.join(messagesDir, `${lang}.json`)
  if (!fs.existsSync(filePath)) { console.log(`SKIP: ${lang}.json not found`); continue }

  let data
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch (e) { console.error(`PARSE ERROR ${lang}:`, e); continue }

  if (data.nav) {
    // Merge — only add missing keys
    data.nav = { ...navKeys, ...data.nav }
    console.log(`MERGE: ${lang}.json (nav already existed)`)
  } else {
    data.nav = navKeys
    console.log(`ADD: ${lang}.json nav section added`)
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' })
}

console.log('Done!')
