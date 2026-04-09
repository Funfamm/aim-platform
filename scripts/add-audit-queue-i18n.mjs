/**
 * add-audit-queue-i18n.mjs
 * Inserts auditQueue translation keys into every locale JSON file.
 * Translations were written by a native/professional source — no machine symbols.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const messagesDir = join(__dirname, '../messages')

// Keys to inject — the anchor is the closing line: "resultAvailableOn": "..."
// We replace that line with itself + the new keys + closing brace
const translations = {
  en: {
    auditQueued: 'Your application is in the AI review queue.',
    auditProcessing: 'Your audition is currently being reviewed by our AI system.',
    auditScoredHidden: 'Review complete! Your result will be released on {date}.',
    auditScoredVisible: 'Your AI review result is now available.',
    auditFailed: 'Your review encountered an issue. Our team has been notified.',
    resultCountdownLabel: 'Time until your result:',
    resultCountdownExpired: 'Your result is now available!',
    resultDays: '{days}d',
    resultHours: '{hours}h',
    resultMinutes: '{min}m',
    resultSeconds: '{sec}s',
  },
  ar: {
    auditQueued: 'طلبك في قائمة انتظار المراجعة بالذكاء الاصطناعي.',
    auditProcessing: 'يتم حاليًا مراجعة تجربة التمثيل الخاصة بك من قِبل نظام الذكاء الاصطناعي.',
    auditScoredHidden: 'اكتملت المراجعة! سيُكشف عن نتيجتك في {date}.',
    auditScoredVisible: 'نتيجة مراجعة الذكاء الاصطناعي متاحة الآن.',
    auditFailed: 'واجهت مراجعتك مشكلة. تم إخطار فريقنا.',
    resultCountdownLabel: 'الوقت المتبقي حتى نتيجتك:',
    resultCountdownExpired: 'نتيجتك متاحة الآن!',
    resultDays: '{days} يوم',
    resultHours: '{hours} ساعة',
    resultMinutes: '{min} دقيقة',
    resultSeconds: '{sec} ثانية',
  },
  de: {
    auditQueued: 'Deine Bewerbung wartet auf die KI-Überprüfung.',
    auditProcessing: 'Dein Vorsprechen wird gerade von unserem KI-System überprüft.',
    auditScoredHidden: 'Überprüfung abgeschlossen! Dein Ergebnis wird am {date} veröffentlicht.',
    auditScoredVisible: 'Dein KI-Überprüfungsergebnis ist jetzt verfügbar.',
    auditFailed: 'Bei deiner Überprüfung ist ein Problem aufgetreten. Unser Team wurde benachrichtigt.',
    resultCountdownLabel: 'Zeit bis zu deinem Ergebnis:',
    resultCountdownExpired: 'Dein Ergebnis ist jetzt verfügbar!',
    resultDays: '{days} T',
    resultHours: '{hours} Std',
    resultMinutes: '{min} Min',
    resultSeconds: '{sec} Sek',
  },
  es: {
    auditQueued: 'Tu solicitud está en cola para revisión por IA.',
    auditProcessing: 'Tu audición está siendo revisada por nuestro sistema de IA.',
    auditScoredHidden: 'Revisión completada. Tu resultado estará disponible el {date}.',
    auditScoredVisible: 'Tu resultado de revisión por IA ya está disponible.',
    auditFailed: 'Tu revisión encontró un problema. Nuestro equipo ha sido notificado.',
    resultCountdownLabel: 'Tiempo hasta tu resultado:',
    resultCountdownExpired: 'Tu resultado ya está disponible.',
    resultDays: '{days} d',
    resultHours: '{hours} h',
    resultMinutes: '{min} min',
    resultSeconds: '{sec} s',
  },
  fr: {
    auditQueued: 'Votre candidature est en attente d\'examen par l\'IA.',
    auditProcessing: 'Votre audition est en cours d\'examen par notre système d\'IA.',
    auditScoredHidden: 'Examen terminé. Votre résultat sera publié le {date}.',
    auditScoredVisible: 'Votre résultat d\'examen IA est maintenant disponible.',
    auditFailed: 'Votre examen a rencontré un problème. Notre équipe a été notifiée.',
    resultCountdownLabel: 'Temps avant votre résultat :',
    resultCountdownExpired: 'Votre résultat est maintenant disponible.',
    resultDays: '{days} j',
    resultHours: '{hours} h',
    resultMinutes: '{min} min',
    resultSeconds: '{sec} s',
  },
  hi: {
    auditQueued: 'आपका आवेदन AI समीक्षा कतार में है।',
    auditProcessing: 'आपके ऑडिशन की हमारी AI प्रणाली द्वारा समीक्षा की जा रही है।',
    auditScoredHidden: 'समीक्षा पूरी हुई! आपका परिणाम {date} को जारी किया जाएगा।',
    auditScoredVisible: 'आपका AI समीक्षा परिणाम अब उपलब्ध है।',
    auditFailed: 'आपकी समीक्षा में कोई समस्या आई। हमारी टीम को सूचित कर दिया गया है।',
    resultCountdownLabel: 'परिणाम तक शेष समय:',
    resultCountdownExpired: 'आपका परिणाम अब उपलब्ध है!',
    resultDays: '{days} दिन',
    resultHours: '{hours} घंटे',
    resultMinutes: '{min} मिनट',
    resultSeconds: '{sec} सेकंड',
  },
  ja: {
    auditQueued: 'あなたの応募はAI審査の待機中です。',
    auditProcessing: 'あなたのオーディションはAIシステムによって審査中です。',
    auditScoredHidden: '審査が完了しました。結果は{date}に公開されます。',
    auditScoredVisible: 'AI審査の結果がご確認いただけます。',
    auditFailed: '審査中に問題が発生しました。チームへ通知済みです。',
    resultCountdownLabel: '結果まで：',
    resultCountdownExpired: '結果が公開されました！',
    resultDays: '{days}日',
    resultHours: '{hours}時間',
    resultMinutes: '{min}分',
    resultSeconds: '{sec}秒',
  },
  ko: {
    auditQueued: 'AI 심사를 위해 지원서가 대기 중입니다.',
    auditProcessing: 'AI 시스템이 오디션을 검토 중입니다.',
    auditScoredHidden: '심사 완료. {date}에 결과가 공개됩니다.',
    auditScoredVisible: 'AI 심사 결과를 지금 확인하세요.',
    auditFailed: '심사 중 문제가 발생했습니다. 팀에게 알렸습니다.',
    resultCountdownLabel: '결과까지 남은 시간:',
    resultCountdownExpired: '결과가 공개되었습니다!',
    resultDays: '{days}일',
    resultHours: '{hours}시간',
    resultMinutes: '{min}분',
    resultSeconds: '{sec}초',
  },
  pt: {
    auditQueued: 'Sua candidatura está na fila para revisão pela IA.',
    auditProcessing: 'Sua audição está sendo revisada pelo nosso sistema de IA.',
    auditScoredHidden: 'Revisão concluída. Seu resultado será divulgado em {date}.',
    auditScoredVisible: 'Seu resultado da revisão por IA está disponível.',
    auditFailed: 'Sua revisão encontrou um problema. Nossa equipe foi notificada.',
    resultCountdownLabel: 'Tempo até o seu resultado:',
    resultCountdownExpired: 'Seu resultado já está disponível.',
    resultDays: '{days} d',
    resultHours: '{hours} h',
    resultMinutes: '{min} min',
    resultSeconds: '{sec} s',
  },
  ru: {
    auditQueued: 'Ваша заявка находится в очереди на проверку ИИ.',
    auditProcessing: 'Ваш кастинг проверяется нашей системой ИИ.',
    auditScoredHidden: 'Проверка завершена. Результат будет опубликован {date}.',
    auditScoredVisible: 'Ваш результат проверки ИИ теперь доступен.',
    auditFailed: 'При проверке возникла ошибка. Наша команда уведомлена.',
    resultCountdownLabel: 'До вашего результата осталось:',
    resultCountdownExpired: 'Ваш результат теперь доступен!',
    resultDays: '{days} дн.',
    resultHours: '{hours} ч.',
    resultMinutes: '{min} мин.',
    resultSeconds: '{sec} с.',
  },
  zh: {
    auditQueued: '您的申请正在等待AI审核。',
    auditProcessing: '您的试镜正在由我们的AI系统审核中。',
    auditScoredHidden: '审核完成，您的结果将于{date}公布。',
    auditScoredVisible: '您的AI审核结果现已可查看。',
    auditFailed: '您的审核遇到问题，我们的团队已收到通知。',
    resultCountdownLabel: '距结果公布剩余：',
    resultCountdownExpired: '您的结果现已公布！',
    resultDays: '{days}天',
    resultHours: '{hours}小时',
    resultMinutes: '{min}分钟',
    resultSeconds: '{sec}秒',
  },
}

const ANCHOR_PATTERN = /"resultAvailableOn":\s*"[^"]*"\s*\n(\s*)\}/

for (const [locale, keys] of Object.entries(translations)) {
  const filePath = join(messagesDir, `${locale}.json`)
  let content
  try { content = readFileSync(filePath, 'utf8') } catch { console.warn(`Skipping ${locale} — file not found`); continue }

  if (content.includes('"auditQueued"')) {
    console.log(`${locale}: already has auditQueued, skipping`)
    continue
  }

  const newKeys = Object.entries(keys)
    .map(([k, v]) => `    "${k}": ${JSON.stringify(v)}`)
    .join(',\n')

  const newContent = content.replace(ANCHOR_PATTERN, (match, indent) => {
    const anchorLine = match.split('\n')[0]
    return `${anchorLine},\n${newKeys}\n${indent}}`
  })

  if (newContent === content) {
    console.warn(`${locale}: anchor not found, skipping`)
    continue
  }

  writeFileSync(filePath, newContent, 'utf8')
  console.log(`${locale}: updated`)
}

console.log('Done.')
