const fs = require('fs');
const https = require('https');
const path = require('path');

const locales = ['ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh']; // 'en' is baseline

const newLoginStrings = {
    invalidCredentials: 'Invalid email or password',
    credentialsRequired: 'Email and password are required',
    verifyEmailRequired: 'Please verify your email before logging in.'
};

const newRegisterStrings = {
    allFieldsRequired: 'Name, email, and password are required',
    accountExists: 'An account with this email already exists'
};

async function translate(text, targetLang) {
    if (targetLang === 'zh') targetLang = 'zh-CN';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed[0].map(x => x[0]).join(''));
                } catch(e) {
                    console.error('Parse error for', text, targetLang);
                    resolve(text);
                }
            });
        }).on('error', (e) => {
            console.error('Req error for', text, targetLang, e);
            resolve(text)
        });
    });
}

async function run() {
    // Handle EN first
    const enPath = path.join('messages', 'en.json');
    let enData;
    try {
        enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        Object.assign(enData.login, newLoginStrings);
        Object.assign(enData.register, newRegisterStrings);
        fs.writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n');
        console.log('Updated en');
    } catch(e) {
        console.error('Error on en', e);
        return;
    }

    // Handle others
    for (const locale of locales) {
        const filePath = path.join('messages', `${locale}.json`);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            for (const [key, text] of Object.entries(newLoginStrings)) {
                if (!data.login[key]) {
                    data.login[key] = await translate(text, locale);
                }
            }
            
            for (const [key, text] of Object.entries(newRegisterStrings)) {
                if (!data.register[key]) {
                    data.register[key] = await translate(text, locale);
                }
            }
            
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
            console.log(`Updated ${locale}`);
        } catch(e) {
            console.error(`Error processing ${locale}`, e);
        }
    }
}
run();
