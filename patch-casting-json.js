const fs = require('fs');
const path = require('path');

const translations = {
    en: { title: "Casting Calls Paused", description: "We are not currently accepting casting applications. Please check back soon for new opportunities." },
    ja: { title: "キャスティング募集は一時停止中です", description: "現在、キャスティングの応募は受け付けておりません。新しい機会については、後ほど再度ご確認ください。" },
    fr: { title: "Appels au casting en pause", description: "Nous n'acceptons pas de candidatures pour le moment. Veuillez revenir vérifier bientôt." },
    es: { title: "Convocatorias de casting en pausa", description: "Actualmente no estamos aceptando solicitudes de casting. Por favor, vuelva a consultar pronto." },
    ar: { title: "تم إيقاف مكالمات الكاستينج مؤقتًا", description: "نحن لا نقبل حالياً طلبات الكاستينج. يرجى التحقق مرة أخرى قريباً للحصول على فرص جديدة." },
    zh: { title: "选角暂停", description: "我们目前不接受选角申请。请稍后回来查看新机会。" },
    hi: { title: "कास्टिंग कॉल रोके गए", description: "हम वर्तमान में कास्टिंग आवेदन स्वीकार नहीं कर रहे हैं। कृपया नए अवसरों के लिए जल्द ही वापस देखें।" },
    pt: { title: "Chamadas de elenco pausadas", description: "Não estamos aceitando inscrições para elenco no momento. Por favor, volte em breve para novas oportunidades." },
    ru: { title: "Кастинги приостановлены", description: "В настоящее время мы не принимаем заявки на кастинг. Пожалуйста, зайдите позже." },
    de: { title: "Casting-Aufrufe pausiert", description: "Wir nehmen derzeit keine Casting-Bewerbungen an. Bitte schauen Sie bald wieder vorbei." },
    ko: { title: "캐스팅 모집 일시 중지", description: "현재 캐스팅 지원을 받지 않고 있습니다. 새로운 기회가 있는지 곧 다시 확인해 주세요." }
};

const dir = path.join(__dirname, 'messages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

for (const file of files) {
    const lang = file.replace('.json', '');
    if (!translations[lang]) continue;
    
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(content);
    
    if (!obj.castingPaused) {
        obj.castingPaused = translations[lang];
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\\n', 'utf8');
        console.log(`Updated ${file}`);
    } else {
        console.log(`Already updated ${file}`);
    }
}
