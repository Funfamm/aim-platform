const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '..', 'messages');

const trustBadges = {
  en: { fast: "Fast Turnaround", quality: "Premium Quality", global: "Global Service" },
  es: { fast: "Entrega rápida", quality: "Calidad Premium", global: "Servicio Global" },
  fr: { fast: "Livraison rapide", quality: "Qualité Premium", global: "Service Mondial" },
  ar: { fast: "تسليم سريع", quality: "جودة ممتازة", global: "خدمة عالمية" },
  hi: { fast: "तेज़ डिलीवरी", quality: "प्रीमियम गुणवत्ता", global: "वैश्विक सेवा" },
  pt: { fast: "Entrega Rápida", quality: "Qualidade Premium", global: "Serviço Global" },
  zh: { fast: "快速交付", quality: "优质品质", global: "全球服务" },
  ja: { fast: "迅速な納品", quality: "プレミアム品質", global: "グローバルサービス" },
  de: { fast: "Schnelle Lieferung", quality: "Premium Qualität", global: "Globaler Service" },
  ru: { fast: "Быстрая доставка", quality: "Премиум качество", global: "Глобальный сервис" },
  ko: { fast: "빠른 납품", quality: "프리미엄 품질", global: "글로벌 서비스" },
};

for (const [locale, badges] of Object.entries(trustBadges)) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) continue;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (json.startProject) {
    json.startProject.trustBadges = badges;
  }
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), { encoding: 'utf-8' });
  console.log(`Updated ${locale} startProject.trustBadges`);
}
console.log('Done!');
