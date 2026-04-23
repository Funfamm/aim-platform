/**
 * GET /api/admin/audit
 * Returns paginated audit log entries with optional filters.
 * Query params: page, limit, action, adminEmail, targetEmail, from, to
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const url = request.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
    const action = url.searchParams.get('action') || ''
    const adminEmail = (url.searchParams.get('adminEmail') || '').trim().toLowerCase()
    const targetEmail = (url.searchParams.get('targetEmail') || '').trim().toLowerCase()
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (adminEmail) where.adminEmail = { contains: adminEmail }
    if (targetEmail) where.targetEmail = { contains: targetEmail }
    if (from || to) {
        where.createdAt = {}
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to)
    }

    const [logs, total] = await Promise.all([
        db.auditLog.findMany({
            where, orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit, take: limit,
        }),
        db.auditLog.count({ where }),
    ])

    return NextResponse.json({
        logs, total,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
}
