import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params

    try {
        // Get course with all related data
        const course = await (prisma as any).course.findUnique({
            where: { id },
            include: {
                modules: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        lessons: { orderBy: { sortOrder: 'asc' } },
                        quiz: {
                            include: {
                                attempts: {
                                    include: { user: { select: { id: true, name: true, email: true } } },
                                    orderBy: { createdAt: 'desc' },
                                },
                            },
                        },
                    },
                },
                enrollments: {
                    include: {
                        user: { select: { id: true, name: true, email: true, image: true } },
                    },
                    orderBy: { enrolledAt: 'desc' },
                },
            },
        })

        if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        // Get all lesson progress for this course's lessons
        const lessonIds = course.modules.flatMap((m: any) => m.lessons.map((l: any) => l.id))
        const allProgress = lessonIds.length > 0 ? await (prisma as any).lessonProgress.findMany({
            where: { lessonId: { in: lessonIds } },
            include: { user: { select: { id: true, name: true, email: true } } },
        }) : []

        // Get review activities via module IDs
        const moduleIds = course.modules.map((m: any) => m.id)
        const reviewActivities = moduleIds.length > 0 ? await (prisma as any).reviewActivity.findMany({
            where: { moduleId: { in: moduleIds } },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50,
        }) : []

        // Build analytics
        const totalEnrollments = course.enrollments.length
        const completedEnrollments = course.enrollments.filter((e: any) => e.completedAt).length
        const activeEnrollments = totalEnrollments - completedEnrollments
        const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0

        // Time-based enrollment stats
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const enrollmentsLast7 = course.enrollments.filter((e: any) => new Date(e.enrolledAt) >= sevenDaysAgo).length
        const enrollmentsLast30 = course.enrollments.filter((e: any) => new Date(e.enrolledAt) >= thirtyDaysAgo).length

        // Per-module stats
        const moduleStats = course.modules.map((mod: any) => {
            const moduleLessonIds = mod.lessons.map((l: any) => l.id)
            const moduleProgress = allProgress.filter((p: any) => moduleLessonIds.includes(p.lessonId))
            const uniqueStudents = new Set(moduleProgress.map((p: any) => p.userId)).size
            const completedLessons = moduleProgress.filter((p: any) => p.completed).length
            const totalLessonSlots = mod.lessons.length * totalEnrollments

            // Quiz stats
            let quizStats = null
            if (mod.quiz) {
                const attempts = mod.quiz.attempts
                const avgScore = attempts.length > 0
                    ? Math.round(attempts.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / attempts.length)
                    : 0
                const passCount = attempts.filter((a: any) => a.passed).length
                const passRate = attempts.length > 0 ? Math.round((passCount / attempts.length) * 100) : 0
                quizStats = {
                    totalAttempts: attempts.length,
                    avgScore,
                    passRate,
                    passCount,
                    failCount: attempts.length - passCount,
                }
            }

            return {
                id: mod.id,
                title: mod.title,
                lessonCount: mod.lessons.length,
                studentsReached: uniqueStudents,
                completionRate: totalLessonSlots > 0 ? Math.round((completedLessons / totalLessonSlots) * 100) : 0,
                quizStats,
            }
        })

        // Per-student engagement
        const studentEngagement = course.enrollments.map((enrollment: any) => {
            const studentProgress = allProgress.filter((p: any) => p.userId === enrollment.userId)
            const completedLessonsCount = studentProgress.filter((p: any) => p.completed).length
            const totalLessons = lessonIds.length
            const studentReviews = reviewActivities.filter((r: any) => r.userId === enrollment.userId)
            const lastActivity = studentProgress.length > 0
                ? studentProgress.reduce((latest: any, p: any) => new Date(p.updatedAt) > new Date(latest.updatedAt) ? p : latest).updatedAt
                : enrollment.enrolledAt

            return {
                user: enrollment.user,
                enrolledAt: enrollment.enrolledAt,
                completedAt: enrollment.completedAt,
                lessonsCompleted: completedLessonsCount,
                totalLessons,
                progressPercent: totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0,
                reviewActivities: studentReviews.length,
                lastActivity,
                mode: enrollment.mode,
            }
        })

        return NextResponse.json({
            overview: {
                totalEnrollments,
                activeEnrollments,
                completedEnrollments,
                completionRate,
                enrollmentsLast7,
                enrollmentsLast30,
                totalModules: course.modules.length,
                totalLessons: lessonIds.length,
            },
            moduleStats,
            studentEngagement,
            recentReviews: reviewActivities.slice(0, 20).map((r: any) => ({
                user: r.user,
                lessonId: r.lessonId,
                type: r.activityType,
                durationSeconds: r.durationSeconds,
                createdAt: r.createdAt,
            })),
        })
    } catch (err) {
        console.error('[analytics]', err)
        return NextResponse.json({ error: 'Analytics failed', details: String(err) }, { status: 500 })
    }
}
