import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const url = request.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')))
    const search = (url.searchParams.get('search') || '').trim()
    const status = url.searchParams.get('status') || ''
    const sort = url.searchParams.get('sort') || 'newest'

    const where: Record<string, unknown> = {}
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { email: { contains: search } },
        ]
    }
    if (status && status !== 'all') where.status = status

    const orderBy = sort === 'oldest' ? { createdAt: 'asc' as const }
        : sort === 'amount_high' ? { amount: 'desc' as const }
        : sort === 'amount_low' ? { amount: 'asc' as const }
        : { createdAt: 'desc' as const }

    const [donations, total] = await Promise.all([
        prisma.donation.findMany({
            where, orderBy,
            skip: (page - 1) * limit,
            take: limit,
            include: { project: true },
        }),
        prisma.donation.count({ where }),
    ])

    // Aggregate stats (use DB-level aggregation, not loading all records)
    const [totalRaised, donationCount, uniqueDonorsResult] = await Promise.all([
        prisma.donation.aggregate({ _sum: { amount: true }, where: { status: 'completed' } }),
        prisma.donation.count(),
        prisma.$queryRaw<[{ count: number }]>`SELECT COUNT(DISTINCT email) as count FROM Donation`,
    ])
    const uniqueDonors = Number(uniqueDonorsResult[0]?.count || 0)

    return NextResponse.json({
        donations: donations.map(d => ({
            id: d.id, name: d.name, email: d.email, amount: d.amount,
            method: d.method, status: d.status, anonymous: d.anonymous,
            project: d.project?.title || 'General',
            createdAt: d.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
            totalRaised: totalRaised._sum.amount || 0,
            count: donationCount,
            avgAmount: donationCount > 0 ? Math.round((totalRaised._sum.amount || 0) / donationCount) : 0,
            uniqueDonors,
        },
    })
}
