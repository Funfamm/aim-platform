import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/audit-log
 * Returns recent admin audit entries stored in the AdminAuditLog table.
 * Query params:
 *   action  – filter by action name (repeatable: ?action=CHANGE_STATUS&action=DELETE_APPLICATIONS)
 *   limit   – max records (default 25, max 100)
 */
export async function GET(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const actions = searchParams.getAll('action')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100)

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries = await (prisma as any).adminAuditLog.findMany({
            where: actions.length > 0 ? { action: { in: actions } } : undefined,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                actor: true,
                action: true,
                targetSummary: true,
                details: true,
                createdAt: true,
            },
        })

        return NextResponse.json(entries)
    } catch {
        // Table may not exist yet — return empty list gracefully
        return NextResponse.json([])
    }
}
