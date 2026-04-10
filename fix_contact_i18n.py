path = r'src\lib\email-i18n.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

NEW_BLOCK = """    // \u2500\u2500 Contact Acknowledgment \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    contactAcknowledgment: {
        en: {
            subject:    'We received your message: {subject}',
            heading:    'Message Received \u2713',
            subtext:    'We got your message.',
            bodyIntro:  'Your message regarding "{subject}" has been received. Our team will review it and get back to you as soon as possible.',
            body:       'Typical response time is 1 to 3 business days.',
            buttonText: 'Back to Homepage',
            footerAuto: 'This email was sent automatically. Please do not reply directly.',
        },
        es: {
            subject:    'Recibimos tu mensaje: {subject}',
            heading:    'Mensaje Recibido \u2713',
            subtext:    'Recibimos tu mensaje.',
            bodyIntro:  'Tu mensaje sobre "{subject}" ha sido recibido. Nuestro equipo lo revisar\u00e1 y te responder\u00e1 lo antes posible.',
            body:       'El tiempo de respuesta t\u00edpico es de 1 a 3 d\u00edas h\u00e1biles.',
            buttonText: 'Volver al Inicio',
            footerAuto: 'Este correo fue enviado autom\u00e1ticamente. Por favor no respondas directamente.',
        },
        fr: {
            subject:    'Nous avons re\u00e7u votre message\u00a0: {subject}',
            heading:    'Message Re\u00e7u \u2713',
            subtext:    'Nous avons re\u00e7u votre message.',
            bodyIntro:  'Votre message concernant "{subject}" a bien \u00e9t\u00e9 re\u00e7u. Notre \u00e9quipe le traitera et vous r\u00e9pondra dans les plus brefs d\u00e9lais.',
            body:       'Le d\u00e9lai de r\u00e9ponse habituel est de 1 \u00e0 3 jours ouvrables.',
            buttonText: 'Retour \u00e0 l\u2019Accueil',
            footerAuto: 'Cet e-mail a \u00e9t\u00e9 envoy\u00e9 automatiquement. Merci de ne pas y r\u00e9pondre directement.',
        },
        ar: {
            subject:    '\u0627\u0633\u062a\u0644\u0645\u0646\u0627 \u0631\u0633\u0627\u0644\u062a\u0643: {subject}',
            heading:    '\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u2713',
            subtext:    '\u0648\u0635\u0644\u062a\u0646\u0627 \u0631\u0633\u0627\u0644\u062a\u0643.',
            bodyIntro:  '\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0631\u0633\u0627\u0644\u062a\u0643 \u0628\u062e\u0635\u0648\u0635 "{subject}". \u0633\u064a\u0631\u0627\u062c\u0639\u0647\u0627 \u0641\u0631\u064a\u0642\u0646\u0627 \u0648\u064a\u0631\u062f \u0639\u0644\u064a\u0643 \u0641\u064a \u0623\u0642\u0631\u0628 \u0648\u0642\u062a \u0645\u0645\u0643\u0646.',
            body:       '\u0648\u0642\u062a \u0627\u0644\u0627\u0633\u062a\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0639\u062a\u0627\u062f \u0647\u0648 \u0645\u0646 1 \u0625\u0644\u0649 3 \u0623\u064a\u0627\u0645 \u0639\u0645\u0644.',
            buttonText: '\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
            footerAuto: '\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064a\u062f \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b. \u064a\u0631\u062c\u0649 \u0639\u062f\u0645 \u0627\u0644\u0631\u062f \u0639\u0644\u064a\u0647 \u0645\u0628\u0627\u0634\u0631\u0629\u064b.',
        },
        zh: {
            subject:    '\u6211\u4eec\u5df2\u6536\u5230\u60a8\u7684\u6d88\u606f\uff1a{subject}',
            heading:    '\u6d88\u606f\u5df2\u6536\u5230 \u2713',
            subtext:    '\u6211\u4eec\u5df2\u6536\u5230\u60a8\u7684\u6d88\u606f\u3002',
            bodyIntro:  '\u60a8\u5173\u4e8e\u201c{subject}\u201d\u7684\u6d88\u606f\u5df2\u6536\u5230\u3002\u6211\u4eec\u7684\u56e2\u961f\u5c06\u5c3d\u5feb\u5ba1\u9605\u5e76\u56de\u590d\u60a8\u3002',
            body:       '\u901a\u5e38\u56de\u590d\u65f6\u95f41\u81f33\u4e2a\u5de5\u4f5c\u65e5\u3002',
            buttonText: '\u8fd4\u56de\u9996\u9875',
            footerAuto: '\u6b64\u90ae\u4ef6\u4e3a\u81ea\u52a8\u53d1\u9001\uff0c\u8bf7\u52ff\u76f4\u63a5\u56de\u590d\u3002',
        },
        hi: {
            subject:    '\u0906\u092a\u0915\u093e \u0938\u0902\u0926\u0947\u0936 \u092e\u093f\u0932 \u0917\u092f\u093e: {subject}',
            heading:    '\u0938\u0902\u0926\u0947\u0936 \u092a\u094d\u0930\u093e\u092a\u094d\u0924 \u0939\u0941\u0906 \u2713',
            subtext:    '\u0906\u092a\u0915\u093e \u0938\u0902\u0926\u0947\u0936 \u092e\u093f\u0932 \u0917\u092f\u093e\u0964',
            bodyIntro:  '"{subject}" \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902 \u0906\u092a\u0915\u093e \u0938\u0902\u0926\u0947\u0936 \u092a\u094d\u0930\u093e\u092a\u094d\u0924 \u0939\u094b \u0917\u092f\u093e \u0939\u0948\u0964 \u0939\u092e\u093e\u0930\u0940 \u091f\u0940\u092e \u0907\u0938\u0915\u0940 \u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0915\u0930\u0947\u0917\u0940 \u0914\u0930 \u091c\u0932\u094d\u0926 \u0938\u0947 \u091c\u0932\u094d\u0926 \u0906\u092a\u0938\u0947 \u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0917\u0940\u0964',
            body:       '\u0938\u093e\u092e\u093e\u0928\u094d\u092f \u092a\u094d\u0930\u0924\u093f\u0915\u094d\u0930\u093f\u092f\u093e \u0938\u092e\u092f 1 \u0938\u0947 3 \u0915\u093e\u0930\u094d\u092f \u0926\u093f\u0935\u0938 \u0939\u0948\u0964',
            buttonText: '\u0939\u094b\u092e\u092a\u0947\u091c \u092a\u0930 \u0935\u093e\u092a\u0938 \u091c\u093e\u090f\u0902',
            footerAuto: '\u092f\u0939 \u0908\u092e\u0947\u0932 \u0938\u094d\u0935\u091a\u093e\u0932\u093f\u0924 \u0930\u0942\u092a \u0938\u0947 \u092d\u0947\u091c\u093e \u0917\u092f\u093e \u0939\u0948\u0964 \u0915\u0943\u092a\u092f\u093e \u0938\u0940\u0927\u0947 \u0909\u0924\u094d\u0924\u0930 \u0928 \u0926\u0947\u0902\u0964',
        },
        pt: {
            subject:    'Recebemos sua mensagem: {subject}',
            heading:    'Mensagem Recebida \u2713',
            subtext:    'Recebemos sua mensagem.',
            bodyIntro:  'Sua mensagem sobre "{subject}" foi recebida. Nossa equipe ir\u00e1 analiz\u00e1-la e responder o mais breve poss\u00edvel.',
            body:       'O tempo de resposta t\u00edpico \u00e9 de 1 a 3 dias \u00fateis.',
            buttonText: 'Voltar \u00e0 P\u00e1gina Inicial',
            footerAuto: 'Este e-mail foi enviado automaticamente. Por favor, n\u00e3o responda diretamente.',
        },
        ru: {
            subject:    '\u041c\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u0438 \u0432\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435: {subject}',
            heading:    '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u2713',
            subtext:    '\u041c\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u0438 \u0432\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.',
            bodyIntro:  '\u0412\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e \u0442\u0435\u043c\u0435 "{subject}" \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u043e. \u041d\u0430\u0448\u0430 \u043a\u043e\u043c\u0430\u043d\u0434\u0430 \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0438\u0442 \u0435\u0433\u043e \u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u0442 \u0432\u0430\u043c \u0432 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0435\u0435 \u0432\u0440\u0435\u043c\u044f.',
            body:       '\u041e\u0431\u044b\u0447\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f \u043e\u0442\u0432\u0435\u0442\u0430 \u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442 1-3 \u0440\u0430\u0431\u043e\u0447\u0438\u0445 \u0434\u043d\u044f.',
            buttonText: '\u041d\u0430 \u0413\u043b\u0430\u0432\u043d\u0443\u044e',
            footerAuto: '\u042d\u0442\u043e \u043f\u0438\u0441\u044c\u043c\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438. \u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043d\u0435 \u043e\u0442\u0432\u0435\u0447\u0430\u0439\u0442\u0435 \u043d\u0430 \u043d\u0435\u0433\u043e \u043d\u0430\u043f\u0440\u044f\u043c\u0443\u044e.',
        },
        ja: {
            subject:    '\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u53d7\u3051\u53d6\u308a\u307e\u3057\u305f: {subject}',
            heading:    '\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u53d7\u3051\u53d6\u308a\u307e\u3057\u305f \u2713',
            subtext:    '\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u53d7\u4fe1\u3057\u307e\u3057\u305f\u3002',
            bodyIntro:  '\u300c{subject}\u300d\u306b\u95a2\u3059\u308b\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u53d7\u3051\u53d6\u308a\u307e\u3057\u305f\u3002\u30c1\u30fc\u30e0\u304c\u78ba\u8a8d\u6b21\u7b2c\u3001\u3067\u304d\u308b\u3060\u3051\u65e9\u304f\u3054\u8fd4\u7b54\u3044\u305f\u3057\u307e\u3059\u3002',
            body:       '\u901a\u5e38\u306e\u8fd4\u4fe1\u6642\u9593\u306f1\u30013\u55b6\u696d\u65e5\u3067\u3059\u3002',
            buttonText: '\u30db\u30fc\u30e0\u30da\u30fc\u30b8\u306b\u623b\u308b',
            footerAuto: '\u3053\u306e\u30e1\u30fc\u30eb\u306f\u81ea\u52d5\u7684\u306b\u9001\u4fe1\u3055\u308c\u307e\u3057\u305f\u3002\u76f4\u63a5\u8fd4\u4fe1\u3057\u306a\u3044\u3067\u304f\u3060\u3055\u3044\u3002',
        },
        de: {
            subject:    'Wir haben Ihre Nachricht erhalten: {subject}',
            heading:    'Nachricht Erhalten \u2713',
            subtext:    'Wir haben Ihre Nachricht erhalten.',
            bodyIntro:  'Ihre Nachricht bez\u00fcglich "{subject}" ist bei uns eingegangen. Unser Team wird sie pr\u00fcfen und sich so bald wie m\u00f6glich bei Ihnen melden.',
            body:       'Die typische Antwortzeit betr\u00e4gt 1 bis 3 Werktage.',
            buttonText: 'Zur\u00fcck zur Startseite',
            footerAuto: 'Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht direkt darauf.',
        },
        ko: {
            subject:    '\uba54\uc2dc\uc9c0\ub97c \ubc1b\uc558\uc2b5\ub2c8\ub2e4: {subject}',
            heading:    '\uba54\uc2dc\uc9c0 \uc218\uc2e0 \u2713',
            subtext:    '\uba54\uc2dc\uc9c0\ub97c \ubc1b\uc558\uc2b5\ub2c8\ub2e4.',
            bodyIntro:  '"{subject}"\uc5d0 \uad00\ud55c \uba54\uc2dc\uc9c0\uac00 \uc811\uc218\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \ud300\uc5d0\uc11c \uac80\ud1a0 \ud6c4 \ucd5c\ub300\ud55c \ube68\ub9ac \ub2f5\ubcc0\ub4dc\ub9ac\uaca0\uc2b5\ub2c8\ub2e4.',
            body:       '\uc77c\ubc18\uc801\uc778 \ub2f5\ubcc0 \uc2dc\uac04\uc740 \uc601\uc5c5\uc77c \uae30\uc900 1~3\uc77c\uc785\ub2c8\ub2e4.',
            buttonText: '\ud648\ud398\uc774\uc9c0\ub85c \ub3cc\uc544\uac00\uae30',
            footerAuto: '\uc774 \uc774\uba54\uc77c\uc740 \uc790\ub3d9\uc73c\ub85c \ubc1c\uc1a1\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \uc9c1\uc811 \ub2f5\uc7a5\ud558\uc9c0 \ub9c8\uc138\uc694.',
        },
    },"""

start = content.find('    // \u2500\u2500 Contact Acknowledgment')
end = content.find('\n\n    // \u2500\u2500 Subscription Confirmation', start)

if start == -1 or end == -1:
    print(f"ERROR: start={start}, end={end}")
    exit(1)

content = content[:start] + NEW_BLOCK + content[end:]
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Done! Replaced {end-start} chars starting at {start}")
