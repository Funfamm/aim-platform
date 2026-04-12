const fs = require('fs');
const path = require('path');

const additions = {
    en: {
        formScriptContentError: "Please paste your script or upload a file — at least one is required.",
        formScriptHint: "Paste text or upload a file",
        formScriptOptionA: "Option A — Paste script text",
        formScriptOptionB: "Option B — Upload script file",
        formScriptRemoveFile: "Remove file"
    },
    es: {
        formScriptContentError: "Pegue su guion o suba un archivo; al menos uno es obligatorio.",
        formScriptHint: "Pegar texto o subir un archivo",
        formScriptOptionA: "Opción A: Pegar texto del guion",
        formScriptOptionB: "Opción B: Subir archivo del guion",
        formScriptRemoveFile: "Eliminar archivo"
    },
    fr: {
        formScriptContentError: "Veuillez coller votre scénario ou télécharger un fichier — au moins un est requis.",
        formScriptHint: "Coller du texte ou télécharger un fichier",
        formScriptOptionA: "Option A — Coller le texte du scénario",
        formScriptOptionB: "Option B — Télécharger le fichier du scénario",
        formScriptRemoveFile: "Supprimer le fichier"
    },
    ar: {
        formScriptContentError: "الرجاء لصق السيناريو أو تحميل ملف — أحدهما على الأقل مطلوب.",
        formScriptHint: "لصق نص أو تحميل ملف",
        formScriptOptionA: "الخيار أ — لصق نص السيناريو",
        formScriptOptionB: "الخيار ب — تحميل ملف السيناريو",
        formScriptRemoveFile: "إزالة الملف"
    },
    zh: {
        formScriptContentError: "请粘贴您的剧本或上传文件——至少需要提供一项。",
        formScriptHint: "粘贴文本或上传文件",
        formScriptOptionA: "选项A —— 粘贴剧本文本",
        formScriptOptionB: "选项B —— 上传剧本文件",
        formScriptRemoveFile: "移除文件"
    },
    hi: {
        formScriptContentError: "कृपया अपनी स्क्रिप्ट पेस्ट करें या फ़ाइल अपलोड करें — कम से कम एक आवश्यक है।",
        formScriptHint: "टेक्स्ट पेस्ट करें या फ़ाइल अपलोड करें",
        formScriptOptionA: "विकल्प A — स्क्रिप्ट टेक्स्ट पेस्ट करें",
        formScriptOptionB: "विकल्प B — स्क्रिप्ट फ़ाइल अपलोड करें",
        formScriptRemoveFile: "फ़ाइल निकालें"
    },
    pt: {
        formScriptContentError: "Cole seu roteiro ou envie um arquivo — pelo menos um é obrigatório.",
        formScriptHint: "Colar texto ou enviar arquivo",
        formScriptOptionA: "Opção A — Colar texto do roteiro",
        formScriptOptionB: "Opção B — Enviar arquivo do roteiro",
        formScriptRemoveFile: "Remover arquivo"
    },
    ru: {
        formScriptContentError: "Пожалуйста, вставьте ваш сценарий или загрузите файл — требуется хотя бы одно.",
        formScriptHint: "Вставить текст или загрузить файл",
        formScriptOptionA: "Вариант А — Вставить текст сценария",
        formScriptOptionB: "Вариант Б — Загрузить файл сценария",
        formScriptRemoveFile: "Удалить файл"
    },
    ja: {
        formScriptContentError: "脚本を貼り付けるか、ファイルをアップロードしてください — 少なくとも1つは必須です。",
        formScriptHint: "テキストを貼り付けるか、ファイルをアップロード",
        formScriptOptionA: "オプションA — 脚本テキストを貼り付け",
        formScriptOptionB: "オプションB — 脚本ファイルをアップロード",
        formScriptRemoveFile: "ファイルを削除"
    },
    de: {
        formScriptContentError: "Bitte fügen Sie Ihr Skript ein oder laden Sie eine Datei hoch – mindestens eines ist erforderlich.",
        formScriptHint: "Text einfügen oder Datei hochladen",
        formScriptOptionA: "Option A — Skripttext einfügen",
        formScriptOptionB: "Option B — Skriptdatei hochladen",
        formScriptRemoveFile: "Datei entfernen"
    },
    ko: {
        formScriptContentError: "대본을 붙여넣거나 파일을 업로드하세요 — 최소 하나는 필수입니다.",
        formScriptHint: "텍스트 붙여넣기 또는 파일 업로드",
        formScriptOptionA: "옵션 A — 대본 텍스트 붙여넣기",
        formScriptOptionB: "옵션 B — 대본 파일 업로드",
        formScriptRemoveFile: "파일 제거"
    }
};

const dir = path.join(__dirname, 'messages');
for (const locale of Object.keys(additions)) {
    const file = path.join(dir, `${locale}.json`);
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        
        let writeMode = false;
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
            writeMode = true;
        }

        try {
            const data = JSON.parse(content);
            if (data.scripts) {
                Object.assign(data.scripts, additions[locale]);
                fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8');
                console.log(`Updated ${locale}.json`);
            }
        } catch (e) {
            console.error(`Failed to parse ${locale}.json`, e);
        }
    }
}
