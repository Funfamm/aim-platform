import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { courseEnrollmentEmail } from '@/lib/email-templates'
import { mirrorToNotificationBoard } from '@/lib/notifications'
import { translateContent } from '@/lib/translate'

// POST — enroll in course
// PUT  — mark lesson complete
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getUserSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: courseId } = await params
    const userId = session.userId

    try {
        const wasAlreadyEnrolled = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
        })

        const enrollment = await prisma.enrollment.upsert({
            where: { userId_courseId: { userId, courseId } },
            create: { userId, courseId },
            update: {},
        })

        // Only send notifications on fresh enrollment (not on re-visits)
        if (!wasAlreadyEnrolled) {
            // Fire-and-forget: localized enrollment email + in-app notification
            sendEnrollmentNotification(userId, courseId).catch(err =>
                console.error('[enrollment] notification failed:', err)
            )
        }

        return NextResponse.json(enrollment)
    } catch (err) {
        return NextResponse.json({ error: 'Enrollment failed', details: String(err) }, { status: 500 })
    }
}

async function sendEnrollmentNotification(userId: string, courseId: string) {
    // Load user locale + email + name
    const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, preferredLanguage: true },
    })
    if (!user?.email) return

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true },
    })
    if (!course) return

    const locale: string = user.preferredLanguage || 'en'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const courseUrl = `${siteUrl}/training/${courseId}`

    let heading = `You're enrolled in ${course.title}!`
    let body = `Welcome${user.name ? ', ' + user.name : ''}! Your journey through ${course.title} starts now. Earn XP as you progress.`
    let btnText = 'Start Learning'
    let badge = 'New Enrollment'
    let notifTitle = `Enrolled: ${course.title} 🎓`
    let notifMessage = `You're now enrolled in ${course.title}. Start your first lesson!`
    let emailSubject = `You're enrolled in ${course.title}! 🎓`

    // Translate all strings for non-English users (10 s timeout)
    if (locale !== 'en') {
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 10_000))
        const tx = await Promise.race([
            translateContent({
                heading,
                body,
                btnText,
                badge,
                notifTitle,
                notifMessage,
                emailSubject,
            }, 'audition').catch(() => null),
            timeout,
        ])
        if (tx?.[locale]) {
            const t = tx[locale]
            heading = t.heading || heading
            body = t.body || body
            btnText = t.btnText || btnText
            badge = t.badge || badge
            notifTitle = t.notifTitle || notifTitle
            notifMessage = t.notifMessage || notifMessage
            emailSubject = t.emailSubject || emailSubject
        }
    }

    // Send email
    await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: courseEnrollmentEmail(user.name || '', course.title, courseUrl, {
            heading, body, button: btnText, badge,
        }),
    }).catch(err => console.error('[enrollment] email failed:', err))

    // In-app notification
    await mirrorToNotificationBoard(
        userId,
        'system',
        notifTitle,
        notifMessage,
        `/training/${courseId}`,
        `enroll-${userId}-${courseId}`, // dedup key
    )
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getUserSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: courseId } = await params
    const userId = session.userId
    const body = await req.json()
    const { lessonId, timeSpent } = body

    if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

    try {
        // Mark lesson complete
        const progress = await prisma.lessonProgress.upsert({
            where: { userId_lessonId: { userId, lessonId } },
            create: { userId, lessonId, completed: true, completedAt: new Date(), timeSpent: timeSpent || 0 },
            update: { completed: true, completedAt: new Date(), timeSpent: { increment: timeSpent || 0 } },
        })

        // Award XP
        const xpGain = 10
        await prisma.user.update({
            where: { id: userId },
            data: { trainingXp: { increment: xpGain } },
        })

        // Update streak
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastTrainingAt: true, trainingStreak: true, preferredLanguage: true } })
        const now = new Date()
        const lastDate = user?.lastTrainingAt
        const isConsecutiveDay = lastDate && (now.getTime() - lastDate.getTime()) < 48 * 60 * 60 * 1000
        const isSameDay = lastDate && now.toDateString() === lastDate.toDateString()

        if (!isSameDay) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    trainingStreak: isConsecutiveDay ? { increment: 1 } : 1,
                    lastTrainingAt: now,
                },
            })
        }

        // Check if module is complete (all lessons done)
        const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { moduleId: true } })
        let moduleComplete = false
        let courseComplete = false
        let xpBonus = 0

        if (lesson) {
            const allLessons = await prisma.lesson.findMany({ where: { moduleId: lesson.moduleId }, select: { id: true } })
            const completed = await prisma.lessonProgress.findMany({
                where: { userId, lessonId: { in: allLessons.map(l => l.id) }, completed: true },
            })
            moduleComplete = completed.length >= allLessons.length
            if (moduleComplete) xpBonus += 50
        }

        // Check if entire course is complete
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: { modules: { include: { lessons: { select: { id: true } } } } },
        })
        if (course) {
            const allCoursePreLessons = course.modules.flatMap(m => m.lessons.map(l => l.id))
            const allCompleted = await prisma.lessonProgress.findMany({
                where: { userId, lessonId: { in: allCoursePreLessons }, completed: true },
            })
            courseComplete = allCompleted.length >= allCoursePreLessons.length
            if (courseComplete) {
                xpBonus += 200
                await prisma.enrollment.update({
                    where: { userId_courseId: { userId, courseId } },
                    data: { completedAt: new Date(), certificateId: `CERT-${courseId.slice(0, 6)}-${userId.slice(0, 6)}-${Date.now().toString(36)}` },
                })

                // Fire-and-forget: encouraging completion notification in user's language
                sendCompletionNotification(userId, courseId, course.title, user?.preferredLanguage || 'en').catch(err =>
                    console.error('[completion] notification failed:', err)
                )
            }
        }

        if (xpBonus > 0) {
            await prisma.user.update({ where: { id: userId }, data: { trainingXp: { increment: xpBonus } } })
        }

        // Badge checks
        const badges: string[] = []
        const totalCompleted = await prisma.lessonProgress.count({ where: { userId, completed: true } })
        if (totalCompleted === 1) {
            try { await prisma.trainingBadge.create({ data: { userId, badgeType: 'first_lesson', courseId } }); badges.push('first_lesson') } catch { /* already earned */ }
        }
        if (courseComplete) {
            try { await prisma.trainingBadge.create({ data: { userId, badgeType: 'first_course', courseId } }); badges.push('first_course') } catch { /* */ }
        }
        const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { trainingStreak: true } })
        if (updatedUser && updatedUser.trainingStreak >= 7) {
            try { await prisma.trainingBadge.create({ data: { userId, badgeType: 'streak_7' } }); badges.push('streak_7') } catch { /* */ }
        }
        if (updatedUser && updatedUser.trainingStreak >= 30) {
            try { await prisma.trainingBadge.create({ data: { userId, badgeType: 'streak_30' } }); badges.push('streak_30') } catch { /* */ }
        }

        return NextResponse.json({
            progress,
            xpGained: xpGain + xpBonus,
            moduleComplete,
            courseComplete,
            newBadges: badges,
        })
    } catch (err) {
        return NextResponse.json({ error: 'Progress failed', details: String(err) }, { status: 500 })
    }
}

async function sendCompletionNotification(userId: string, courseId: string, courseTitle: string, locale: string) {
    let title = `You completed ${courseTitle}! 🏆`
    let message = `Amazing work! You've finished every lesson in ${courseTitle}. Your dedication is paying off — keep going!`

    // Translate for non-English users
    if (locale !== 'en') {
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 10_000))
        const tx = await Promise.race([
            translateContent({ title, message }, 'audition').catch(() => null),
            timeout,
        ])
        if (tx?.[locale]) {
            title = tx[locale].title || title
            message = tx[locale].message || message
        }
    }

    await mirrorToNotificationBoard(
        userId,
        'system',
        title,
        message,
        `/training/${courseId}`,
        `course-complete-${userId}-${courseId}`, // dedup key — only fires once
    )
}

// GET user's progress for a specific course
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getUserSession()
    if (!session) return NextResponse.json({ enrolled: false, progress: [] })

    const { id: courseId } = await params
    const userId = session.userId

    const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
    })

    if (!enrollment) return NextResponse.json({ enrolled: false, progress: [] })

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: { modules: { include: { lessons: { select: { id: true } } } } },
    })

    const lessonIds = course?.modules.flatMap(m => m.lessons.map(l => l.id)) || []
    const progress = await prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
    })

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { trainingXp: true, trainingStreak: true, trainingBadges: true },
    })

    return NextResponse.json({
        enrolled: true,
        enrollment,
        progress,
        xp: user?.trainingXp || 0,
        streak: user?.trainingStreak || 0,
        badges: user?.trainingBadges || [],
    })
}
