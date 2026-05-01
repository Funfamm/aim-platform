/**
 * Translation patch script — adds missing keys to all locale files.
 * Uses fs.writeFileSync with explicit utf8 encoding (no BOM).
 * Run with: node scripts/patch-translations.js
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

// All missing translations organized by section > key > locale
const patches = {
  hero: {
    titleAccentPrefix: {
      es: "que",
      fr: "qui",
      ar: "التي",
      zh: "那些",
      hi: "जो",
      pt: "que",
      ru: "которые",
      ja: "その",
      de: "die",
      ko: "그"
    }
  },
  threeWaysIn: {
    eyebrow: {
      es: "TRES FORMAS DE ENTRAR",
      fr: "TROIS FAÇONS D'ENTRER",
      ar: "ثلاث طرق للدخول",
      zh: "三种参与方式",
      hi: "तीन रास्ते",
      pt: "TRÊS FORMAS DE ENTRAR",
      ru: "ТРИ ПУТИ",
      ja: "3つの扉",
      de: "DREI WEGE HINEIN",
      ko: "세 가지 길"
    },
    title: {
      es: "Un estudio.",
      fr: "Un studio.",
      ar: "استوديو واحد.",
      zh: "一个工作室。",
      hi: "एक स्टूडियो।",
      pt: "Um estúdio.",
      ru: "Одна студия.",
      ja: "ひとつのスタジオ。",
      de: "Ein Studio.",
      ko: "하나의 스튜디오."
    },
    titleAccent: {
      es: "Tres puertas.",
      fr: "Trois portes.",
      ar: "ثلاثة أبواب.",
      zh: "三扇门。",
      hi: "तीन दरवाज़े।",
      pt: "Três portas.",
      ru: "Три двери.",
      ja: "3つの扉。",
      de: "Drei Türen.",
      ko: "세 개의 문."
    },
    card1Title: {
      es: "Mira",
      fr: "Regardez",
      ar: "شاهد",
      zh: "观看",
      hi: "देखें",
      pt: "Assista",
      ru: "Смотрите",
      ja: "観る",
      de: "Ansehen",
      ko: "감상하기"
    },
    card1Sub: {
      es: "CINE QUE VALE LA PENA VER",
      fr: "UN CINÉMA QUI MÉRITE D'ÊTRE VU",
      ar: "سينما تستحق المشاهدة",
      zh: "值得见证的电影",
      hi: "देखने योग्य सिनेमा",
      pt: "CINEMA QUE VALE A PENA VER",
      ru: "КИНО, ДОСТОЙНОЕ ВНИМАНИЯ",
      ja: "観る価値のある映画",
      de: "KINO, DAS ES WERT IST",
      ko: "볼 가치가 있는 영화"
    },
    card1Body: {
      es: "Películas sobre los momentos que importaron. Los sacrificios, los arrepentimientos, las personas por las que haríamos cualquier cosa.",
      fr: "Des films sur les moments qui comptaient. Les sacrifices, les regrets, les personnes pour lesquelles on ferait n'importe quoi.",
      ar: "أفلام عن اللحظات التي كانت مهمة. التضحيات، والندم، والأشخاص الذين نفعل أي شيء من أجلهم.",
      zh: "关于那些重要时刻的电影。那些牺牲、遗憾，以及我们愿意为之付出一切的人。",
      hi: "उन पलों के बारे में फ़िल्में जो मायने रखते थे। बलिदान, पछतावे, वे लोग जिनके लिए हम कुछ भी करेंगे।",
      pt: "Filmes sobre os momentos que importaram. Os sacrifícios, os arrependimentos, as pessoas pelas quais faríamos qualquer coisa.",
      ru: "Фильмы о моментах, которые имели значение. Жертвы, сожаления, люди, ради которых мы готовы на всё.",
      ja: "大切な瞬間を描いた映画。犠牲、後悔、そして何でもしてあげたい人たち。",
      de: "Filme über die Momente, die zählten. Die Opfer, das Bedauern, die Menschen, für die wir alles tun würden.",
      ko: "중요했던 순간에 대한 영화. 희생, 후회, 그리고 무엇이든 해주고 싶은 사람들."
    },
    card1Cta: {
      es: "Ver las películas",
      fr: "Voir les films",
      ar: "شاهد الأفلام",
      zh: "观看影片",
      hi: "फ़िल्में देखें",
      pt: "Ver os filmes",
      ru: "Смотреть фильмы",
      ja: "映画を観る",
      de: "Filme ansehen",
      ko: "영화 보기"
    },
    card2Title: {
      es: "Participa",
      fr: "Participez",
      ar: "شارك فيه",
      zh: "参与其中",
      hi: "इसमें शामिल हों",
      pt: "Participe",
      ru: "Участвуйте",
      ja: "出演する",
      de: "Mitmachen",
      ko: "참여하기"
    },
    card2Sub: {
      es: "VÉTE EN PANTALLA",
      fr: "VOYEZ-VOUS À L'ÉCRAN",
      ar: "شاهد نفسك على الشاشة",
      zh: "在银幕上看到自己",
      hi: "स्क्रीन पर खुद को देखें",
      pt: "VEJA-SE NA TELA",
      ru: "УВИДЬТЕ СЕБЯ НА ЭКРАНЕ",
      ja: "スクリーンに映る自分を見る",
      de: "SEHEN SIE SICH AUF DER LEINWAND",
      ko: "스크린에서 나를 만나다"
    },
    card2Body: {
      es: "Convocatorias reales para nuestras próximas producciones. No se necesita experiencia. Solo trae algo auténtico.",
      fr: "De vrais castings pour nos prochaines productions. Aucune expérience requise. Apportez juste quelque chose de vrai.",
      ar: "اختبارات أداء حقيقية لإنتاجاتنا القادمة. لا حاجة لخبرة سابقة. فقط أحضر شيئاً حقيقياً.",
      zh: "为我们下一部作品进行的真实选角。无需经验。只需带来真实的自己。",
      hi: "हमारी अगली प्रोडक्शन के लिए असली कास्टिंग कॉल। अनुभव की ज़रूरत नहीं। बस कुछ सच्चा लेकर आएं।",
      pt: "Chamadas reais de elenco para nossas próximas produções. Não é necessária experiência. Apenas traga algo verdadeiro.",
      ru: "Настоящие кастинги для наших будущих проектов. Опыт не требуется. Просто принесите что-то настоящее.",
      ja: "次回作のリアルなキャスティング募集。経験不問。ありのままの自分を持ってきてください。",
      de: "Echte Castings für unsere nächsten Produktionen. Keine Erfahrung nötig. Bringen Sie einfach etwas Echtes mit.",
      ko: "다음 작품을 위한 실제 캐스팅 콜. 경험 불필요. 진심만 가져오세요."
    },
    card2Cta: {
      es: "Ver roles abiertos",
      fr: "Voir les rôles",
      ar: "عرض الأدوار المتاحة",
      zh: "查看开放角色",
      hi: "खुली भूमिकाएँ देखें",
      pt: "Ver papéis abertos",
      ru: "Открытые роли",
      ja: "募集中の役を見る",
      de: "Offene Rollen ansehen",
      ko: "오픈 역할 보기"
    },
    card3Title: {
      es: "Aprende a hacerlo",
      fr: "Apprenez à créer",
      ar: "تعلّم صناعته",
      zh: "学习制作",
      hi: "बनाना सीखें",
      pt: "Aprenda a criar",
      ru: "Научитесь снимать",
      ja: "作り方を学ぶ",
      de: "Lernen Sie es zu machen",
      ko: "만드는 법 배우기"
    },
    card3Sub: {
      es: "LA PRÓXIMA GENERACIÓN DEL CINE",
      fr: "LA PROCHAINE GÉNÉRATION DU CINÉMA",
      ar: "الجيل القادم من السينما",
      zh: "电影的下一代",
      hi: "सिनेमा की अगली पीढ़ी",
      pt: "A PRÓXIMA GERAÇÃO DO CINEMA",
      ru: "СЛЕДУЮЩЕЕ ПОКОЛЕНИЕ КИНО",
      ja: "映画の次世代",
      de: "DIE NÄCHSTE GENERATION DES KINOS",
      ko: "영화의 다음 세대"
    },
    card3Body: {
      es: "Entrena con nosotros. Construye con IA. Haz películas que importen.",
      fr: "Formez-vous avec nous. Créez avec l'IA. Faites des films qui comptent.",
      ar: "تدرّب معنا. ابنِ بالذكاء الاصطناعي. اصنع أفلاماً ذات معنى.",
      zh: "与我们一起训练。用AI创作。制作有意义的电影。",
      hi: "हमारे साथ प्रशिक्षण लें। AI के साथ बनाएं। ऐसी फ़िल्में बनाएं जो मायने रखें।",
      pt: "Treine conosco. Construa com IA. Faça filmes que importam.",
      ru: "Тренируйтесь с нами. Создавайте с помощью ИИ. Снимайте кино, которое имеет значение.",
      ja: "私たちと一緒にトレーニング。AIで制作。意味のある映画を作ろう。",
      de: "Trainieren Sie mit uns. Bauen Sie mit KI. Machen Sie Filme, die zählen.",
      ko: "우리와 함께 훈련하세요. AI로 만드세요. 의미 있는 영화를 만드세요."
    },
    card3Cta: {
      es: "Explorar formación",
      fr: "Explorer la formation",
      ar: "استكشف التدريب",
      zh: "探索培训",
      hi: "प्रशिक्षण देखें",
      pt: "Explorar treinamento",
      ru: "Обучение",
      ja: "トレーニングを探す",
      de: "Training erkunden",
      ko: "트레이닝 살펴보기"
    }
  },
  footer: {
    brandSignature: {
      es: "NO APARTES LA MIRADA.",
      fr: "NE DÉTOURNEZ PAS LE REGARD.",
      ar: "لا تشح بنظرك.",
      zh: "别移开目光。",
      hi: "नज़रें मत हटाओ।",
      pt: "NÃO DESVIE O OLHAR.",
      ru: "НЕ ОТВОДИ ВЗГЛЯД.",
      ja: "目を逸らすな。",
      de: "SCHAU NICHT WEG.",
      ko: "눈을 돌리지 마세요."
    }
  },
  about: {
    heroSubtitleP2: {
      es: "Hacemos estas películas con IA - no porque la tecnología sea el punto, sino porque es la única manera en que un estudio de nuestro tamaño podría contar historias tan grandes. Las herramientas son nuevas. Los sentimientos son tan antiguos como la familia de cualquiera.",
      fr: "Nous réalisons ces films avec l'IA - non pas parce que la technologie est le sujet, mais parce que c'est la seule façon pour un studio de notre taille de raconter des histoires aussi grandes. Les outils sont nouveaux. Les émotions sont aussi anciennes que n'importe quelle famille.",
      ar: "نصنع هذه الأفلام بالذكاء الاصطناعي - ليس لأن التكنولوجيا هي الهدف، بل لأنها الطريقة الوحيدة التي يمكن لاستوديو بحجمنا أن يروي قصصاً بهذا الحجم. الأدوات جديدة. المشاعر قديمة قِدم عائلة أي شخص.",
      zh: "我们用AI制作这些电影——不是因为技术是重点，而是因为这是我们这样规模的工作室讲述如此宏大故事的唯一方式。工具是新的。感受却和每个人的家庭一样古老。",
      hi: "हम ये फ़िल्में AI से बनाते हैं - इसलिए नहीं कि तकनीक ही मुद्दा है, बल्कि इसलिए कि हमारे जैसे छोटे स्टूडियो के लिए इतनी बड़ी कहानियाँ कहने का यही एकमात्र तरीका है। उपकरण नए हैं। भावनाएँ किसी के भी परिवार जितनी पुरानी हैं।",
      pt: "Fazemos estes filmes com IA - não porque a tecnologia seja o ponto, mas porque é a única forma de um estúdio do nosso tamanho contar histórias tão grandes. As ferramentas são novas. Os sentimentos são tão antigos quanto a família de qualquer pessoa.",
      ru: "Мы снимаем эти фильмы с помощью ИИ - не потому что технология главное, а потому что это единственный способ для студии нашего размера рассказывать такие масштабные истории. Инструменты новые. Чувства стары как мир.",
      ja: "私たちはAIでこれらの映画を制作しています。技術が主役だからではなく、私たちのような小さなスタジオがこれほど大きな物語を語れる唯一の方法だからです。ツールは新しい。しかし感情は、誰の家族と同じくらい古いものです。",
      de: "Wir machen diese Filme mit KI - nicht weil die Technologie der Punkt ist, sondern weil es die einzige Möglichkeit ist, wie ein Studio unserer Größe so große Geschichten erzählen kann. Die Werkzeuge sind neu. Die Gefühle sind so alt wie jede Familie.",
      ko: "우리는 AI로 이 영화들을 만듭니다 - 기술이 핵심이어서가 아니라, 우리 규모의 스튜디오가 이렇게 큰 이야기를 할 수 있는 유일한 방법이기 때문입니다. 도구는 새롭습니다. 감정은 누구의 가족만큼이나 오래된 것입니다."
    }
  }
};

const locales = ['es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'de', 'ko'];

let totalPatched = 0;

for (const locale of locales) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  for (const [section, keys] of Object.entries(patches)) {
    if (!data[section]) {
      data[section] = {};
    }
    for (const [key, translations] of Object.entries(keys)) {
      if (translations[locale] && !data[section][key]) {
        data[section][key] = translations[locale];
        totalPatched++;
      }
    }
  }

  // Write with explicit UTF8 no BOM
  const output = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, output, 'utf8');
  console.log(`Patched ${locale}.json`);
}

console.log(`\nDone! Total entries patched: ${totalPatched}`);
