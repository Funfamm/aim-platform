import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const rows = await p.filmSubtitle.findMany({
    select: { id: true, projectId: true, language: true, originalLanguage: true, status: true, translateStatus: true, langStatus: true, segments: true, translations: true },
    orderBy: { updatedAt: 'desc' },
    take: 10
})
if (!rows.length) { console.log('No subtitle records at all.'); await p.$disconnect(); process.exit(0) }
rows.forEach(r => {
    const sc = JSON.parse(r.segments || '[]').length
    const trans = JSON.parse(r.translations || '{}')
    const tl = Object.keys(trans).join(',')
    const enSegs = trans['en'] ?? []
    const enNonEmpty = enSegs.filter(s => s.text?.trim()).length
    const enInfo = tl.includes('en') ? ` en:${enSegs.length}segs(${enNonEmpty}nonEmpty)` : ' en:MISSING'
    console.log(
        r.projectId.slice(0,10), '|',
        'lang:', r.language,
        '| origLang:', r.originalLanguage ?? 'NULL',
        '| segs:', sc,
        '| translated:[' + (tl||'none') + ']' + enInfo,
        '| status:', r.status
    )
})
await p.$disconnect()
