import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import {
    courseEnrollmentEmail,
    courseCompletionEmail,
    badgeEarnedEmail,
} from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'
import { mirrorToNotificationBoard } from '@/lib/notifications'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, preferredLanguage: true, receiveLocalizedEmails: true },
    })
    if (!user?.email) return

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, slug: true },
    })
    if (!course) return

    const locale: string = (user.receiveLocalizedEmails !== false && user.preferredLanguage) ? user.preferredLanguage : 'en'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const courseUrl = `${siteUrl}/${locale}/training/${course.slug}`

    // All strings resolved from static i18n — no runtime translate call needed
    const subject = et('trainingEnrollment', locale, 'subject').replace('{title}', course.title)
    const notifTitle = et('trainingEnrollment', locale, 'notifTitle').replace('{title}', course.title)
    const notifMessage = et('trainingEnrollment', locale, 'notifMessage').replace('{title}', course.title)

    // Send localized email
    await sendEmail({
        to: user.email,
        subject,
        html: courseEnrollmentEmail(user.name || '', course.title, courseUrl, locale),
    }).catch(err => console.error('[enrollment] email failed:', err))

    // In-app notification (dedup key — only fires once per enrollment)
    await mirrorToNotificationBoard(
        userId,
        'system',
        notifTitle,
        notifMessage,
        `/${locale}/training/${course.slug}`,
        `enroll-${userId}-${courseId}`,
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
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { lastTrainingAt: true, trainingStreak: true, preferredLanguage: true, receiveLocalizedEmails: true, email: true, name: true },
        })
        const locale: string = (user?.receiveLocalizedEmails !== false && user?.preferredLanguage) ? user.preferredLanguage : 'en'

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
            // slug needed for the completion email/notification link
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

                // Fire-and-forget: completion email + notification
                sendCompletionNotification(userId, courseId, course.title, course.slug, locale, user?.email || '', user?.name || '').catch(err =>
                    console.error('[completion] notification failed:', err)
                )
            }
        }

        if (xpBonus > 0) {
            await prisma.user.update({ where: { id: userId }, data: { trainingXp: { increment: xpBonus } } })
        }

        // ── Badge checks ──────────────────────────────────────────────────────
        const badges: string[] = []
        const totalCompleted = await prisma.lessonProgress.count({ where: { userId, completed: true } })
        const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { trainingStreak: true } })

        // first_lesson
        if (totalCompleted === 1) {
            try {
                await prisma.trainingBadge.create({ data: { userId, badgeType: 'first_lesson', courseId } })
                badges.push('first_lesson')
                sendBadgeNotification(userId, 'first_lesson', courseId, locale, user?.email || '', user?.name || '').catch(console.error)
            } catch { /* already earned */ }
        }

        // first_course
        if (courseComplete) {
            try {
                await prisma.trainingBadge.create({ data: { userId, badgeType: 'first_course', courseId } })
                badges.push('first_course')
                sendBadgeNotification(userId, 'first_course', courseId, locale, user?.email || '', user?.name || '').catch(console.error)
            } catch { /* already earned */ }
        }

        // streak_7
        if (updatedUser && updatedUser.trainingStreak >= 7) {
            try {
                await prisma.trainingBadge.create({ data: { userId, badgeType: 'streak_7' } })
                badges.push('streak_7')
                sendBadgeNotification(userId, 'streak_7', courseId, locale, user?.email || '', user?.name || '').catch(console.error)
            } catch { /* already earned */ }
        }

        // streak_30
        if (updatedUser && updatedUser.trainingStreak >= 30) {
            try {
                await prisma.trainingBadge.create({ data: { userId, badgeType: 'streak_30' } })
                badges.push('streak_30')
                sendBadgeNotification(userId, 'streak_30', courseId, locale, user?.email || '', user?.name || '').catch(console.error)
            } catch { /* already earned */ }
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

async function sendCompletionNotification(
    userId: string, courseId: string, courseTitle: string, courseSlug: string,
    locale: string, userEmail: string, userName: string
) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const courseUrl = `${siteUrl}/${locale}/training/${courseSlug}`

    const subject = et('trainingCompletion', locale, 'subject').replace('{title}', courseTitle)
    const notifTitle = et('trainingCompletion', locale, 'notifTitle').replace('{title}', courseTitle)
    const notifMessage = et('trainingCompletion', locale, 'notifMessage').replace('{title}', courseTitle)

    // Send completion email
    if (userEmail) {
        await sendEmail({
            to: userEmail,
            subject,
            html: courseCompletionEmail(userName, courseTitle, courseUrl, locale),
        }).catch(err => console.error('[completion] email failed:', err))
    }

    // In-app notification (dedup key — only fires once)
    await mirrorToNotificationBoard(
        userId,
        'system',
        notifTitle,
        notifMessage,
        `/${locale}/training/${courseSlug}`,
        `course-complete-${userId}-${courseId}`,
    )
}

async function sendBadgeNotification(
    userId: string, badgeType: string, courseId: string,
    locale: string, userEmail: string, userName: string
) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const trainingUrl = `${siteUrl}/${locale}/training`

    const i18nKeyMap: Record<string, string> = {
        first_lesson: 'trainingBadgeFirstLesson',
        first_course: 'trainingBadgeFirstCourse',
        streak_7: 'trainingBadgeStreak7',
        streak_30: 'trainingBadgeStreak30',
    }
    const i18nKey = i18nKeyMap[badgeType] || 'trainingBadgeFirstLesson'

    const subject = et(i18nKey, locale, 'subject')
    const notifTitle = et(i18nKey, locale, 'notifTitle')
    const notifMessage = et(i18nKey, locale, 'notifMessage')

    // Send badge email
    if (userEmail) {
        await sendEmail({
            to: userEmail,
            subject,
            html: badgeEarnedEmail(userName, badgeType, trainingUrl, locale),
        }).catch(err => console.error(`[badge:${badgeType}] email failed:`, err))
    }

    // In-app notification (dedup key — only fires once per badge per user)
    await mirrorToNotificationBoard(
        userId,
        'system',
        notifTitle,
        notifMessage,
        `/${locale}/training/${courseId}`,
        `badge-${badgeType}-${userId}`,
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
