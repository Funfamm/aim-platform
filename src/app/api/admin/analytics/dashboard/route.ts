import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const [projectCount, castingCount, applicationCount, pendingCount, reviewedCount] = await Promise.all([
        prisma.project.count(),
        prisma.castingCall.count({ where: { status: 'open' } }),
        prisma.application.count(),
        prisma.application.count({ where: { status: 'pending' } }),
        prisma.application.count({ where: { status: { not: 'pending' } } }),
    ])

    const recentApplications = await prisma.application.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { castingCall: { include: { project: true } } },
    })

    return NextResponse.json({
        projectCount,
        castingCount,
        applicationCount,
        pendingCount,
        reviewedCount,
        recentApplications: recentApplications.map(app => ({
            id: app.id,
            fullName: app.fullName,
            status: app.status,
            aiScore: app.aiScore,
            createdAt: app.createdAt.toISOString(),
            castingCall: {
                roleName: app.castingCall.roleName,
                project: { title: app.castingCall.project.title },
            },
        })),
    })
}
