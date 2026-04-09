import { readFileSync, writeFileSync } from 'fs'

const LOCALES = ['en','ar','de','es','fr','hi','ja','ko','pt','ru','zh']

const notFound = {
  en: {
    title: 'Scene Not Found',
    desc: "Looks like this scene didn't make the final cut. The page you're looking for may have been moved, renamed, or is still in pre-production.",
    backHome: 'Back to Home',
    viewCasting: 'View Casting Calls',
  },
  ar: {
    title: 'المشهد غير موجود',
    desc: 'يبدو أن هذا المشهد لم يصل إلى النسخة النهائية. قد تكون الصفحة التي تبحث عنها قد نُقلت أو أُعيدت تسميتها أو لا تزال في مرحلة الإنتاج المسبق.',
    backHome: 'العودة إلى الرئيسية',
    viewCasting: 'عرض نداءات التمثيل',
  },
  de: {
    title: 'Szene nicht gefunden',
    desc: 'Es sieht aus, als hätte diese Szene den finalen Schnitt nicht überlebt. Die gesuchte Seite wurde möglicherweise verschoben, umbenannt oder befindet sich noch in der Vorproduktion.',
    backHome: 'Zurück zur Startseite',
    viewCasting: 'Castings ansehen',
  },
  es: {
    title: 'Escena no encontrada',
    desc: 'Parece que esta escena no llegó al corte final. La página que buscas puede haberse movido, renombrado, o aún estar en preproducción.',
    backHome: 'Volver al inicio',
    viewCasting: 'Ver convocatorias',
  },
  fr: {
    title: 'Scène introuvable',
    desc: "Il semble que cette scène n'ait pas survécu au montage final. La page que vous cherchez a peut-être été déplacée, renommée ou est encore en pré-production.",
    backHome: "Retour à l'accueil",
    viewCasting: 'Voir les castings',
  },
  hi: {
    title: 'दृश्य नहीं मिला',
    desc: 'लगता है यह दृश्य फाइनल कट में नहीं बना। जो पेज आप ढूंढ रहे हैं वह शायद स्थानांतरित, नाम बदला गया, या अभी प्री-प्रोडक्शन में है।',
    backHome: 'होम पर वापस जाएं',
    viewCasting: 'कास्टिंग कॉल देखें',
  },
  ja: {
    title: 'シーンが見つかりません',
    desc: 'このシーンは最終カットに残らなかったようです。お探しのページは移動、名前変更、またはまだプリプロダクション中の可能性があります。',
    backHome: 'ホームに戻る',
    viewCasting: 'キャスティングを見る',
  },
  ko: {
    title: '씬을 찾을 수 없습니다',
    desc: '이 씬은 최종 편집에서 살아남지 못한 것 같습니다. 찾고 계신 페이지가 이동되거나, 이름이 변경되었거나, 아직 프리프로덕션 중일 수 있습니다.',
    backHome: '홈으로 돌아가기',
    viewCasting: '캐스팅 보기',
  },
  pt: {
    title: 'Cena não encontrada',
    desc: 'Parece que esta cena não passou pelo corte final. A página que você procura pode ter sido movida, renomeada ou ainda estar em pré-produção.',
    backHome: 'Voltar ao início',
    viewCasting: 'Ver castings',
  },
  ru: {
    title: 'Сцена не найдена',
    desc: 'Похоже, эта сцена не вошла в финальный монтаж. Страница, которую вы ищете, могла быть перемещена, переименована или всё ещё находится в разработке.',
    backHome: 'На главную',
    viewCasting: 'Кастинги',
  },
  zh: {
    title: '找不到该场景',
    desc: '看来这个场景没有进入最终剪辑。您正在寻找的页面可能已被移动、重命名，或仍在制作前期。',
    backHome: '返回首页',
    viewCasting: '查看试镜',
  },
}

for (const loc of LOCALES) {
  const path = `messages/${loc}.json`
  const msgs = JSON.parse(readFileSync(path, 'utf8'))
  msgs.notFound = notFound[loc]
  writeFileSync(path, JSON.stringify(msgs, null, 2))
  console.log(`Updated ${path}`)
}
console.log('Done adding notFound keys.')
