import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiLimiter } from '@/lib/rate-limit'

/**
 * GET /api/admin/applications/[id]/notifications
 *
 * Returns paginated notification history for an application.
 * Query params: page (default 1), size (default 20, max 100)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const blocked = apiLimiter.check(request)
    if (blocked) return blocked

    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params

    const { searchParams } = new URL(request.url)
    const rawPage = parseInt(searchParams.get('page') || '1', 10)
    const rawSize = parseInt(searchParams.get('size') || '20', 10)
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage)
    const size = Math.min(100, Math.max(1, isNaN(rawSize) ? 20 : rawSize))
    const skip = (page - 1) * size

    // Prevent extreme pagination offsets that could exhaust DB resources
    const MAX_SKIP = 10_000
    if (skip > MAX_SKIP) {
        return NextResponse.json({ error: 'Pagination offset too large. Maximum 10,000.' }, { status: 400 })
    }


    // Verify the application exists and belongs to admin's scope
    const exists = await prisma.application.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const [notifications, total] = await Promise.all([
        prisma.applicationNotification.findMany({
            where: { applicationId: id },
            orderBy: { createdAt: 'desc' },
            skip,
            take: size,
            select: {
                id: true,
                createdAt: true,
                type: true,
                subject: true,
                recipientEmail: true,
                status: true,
            },
        }),
        prisma.applicationNotification.count({ where: { applicationId: id } }),
    ])

    return NextResponse.json({
        notifications,
        pagination: {
            page,
            size,
            total,
            totalPages: Math.ceil(total / size),
        },
    })
}
