import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — fetch subtitles for a project/episode
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const episodeId = searchParams.get('episodeId') || null

    if (!projectId) {
        return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const subtitle = await (prisma as any).filmSubtitle.findFirst({
        where: {
            projectId,
            episodeId: episodeId || null,
        },
    })

    return NextResponse.json({ subtitle })
}

// POST — save/update subtitles
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { projectId, episodeId, language, segments, translations, status } = body

        if (!projectId || !segments) {
            return NextResponse.json({ error: 'projectId and segments required' }, { status: 400 })
        }

        // Check if subtitle already exists for this project/episode
        const existing = await (prisma as any).filmSubtitle.findFirst({
            where: {
                projectId,
                episodeId: episodeId || null,
            },
        })

        let subtitle
        if (existing) {
            subtitle = await (prisma as any).filmSubtitle.update({
                where: { id: existing.id },
                data: {
                    language: language || 'en',
                    segments: typeof segments === 'string' ? segments : JSON.stringify(segments),
                    translations: translations ? (typeof translations === 'string' ? translations : JSON.stringify(translations)) : null,
                    status: status || 'completed',
                },
            })
        } else {
            subtitle = await (prisma as any).filmSubtitle.create({
                data: {
                    projectId,
                    episodeId: episodeId || null,
                    language: language || 'en',
                    segments: typeof segments === 'string' ? segments : JSON.stringify(segments),
                    translations: translations ? (typeof translations === 'string' ? translations : JSON.stringify(translations)) : null,
                    status: status || 'completed',
                },
            })
        }

        return NextResponse.json({ subtitle })
    } catch (error) {
        console.error('Subtitle save error:', error)
        return NextResponse.json({ error: 'Failed to save subtitles' }, { status: 500 })
    }
}
