import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — Fetch transcript for a lesson (public, for subtitle display)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const lessonId = searchParams.get('lessonId')

    if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

    const transcript = await prisma.transcript.findUnique({ where: { lessonId } })
    if (!transcript || transcript.status !== 'completed') {
        return NextResponse.json({ transcript: null })
    }

    return NextResponse.json({
        transcript: {
            id: transcript.id,
            lessonId: transcript.lessonId,
            language: transcript.language,
            segments: typeof transcript.segments === 'string' ? JSON.parse(transcript.segments) : transcript.segments,
            translations: transcript.translations ? (typeof transcript.translations === 'string' ? JSON.parse(transcript.translations) : transcript.translations) : null,
            status: transcript.status,
        },
    })
}
