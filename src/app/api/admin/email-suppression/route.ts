import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { liftSuppression, manuallySuppress, purgeAllSuppressedSubscribers } from '@/lib/suppression'
import { logAdminAction } from '@/lib/audit-log'

/**
 * GET /api/admin/email-suppression
 * Returns the suppression list with filters + stats.
 *
 * Query params:
 *   - reason: filter by reason (hard_bounce, soft_bounce, complaint, manual, unsubscribe)
 *   - search: search by email substring
 *   - page: pagination (default 1)
 *   - limit: per page (default 50, max 200)
 *   - active: 'true' for active suppressions only, 'false' for lifted
 */
export async function GET(request: Request) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const reason = url.searchParams.get('reason') || undefined
    const search = url.searchParams.get('search') || undefined
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
    const activeOnly = url.searchParams.get('active') !== 'false'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (activeOnly) {
        where.removedAt = null
    }
    if (reason) {
        where.reason = reason
    }
    if (search) {
        where.email = { contains: search.toLowerCase(), mode: 'insensitive' }
    }

    const [records, total, stats] = await Promise.all([
        prisma.emailSuppression.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.emailSuppression.count({ where }),
        // Stats by reason (active suppressions only)
        prisma.emailSuppression.groupBy({
            by: ['reason'],
            where: { removedAt: null },
            _count: true,
        }),
    ])

    const statsByReason: Record<string, number> = {}
    for (const s of stats) {
        statsByReason[s.reason] = s._count
    }

    return NextResponse.json({
        records,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: statsByReason,
        totalActive: Object.values(statsByReason).reduce((a, b) => a + b, 0),
    })
}

/**
 * POST /api/admin/email-suppression
 * Admin actions: add, remove, purge.
 *
 * Body:
 *   { action: 'add', email: string, reason?: string }
 *   { action: 'remove', email: string }
 *   { action: 'purge_subscribers' }
 *   { action: 'delete', email: string }  — permanently delete suppression record
 */
export async function POST(request: Request) {
    let session
    try { session = await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, email, reason } = body

    switch (action) {
        case 'add': {
            if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
            const ok = await manuallySuppress(email, session.userId, reason || 'manual')
            logAdminAction({ actor: session.userId, action: 'SUPPRESS_EMAIL', target: email })
            return NextResponse.json({ success: ok })
        }

        case 'remove': {
            if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
            const ok = await liftSuppression(email, session.userId)
            logAdminAction({ actor: session.userId, action: 'LIFT_SUPPRESSION', target: email })
            return NextResponse.json({ success: ok })
        }

        case 'delete': {
            if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
            const normalized = email.toLowerCase().trim()
            try {
                await prisma.emailSuppression.delete({ where: { email: normalized } })
                logAdminAction({ actor: session.userId, action: 'DELETE_SUPPRESSION', target: normalized })
                return NextResponse.json({ success: true })
            } catch {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }
        }

        case 'purge_subscribers': {
            const count = await purgeAllSuppressedSubscribers()
            logAdminAction({ actor: session.userId, action: 'PURGE_SUPPRESSED_SUBSCRIBERS', target: `${count} subscribers` })
            return NextResponse.json({ success: true, purged: count })
        }

        default:
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
}
