/**
 * Add surveyPage locale keys to all 11 messages/*.json files.
 * Uses UTF8NoBOM encoding via Node's native fs.
 */
const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

const surveyPageStrings = {
    en: {
        title: "Shape What We Make Next",
        subtitle: "Tell us what you want to watch on AIM Studio. Your answer guides what we produce.",
        question: "What kind of films do you want to see?",
        selectAll: "Select all that apply",
        optional: "Anything else you'd love to see? (optional)",
        submit: "Submit",
        submitting: "Submitting...",
        thankYouTitle: "Thank you!",
        thankYouMessage: "Your voice is shaping what AIM Studio makes next. We'll be in touch when it's ready.",
        convertTitle: "Want to be the first to watch?",
        convertMessage: "Create a free account — it's free, and you'll get early access to everything we make.",
        convertButton: "Create Your Free Account",
        convertSkip: "Maybe later",
        alreadyResponded: "You've already shared your thoughts. We appreciate it — stay tuned for what's coming.",
        error: "Something went wrong, please try again.",
        categories: {
            action: "Action / Thriller",
            drama: "Drama & Family",
            documentary: "Documentary",
            horror: "Horror",
            romance: "Romance",
            shorts: "Short Films",
            all: "All of the above"
        }
    },
    es: {
        title: "Da Forma a Lo Que Hacemos",
        subtitle: "Dinos qué quieres ver en AIM Studio. Tu respuesta guía lo que producimos.",
        question: "¿Qué tipo de películas quieres ver?",
        selectAll: "Selecciona todo lo que aplique",
        optional: "¿Algo más que te gustaría ver? (opcional)",
        submit: "Enviar",
        submitting: "Enviando...",
        thankYouTitle: "¡Gracias!",
        thankYouMessage: "Tu voz está dando forma a lo que AIM Studio hará a continuación. Te avisaremos cuando esté listo.",
        convertTitle: "¿Quieres ser el primero en verlo?",
        convertMessage: "Crea una cuenta gratuita y tendrás acceso anticipado a todo lo que creemos.",
        convertButton: "Crear Tu Cuenta Gratis",
        convertSkip: "Quizás después",
        alreadyResponded: "Ya compartiste tus ideas. Lo apreciamos — mantente atento a lo que viene.",
        error: "Algo salió mal, por favor intenta de nuevo.",
        categories: {
            action: "Acción / Suspenso",
            drama: "Drama y Familia",
            documentary: "Documental",
            horror: "Terror",
            romance: "Romance",
            shorts: "Cortometrajes",
            all: "Todo lo anterior"
        }
    },
    fr: {
        title: "Façonnez Ce Que Nous Créons",
        subtitle: "Dites-nous ce que vous voulez voir sur AIM Studio. Votre réponse guide nos productions.",
        question: "Quel type de films voulez-vous voir ?",
        selectAll: "Sélectionnez tout ce qui s'applique",
        optional: "Autre chose que vous aimeriez voir ? (optionnel)",
        submit: "Envoyer",
        submitting: "Envoi...",
        thankYouTitle: "Merci !",
        thankYouMessage: "Votre voix façonne ce qu'AIM Studio créera ensuite. Nous vous tiendrons informé.",
        convertTitle: "Vous voulez être le premier à regarder ?",
        convertMessage: "Créez un compte gratuit et accédez en avant-première à tout ce que nous créons.",
        convertButton: "Créer Votre Compte Gratuit",
        convertSkip: "Peut-être plus tard",
        alreadyResponded: "Vous avez déjà partagé votre avis. Merci — restez à l'écoute.",
        error: "Une erreur est survenue, veuillez réessayer.",
        categories: {
            action: "Action / Thriller",
            drama: "Drame & Famille",
            documentary: "Documentaire",
            horror: "Horreur",
            romance: "Romance",
            shorts: "Courts Métrages",
            all: "Tout ce qui précède"
        }
    },
    ar: {
        title: "شكّل ما نصنعه بعد ذلك",
        subtitle: "أخبرنا ماذا تريد أن تشاهد على AIM Studio. إجابتك توجه ما ننتجه.",
        question: "ما نوع الأفلام التي تريد مشاهدتها؟",
        selectAll: "اختر كل ما ينطبق",
        optional: "هل هناك شيء آخر تود رؤيته؟ (اختياري)",
        submit: "إرسال",
        submitting: "جارٍ الإرسال...",
        thankYouTitle: "شكراً لك!",
        thankYouMessage: "صوتك يشكّل ما سيصنعه AIM Studio بعد ذلك. سنتواصل معك عندما يكون جاهزاً.",
        convertTitle: "تريد أن تكون أول من يشاهد؟",
        convertMessage: "أنشئ حساباً مجانياً واحصل على وصول مبكر لكل ما نصنعه.",
        convertButton: "أنشئ حسابك المجاني",
        convertSkip: "ربما لاحقاً",
        alreadyResponded: "لقد شاركت بالفعل أفكارك. نقدر ذلك — ترقب ما هو قادم.",
        error: "حدث خطأ ما، يرجى المحاولة مرة أخرى.",
        categories: {
            action: "أكشن / إثارة",
            drama: "دراما وعائلة",
            documentary: "وثائقي",
            horror: "رعب",
            romance: "رومانسية",
            shorts: "أفلام قصيرة",
            all: "كل ما سبق"
        }
    },
    zh: {
        title: "塑造我们的下一部作品",
        subtitle: "告诉我们您想在 AIM Studio 观看什么。您的回答将指导我们的制作方向。",
        question: "您想看什么类型的电影？",
        selectAll: "选择所有适用的选项",
        optional: "还有其他想看的内容吗？（可选）",
        submit: "提交",
        submitting: "提交中...",
        thankYouTitle: "谢谢您！",
        thankYouMessage: "您的声音正在塑造 AIM Studio 的下一部作品。准备好后我们会通知您。",
        convertTitle: "想成为第一个观看的人吗？",
        convertMessage: "创建免费账户，提前访问我们制作的所有内容。",
        convertButton: "创建免费账户",
        convertSkip: "以后再说",
        alreadyResponded: "您已经分享了您的想法。感谢您 — 敬请期待即将到来的内容。",
        error: "出了点问题，请重试。",
        categories: {
            action: "动作/惊悚",
            drama: "剧情与家庭",
            documentary: "纪录片",
            horror: "恐怖",
            romance: "浪漫",
            shorts: "短片",
            all: "以上全部"
        }
    },
    hi: {
        title: "हम आगे क्या बनाएं, यह तय करें",
        subtitle: "बताइए कि आप AIM Studio पर क्या देखना चाहते हैं। आपका जवाब हमारे प्रोडक्शन को दिशा देता है।",
        question: "आप किस तरह की फिल्में देखना चाहते हैं?",
        selectAll: "सभी लागू विकल्प चुनें",
        optional: "कुछ और जो आप देखना चाहेंगे? (वैकल्पिक)",
        submit: "जमा करें",
        submitting: "जमा हो रहा है...",
        thankYouTitle: "धन्यवाद!",
        thankYouMessage: "आपकी आवाज़ AIM Studio के अगले प्रोडक्शन को आकार दे रही है। तैयार होने पर हम संपर्क करेंगे।",
        convertTitle: "सबसे पहले देखना चाहते हैं?",
        convertMessage: "एक मुफ़्त अकाउंट बनाएं और हमारे सभी कंटेंट तक जल्दी पहुंच पाएं।",
        convertButton: "अपना मुफ़्त अकाउंट बनाएं",
        convertSkip: "शायद बाद में",
        alreadyResponded: "आप पहले ही अपने विचार साझा कर चुके हैं। हम इसकी सराहना करते हैं — आने वाली चीज़ों पर नज़र रखें।",
        error: "कुछ गलत हो गया, कृपया पुनः प्रयास करें।",
        categories: {
            action: "एक्शन / थ्रिलर",
            drama: "ड्रामा और पारिवारिक",
            documentary: "डॉक्यूमेंट्री",
            horror: "हॉरर",
            romance: "रोमांस",
            shorts: "लघु फिल्में",
            all: "उपरोक्त सभी"
        }
    },
    pt: {
        title: "Dê Forma ao Que Criamos",
        subtitle: "Diga-nos o que você quer assistir no AIM Studio. Sua resposta guia o que produzimos.",
        question: "Que tipo de filmes você quer ver?",
        selectAll: "Selecione todos que se aplicam",
        optional: "Algo mais que gostaria de ver? (opcional)",
        submit: "Enviar",
        submitting: "Enviando...",
        thankYouTitle: "Obrigado!",
        thankYouMessage: "Sua voz está moldando o que o AIM Studio fará a seguir. Entraremos em contato quando estiver pronto.",
        convertTitle: "Quer ser o primeiro a assistir?",
        convertMessage: "Crie uma conta gratuita e tenha acesso antecipado a tudo que criamos.",
        convertButton: "Criar Sua Conta Gratuita",
        convertSkip: "Talvez depois",
        alreadyResponded: "Você já compartilhou suas ideias. Agradecemos — fique atento ao que está por vir.",
        error: "Algo deu errado, por favor tente novamente.",
        categories: {
            action: "Ação / Suspense",
            drama: "Drama e Família",
            documentary: "Documentário",
            horror: "Terror",
            romance: "Romance",
            shorts: "Curtas-Metragens",
            all: "Todos os anteriores"
        }
    },
    ru: {
        title: "Определите Наш Следующий Фильм",
        subtitle: "Расскажите, что вы хотите смотреть на AIM Studio. Ваш ответ определяет, что мы создадим.",
        question: "Какие фильмы вы хотите видеть?",
        selectAll: "Выберите все подходящие",
        optional: "Что-то ещё, что хотели бы видеть? (необязательно)",
        submit: "Отправить",
        submitting: "Отправка...",
        thankYouTitle: "Спасибо!",
        thankYouMessage: "Ваш голос формирует то, что AIM Studio создаст дальше. Мы свяжемся с вами, когда будет готово.",
        convertTitle: "Хотите быть первым зрителем?",
        convertMessage: "Создайте бесплатный аккаунт и получите ранний доступ ко всему, что мы создаём.",
        convertButton: "Создать Бесплатный Аккаунт",
        convertSkip: "Может быть позже",
        alreadyResponded: "Вы уже поделились своим мнением. Мы ценим это — следите за обновлениями.",
        error: "Что-то пошло не так, пожалуйста, попробуйте ещё раз.",
        categories: {
            action: "Боевик / Триллер",
            drama: "Драма и Семейное",
            documentary: "Документальное",
            horror: "Ужасы",
            romance: "Романтика",
            shorts: "Короткометражки",
            all: "Всё вышеперечисленное"
        }
    },
    ja: {
        title: "次の作品を一緒に決めましょう",
        subtitle: "AIM Studioで何を見たいか教えてください。あなたの回答が制作の方向性を決めます。",
        question: "どんな映画を見たいですか？",
        selectAll: "該当するものをすべて選択",
        optional: "他に見たいものはありますか？（任意）",
        submit: "送信",
        submitting: "送信中...",
        thankYouTitle: "ありがとうございます！",
        thankYouMessage: "あなたの声がAIM Studioの次回作を形作っています。準備ができたらご連絡します。",
        convertTitle: "最初に観たいですか？",
        convertMessage: "無料アカウントを作成して、すべての作品に早期アクセスしましょう。",
        convertButton: "無料アカウントを作成",
        convertSkip: "後で",
        alreadyResponded: "すでにご意見をいただいています。ありがとうございます — 今後の展開にご期待ください。",
        error: "問題が発生しました。もう一度お試しください。",
        categories: {
            action: "アクション / スリラー",
            drama: "ドラマ & ファミリー",
            documentary: "ドキュメンタリー",
            horror: "ホラー",
            romance: "ロマンス",
            shorts: "短編映画",
            all: "上記すべて"
        }
    },
    de: {
        title: "Gestalten Sie Unser Nächstes Werk",
        subtitle: "Sagen Sie uns, was Sie auf AIM Studio sehen möchten. Ihre Antwort bestimmt, was wir produzieren.",
        question: "Welche Art von Filmen möchten Sie sehen?",
        selectAll: "Wählen Sie alle zutreffenden aus",
        optional: "Gibt es noch etwas, das Sie gerne sehen würden? (optional)",
        submit: "Absenden",
        submitting: "Wird gesendet...",
        thankYouTitle: "Vielen Dank!",
        thankYouMessage: "Ihre Stimme formt, was AIM Studio als Nächstes erschafft. Wir melden uns, wenn es soweit ist.",
        convertTitle: "Möchten Sie der Erste sein, der zuschaut?",
        convertMessage: "Erstellen Sie ein kostenloses Konto und erhalten Sie frühzeitigen Zugang zu allem, was wir schaffen.",
        convertButton: "Kostenloses Konto Erstellen",
        convertSkip: "Vielleicht später",
        alreadyResponded: "Sie haben bereits Ihre Meinung geteilt. Wir schätzen das — bleiben Sie gespannt.",
        error: "Etwas ist schiefgelaufen, bitte versuchen Sie es erneut.",
        categories: {
            action: "Action / Thriller",
            drama: "Drama & Familie",
            documentary: "Dokumentarfilm",
            horror: "Horror",
            romance: "Romantik",
            shorts: "Kurzfilme",
            all: "Alles oben Genannte"
        }
    },
    ko: {
        title: "다음 작품을 함께 만들어요",
        subtitle: "AIM Studio에서 무엇을 보고 싶은지 알려주세요. 당신의 답변이 제작 방향을 결정합니다.",
        question: "어떤 종류의 영화를 보고 싶으신가요?",
        selectAll: "해당하는 항목을 모두 선택하세요",
        optional: "다른 보고 싶은 것이 있나요? (선택사항)",
        submit: "제출",
        submitting: "제출 중...",
        thankYouTitle: "감사합니다!",
        thankYouMessage: "당신의 목소리가 AIM Studio의 다음 작품을 만들고 있습니다. 준비되면 연락드리겠습니다.",
        convertTitle: "가장 먼저 보고 싶으신가요?",
        convertMessage: "무료 계정을 만들고 모든 작품에 대한 조기 접근 권한을 받으세요.",
        convertButton: "무료 계정 만들기",
        convertSkip: "나중에",
        alreadyResponded: "이미 의견을 공유해 주셨습니다. 감사합니다 — 앞으로의 소식을 기대해 주세요.",
        error: "문제가 발생했습니다. 다시 시도해 주세요.",
        categories: {
            action: "액션 / 스릴러",
            drama: "드라마 & 가족",
            documentary: "다큐멘터리",
            horror: "공포",
            romance: "로맨스",
            shorts: "단편 영화",
            all: "위 모두"
        }
    }
};

// Process each locale file
for (const [locale, strings] of Object.entries(surveyPageStrings)) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${locale}.json — file not found`);
        continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);

    // Add surveyPage key
    json.surveyPage = strings;

    // Write with UTF8 no BOM
    const output = JSON.stringify(json, null, 2) + '\n';
    fs.writeFileSync(filePath, output, 'utf8');
    console.log(`✅ Updated ${locale}.json`);
}

console.log('\nDone! All locale files updated.');
