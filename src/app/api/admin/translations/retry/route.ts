import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { retryMissingTranslations } from '@/lib/translate'

/**
 * POST /api/admin/translations/retry
 * Body: { type: 'casting' | 'script' | 'project' | 'course'; id: string }
 *
 * Fetches the current content + existing translations from the DB,
 * then retries only the missing locales — never re-translates what's done.
 */
export async function POST(req: Request) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { type, id } = await req.json() as { type: string; id: string }
    if (!type || !id) {
        return NextResponse.json({ error: 'type and id are required' }, { status: 400 })
    }

    switch (type) {
        case 'casting': {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const call = await (prisma as any).castingCall.findUnique({
                where: { id },
                select: { roleName: true, roleDescription: true, translations: true },
            })
            if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

            retryMissingTranslations(
                { roleName: call.roleName, roleDescription: call.roleDescription },
                call.translations,
                async (merged) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (prisma as any).castingCall.update({ where: { id }, data: { translations: merged } })
                },
                'audition'
            )
            return NextResponse.json({ success: true, queued: true })
        }

        case 'script': {
            const call = await prisma.scriptCall.findUnique({
                where: { id },
                select: { title: true, description: true, genre: true, toneKeywords: true, contentTranslations: true },
            })
            if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

            const fields: Record<string, string> = { title: call.title, description: call.description }
            if (call.genre) fields.genre = call.genre
            if (call.toneKeywords) fields.toneKeywords = call.toneKeywords

            retryMissingTranslations(
                fields,
                call.contentTranslations,
                async (merged) => {
                    await prisma.scriptCall.update({ where: { id }, data: { contentTranslations: merged } })
                },
                'scripts'
            )
            return NextResponse.json({ success: true, queued: true })
        }

        case 'project': {
            const project = await prisma.project.findUnique({
                where: { id },
                select: { title: true, tagline: true, description: true, genre: true, translations: true },
            })
            if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

            retryMissingTranslations(
                { title: project.title, tagline: project.tagline, description: project.description, genre: project.genre || '' },
                project.translations,
                async (merged) => {
                    await prisma.project.update({ where: { id }, data: { translations: merged } })
                },
                'all'
            )
            return NextResponse.json({ success: true, queued: true })
        }

        case 'course': {
            const course = await prisma.course.findUnique({
                where: { id },
                select: { title: true, description: true, translations: true },
            })
            if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

            retryMissingTranslations(
                { title: course.title, description: course.description },
                course.translations,
                async (merged) => {
                    await prisma.course.update({ where: { id }, data: { translations: merged } })
                },
                'training'
            )
            return NextResponse.json({ success: true, queued: true })
        }

        default:
            return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
}
