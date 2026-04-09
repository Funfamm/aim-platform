import { readFileSync, writeFileSync } from 'fs'

const LOCALES = ['en','ar','de','es','fr','hi','ja','ko','pt','ru','zh']

const watchTrailer = {
  en: 'Watch Trailer',
  ar: 'شاهد الإعلان',
  de: 'Trailer ansehen',
  es: 'Ver tráiler',
  fr: 'Voir la bande-annonce',
  hi: 'ट्रेलर देखें',
  ja: 'トレーラーを見る',
  ko: '트레일러 보기',
  pt: 'Assistir ao trailer',
  ru: 'Смотреть трейлер',
  zh: '观看预告片',
}

for (const loc of LOCALES) {
  const path = `messages/${loc}.json`
  const msgs = JSON.parse(readFileSync(path, 'utf8'))
  if (!msgs.works) msgs.works = {}
  msgs.works.watchTrailer = watchTrailer[loc]
  writeFileSync(path, JSON.stringify(msgs, null, 2))
  console.log(`Updated ${path}`)
}
console.log('Done adding watchTrailer to works namespace in all locales.')
