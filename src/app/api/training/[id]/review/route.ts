import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

// POST — log a review activity
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getUserSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: courseId } = await params
    const body = await req.json()
    const { moduleId, lessonId, activityType, duration, metadata } = body

    if (!moduleId || !activityType) {
        return NextResponse.json({ error: 'moduleId and activityType required' }, { status: 400 })
    }

    // Verify enrollment
    const enrollment = await (prisma as any).enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId } },
    })
    if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })

    try {
        const activity = await (prisma as any).reviewActivity.create({
            data: {
                userId: session.userId,
                moduleId,
                lessonId: lessonId || null,
                activityType,
                duration: duration || 0,
                metadata: metadata ? JSON.stringify(metadata) : null,
            },
        })

        // Award XP for review activities
        const xpGain = activityType === 'quiz_reviewed' ? 10 : 5
        await (prisma as any).user.update({
            where: { id: session.userId },
            data: { trainingXp: { increment: xpGain } },
        })

        // Update enrollment mode to "review"
        await (prisma as any).enrollment.update({
            where: { userId_courseId: { userId: session.userId, courseId } },
            data: { mode: 'review' },
        })

        return NextResponse.json({ activity, xpGained: xpGain })
    } catch (err) {
        return NextResponse.json({ error: 'Failed to log activity', details: String(err) }, { status: 500 })
    }
}

// GET — get review activity count for a module (used for retake gating)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getUserSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: courseId } = await params
    const url = new URL(req.url)
    const moduleId = url.searchParams.get('moduleId')

    // Verify enrollment
    const enrollment = await (prisma as any).enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId } },
    })
    if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })

    const where: any = { userId: session.userId }
    if (moduleId) where.moduleId = moduleId

    // Get all module IDs for this course if no moduleId specified
    if (!moduleId) {
        const course = await (prisma as any).course.findUnique({
            where: { id: courseId },
            include: { modules: { select: { id: true } } },
        })
        if (course) {
            where.moduleId = { in: course.modules.map((m: any) => m.id) }
        }
    }

    const activities = await (prisma as any).reviewActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    const activityCount = activities.length
    const totalDuration = activities.reduce((sum: number, a: any) => sum + (a.duration || 0), 0)

    // Count unique lessons reviewed
    const lessonSet = new Set(activities.filter((a: any) => a.lessonId).map((a: any) => a.lessonId))

    return NextResponse.json({
        activities: activities.slice(0, 20),
        activityCount,
        totalDuration,
        uniqueLessonsReviewed: lessonSet.size,
        mode: enrollment.mode,
    })
}
