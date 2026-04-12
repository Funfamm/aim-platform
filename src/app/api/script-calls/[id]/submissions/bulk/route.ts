import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit-log'
import { notifyScriptStatusChange } from '@/lib/notifications'

async function getAdminSession() {
    const session = await getSession()
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) return null
    return session
}

const VALID_STATUSES = ['analyzed', 'shortlisted', 'selected', 'rejected']
const NOTIFY_STATUSES = new Set(['shortlisted', 'selected', 'rejected'])
const MAX_BULK_IDS = 500

// Rate-limit helper — fn returns true = sent, false = failed
async function sendBatched<T>(
    items: T[],
    batchSize: number,
    delayMs: number,
    fn: (item: T) => Promise<boolean>,
): Promise<{ sent: number; failed: number }> {
    let sent = 0
    let failed = 0
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const results = await Promise.allSettled(batch.map(fn))
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value) sent++
            else failed++
        }
        if (i + batchSize < items.length) {
            await new Promise(r => setTimeout(r, delayMs))
        }
    }
    return { sent, failed }
}

/**
 * POST /api/script-calls/[id]/submissions/bulk
 * Bulk update status for multiple script submissions.
 * Features: deduplication, rate-limited notifications, audit log, withdrawn guard.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: scriptCallId } = await params

    try {
        const body = await req.json()
        const submissionIds: string[] = (body.submissionIds ?? []).slice(0, MAX_BULK_IDS)
        const { status, statusNote, notify = true } = body

        if (!submissionIds.length) {
            return NextResponse.json({ error: 'No submissions selected' }, { status: 400 })
        }
        if (!VALID_STATUSES.includes(status)) {
            return NextResponse.json({
                error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
            }, { status: 400 })
        }

        // Fetch eligible submissions — scoped to this script call, excluding withdrawn
        const submissions = await prisma.scriptSubmission.findMany({
            where: {
                id: { in: submissionIds },
                scriptCallId,        // security: can't affect other calls
                status: { not: 'withdrawn' },
            },
            select: {
                id: true,
                authorName: true,
                authorEmail: true,
                title: true,
                lastNotifiedStatus: true,
                scriptCall: { select: { title: true } },
            },
        })

        if (!submissions.length) {
            return NextResponse.json({ error: 'No eligible submissions found' }, { status: 404 })
        }

        // Update all statuses
        await prisma.scriptSubmission.updateMany({
            where: { id: { in: submissions.map(s => s.id) } },
            data: { status },
        })

        // Fix #5: Audit log for script bulk actions
        const targetSummary = `${submissions.length} script submission${submissions.length !== 1 ? 's' : ''} → ${status}`
        logAdminAction({
            actor: session.userId,
            action: 'CHANGE_STATUS',
            target: submissionIds.slice(0, 5).join(',') + (submissionIds.length > 5 ? ` +${submissionIds.length - 5} more` : ''),
            targetSummary,
            details: { newStatus: status, count: submissions.length, scriptCallId, statusNote: statusNote || null },
        })

        // Notify only submissions not already notified for this status
        const alreadyNotified = submissions.filter(s => s.lastNotifiedStatus === status).length
        let notifiedCount = 0
        let failedCount = 0

        if (notify && NOTIFY_STATUSES.has(status)) {
            const toNotify = submissions.filter(s => s.lastNotifiedStatus !== status)

            const { sent, failed } = await sendBatched(toNotify, 10, 500, async (sub) => {
                try {
                    await notifyScriptStatusChange({
                        submissionId: sub.id,
                        recipientEmail: sub.authorEmail,
                        recipientName: sub.authorName,
                        scriptTitle: sub.title,
                        callTitle: sub.scriptCall.title,
                        newStatus: status,
                        statusNote: statusNote || null,
                    })

                    // Stamp dedup field
                    await prisma.scriptSubmission.update({
                        where: { id: sub.id },
                        data: { lastNotifiedStatus: status },
                    }).catch(() => {/* non-critical */})

                    return true
                } catch {
                    return false
                }
            })

            notifiedCount = sent
            failedCount = failed
        }

        const parts = [`${submissions.length} updated`]
        if (notifiedCount > 0) parts.push(`${notifiedCount} notified`)
        if (failedCount > 0) parts.push(`${failedCount} notify failed`)
        if (alreadyNotified > 0) parts.push(`${alreadyNotified} already notified (skipped)`)

        return NextResponse.json({
            success: true,
            updated: submissions.length,
            notified: notifiedCount,
            notifyFailed: failedCount,
            skipped: alreadyNotified,
            message: parts.join(' · '),
        })
    } catch (error) {
        console.error('Script bulk status error:', error)
        return NextResponse.json({ error: 'Failed to update submissions' }, { status: 500 })
    }
}
