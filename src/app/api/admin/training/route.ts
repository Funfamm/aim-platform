import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const courses = await prisma.course.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            modules: {
                orderBy: { sortOrder: 'asc' },
                include: {
                    lessons: { orderBy: { sortOrder: 'asc' } },
                },
            },
            enrollments: true,
        },
    })

    const enriched = courses.map(c => ({
        ...c,
        totalModules: c.modules.length,
        totalLessons: c.modules.reduce((sum, m) => sum + m.lessons.length, 0),
        totalDuration: c.modules.reduce((sum, m) => sum + m.lessons.reduce((s, l) => s + (l.duration || 0), 0), 0),
        enrollmentCount: c.enrollments.length,
        completedCount: c.enrollments.filter(e => e.completedAt).length,
    }))

    return NextResponse.json(enriched)
}

export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const slug = (body.title || 'course')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') + '-' + Date.now().toString(36)

        const course = await prisma.course.create({
            data: {
                title: body.title || 'Untitled Course',
                slug,
                description: body.description || '',
                category: body.category || 'acting',
                level: body.level || 'beginner',
                thumbnail: body.thumbnail || null,
                duration: body.duration || null,
                published: false,
                sourceContent: body.sourceContent || null,
                translations: body.translations ? (typeof body.translations === 'string' ? body.translations : JSON.stringify(body.translations)) : null,
                modules: body.modules?.length ? {
                    create: body.modules.map((m: any, mi: number) => ({
                        title: m.title || `Module ${mi + 1}`,
                        description: m.description || null,
                        sortOrder: mi,
                        translations: m.translations ? (typeof m.translations === 'string' ? m.translations : JSON.stringify(m.translations)) : null,
                        lessons: m.lessons?.length ? {
                            create: m.lessons.map((l: any, li: number) => ({
                                title: l.title || `Lesson ${li + 1}`,
                                contentType: l.contentType || 'video',
                                contentUrl: l.contentUrl || null,
                                uploadPath: l.uploadPath || null,
                                description: l.description || null,
                                duration: l.duration ? parseInt(l.duration) || null : null,
                                sortOrder: li,
                                translations: l.translations ? (typeof l.translations === 'string' ? l.translations : JSON.stringify(l.translations)) : null,
                            })),
                        } : undefined,
                    })),
                } : undefined,
            },
            include: {
                modules: { include: { lessons: true } },
            },
        })

        // Fire-and-forget: auto-translate course content
        translateAndSave(
            { title: course.title, description: course.description },
            async (translations) => {
                await prisma.course.update({ where: { id: course.id }, data: { translations } })
            },
            'training'
        )

        // Also translate each module and lesson
        for (const mod of course.modules) {
            if (mod.title || mod.description) {
                translateAndSave(
                    { title: mod.title, ...(mod.description ? { description: mod.description } : {}) },
                    async (translations) => {
                        await prisma.courseModule.update({ where: { id: mod.id }, data: { translations } })
                    },
                    'training'
                )
            }
            for (const lesson of mod.lessons) {
                if (lesson.title || lesson.description) {
                    translateAndSave(
                        { title: lesson.title, ...(lesson.description ? { description: lesson.description } : {}) },
                        async (translations) => {
                            await prisma.lesson.update({ where: { id: lesson.id }, data: { translations } })
                        },
                        'training'
                    )
                }
            }
        }

        return NextResponse.json(course, { status: 201 })
    } catch (err) {
        console.error('Training POST error:', err)
        return NextResponse.json({ error: 'Create failed', details: String(err) }, { status: 500 })
    }
}
