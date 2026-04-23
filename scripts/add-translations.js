const fs = require('fs');
const path = require('path');

// Keys to add to projectDetail namespace per locale
const projectDetailKeys = {
  en: {
    gallery: 'Gallery', behindTheScenes: 'Behind the Scenes',
    credits: 'Credits', teamBehind: 'The Team Behind',
    roleDirector: 'Director', roleProducer: 'Producer',
    roleEditor: 'Editor', roleWriter: 'Writer',
    roleCinematographer: 'Cinematographer', roleComposer: 'Composer',
    roleNarrator: 'Narrator', roleActor: 'Actor',
    roleExecProducer: 'Executive Producer', roleCoDirector: 'Co-Director',
    roleSoundDesigner: 'Sound Designer', roleArtDirector: 'Art Director',
    roleCostumeDesigner: 'Costume Designer', roleMakeupArtist: 'Makeup Artist',
  },
  hi: {
    gallery: '\u0917\u0948\u0932\u0930\u0940', behindTheScenes: '\u092A\u0930\u094D\u0926\u0947 \u0915\u0947 \u092A\u0940\u091B\u0947',
    credits: '\u0936\u094D\u0930\u0947\u092F', teamBehind: '\u0907\u0938\u0915\u0947 \u092A\u0940\u091B\u0947 \u0915\u0940 \u091F\u0940\u092E',
    roleDirector: '\u0928\u093F\u0930\u094D\u0926\u0947\u0936\u0915', roleProducer: '\u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E',
    roleEditor: '\u0938\u0902\u092A\u093E\u0926\u0915', roleWriter: '\u0932\u0947\u0916\u0915',
    roleCinematographer: '\u091B\u093E\u092F\u093E\u0915\u093E\u0930', roleComposer: '\u0938\u0902\u0917\u0940\u0924\u0915\u093E\u0930',
    roleNarrator: '\u0915\u0925\u093E\u0935\u093E\u091A\u0915', roleActor: '\u0905\u092D\u093F\u0928\u0947\u0924\u093E',
    roleExecProducer: '\u0915\u093E\u0930\u094D\u092F\u0915\u093E\u0930\u0940 \u0928\u093F\u0930\u094D\u092E\u093E\u0924\u093E', roleCoDirector: '\u0938\u0939-\u0928\u093F\u0930\u094D\u0926\u0947\u0936\u0915',
    roleSoundDesigner: '\u0927\u094D\u0935\u0928\u093F \u0921\u093F\u091C\u093C\u093E\u0907\u0928\u0930', roleArtDirector: '\u0915\u0932\u093E \u0928\u093F\u0930\u094D\u0926\u0947\u0936\u0915',
    roleCostumeDesigner: '\u092A\u094B\u0936\u093E\u0915 \u0921\u093F\u091C\u093C\u093E\u0907\u0928\u0930', roleMakeupArtist: '\u092E\u0947\u0915\u0905\u092A \u0915\u0932\u093E\u0915\u093E\u0930',
  },
  ar: {
    gallery: '\u0627\u0644\u0645\u0639\u0631\u0636', behindTheScenes: '\u062E\u0644\u0641 \u0627\u0644\u0643\u0648\u0627\u0644\u064A\u0633',
    credits: '\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F\u0627\u062A', teamBehind: '\u0627\u0644\u0641\u0631\u064A\u0642 \u062E\u0644\u0641',
    roleDirector: '\u0627\u0644\u0645\u062E\u0631\u062C', roleProducer: '\u0627\u0644\u0645\u0646\u062A\u062C',
    roleEditor: '\u0627\u0644\u0645\u062D\u0631\u0631', roleWriter: '\u0627\u0644\u0643\u0627\u062A\u0628',
    roleCinematographer: '\u0627\u0644\u0645\u0635\u0648\u0631 \u0627\u0644\u0633\u064A\u0646\u0645\u0627\u0626\u064A', roleComposer: '\u0627\u0644\u0645\u0644\u062D\u0646',
    roleNarrator: '\u0627\u0644\u0631\u0627\u0648\u064A', roleActor: '\u0627\u0644\u0645\u0645\u062B\u0644',
    roleExecProducer: '\u0627\u0644\u0645\u0646\u062A\u062C \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A', roleCoDirector: '\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0645\u062E\u0631\u062C',
    roleSoundDesigner: '\u0645\u0635\u0645\u0645 \u0627\u0644\u0635\u0648\u062A', roleArtDirector: '\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0646\u064A',
    roleCostumeDesigner: '\u0645\u0635\u0645\u0645 \u0627\u0644\u0623\u0632\u064A\u0627\u0621', roleMakeupArtist: '\u0641\u0646\u0627\u0646 \u0627\u0644\u0645\u0643\u064A\u0627\u062C',
  },
  de: {
    gallery: 'Galerie', behindTheScenes: 'Hinter den Kulissen',
    credits: 'Mitwirkende', teamBehind: 'Das Team hinter',
    roleDirector: 'Regisseur', roleProducer: 'Produzent',
    roleEditor: 'Schnitt', roleWriter: 'Autor',
    roleCinematographer: 'Kamera', roleComposer: 'Komponist',
    roleNarrator: 'Erz\u00E4hler', roleActor: 'Darsteller',
    roleExecProducer: 'Ausf\u00FChrender Produzent', roleCoDirector: 'Co-Regisseur',
    roleSoundDesigner: 'Tondesigner', roleArtDirector: 'Szenenbildner',
    roleCostumeDesigner: 'Kost\u00FCmdesigner', roleMakeupArtist: 'Maskenbildner',
  },
  es: {
    gallery: 'Galer\u00EDa', behindTheScenes: 'Detr\u00E1s de Escenas',
    credits: 'Cr\u00E9ditos', teamBehind: 'El Equipo Detr\u00E1s de',
    roleDirector: 'Director', roleProducer: 'Productor',
    roleEditor: 'Editor', roleWriter: 'Guionista',
    roleCinematographer: 'Cinemat\u00F3grafo', roleComposer: 'Compositor',
    roleNarrator: 'Narrador', roleActor: 'Actor',
    roleExecProducer: 'Productor Ejecutivo', roleCoDirector: 'Codirector',
    roleSoundDesigner: 'Dise\u00F1ador de Sonido', roleArtDirector: 'Director Art\u00EDstico',
    roleCostumeDesigner: 'Dise\u00F1ador de Vestuario', roleMakeupArtist: 'Maquillador',
  },
  fr: {
    gallery: 'Galerie', behindTheScenes: 'Les Coulisses',
    credits: 'Cr\u00E9dits', teamBehind: "L'\u00C9quipe Derri\u00E8re",
    roleDirector: 'R\u00E9alisateur', roleProducer: 'Producteur',
    roleEditor: 'Monteur', roleWriter: 'Sc\u00E9nariste',
    roleCinematographer: 'Directeur Photo', roleComposer: 'Compositeur',
    roleNarrator: 'Narrateur', roleActor: 'Acteur',
    roleExecProducer: 'Producteur Ex\u00E9cutif', roleCoDirector: 'Co-r\u00E9alisateur',
    roleSoundDesigner: 'Concepteur Sonore', roleArtDirector: 'Directeur Artistique',
    roleCostumeDesigner: 'Costumier', roleMakeupArtist: 'Maquilleur',
  },
  ja: {
    gallery: '\u30AE\u30E3\u30E9\u30EA\u30FC', behindTheScenes: '\u821E\u53F0\u88CF',
    credits: '\u30AF\u30EC\u30B8\u30C3\u30C8', teamBehind: '\u30C1\u30FC\u30E0',
    roleDirector: '\u76E3\u7763', roleProducer: '\u30D7\u30ED\u30C7\u30E5\u30FC\u30B5\u30FC',
    roleEditor: '\u7DE8\u96C6', roleWriter: '\u811A\u672C',
    roleCinematographer: '\u64AE\u5F71\u76E3\u7763', roleComposer: '\u4F5C\u66F2',
    roleNarrator: '\u30CA\u30EC\u30FC\u30BF\u30FC', roleActor: '\u4FF3\u512A',
    roleExecProducer: '\u30A8\u30B0\u30BC\u30AF\u30C6\u30A3\u30D6\u30D7\u30ED\u30C7\u30E5\u30FC\u30B5\u30FC', roleCoDirector: '\u5171\u540C\u76E3\u7763',
    roleSoundDesigner: '\u30B5\u30A6\u30F3\u30C9\u30C7\u30B6\u30A4\u30CA\u30FC', roleArtDirector: '\u30A2\u30FC\u30C8\u30C7\u30A3\u30EC\u30AF\u30BF\u30FC',
    roleCostumeDesigner: '\u8863\u88C5\u30C7\u30B6\u30A4\u30CA\u30FC', roleMakeupArtist: '\u30E1\u30A4\u30AF\u30A2\u30C3\u30D7\u30A2\u30FC\u30C6\u30A3\u30B9\u30C8',
  },
  ko: {
    gallery: '\uAC24\uB7EC\uB9AC', behindTheScenes: '\uBE44\uD558\uC778\uB4DC \uC2A4\uD1A0\uB9AC',
    credits: '\uD06C\uB808\uB527', teamBehind: '\uD300',
    roleDirector: '\uAC10\uB3C5', roleProducer: '\uD504\uB85C\uB4C0\uC11C',
    roleEditor: '\uD3B8\uC9D1', roleWriter: '\uC791\uAC00',
    roleCinematographer: '\uCD2C\uC601\uAC10\uB3C5', roleComposer: '\uC791\uACE1',
    roleNarrator: '\uB0B4\uB808\uC774\uD130', roleActor: '\uBC30\uC6B0',
    roleExecProducer: '\uCD1D\uAD04 \uD504\uB85C\uB4C0\uC11C', roleCoDirector: '\uACF5\uB3D9 \uAC10\uB3C5',
    roleSoundDesigner: '\uC0AC\uC6B4\uB4DC \uB514\uC790\uC774\uB108', roleArtDirector: '\uC544\uD2B8 \uB514\uB809\uD130',
    roleCostumeDesigner: '\uC758\uC0C1 \uB514\uC790\uC774\uB108', roleMakeupArtist: '\uBA54\uC774\uD06C\uC5C5 \uC544\uD2F0\uC2A4\uD2B8',
  },
  pt: {
    gallery: 'Galeria', behindTheScenes: 'Bastidores',
    credits: 'Cr\u00E9ditos', teamBehind: 'A Equipe Por Tr\u00E1s de',
    roleDirector: 'Diretor', roleProducer: 'Produtor',
    roleEditor: 'Editor', roleWriter: 'Roteirista',
    roleCinematographer: 'Diretor de Fotografia', roleComposer: 'Compositor',
    roleNarrator: 'Narrador', roleActor: 'Ator',
    roleExecProducer: 'Produtor Executivo', roleCoDirector: 'Codiretor',
    roleSoundDesigner: 'Designer de Som', roleArtDirector: 'Diretor de Arte',
    roleCostumeDesigner: 'Figurinista', roleMakeupArtist: 'Maquiador',
  },
  ru: {
    gallery: '\u0413\u0430\u043B\u0435\u0440\u0435\u044F', behindTheScenes: '\u0417\u0430 \u043A\u0443\u043B\u0438\u0441\u0430\u043C\u0438',
    credits: '\u0422\u0438\u0442\u0440\u044B', teamBehind: '\u041A\u043E\u043C\u0430\u043D\u0434\u0430',
    roleDirector: '\u0420\u0435\u0436\u0438\u0441\u0441\u0451\u0440', roleProducer: '\u041F\u0440\u043E\u0434\u044E\u0441\u0435\u0440',
    roleEditor: '\u041C\u043E\u043D\u0442\u0430\u0436\u0451\u0440', roleWriter: '\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0441\u0442',
    roleCinematographer: '\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440', roleComposer: '\u041A\u043E\u043C\u043F\u043E\u0437\u0438\u0442\u043E\u0440',
    roleNarrator: '\u0420\u0430\u0441\u0441\u043A\u0430\u0437\u0447\u0438\u043A', roleActor: '\u0410\u043A\u0442\u0451\u0440',
    roleExecProducer: '\u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u043E\u0434\u044E\u0441\u0435\u0440', roleCoDirector: '\u0421\u043E-\u0440\u0435\u0436\u0438\u0441\u0441\u0451\u0440',
    roleSoundDesigner: '\u0417\u0432\u0443\u043A\u043E\u0440\u0435\u0436\u0438\u0441\u0441\u0451\u0440', roleArtDirector: '\u0410\u0440\u0442-\u0434\u0438\u0440\u0435\u043A\u0442\u043E\u0440',
    roleCostumeDesigner: '\u0425\u0443\u0434\u043E\u0436\u043D\u0438\u043A \u043F\u043E \u043A\u043E\u0441\u0442\u044E\u043C\u0430\u043C', roleMakeupArtist: '\u0412\u0438\u0437\u0430\u0436\u0438\u0441\u0442',
  },
  zh: {
    gallery: '\u753B\u5ECA', behindTheScenes: '\u5E55\u540E\u82B1\u7D6E',
    credits: '\u6F14\u804C\u4EBA\u5458', teamBehind: '\u56E2\u961F',
    roleDirector: '\u5BFC\u6F14', roleProducer: '\u5236\u7247\u4EBA',
    roleEditor: '\u526A\u8F91', roleWriter: '\u7F16\u5267',
    roleCinematographer: '\u6444\u5F71\u6307\u5BFC', roleComposer: '\u4F5C\u66F2',
    roleNarrator: '\u65C1\u767D', roleActor: '\u6F14\u5458',
    roleExecProducer: '\u6267\u884C\u5236\u7247\u4EBA', roleCoDirector: '\u8054\u5408\u5BFC\u6F14',
    roleSoundDesigner: '\u58F0\u97F3\u8BBE\u8BA1', roleArtDirector: '\u7F8E\u672F\u6307\u5BFC',
    roleCostumeDesigner: '\u670D\u88C5\u8BBE\u8BA1', roleMakeupArtist: '\u5316\u5986\u5E08',
  },
};

// Keys to add to watchPlayer namespace
const watchPlayerKeys = {
  en: { hintPlay: 'play', hintVolume: 'volume', hintMute: 'mute', hintFullscreen: 'fullscreen' },
  hi: { hintPlay: '\u091A\u0932\u093E\u090F\u0902', hintVolume: '\u0906\u0935\u093E\u091C\u093C', hintMute: '\u092E\u094D\u092F\u0942\u091F', hintFullscreen: '\u092A\u0942\u0930\u094D\u0923 \u0938\u094D\u0915\u094D\u0930\u0940\u0928' },
  ar: { hintPlay: '\u062A\u0634\u063A\u064A\u0644', hintVolume: '\u0627\u0644\u0635\u0648\u062A', hintMute: '\u0643\u062A\u0645', hintFullscreen: '\u0645\u0644\u0621 \u0627\u0644\u0634\u0627\u0634\u0629' },
  de: { hintPlay: 'Abspielen', hintVolume: 'Lautst\u00E4rke', hintMute: 'Stumm', hintFullscreen: 'Vollbild' },
  es: { hintPlay: 'reproducir', hintVolume: 'volumen', hintMute: 'silenciar', hintFullscreen: 'pantalla completa' },
  fr: { hintPlay: 'lecture', hintVolume: 'volume', hintMute: 'muet', hintFullscreen: 'plein \u00E9cran' },
  ja: { hintPlay: '\u518D\u751F', hintVolume: '\u97F3\u91CF', hintMute: '\u30DF\u30E5\u30FC\u30C8', hintFullscreen: '\u30D5\u30EB\u30B9\u30AF\u30EA\u30FC\u30F3' },
  ko: { hintPlay: '\uC7AC\uC0DD', hintVolume: '\uBCFC\uB968', hintMute: '\uC74C\uC18C\uAC70', hintFullscreen: '\uC804\uCCB4\uD654\uBA74' },
  pt: { hintPlay: 'reproduzir', hintVolume: 'volume', hintMute: 'mudo', hintFullscreen: 'tela cheia' },
  ru: { hintPlay: '\u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435', hintVolume: '\u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C', hintMute: '\u0431\u0435\u0437 \u0437\u0432\u0443\u043A\u0430', hintFullscreen: '\u043F\u043E\u043B\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D' },
  zh: { hintPlay: '\u64AD\u653E', hintVolume: '\u97F3\u91CF', hintMute: '\u9759\u97F3', hintFullscreen: '\u5168\u5C4F' },
};

const locales = ['en','hi','ar','de','es','fr','ja','ko','pt','ru','zh'];
for (const locale of locales) {
  const filePath = path.join('messages', locale + '.json');
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Add projectDetail keys
  if (json.projectDetail && projectDetailKeys[locale]) {
    Object.assign(json.projectDetail, projectDetailKeys[locale]);
  }
  
  // Add watchPlayer keys  
  if (watchPlayerKeys[locale]) {
    if (!json.watchPlayer) json.watchPlayer = {};
    Object.assign(json.watchPlayer, watchPlayerKeys[locale]);
  }
  
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log('Updated ' + locale);
}
console.log('Done!');
