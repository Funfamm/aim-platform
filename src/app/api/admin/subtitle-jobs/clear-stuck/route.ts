/**
 * POST /api/admin/subtitle-jobs/clear-stuck
 *
 * Admin-only endpoint to clear stuck subtitle jobs (queued/processing)
 * that the worker never completed. This allows the admin to retry.
 *
 * Optional body:
 *   { projectId?: string, episodeId?: string }
 *   — If provided, only clears stuck jobs for that specific content.
 *   — If omitted, clears ALL stuck jobs across the platform.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasAdminRole(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let projectId: string | undefined
    let episodeId: string | undefined

    try {
        const body = await req.json().catch(() => ({}))
        projectId = body.projectId
        episodeId = body.episodeId
    } catch { /* empty body is fine */ }

    // Build where clause
    const where: Record<string, unknown> = {
        status: { in: ['queued', 'processing'] },
    }
    if (projectId) where.projectId = projectId
    if (episodeId) where.episodeId = episodeId

    const result = await prisma.subtitleJob.updateMany({
        where,
        data: {
            status: 'failed',
            errorMessage: `Manually cleared by admin (${session.userId}) at ${new Date().toISOString()}`,
        },
    })

    return NextResponse.json({ cleared: result.count })
}
