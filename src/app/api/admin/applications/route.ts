import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const url = request.nextUrl
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')))
        const search = (url.searchParams.get('search') || '').trim()
        const status = url.searchParams.get('status') || ''
        const sort = url.searchParams.get('sort') || 'newest'
        const roleId = url.searchParams.get('roleId') || ''

        const where: Record<string, unknown> = {}
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email:    { contains: search, mode: 'insensitive' } },
            ]
        }
        if (status && status !== 'all') where.status = status
        if (roleId) where.castingCallId = roleId

        const orderBy = sort === 'oldest'     ? { createdAt: 'asc' as const }
            : sort === 'score_high' ? { aiScore: 'desc' as const }
            : sort === 'score_low'  ? { aiScore: 'asc'  as const }
            : { createdAt: 'desc' as const }

        const [applications, total, statusCounts] = await Promise.all([
            prisma.application.findMany({
                where, orderBy,
                skip: (page - 1) * limit, take: limit,
                include: { castingCall: { include: { project: true } } },
            }),
            prisma.application.count({ where }),
            prisma.application.groupBy({ by: ['status'], _count: true }),
        ])

        return NextResponse.json({
            applications: applications.map(a => ({
                id: a.id, fullName: a.fullName, email: a.email,
                phone: a.phone, age: a.age, gender: a.gender,
                status: a.status, aiScore: a.aiScore, aiFitLevel: a.aiFitLevel,
                headshotPath: a.headshotPath, selfTapePath: a.selfTapePath,
                experience: a.experience, specialSkills: a.specialSkills,
                createdAt: a.createdAt.toISOString(),
                castingCall: {
                    roleName: a.castingCall.roleName,
                    roleType: a.castingCall.roleType,
                    project: { title: a.castingCall.project.title },
                },
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            statusCounts: Object.fromEntries(statusCounts.map(s => [s.status, s._count])),
        })
    } catch (err) {
        console.error('[admin/applications] GET error:', err)
        return NextResponse.json(
            { error: 'Failed to load applications', details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        )
    }
}
