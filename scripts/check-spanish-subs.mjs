import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

const rows = await p.filmSubtitle.findMany({
    where: { language: 'es' },
    select: {
        id: true, projectId: true, language: true,
        originalLanguage: true, status: true, translateStatus: true,
        langStatus: true, segments: true, translations: true,
    }
})

if (!rows.length) {
    console.log('NO Spanish subtitle records found in DB (language=es)')
} else {
    for (const r of rows) {
        const segs = JSON.parse(r.segments || '[]')
        let trans = {}
        try { trans = JSON.parse(r.translations || '{}') } catch {}
        const transLangs = Object.keys(trans)
        const enSegs = trans['en'] ?? []
        const enNonEmpty = enSegs.filter(s => s.text?.trim().length > 0).length
        console.log('─'.repeat(60))
        console.log('projectId:          ', r.projectId)
        console.log('id:                 ', r.id)
        console.log('language:           ', r.language)
        console.log('originalLanguage:   ', r.originalLanguage ?? '(null – not set)')
        console.log('status:             ', r.status)
        console.log('translateStatus:    ', r.translateStatus)
        console.log('segmentCount:       ', segs.length)
        console.log('firstSegment:       ', segs[0]?.text?.slice(0, 80) ?? '(empty)')
        console.log('langStatus:         ', JSON.stringify(r.langStatus))
        console.log('translatedLangs:    ', transLangs.join(', ') || '(none)')
        console.log('englishTrack:       ', transLangs.includes('en') ? `YES – ${enSegs.length} segs, ${enNonEmpty} non-empty` : 'MISSING')
    }
}

await p.$disconnect()
