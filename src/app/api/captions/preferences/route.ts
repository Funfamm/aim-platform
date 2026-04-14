import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { CAPTION_LANGS, type CaptionLang } from '@/lib/livekit/translation-adapter'

// GET /api/captions/preferences — return the authenticated user's preferred caption language
export async function GET() {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { preferredLanguage: true },
    })

    return NextResponse.json({
        lang: (user?.preferredLanguage || 'en') as CaptionLang,
    })
}

// PUT /api/captions/preferences — save the user's preferred caption language
export async function PUT(req: Request) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const lang = body.lang as CaptionLang

    if (!lang || !CAPTION_LANGS.includes(lang)) {
        return NextResponse.json(
            { error: `Invalid lang. Must be one of: ${CAPTION_LANGS.join(', ')}` },
            { status: 400 }
        )
    }

    await prisma.user.update({
        where: { id: session.userId },
        data: { preferredLanguage: lang },
    })

    return NextResponse.json({ lang })
}
