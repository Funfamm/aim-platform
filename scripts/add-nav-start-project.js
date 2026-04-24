const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '..', 'messages');

const navTranslations = {
  en: "Start a Project",
  es: "Iniciar Proyecto",
  fr: "Démarrer un Projet",
  ar: "ابدأ مشروعًا",
  hi: "प्रोजेक्ट शुरू करें",
  pt: "Iniciar Projeto",
  zh: "开始项目",
  ja: "プロジェクトを始める",
  de: "Projekt starten",
  ru: "Начать проект",
  ko: "프로젝트 시작",
};

for (const [locale, label] of Object.entries(navTranslations)) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) continue;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  json.nav.startProject = label;
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), { encoding: 'utf-8' });
  console.log(`Updated ${locale} nav.startProject`);
}
console.log('Done!');
