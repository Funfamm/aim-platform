const fs = require('fs');
const path = require('path');
const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const locales = ['en','es','fr','de','pt','ar','zh','hi','ja','ko','ru'];

const translations = {
  home: {
    curatedCollections: { en:"Curated Collections",es:"Colecciones Seleccionadas",fr:"Collections Sélectionnées",de:"Kuratierte Sammlungen",pt:"Coleções Selecionadas",ar:"مجموعات مختارة",zh:"精选合集",hi:"चयनित संग्रह",ja:"キュレーションコレクション",ko:"큐레이션 컬렉션",ru:"Подборки" }
  },
  common: {
    trackProject: { en:"Track Your Project",es:"Seguir Tu Proyecto",fr:"Suivre Votre Projet",de:"Projekt Verfolgen",pt:"Acompanhar Seu Projeto",ar:"تتبع مشروعك",zh:"追踪您的项目",hi:"अपने प्रोजेक्ट को ट्रैक करें",ja:"プロジェクトを追跡",ko:"프로젝트 추적",ru:"Отслеживать Проект" }
  },
  training: {
    heroLine2: { en:"",es:"",fr:"",de:"",pt:"",ar:"",zh:"",hi:"",ja:"",ko:"",ru:"" }
  },
  NotificationsPage: {
    trackProject: { en:"Track Your Project",es:"Seguir Tu Proyecto",fr:"Suivre Votre Projet",de:"Projekt Verfolgen",pt:"Acompanhar Seu Projeto",ar:"تتبع مشروعك",zh:"追踪您的项目",hi:"अपने प्रोजेक्ट को ट्रैक करें",ja:"プロジェクトを追跡",ko:"프로젝트 추적",ru:"Отслеживать Проект" }
  },
  scripts: {
    heroLine2: { en:"",es:"",fr:"",de:"",pt:"",ar:"",zh:"",hi:"",ja:"",ko:"",ru:"" }
  },
  pay: {
    pageTitle: { en:"Pay Deposit",es:"Pagar Depósito",fr:"Payer l'Acompte",de:"Anzahlung Leisten",pt:"Pagar Depósito",ar:"دفع العربون",zh:"支付定金",hi:"जमा राशि भुगतान करें",ja:"デポジットを支払う",ko:"보증금 결제",ru:"Оплатить Депозит" },
    projectSummary: { en:"Project Summary",es:"Resumen del Proyecto",fr:"Résumé du Projet",de:"Projektübersicht",pt:"Resumo do Projeto",ar:"ملخص المشروع",zh:"项目摘要",hi:"प्रोजेक्ट सारांश",ja:"プロジェクト概要",ko:"프로젝트 요약",ru:"Сводка Проекта" },
    projectLabel: { en:"Project",es:"Proyecto",fr:"Projet",de:"Projekt",pt:"Projeto",ar:"المشروع",zh:"项目",hi:"प्रोजेक्ट",ja:"プロジェクト",ko:"프로젝트",ru:"Проект" },
    totalLabel: { en:"Project Total",es:"Total del Proyecto",fr:"Total du Projet",de:"Projektgesamtbetrag",pt:"Total do Projeto",ar:"إجمالي المشروع",zh:"项目总额",hi:"प्रोजेक्ट कुल",ja:"プロジェクト合計",ko:"프로젝트 총액",ru:"Итого по Проекту" },
    depositLabel: { en:"Deposit Due (40%)",es:"Depósito (40%)",fr:"Acompte Dû (40%)",de:"Fällige Anzahlung (40%)",pt:"Depósito (40%)",ar:"العربون المستحق (40%)",zh:"应付定金 (40%)",hi:"जमा राशि देय (40%)",ja:"デポジット (40%)",ko:"보증금 (40%)",ru:"Депозит (40%)" },
    milestoneDeposit: { en:"Deposit - Due Now",es:"Depósito - Vence Ahora",fr:"Acompte - À Payer Maintenant",de:"Anzahlung - Sofort Fällig",pt:"Depósito - Vence Agora",ar:"العربون - مستحق الآن",zh:"定金 - 立即支付",hi:"जमा - अभी देय",ja:"デポジット - 今すぐ",ko:"보증금 - 즉시 결제",ru:"Депозит - К Оплате Сейчас" },
    milestoneMidpoint: { en:"Midpoint - After Rough Cut",es:"Punto Medio - Después del Primer Corte",fr:"Mi-parcours - Après le Premier Montage",de:"Mitte - Nach dem Rohschnitt",pt:"Ponto Médio - Após o Primeiro Corte",ar:"المرحلة الوسطى - بعد القص الأولي",zh:"中期 - 粗剪后",hi:"मध्य - रफ कट के बाद",ja:"中間 - ラフカット後",ko:"중간 - 러프컷 후",ru:"Середина - После Чернового Монтажа" },
    milestoneFinal: { en:"Final - Before Delivery",es:"Final - Antes de la Entrega",fr:"Final - Avant la Livraison",de:"Abschluss - Vor der Lieferung",pt:"Final - Antes da Entrega",ar:"النهائي - قبل التسليم",zh:"尾款 - 交付前",hi:"अंतिम - डिलीवरी से पहले",ja:"最終 - 納品前",ko:"최종 - 납품 전",ru:"Финал - Перед Доставкой" },
    payButton: { en:"Pay with PayPal",es:"Pagar con PayPal",fr:"Payer avec PayPal",de:"Mit PayPal Bezahlen",pt:"Pagar com PayPal",ar:"الدفع عبر PayPal",zh:"通过PayPal支付",hi:"PayPal से भुगतान करें",ja:"PayPalで支払う",ko:"PayPal로 결제",ru:"Оплатить через PayPal" },
    processing: { en:"Processing payment...",es:"Procesando pago...",fr:"Traitement du paiement...",de:"Zahlung wird verarbeitet...",pt:"Processando pagamento...",ar:"جاري معالجة الدفع...",zh:"正在处理付款...",hi:"भुगतान प्रक्रिया हो रही है...",ja:"お支払い処理中...",ko:"결제 처리 중...",ru:"Обработка платежа..." },
    successTitle: { en:"Payment Received!",es:"¡Pago Recibido!",fr:"Paiement Reçu !",de:"Zahlung Eingegangen!",pt:"Pagamento Recebido!",ar:"تم استلام الدفع!",zh:"已收到付款！",hi:"भुगतान प्राप्त हुआ!",ja:"お支払いを受け取りました！",ko:"결제 완료!",ru:"Оплата Получена!" },
    successMessage: { en:"Your deposit has been secured. Production will begin shortly.",es:"Tu depósito ha sido asegurado. La producción comenzará pronto.",fr:"Votre acompte a été sécurisé. La production commencera bientôt.",de:"Ihre Anzahlung wurde gesichert. Die Produktion beginnt in Kürze.",pt:"Seu depósito foi garantido. A produção começará em breve.",ar:"تم تأمين عربونك. سيبدأ الإنتاج قريبًا.",zh:"您的定金已确认。制作即将开始。",hi:"आपकी जमा राशि सुरक्षित हो गई है। उत्पादन जल्द शुरू होगा।",ja:"デポジットが確保されました。間もなく制作が始まります。",ko:"보증금이 확보되었습니다. 곧 제작이 시작됩니다.",ru:"Ваш депозит принят. Производство начнётся в ближайшее время." },
    alreadyPaidTitle: { en:"Deposit Already Paid",es:"Depósito Ya Pagado",fr:"Acompte Déjà Payé",de:"Anzahlung Bereits Bezahlt",pt:"Depósito Já Pago",ar:"تم دفع العربون بالفعل",zh:"定金已支付",hi:"जमा राशि पहले से भुगतान की गई",ja:"デポジット支払い済み",ko:"보증금 이미 결제됨",ru:"Депозит Уже Оплачен" },
    alreadyPaidMessage: { en:"Your deposit was already paid.",es:"Tu depósito ya fue pagado.",fr:"Votre acompte a déjà été payé.",de:"Ihre Anzahlung wurde bereits bezahlt.",pt:"Seu depósito já foi pago.",ar:"تم دفع عربونك بالفعل.",zh:"您的定金已支付。",hi:"आपकी जमा राशि पहले ही भुगतान हो चुकी है।",ja:"デポジットは既にお支払い済みです。",ko:"보증금이 이미 결제되었습니다.",ru:"Ваш депозит уже оплачен." },
    invalidLinkTitle: { en:"Invalid Link",es:"Enlace Inválido",fr:"Lien Invalide",de:"Ungültiger Link",pt:"Link Inválido",ar:"رابط غير صالح",zh:"无效链接",hi:"अमान्य लिंक",ja:"無効なリンク",ko:"유효하지 않은 링크",ru:"Недействительная Ссылка" },
    invalidLinkMessage: { en:"This payment link is invalid or has expired. Please contact us.",es:"Este enlace de pago no es válido o ha expirado. Contáctanos.",fr:"Ce lien de paiement est invalide ou a expiré. Veuillez nous contacter.",de:"Dieser Zahlungslink ist ungültig oder abgelaufen. Bitte kontaktieren Sie uns.",pt:"Este link de pagamento é inválido ou expirou. Entre em contato conosco.",ar:"رابط الدفع هذا غير صالح أو منتهي الصلاحية. يرجى الاتصال بنا.",zh:"此支付链接无效或已过期。请联系我们。",hi:"यह भुगतान लिंक अमान्य है या समाप्त हो गया है। कृपया हमसे संपर्क करें।",ja:"このお支払いリンクは無効か期限切れです。お問い合わせください。",ko:"이 결제 링크가 유효하지 않거나 만료되었습니다. 문의해 주세요.",ru:"Эта ссылка на оплату недействительна или истекла. Свяжитесь с нами." },
    trackProject: { en:"Track Your Project",es:"Seguir Tu Proyecto",fr:"Suivre Votre Projet",de:"Projekt Verfolgen",pt:"Acompanhar Seu Projeto",ar:"تتبع مشروعك",zh:"追踪您的项目",hi:"अपने प्रोजेक्ट को ट्रैक करें",ja:"プロジェクトを追跡",ko:"프로젝트 추적",ru:"Отслеживать Проект" },
    securedByPaypal: { en:"Payments secured by PayPal Purchase Protection",es:"Pagos protegidos por la Protección de Compras de PayPal",fr:"Paiements sécurisés par la Protection des Achats PayPal",de:"Zahlungen gesichert durch PayPal-Käuferschutz",pt:"Pagamentos protegidos pela Proteção ao Comprador do PayPal",ar:"المدفوعات محمية بحماية المشتري من PayPal",zh:"PayPal买家保护保障付款安全",hi:"PayPal खरीदार सुरक्षा द्वारा सुरक्षित भुगतान",ja:"PayPal購入保護による安全な支払い",ko:"PayPal 구매 보호로 안전한 결제",ru:"Платежи защищены Программой Защиты Покупателей PayPal" },
    loadingPaypal: { en:"Loading PayPal...",es:"Cargando PayPal...",fr:"Chargement de PayPal...",de:"PayPal wird geladen...",pt:"Carregando PayPal...",ar:"جاري تحميل PayPal...",zh:"正在加载PayPal...",hi:"PayPal लोड हो रहा है...",ja:"PayPalを読み込み中...",ko:"PayPal 로딩 중...",ru:"Загрузка PayPal..." },
    paymentSchedule: { en:"Payment Schedule",es:"Calendario de Pagos",fr:"Calendrier de Paiement",de:"Zahlungsplan",pt:"Cronograma de Pagamento",ar:"جدول الدفع",zh:"付款计划",hi:"भुगतान अनुसूची",ja:"支払いスケジュール",ko:"결제 일정",ru:"График Платежей" }
  }
};

let totalAdded = 0;
for (const locale of locales) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let changed = false;
  for (const [section, keys] of Object.entries(translations)) {
    if (!json[section]) json[section] = {};
    for (const [key, vals] of Object.entries(keys)) {
      if (json[section][key] !== undefined) continue;
      json[section][key] = vals[locale] || vals.en;
      changed = true;
      totalAdded++;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    console.log('Updated ' + locale + '.json');
  }
}
console.log('Total keys added: ' + totalAdded);
