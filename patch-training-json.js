const fs = require('fs');
const path = require('path');

const translations = {
    en: { title: "Training Hub: Coming Soon", description: "We're building a world-class training experience for aspiring filmmakers, actors, and creatives.", backHome: "← Back Home" },
    ja: { title: "トレーニングハブ：近日公開", description: "映画制作者、俳優、クリエイターを志す方々のために、ワールドクラスのトレーニング体験を構築しています。", backHome: "← ホームに戻る" },
    fr: { title: "Centre de formation : Prochainement", description: "Nous créons une expérience de formation de classe mondiale pour les futurs cinéastes, acteurs et créatifs.", backHome: "← Retour à l'accueil" },
    es: { title: "Centro de entrenamiento: Próximamente", description: "Estamos construyendo una experiencia de capacitación de clase mundial para aspirantes a cineastas, actores y creativos.", backHome: "← Volver al inicio" },
    ar: { title: "مركز التدريب: قريباً", description: "نحن نبني تجربة تدريب عالمية المستوى لصناع الأفلام والممثلين والمبدعين الطموحين.", backHome: "← العودة للرئيسية" },
    zh: { title: "培训中心：即将推出", description: "我们正在为有抱负的电影创作者、演员和创意人士打造世界级的培训体验。", backHome: "← 返回首页" },
    hi: { title: "प्रशिक्षण केंद्र: जल्द आ रहा है", description: "हम महत्वाकांक्षी फिल्म निर्माताओं, अभिनेताओं और रचनात्मक लोगों के लिए एक विश्व स्तरीय प्रशिक्षण अनुभव बना रहे हैं।", backHome: "← वापस होम पर जाएं" },
    pt: { title: "Centro de Treinamento: Em breve", description: "Estamos construindo uma experiência de treinamento de classe mundial para aspirantes a cineastas, atores e criativos.", backHome: "← Voltar ao Início" },
    ru: { title: "Учебный центр: Скоро", description: "Мы создаем образовательную платформу мирового уровня для начинающих кинематографистов, актеров и творческих людей.", backHome: "← На главную" },
    de: { title: "Trainingszentrum: Demnächst", description: "Wir bauen ein erstklassiges Trainingserlebnis für angehende Filmemacher, Schauspieler und Kreative auf.", backHome: "← Zurück zur Startseite" },
    ko: { title: "트레이닝 허브: 출시 예정", description: "영화 제작자, 배우, 크리에이터를 꿈꾸는 분들을 위한 세계적인 수준의 트레이닝 경험을 구축하고 있습니다.", backHome: "← 홈으로 돌아가기" }
};

const dir = path.join(__dirname, 'messages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

for (const file of files) {
    const lang = file.replace('.json', '');
    if (!translations[lang]) continue;
    
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(content);
    
    if (!obj.trainingPaused) {
        obj.trainingPaused = translations[lang];
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
        console.log(`Updated ${file}`);
    } else {
        console.log(`Already updated ${file}`);
    }
}
