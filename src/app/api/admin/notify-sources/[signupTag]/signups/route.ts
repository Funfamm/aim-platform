import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// ── GET /api/admin/notify-sources/[signupTag]/signups ────────────────────────
// Returns paginated signups for a specific non-CTA signupTag.
// Supports search, pagination, and CSV export.
// Read-only. Admin-only.
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ signupTag: string }> }
) {
    let admin: { userId: string; email?: string }
    try { admin = await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { signupTag } = await params
    const decodedTag = decodeURIComponent(signupTag)

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10))
    const search = searchParams.get('search') || ''

    const where = {
        signupTag: decodedTag,
        ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    // CSV export
    if (format === 'csv') {
        console.log(`[AUDIT] CSV export of notify-source signups: tag=${decodedTag}, by=${admin.email || 'unknown'} (${admin.userId}) at ${new Date().toISOString()}`)

        const allSignups = await prisma.notificationSignup.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        })

        const esc = (v: string | null | undefined) => (v || '').replace(/"/g, '""')
        const header = 'email,language,country,requestedBy,requestSource,sourceType,sourceEntityId,sourcePageUrl,status,userId,confirmationSentAt,confirmationInAppAt,notifiedAt,finalNoticeSentAt,createdAt\n'
        const rows = allSignups.map(s =>
            `"${esc(s.email)}","${esc(s.language)}","${esc(s.country)}","${esc(s.requestedBy)}","${esc(s.requestSource)}","${esc(s.sourceType)}","${esc(s.sourceEntityId)}","${esc(s.sourcePageUrl)}","${esc(s.status)}","${esc(s.userId)}","${s.confirmationSentAt?.toISOString() || ''}","${s.confirmationInAppAt?.toISOString() || ''}","${s.notifiedAt?.toISOString() || ''}","${s.finalNoticeSentAt?.toISOString() || ''}","${s.createdAt.toISOString()}"`
        ).join('\n')

        return new NextResponse(header + rows, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${decodedTag}_signups_${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        })
    }

    // Paginated JSON response
    const [signups, total] = await Promise.all([
        prisma.notificationSignup.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                email: true,
                language: true,
                country: true,
                requestedBy: true,
                requestSource: true,
                sourceType: true,
                sourceEntityId: true,
                sourcePageUrl: true,
                status: true,
                userId: true,
                confirmationSentAt: true,
                confirmationInAppAt: true,
                notifiedAt: true,
                finalNoticeSentAt: true,
                createdAt: true,
            },
        }),
        prisma.notificationSignup.count({ where }),
    ])

    // Language and country distribution
    const [langDist, countryDist] = await Promise.all([
        prisma.notificationSignup.groupBy({
            by: ['language'],
            where: { signupTag: decodedTag },
            _count: true,
            orderBy: { _count: { language: 'desc' } },
        }),
        prisma.notificationSignup.groupBy({
            by: ['country'],
            where: { signupTag: decodedTag, country: { not: null } },
            _count: true,
            orderBy: { _count: { country: 'desc' } },
            take: 20,
        }),
    ])

    return NextResponse.json({
        signupTag: decodedTag,
        signups,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        distributions: {
            languages: langDist.map(l => ({ language: l.language, count: l._count })),
            countries: countryDist.map(c => ({ country: c.country || 'Unknown', count: c._count })),
        },
    })
}
