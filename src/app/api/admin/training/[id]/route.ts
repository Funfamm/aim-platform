import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateContent } from '@/lib/translate'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const course = await prisma.course.findUnique({
        where: { id },
        include: {
            modules: {
                orderBy: { sortOrder: 'asc' },
                include: {
                    lessons: { orderBy: { sortOrder: 'asc' } },
                    quiz: { include: { questions: { orderBy: { sortOrder: 'asc' } } } },
                },
            },
            enrollments: true,
        },
    })

    if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(course)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const body = await req.json()

    try {
        // Update course fields
        const course = await prisma.course.update({
            where: { id },
            data: {
                title: body.title,
                description: body.description,
                category: body.category,
                level: body.level,
                thumbnail: body.thumbnail || null,
                published: body.published ?? false,
                translations: body.translations || null,
                sourceContent: body.sourceContent || null,
                sortOrder: body.sortOrder ?? 0,
            },
        })

        // Sync modules: delete removed, upsert existing
        if (body.modules) {
            const existingModules = await prisma.courseModule.findMany({ where: { courseId: id }, select: { id: true } })
            const incomingIds = body.modules.filter((m: any) => m.id).map((m: any) => m.id)
            const toDelete = existingModules.filter(m => !incomingIds.includes(m.id))
            if (toDelete.length) {
                await prisma.courseModule.deleteMany({ where: { id: { in: toDelete.map(m => m.id) } } })
            }

            for (let mi = 0; mi < body.modules.length; mi++) {
                const m = body.modules[mi]
                const moduleData = {
                    title: m.title || `Module ${mi + 1}`,
                    description: m.description || null,
                    translations: m.translations || null,
                    sortOrder: mi,
                }

                let moduleId: string
                if (m.id) {
                    await prisma.courseModule.update({ where: { id: m.id }, data: moduleData })
                    moduleId = m.id
                } else {
                    const created = await prisma.courseModule.create({ data: { ...moduleData, courseId: id } })
                    moduleId = created.id
                }

                // Sync lessons within module
                if (m.lessons) {
                    const existingLessons = await prisma.lesson.findMany({ where: { moduleId }, select: { id: true } })
                    const lessonIds = m.lessons.filter((l: any) => l.id).map((l: any) => l.id)
                    const lessonsToDelete = existingLessons.filter(l => !lessonIds.includes(l.id))
                    if (lessonsToDelete.length) {
                        await prisma.lesson.deleteMany({ where: { id: { in: lessonsToDelete.map(l => l.id) } } })
                    }

                    for (let li = 0; li < m.lessons.length; li++) {
                        const l = m.lessons[li]
                        const lessonData = {
                            title: l.title || `Lesson ${li + 1}`,
                            contentType: l.contentType || 'video',
                            contentUrl: l.contentUrl || null,
                            uploadPath: l.uploadPath || null,
                            description: l.description || null,
                            duration: l.duration ? parseInt(l.duration) : null,
                            translations: l.translations || null,
                            sortOrder: li,
                        }

                        if (l.id) {
                            await prisma.lesson.update({ where: { id: l.id }, data: lessonData })
                        } else {
                            await prisma.lesson.create({ data: { ...lessonData, moduleId } })
                        }
                    }
                }

                // Sync quiz for this module
                if (m.quiz) {
                    const existingQuiz = await prisma.quiz.findUnique({ where: { moduleId } })
                    const quizData = {
                        title: m.quiz.title || `${m.title || 'Module'} Quiz`,
                        passMark: m.quiz.passMark ?? 80,
                        maxAttempts: m.quiz.maxAttempts ?? 1,
                        translations: typeof m.quiz.translations === 'string' ? m.quiz.translations : (m.quiz.translations ? JSON.stringify(m.quiz.translations) : null),
                    }

                    let quizId: string
                    if (existingQuiz) {
                        await prisma.quiz.update({ where: { id: existingQuiz.id }, data: quizData })
                        quizId = existingQuiz.id
                    } else {
                        const created = await prisma.quiz.create({ data: { ...quizData, moduleId } })
                        quizId = created.id
                    }

                    // Sync questions
                    if (m.quiz.questions) {
                        const existingQuestions = await prisma.quizQuestion.findMany({ where: { quizId }, select: { id: true } })
                        const incomingQIds = m.quiz.questions.filter((q: any) => q.id).map((q: any) => q.id)
                        const questionsToDelete = existingQuestions.filter(q => !incomingQIds.includes(q.id))
                        if (questionsToDelete.length) {
                            await prisma.quizQuestion.deleteMany({ where: { id: { in: questionsToDelete.map(q => q.id) } } })
                        }

                        for (let qi = 0; qi < m.quiz.questions.length; qi++) {
                            const q = m.quiz.questions[qi]
                            const questionData = {
                                questionText: q.questionText || '',
                                questionType: q.questionType || 'single',
                                options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
                                correctAnswer: q.correctAnswer || '',
                                explanation: q.explanation || null,
                                sourceRef: q.sourceRef || null,
                                translations: typeof q.translations === 'string' ? q.translations : (q.translations ? JSON.stringify(q.translations) : null),
                                sortOrder: qi,
                            }

                            if (q.id) {
                                await prisma.quizQuestion.update({ where: { id: q.id }, data: questionData })
                            } else {
                                await prisma.quizQuestion.create({ data: { ...questionData, quizId } })
                            }
                        }
                    }
                } else {
                    // If quiz was removed in editor, delete it from DB
                    const existingQuiz = await prisma.quiz.findUnique({ where: { moduleId } })
                    if (existingQuiz) {
                        await prisma.quiz.delete({ where: { id: existingQuiz.id } })
                    }
                }
            }
        }

        // Stream progress events for translations
        const freshData = await prisma.course.findUnique({
            where: { id },
            include: { modules: { orderBy: { sortOrder: 'asc' }, include: { lessons: { orderBy: { sortOrder: 'asc' } }, quiz: { include: { questions: { orderBy: { sortOrder: 'asc' } } } } } } },
        })

        if (!freshData) {
            return NextResponse.json({ error: 'Course not found after save' }, { status: 404 })
        }

        // Count total translation jobs
        let totalJobs = 1 // course itself
        for (const mod of freshData.modules) {
            totalJobs++ // module
            totalJobs += mod.lessons.length // lessons
            if (mod.quiz) {
                totalJobs++ // quiz title
                totalJobs += mod.quiz.questions.length // questions
            }
        }

        const encoder = new TextEncoder()
        let completedJobs = 0

        const stream = new ReadableStream({
            async start(controller) {
                const send = (data: Record<string, unknown>) => {
                    try { controller.enqueue(encoder.encode(JSON.stringify(data) + '\n')) } catch { /* stream closed */ }
                }

                try {
                send({ type: 'progress', step: 'Saving course data...', done: 0, total: totalJobs })

                // Helper: wrap a translation job to report progress
                const tracked = (label: string, job: Promise<void>): Promise<void> =>
                    job.then(() => {
                        completedJobs++
                        send({ type: 'progress', step: label, done: completedJobs, total: totalJobs })
                    }).catch((err) => {
                        completedJobs++
                        console.error(`[translate] Failed: ${label}`, err)
                        send({ type: 'progress', step: `⚠️ ${label} (failed)`, done: completedJobs, total: totalJobs })
                    })

                const translationJobs: Promise<void>[] = []

                // Course
                translationJobs.push(tracked(
                    `Translating course: ${freshData.title}`,
                    translateContent({ title: freshData.title, description: freshData.description }).then(async (result) => {
                        if (result) await prisma.course.update({ where: { id }, data: { translations: JSON.stringify(result) } })
                    })
                ))

                for (const mod of freshData.modules) {
                    // Module
                    translationJobs.push(tracked(
                        `Translating module: ${mod.title}`,
                        translateContent({ title: mod.title, ...(mod.description ? { description: mod.description } : {}) }).then(async (result) => {
                            if (result) await prisma.courseModule.update({ where: { id: mod.id }, data: { translations: JSON.stringify(result) } })
                        })
                    ))

                    // Lessons
                    for (const lesson of mod.lessons) {
                        translationJobs.push(tracked(
                            `Translating lesson: ${lesson.title}`,
                            translateContent({ title: lesson.title, ...(lesson.description ? { description: lesson.description } : {}) }).then(async (result) => {
                                if (result) await prisma.lesson.update({ where: { id: lesson.id }, data: { translations: JSON.stringify(result) } })
                            })
                        ))
                    }

                    // Quiz
                    if (mod.quiz) {
                        translationJobs.push(tracked(
                            `Translating quiz: ${mod.quiz.title}`,
                            translateContent({ title: mod.quiz.title }).then(async (result) => {
                                if (result) await prisma.quiz.update({ where: { id: mod.quiz!.id }, data: { translations: JSON.stringify(result) } })
                            })
                        ))

                        for (const q of mod.quiz.questions) {
                            const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                            const fields: Record<string, string> = { questionText: q.questionText }
                            if (Array.isArray(opts)) {
                                opts.forEach((o: { id: string; text: string }) => { fields[`option_${o.id}`] = o.text })
                            }
                            if (q.explanation) fields.explanation = q.explanation

                            translationJobs.push(tracked(
                                `Translating question: ${q.questionText.slice(0, 40)}...`,
                                translateContent(fields).then(async (result) => {
                                    if (result) await prisma.quizQuestion.update({ where: { id: q.id }, data: { translations: JSON.stringify(result) } })
                                })
                            ))
                        }
                    }
                }

                await Promise.allSettled(translationJobs)

                // Re-fetch with fresh translations
                const updated = await prisma.course.findUnique({
                    where: { id },
                    include: { modules: { orderBy: { sortOrder: 'asc' }, include: { lessons: { orderBy: { sortOrder: 'asc' } }, quiz: { include: { questions: { orderBy: { sortOrder: 'asc' } } } } } } },
                })

                send({ type: 'done', data: updated })
                } catch (streamErr) {
                    console.error('Stream error:', streamErr)
                    send({ type: 'error', message: String(streamErr) })
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked' },
        })
    } catch (err) {
        console.error('Training PUT error:', err)
        return NextResponse.json({ error: 'Update failed', details: String(err) }, { status: 500 })
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    await prisma.course.delete({ where: { id } })
    return NextResponse.json({ ok: true })
}
