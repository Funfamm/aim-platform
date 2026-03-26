import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST — enroll in course
// PUT — mark lesson complete
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getUserSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: courseId } = await params
    const userId = session.userId

    try {
        const enrollment = await prisma.enrollment.upsert({
            where: { userId_courseId: { userId, courseId } },
            create: { userId, courseId },
            update: {},
        })
        return NextResponse.json(enrollment)
    } catch (err) {
        return NextResponse.json({ error: 'Enrollment failed', details: String(err) }, { status: 500 })
    }
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
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastTrainingAt: true, trainingStreak: true } })
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
