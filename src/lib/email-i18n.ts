/**
 * AIM Studio – Email Internationalisation Strings
 * -------------------------------------------------
 * Translation map for all user‑facing transactional email templates.
 * Security emails (OTP, password reset, verification, new‑device) stay
 * English‑only for clarity and security — intentional design decision.
 *
 * Structure: emailStrings[templateKey][localeCode][stringKey]
 *
 * Usage:
 *   import { t } from '@/lib/email-i18n'
 *   const heading = t('welcome', 'es', 'heading')   // → Spanish heading
 *
 * Fallback: returns English string if locale or key is missing.
 */

type LocaleStrings = Record<string, string>
type TemplateStrings = Record<string, LocaleStrings>

export const emailStrings: Record<string, TemplateStrings> = {

    // ── Welcome ───────────────────────────────────────────────────────────────
    welcome: {
        en: {
            heading:  'Welcome to AIM Studio! 🎬',
            subtext:  'Your account has been created successfully.',
            body:     'You now have access to our exclusive AI-powered filmmaking platform. Explore our films, apply for casting calls, track your applications, and more.',
            buttonText: 'Explore AIM Studio →',
            footer:   'If you have any questions, feel free to reach out through our contact page.',
        },
        es: {
            heading:  '¡Bienvenido a AIM Studio! 🎬',
            subtext:  'Tu cuenta ha sido creada exitosamente.',
            body:     'Ahora tienes acceso a nuestra plataforma exclusiva de cine impulsada por IA. Explora nuestras películas, aplica a convocatorias de casting, rastrea tus solicitudes y mucho más.',
            buttonText: 'Explorar AIM Studio →',
            footer:   'Si tienes alguna pregunta, no dudes en contactarnos a través de nuestra página de contacto.',
        },
        fr: {
            heading:  'Bienvenue sur AIM Studio ! 🎬',
            subtext:  'Votre compte a été créé avec succès.',
            body:     'Vous avez maintenant accès à notre plateforme cinématographique exclusive propulsée par l\'IA. Explorez nos films, postulez aux castings, suivez vos candidatures et bien plus encore.',
            buttonText: 'Explorer AIM Studio →',
            footer:   'Si vous avez des questions, n\'hésitez pas à nous contacter via notre page de contact.',
        },
        ar: {
            heading:  'مرحباً بك في AIM Studio! 🎬',
            subtext:  'تم إنشاء حسابك بنجاح.',
            body:     'لديك الآن وصول إلى منصتنا الحصرية لصناعة الأفلام بالذكاء الاصطناعي. استكشف أفلامنا، وتقدم لمكالمات الكاستينج، وتتبع طلباتك والمزيد.',
            buttonText: 'استكشف AIM Studio →',
            footer:   'إذا كان لديك أي أسئلة، لا تتردد في التواصل معنا عبر صفحة الاتصال.',
        },
        zh: {
            heading:  '欢迎来到 AIM Studio！🎬',
            subtext:  '您的账户已成功创建。',
            body:     '您现在可以访问我们的专属AI电影制作平台。探索我们的影片、申请试镜、跟踪申请进度等更多功能。',
            buttonText: '探索 AIM Studio →',
            footer:   '如有任何问题，请通过我们的联系页面随时联系我们。',
        },
        hi: {
            heading:  'AIM Studio में आपका स्वागत है! 🎬',
            subtext:  'आपका खाता सफलतापूर्वक बनाया गया है।',
            body:     'अब आपके पास हमारे एक्सक्लूसिव AI-संचालित फिल्म निर्माण प्लेटफॉर्म तक पहुंच है। हमारी फिल्में देखें, कास्टिंग के लिए आवेदन करें, अपने आवेदन ट्रैक करें और बहुत कुछ।',
            buttonText: 'AIM Studio एक्सप्लोर करें →',
            footer:   'यदि आपके कोई प्रश्न हैं, तो हमारे संपर्क पृष्ठ के माध्यम से हमसे संपर्क करें।',
        },
        pt: {
            heading:  'Bem-vindo ao AIM Studio! 🎬',
            subtext:  'Sua conta foi criada com sucesso.',
            body:     'Você agora tem acesso à nossa plataforma exclusiva de cinema com IA. Explore nossos filmes, candidate-se a castings, acompanhe suas candidaturas e muito mais.',
            buttonText: 'Explorar AIM Studio →',
            footer:   'Se tiver dúvidas, entre em contato conosco pela nossa página de contato.',
        },
        ru: {
            heading:  'Добро пожаловать в AIM Studio! 🎬',
            subtext:  'Ваш аккаунт успешно создан.',
            body:     'Теперь у вас есть доступ к нашей эксклюзивной платформе кинопроизводства на основе ИИ. Исследуйте наши фильмы, подавайте заявки на кастинг, отслеживайте заявки и многое другое.',
            buttonText: 'Исследовать AIM Studio →',
            footer:   'Если у вас есть вопросы, свяжитесь с нами через страницу контактов.',
        },
        ja: {
            heading:  'AIM Studioへようこそ！🎬',
            subtext:  'アカウントが正常に作成されました。',
            body:     'AIを活用した映画制作プラットフォームにアクセスできるようになりました。映画を探したり、オーディションに応募したり、申請状況を追跡したりできます。',
            buttonText: 'AIM Studioを探索する →',
            footer:   'ご質問がある場合は、お問い合わせページからご連絡ください。',
        },
        de: {
            heading:  'Willkommen bei AIM Studio! 🎬',
            subtext:  'Ihr Konto wurde erfolgreich erstellt.',
            body:     'Sie haben jetzt Zugang zu unserer exklusiven KI-gestützten Filmplattform. Entdecken Sie Filme, bewerben Sie sich für Castings, verfolgen Sie Ihre Bewerbungen und vieles mehr.',
            buttonText: 'AIM Studio erkunden →',
            footer:   'Bei Fragen können Sie uns gerne über unsere Kontaktseite erreichen.',
        },
        ko: {
            heading:  'AIM Studio에 오신 것을 환영합니다! 🎬',
            subtext:  '계정이 성공적으로 생성되었습니다.',
            body:     '이제 AI 기반 영화 제작 플랫폼에 액세스할 수 있습니다. 영화를 탐색하고, 캐스팅에 지원하고, 지원 현황을 추적하세요.',
            buttonText: 'AIM Studio 탐색하기 →',
            footer:   '궁금한 점이 있으시면 문의 페이지를 통해 연락해 주세요.',
        },
    },

    // ── Application Confirmation ───────────────────────────────────────────────
    applicationConfirmation: {
        en: {
            heading:    'Application Received! 🎭',
            subtext:    'Thanks for applying.',
            body:       "Your application has been submitted successfully. Our casting team will review it carefully. You'll receive updates as your application progresses.",
            luck:       'Good luck! 🤞',
            buttonText: 'View Your Dashboard',
        },
        es: {
            heading:    '¡Solicitud Recibida! 🎭',
            subtext:    'Gracias por postularte.',
            body:       'Tu solicitud ha sido enviada exitosamente. Nuestro equipo de casting la revisará detalladamente. Recibirás actualizaciones a medida que tu solicitud avance.',
            luck:       '¡Buena suerte! 🤞',
            buttonText: 'Ver Tu Panel',
        },
        fr: {
            heading:    'Candidature Reçue ! 🎭',
            subtext:    'Merci de postuler.',
            body:       'Votre candidature a été soumise avec succès. Notre équipe de casting l\'examinera attentivement. Vous recevrez des mises à jour au fur et à mesure de l\'avancement.',
            luck:       'Bonne chance ! 🤞',
            buttonText: 'Voir Votre Tableau de Bord',
        },
        ar: {
            heading:    'تم استلام طلبك! 🎭',
            subtext:    'شكراً على تقدمك.',
            body:       'تم إرسال طلبك بنجاح. سيراجعه فريق الكاستينج بعناية. ستتلقى تحديثات مع تقدم طلبك.',
            luck:       'حظاً موفقاً! 🤞',
            buttonText: 'عرض لوحة التحكم',
        },
        zh: {
            heading:    '申请已收到！🎭',
            subtext:    '感谢您的申请。',
            body:       '您的申请已成功提交。我们的选角团队将仔细审核。随着申请进展，您将收到更新通知。',
            luck:       '祝您好运！🤞',
            buttonText: '查看您的控制台',
        },
        hi: {
            heading:    'आवेदन प्राप्त हुआ! 🎭',
            subtext:    'आवेदन के लिए धन्यवाद।',
            body:       'आपका आवेदन सफलतापूर्वक जमा हो गया है। हमारी कास्टिंग टीम इसे ध्यानपूर्वक समीक्षा करेगी। आवेदन की प्रगति के साथ आपको अपडेट मिलेंगे।',
            luck:       'शुभकामनाएं! 🤞',
            buttonText: 'अपना डैशबोर्ड देखें',
        },
        pt: {
            heading:    'Candidatura Recebida! 🎭',
            subtext:    'Obrigado por se candidatar.',
            body:       'Sua candidatura foi enviada com sucesso. Nossa equipe de casting a analisará cuidadosamente. Você receberá atualizações conforme sua candidatura avança.',
            luck:       'Boa sorte! 🤞',
            buttonText: 'Ver Seu Painel',
        },
        ru: {
            heading:    'Заявка Получена! 🎭',
            subtext:    'Спасибо за вашу заявку.',
            body:       'Ваша заявка успешно отправлена. Наша команда кастинга тщательно её рассмотрит. Вы будете получать обновления по мере продвижения заявки.',
            luck:       'Удачи! 🤞',
            buttonText: 'Перейти к Панели',
        },
        ja: {
            heading:    '応募を受け付けました！🎭',
            subtext:    'ご応募ありがとうございます。',
            body:       '応募が正常に送信されました。キャスティングチームが丁寧に審査します。審査の進捗に合わせてご連絡いたします。',
            luck:       'ご健闘をお祈りしています！🤞',
            buttonText: 'ダッシュボードを見る',
        },
        de: {
            heading:    'Bewerbung Eingegangen! 🎭',
            subtext:    'Danke für Ihre Bewerbung.',
            body:       'Ihre Bewerbung wurde erfolgreich eingereicht. Unser Casting-Team wird sie sorgfältig prüfen. Sie erhalten Updates, wenn Ihre Bewerbung voranschreitet.',
            luck:       'Viel Erfolg! 🤞',
            buttonText: 'Dashboard Ansehen',
        },
        ko: {
            heading:    '지원서가 접수되었습니다! 🎭',
            subtext:    '지원해 주셔서 감사합니다.',
            body:       '지원서가 성공적으로 제출되었습니다. 캐스팅 팀이 세심하게 검토할 것입니다. 지원 진행 상황에 따라 업데이트를 받으실 것입니다.',
            luck:       '행운을 빕니다! 🤞',
            buttonText: '대시보드 보기',
        },
    },

    // ── Application Status Update ──────────────────────────────────────────────
    applicationStatusUpdate: {
        en: {
            heading:    'Application Update',
            subtext:    'We have news for you.',
            buttonText: 'View More Casting Roles',
        },
        es: {
            heading:    'Actualización de Solicitud',
            subtext:    'Tenemos novedades para ti.',
            buttonText: 'Ver Más Roles de Casting',
        },
        fr: {
            heading:    'Mise à Jour de Candidature',
            subtext:    'Nous avons des nouvelles pour vous.',
            buttonText: 'Voir Plus de Rôles',
        },
        ar: {
            heading:    'تحديث الطلب',
            subtext:    'لدينا أخبار لك.',
            buttonText: 'عرض المزيد من أدوار الكاستينج',
        },
        zh: {
            heading:    '申请更新',
            subtext:    '我们有新消息要告诉您。',
            buttonText: '查看更多试镜角色',
        },
        hi: {
            heading:    'आवेदन अपडेट',
            subtext:    'हमारे पास आपके लिए खबर है।',
            buttonText: 'अधिक कास्टिंग रोल देखें',
        },
        pt: {
            heading:    'Atualização da Candidatura',
            subtext:    'Temos novidades para você.',
            buttonText: 'Ver Mais Papéis de Casting',
        },
        ru: {
            heading:    'Обновление Заявки',
            subtext:    'У нас есть для вас новости.',
            buttonText: 'Смотреть Больше Ролей',
        },
        ja: {
            heading:    '応募状況の更新',
            subtext:    'お知らせがあります。',
            buttonText: 'さらにキャストを見る',
        },
        de: {
            heading:    'Bewerbungsaktualisierung',
            subtext:    'Wir haben Neuigkeiten für Sie.',
            buttonText: 'Mehr Casting-Rollen Ansehen',
        },
        ko: {
            heading:    '지원서 업데이트',
            subtext:    '소식이 있습니다.',
            buttonText: '더 많은 캐스팅 역할 보기',
        },
    },

    // ── Donation Thank You ─────────────────────────────────────────────────────
    donationThankYou: {
        en: {
            heading:    'Thank You for Your Generosity! 💛',
            subtext:    'Your support means the world to us.',
            donationReceived: 'Donation received',
            body:       'Your contribution directly supports independent AI-powered filmmaking. Every dollar helps us push the boundaries of visual storytelling.',
            receipt:    'This email serves as your donation receipt for your records.',
            buttonText: 'Visit AIM Studio',
        },
        es: {
            heading:    '¡Gracias por tu Generosidad! 💛',
            subtext:    'Tu apoyo significa el mundo para nosotros.',
            donationReceived: 'Donación recibida',
            body:       'Tu contribución apoya directamente el cine independiente impulsado por IA. Cada dólar nos ayuda a empujar los límites de la narración visual.',
            receipt:    'Este correo sirve como recibo de tu donación para tus registros.',
            buttonText: 'Visitar AIM Studio',
        },
        fr: {
            heading:    'Merci pour Votre Générosité ! 💛',
            subtext:    'Votre soutien signifie tout pour nous.',
            donationReceived: 'Don reçu',
            body:       'Votre contribution soutient directement le cinéma indépendant propulsé par l\'IA. Chaque euro nous aide à repousser les limites de la narration visuelle.',
            receipt:    'Cet e-mail sert de reçu de don pour vos dossiers.',
            buttonText: 'Visiter AIM Studio',
        },
        ar: {
            heading:    'شكراً لك على كرمك! 💛',
            subtext:    'دعمك يعني لنا الكثير.',
            donationReceived: 'تم استلام التبرع',
            body:       'مساهمتك تدعم صناعة الأفلام المستقلة القائمة على الذكاء الاصطناعي. كل دولار يساعدنا على دفع حدود الرواية البصرية.',
            receipt:    'يعمل هذا البريد الإلكتروني كإيصال تبرعك لسجلاتك.',
            buttonText: 'زيارة AIM Studio',
        },
        zh: {
            heading:    '感谢您的慷慨！💛',
            subtext:    '您的支持对我们意义重大。',
            donationReceived: '已收到捐款',
            body:       '您的捐款直接支持独立AI电影制作。每一分钱都帮助我们突破视觉叙事的边界。',
            receipt:    '此电子邮件作为您的捐款收据，请妥善保存。',
            buttonText: '访问 AIM Studio',
        },
        hi: {
            heading:    'आपकी उदारता के लिए धन्यवाद! 💛',
            subtext:    'आपका समर्थन हमारे लिए बहुत मायने रखता है।',
            donationReceived: 'दान प्राप्त हुआ',
            body:       'आपका योगदान सीधे स्वतंत्र AI-संचालित फिल्म निर्माण का समर्थन करता है। हर डॉलर हमें दृश्य कहानी कहने की सीमाओं को आगे बढ़ाने में मदद करता है।',
            receipt:    'यह ईमेल आपके रिकॉर्ड के लिए आपकी दान रसीद के रूप में काम करता है।',
            buttonText: 'AIM Studio पर जाएं',
        },
        pt: {
            heading:    'Obrigado pela Sua Generosidade! 💛',
            subtext:    'Seu apoio significa muito para nós.',
            donationReceived: 'Doação recebida',
            body:       'Sua contribuição apoia diretamente o cinema independente com IA. Cada real nos ajuda a empurrar os limites da narrativa visual.',
            receipt:    'Este e-mail serve como recibo da sua doação para seus registros.',
            buttonText: 'Visitar AIM Studio',
        },
        ru: {
            heading:    'Спасибо за Вашу Щедрость! 💛',
            subtext:    'Ваша поддержка очень важна для нас.',
            donationReceived: 'Пожертвование получено',
            body:       'Ваш вклад напрямую поддерживает независимое кино на основе ИИ. Каждый рубль помогает нам расширять границы визуального повествования.',
            receipt:    'Это письмо служит квитанцией о вашем пожертвовании.',
            buttonText: 'Посетить AIM Studio',
        },
        ja: {
            heading:    'ご寄付ありがとうございます！💛',
            subtext:    'あなたのサポートは私たちにとって非常に重要です。',
            donationReceived: '寄付を受領しました',
            body:       'あなたの貢献はAIを活用した独立映画制作を直接支援します。すべての寄付が視覚的なストーリーテリングの可能性を広げます。',
            receipt:    'このメールは寄付の領収書としてご利用いただけます。',
            buttonText: 'AIM Studioを訪問する',
        },
        de: {
            heading:    'Danke für Ihre Großzügigkeit! 💛',
            subtext:    'Ihre Unterstützung bedeutet uns sehr viel.',
            donationReceived: 'Spende erhalten',
            body:       'Ihr Beitrag unterstützt direkt den unabhängigen KI-gestützten Film. Jeder Euro hilft uns, die Grenzen des visuellen Geschichtenerzählens zu erweitern.',
            receipt:    'Diese E-Mail dient als Spendenquittung für Ihre Unterlagen.',
            buttonText: 'AIM Studio Besuchen',
        },
        ko: {
            heading:    '후원해 주셔서 감사합니다! 💛',
            subtext:    '여러분의 지원이 저희에게 큰 의미가 있습니다.',
            donationReceived: '기부금 수령',
            body:       '귀하의 기부는 AI 기반 독립 영화 제작을 직접 지원합니다. 모든 기부금이 시각적 스토리텔링의 경계를 넓히는 데 도움이 됩니다.',
            receipt:    '이 이메일은 기부 영수증으로 활용하실 수 있습니다.',
            buttonText: 'AIM Studio 방문하기',
        },
    },

    // ── Script Submission ──────────────────────────────────────────────────────
    scriptSubmission: {
        en: {
            heading:    'Script Submitted! ✍️',
            subtext:    'Your submission has been received.',
            body:       'Our team will review your screenplay submission. If selected, we may reach out for further discussion.',
            thanks:     'Thank you for sharing your creative work with us!',
            buttonText: 'View Your Dashboard',
        },
        es: {
            heading:    '¡Guión Enviado! ✍️',
            subtext:    'Tu envío ha sido recibido.',
            body:       'Nuestro equipo revisará tu guión. Si es seleccionado, podríamos contactarte para una discusión adicional.',
            thanks:     '¡Gracias por compartir tu trabajo creativo con nosotros!',
            buttonText: 'Ver Tu Panel',
        },
        fr: {
            heading:    'Scénario Soumis ! ✍️',
            subtext:    'Votre soumission a été reçue.',
            body:       'Notre équipe examinera votre scénario. Si sélectionné, nous pourrions vous contacter pour une discussion approfondie.',
            thanks:     'Merci de partager votre travail créatif avec nous !',
            buttonText: 'Voir Votre Tableau de Bord',
        },
        ar: {
            heading:    'تم إرسال السيناريو! ✍️',
            subtext:    'تم استلام إرسالك.',
            body:       'سيراجع فريقنا تقديم السيناريو الخاص بك. إذا تم اختياره، فقد نتواصل معك لمناقشة إضافية.',
            thanks:     'شكراً لمشاركة عملك الإبداعي معنا!',
            buttonText: 'عرض لوحة التحكم',
        },
        zh: {
            heading:    '剧本已提交！✍️',
            subtext:    '您的提交已收到。',
            body:       '我们的团队将审核您的剧本。如果入选，我们可能会联系您进行进一步讨论。',
            thanks:     '感谢您与我们分享您的创意作品！',
            buttonText: '查看您的控制台',
        },
        hi: {
            heading:    'स्क्रिप्ट सबमिट की गई! ✍️',
            subtext:    'आपका सबमिशन प्राप्त हो गया है।',
            body:       'हमारी टीम आपकी पटकथा की समीक्षा करेगी। यदि चुना गया, तो हम आगे की चर्चा के लिए संपर्क कर सकते हैं।',
            thanks:     'हमारे साथ अपनी रचनात्मक कृति साझा करने के लिए धन्यवाद!',
            buttonText: 'अपना डैशबोर्ड देखें',
        },
        pt: {
            heading:    'Roteiro Enviado! ✍️',
            subtext:    'Sua submissão foi recebida.',
            body:       'Nossa equipe revisará seu roteiro. Se selecionado, podemos entrar em contato para uma discussão adicional.',
            thanks:     'Obrigado por compartilhar seu trabalho criativo conosco!',
            buttonText: 'Ver Seu Painel',
        },
        ru: {
            heading:    'Сценарий Отправлен! ✍️',
            subtext:    'Ваша заявка получена.',
            body:       'Наша команда рассмотрит ваш сценарий. Если он будет выбран, мы можем связаться с вами для дальнейшего обсуждения.',
            thanks:     'Спасибо, что поделились своим творческим трудом с нами!',
            buttonText: 'Перейти к Панели',
        },
        ja: {
            heading:    '脚本が提出されました！✍️',
            subtext:    '提出を受け付けました。',
            body:       '私たちのチームがあなたの脚本を審査します。選ばれた場合、さらに話し合うためにご連絡するかもしれません。',
            thanks:     '創作物を共有していただきありがとうございます！',
            buttonText: 'ダッシュボードを見る',
        },
        de: {
            heading:    'Drehbuch Eingereicht! ✍️',
            subtext:    'Ihre Einreichung wurde erhalten.',
            body:       'Unser Team wird Ihr Drehbuch prüfen. Falls ausgewählt, könnten wir Sie für eine weitere Diskussion kontaktieren.',
            thanks:     'Danke, dass Sie Ihre kreative Arbeit mit uns geteilt haben!',
            buttonText: 'Dashboard Ansehen',
        },
        ko: {
            heading:    '각본이 제출되었습니다! ✍️',
            subtext:    '제출을 받았습니다.',
            body:       '우리 팀이 각본을 검토할 것입니다. 선정될 경우 추가 논의를 위해 연락드릴 수 있습니다.',
            thanks:     '창작물을 공유해 주셔서 감사합니다!',
            buttonText: '대시보드 보기',
        },
    },

    // ── Contact Acknowledgment ─────────────────────────────────────────────────
    contactAcknowledgment: {
        en: {
            heading:    'Message Received ✓',
            subtext:    'We got your message.',
            body:       'Typical response time is 1 to 3 business days.',
            buttonText: 'Back to Homepage',
        },
        es: {
            heading:    'Mensaje Recibido ✓',
            subtext:    'Recibimos tu mensaje.',
            body:       'El tiempo de respuesta típico es de 1 a 3 días hábiles.',
            buttonText: 'Volver al Inicio',
        },
        fr: {
            heading:    'Message Reçu ✓',
            subtext:    'Nous avons reçu votre message.',
            body:       'Le délai de réponse habituel est de 1 à 3 jours ouvrables.',
            buttonText: 'Retour à l\'Accueil',
        },
        ar: {
            heading:    'تم استلام الرسالة ✓',
            subtext:    'وصلتنا رسالتك.',
            body:       'وقت الاستجابة المعتاد هو من 1 إلى 3 أيام عمل.',
            buttonText: 'العودة إلى الصفحة الرئيسية',
        },
        zh: {
            heading:    '消息已收到 ✓',
            subtext:    '我们已收到您的消息。',
            body:       '通常回复时间为1至3个工作日。',
            buttonText: '返回首页',
        },
        hi: {
            heading:    'संदेश प्राप्त हुआ ✓',
            subtext:    'आपका संदेश मिल गया।',
            body:       'सामान्य प्रतिक्रिया समय 1 से 3 कार्य दिवस है।',
            buttonText: 'होमपेज पर वापस जाएं',
        },
        pt: {
            heading:    'Mensagem Recebida ✓',
            subtext:    'Recebemos sua mensagem.',
            body:       'O tempo de resposta típico é de 1 a 3 dias úteis.',
            buttonText: 'Voltar à Página Inicial',
        },
        ru: {
            heading:    'Сообщение Получено ✓',
            subtext:    'Мы получили ваше сообщение.',
            body:       'Обычное время ответа составляет 1-3 рабочих дня.',
            buttonText: 'На Главную',
        },
        ja: {
            heading:    'メッセージを受け取りました ✓',
            subtext:    'メッセージを受信しました。',
            body:       '通常の返信時間は1〜3営業日です。',
            buttonText: 'ホームページに戻る',
        },
        de: {
            heading:    'Nachricht Erhalten ✓',
            subtext:    'Wir haben Ihre Nachricht erhalten.',
            body:       'Die typische Antwortzeit beträgt 1 bis 3 Werktage.',
            buttonText: 'Zurück zur Startseite',
        },
        ko: {
            heading:    '메시지 수신 ✓',
            subtext:    '메시지를 받았습니다.',
            body:       '일반적인 답변 시간은 영업일 기준 1~3일입니다.',
            buttonText: '홈페이지로 돌아가기',
        },
    },
}

/**
 * Look up a translated string.
 * Falls back to English if locale or key is missing.
 */
export function t(template: string, locale: string, key: string): string {
    return (
        emailStrings[template]?.[locale]?.[key] ??
        emailStrings[template]?.['en']?.[key] ??
        ''
    )
}
