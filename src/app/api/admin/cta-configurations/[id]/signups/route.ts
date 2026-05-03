import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// ── GET /api/admin/cta-configurations/[id]/signups ──────────────────────────
// Returns paginated signups for a specific CTA, with CSV export support.
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let admin: { userId: string; email?: string }
    try { admin = await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10))
    const search = searchParams.get('search') || ''

    // Fetch the CTA to get its signupTag
    const cta = await prisma.ctaConfiguration.findUnique({ where: { id } })
    if (!cta) {
        return NextResponse.json({ error: 'CTA not found' }, { status: 404 })
    }

    const where = {
        signupTag: cta.signupTag,
        ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    // CSV export
    if (format === 'csv') {
        // Audit log the export
        console.log(`[AUDIT] CSV export of CTA signups: ctaId=${id}, tag=${cta.signupTag}, by=${admin.email || 'unknown'} (${admin.userId}) at ${new Date().toISOString()}`)

        const allSignups = await prisma.notificationSignup.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        })

        // Escape double quotes for CSV safety
        const esc = (v: string) => v.replace(/"/g, '""')
        const header = 'email,language,country,created_at,notified_at\n'
        const rows = allSignups.map(s =>
            `"${esc(s.email)}","${esc(s.language)}","${esc(s.country || '')}","${s.createdAt.toISOString()}","${s.notifiedAt?.toISOString() || ''}"`
        ).join('\n')

        return new NextResponse(header + rows, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${cta.signupTag}_signups_${new Date().toISOString().slice(0, 10)}.csv"`,
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
                createdAt: true,
                notifiedAt: true,
            },
        }),
        prisma.notificationSignup.count({ where }),
    ])

    // Language and country distribution
    const [langDist, countryDist] = await Promise.all([
        prisma.notificationSignup.groupBy({
            by: ['language'],
            where: { signupTag: cta.signupTag },
            _count: true,
            orderBy: { _count: { language: 'desc' } },
        }),
        prisma.notificationSignup.groupBy({
            by: ['country'],
            where: { signupTag: cta.signupTag, country: { not: null } },
            _count: true,
            orderBy: { _count: { country: 'desc' } },
            take: 20,
        }),
    ])

    return NextResponse.json({
        signups,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        distributions: {
            languages: langDist.map(l => ({ language: l.language, count: l._count })),
            countries: countryDist.map(c => ({ country: c.country || 'Unknown', count: c._count })),
        },
    })
}
