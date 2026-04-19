/**
 * GET /api/subtitles/status/[jobId]
 *
 * Admin-only polling endpoint for the job status badge.
 * Used by the UI to poll every ~3 s while status is 'queued' or 'processing'.
 *
 * RESPONSE
 * ────────
 * 200 { jobId, status, vttUrl?, srtUrl?, errorMessage? }
 * 401 Unauthorized
 * 403 Forbidden
 * 404 Job not found
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { getJobById } from '@/lib/subtitle-job-service'

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasAdminRole(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { jobId } = await params
    const job = await getJobById(jobId)

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    return NextResponse.json({
        jobId: job.id,
        status: job.status,
        vttUrl: job.vttUrl ?? null,
        srtUrl: job.srtUrl ?? null,
        errorMessage: job.errorMessage ?? null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
    })
}
