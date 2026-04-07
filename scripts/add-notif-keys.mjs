import { readFileSync, writeFileSync } from 'fs';

// New keys to add to NotificationsPage for each locale
const newKeys = {
  en: {
    saveError: 'Failed to save notification preferences. Please try again.',
    emailLangTitle: 'Email Language',
    emailLangDesc: 'Choose whether you receive emails in your saved language.',
    emailLangToggleLabel: 'Receive emails in my language',
    emailLangOn: 'Emails will be sent in your selected language.',
    emailLangOff: 'All emails will be sent in English.',
  },
  ar: {
    saveError: 'فشل حفظ تفضيلات الإشعارات. يرجى المحاولة مرة أخرى.',
    emailLangTitle: 'لغة البريد الإلكتروني',
    emailLangDesc: 'اختر ما إذا كنت تريد استلام رسائل البريد الإلكتروني بلغتك المحفوظة.',
    emailLangToggleLabel: 'استلام رسائل البريد الإلكتروني بلغتي',
    emailLangOn: 'سيتم إرسال رسائل البريد الإلكتروني بلغتك المختارة.',
    emailLangOff: 'ستُرسل جميع رسائل البريد الإلكتروني بالإنجليزية.',
  },
  de: {
    saveError: 'Benachrichtigungseinstellungen konnten nicht gespeichert werden. Bitte versuche es erneut.',
    emailLangTitle: 'E-Mail-Sprache',
    emailLangDesc: 'Wähle, ob du E-Mails in deiner gespeicherten Sprache erhalten möchtest.',
    emailLangToggleLabel: 'E-Mails in meiner Sprache empfangen',
    emailLangOn: 'E-Mails werden in deiner ausgewählten Sprache gesendet.',
    emailLangOff: 'Alle E-Mails werden auf Englisch gesendet.',
  },
  es: {
    saveError: 'No se pudieron guardar las preferencias de notificación. Por favor, inténtalo de nuevo.',
    emailLangTitle: 'Idioma del correo electrónico',
    emailLangDesc: 'Elige si deseas recibir correos en tu idioma guardado.',
    emailLangToggleLabel: 'Recibir correos en mi idioma',
    emailLangOn: 'Los correos se enviarán en tu idioma seleccionado.',
    emailLangOff: 'Todos los correos se enviarán en inglés.',
  },
  fr: {
    saveError: 'Impossible de sauvegarder les préférences de notification. Veuillez réessayer.',
    emailLangTitle: 'Langue des e-mails',
    emailLangDesc: 'Choisissez si vous souhaitez recevoir vos e-mails dans votre langue enregistrée.',
    emailLangToggleLabel: 'Recevoir les e-mails dans ma langue',
    emailLangOn: 'Les e-mails seront envoyés dans votre langue sélectionnée.',
    emailLangOff: 'Tous les e-mails seront envoyés en anglais.',
  },
  hi: {
    saveError: 'अधिसूचना प्राथमिकताएं सहेजी नहीं जा सकीं। कृपया पुनः प्रयास करें।',
    emailLangTitle: 'ईमेल भाषा',
    emailLangDesc: 'चुनें कि क्या आप अपनी सहेजी गई भाषा में ईमेल प्राप्त करना चाहते हैं।',
    emailLangToggleLabel: 'मेरी भाषा में ईमेल प्राप्त करें',
    emailLangOn: 'ईमेल आपकी चुनी गई भाषा में भेजे जाएंगे।',
    emailLangOff: 'सभी ईमेल अंग्रेजी में भेजे जाएंगे।',
  },
  ja: {
    saveError: '通知設定の保存に失敗しました。もう一度お試しください。',
    emailLangTitle: 'メール言語',
    emailLangDesc: '設定した言語でメールを受信するかどうかを選択してください。',
    emailLangToggleLabel: '自分の言語でメールを受信する',
    emailLangOn: 'メールは選択した言語で送信されます。',
    emailLangOff: 'すべてのメールは英語で送信されます。',
  },
  ko: {
    saveError: '알림 기본 설정을 저장하지 못했습니다. 다시 시도해 주세요.',
    emailLangTitle: '이메일 언어',
    emailLangDesc: '저장된 언어로 이메일을 받을지 선택하세요.',
    emailLangToggleLabel: '내 언어로 이메일 받기',
    emailLangOn: '이메일이 선택한 언어로 전송됩니다.',
    emailLangOff: '모든 이메일이 영어로 전송됩니다.',
  },
  pt: {
    saveError: 'Falha ao salvar preferências de notificação. Por favor, tente novamente.',
    emailLangTitle: 'Idioma do e-mail',
    emailLangDesc: 'Escolha se deseja receber e-mails no seu idioma salvo.',
    emailLangToggleLabel: 'Receber e-mails no meu idioma',
    emailLangOn: 'Os e-mails serão enviados no seu idioma selecionado.',
    emailLangOff: 'Todos os e-mails serão enviados em inglês.',
  },
  ru: {
    saveError: 'Не удалось сохранить настройки уведомлений. Пожалуйста, попробуйте снова.',
    emailLangTitle: 'Язык электронной почты',
    emailLangDesc: 'Выберите, хотите ли вы получать письма на сохранённом языке.',
    emailLangToggleLabel: 'Получать письма на моём языке',
    emailLangOn: 'Письма будут отправляться на выбранном вами языке.',
    emailLangOff: 'Все письма будут отправляться на английском.',
  },
  zh: {
    saveError: '保存通知偏好设置失败，请重试。',
    emailLangTitle: '电子邮件语言',
    emailLangDesc: '选择是否以您保存的语言接收电子邮件。',
    emailLangToggleLabel: '以我的语言接收电子邮件',
    emailLangOn: '电子邮件将以您选择的语言发送。',
    emailLangOff: '所有电子邮件将以英语发送。',
  },
};

const locales = Object.keys(newKeys);

for (const loc of locales) {
  const raw = readFileSync(`./messages/${loc}.json`);
  const msg = JSON.parse(raw.toString('utf8'));

  if (!msg.NotificationsPage) {
    console.log(`⚠️  ${loc}: no NotificationsPage section!`);
    continue;
  }

  Object.assign(msg.NotificationsPage, newKeys[loc]);
  writeFileSync(`./messages/${loc}.json`, JSON.stringify(msg, null, 2), 'utf8');
  console.log(`✅ ${loc}: added saveError + emailLang* keys`);
}
