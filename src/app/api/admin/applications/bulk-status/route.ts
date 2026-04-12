import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAdminAction } from '@/lib/audit-log'
import { notifyApplicantStatusChange } from '@/lib/notifications'

// Statuses that trigger applicant email notifications
const NOTIFY_STATUSES = new Set([
    'shortlisted', 'callback', 'contacted', 'audition',
    'final_review', 'selected', 'rejected', 'not_selected',
])

const VALID_STATUSES = [
    'submitted', 'under_review', 'reviewed', 'shortlisted',
    'contacted', 'audition', 'callback', 'final_review',
    'selected', 'not_selected', 'rejected', 'withdrawn',
    'pending', 'approved',
]

// Safety cap: never resolve more than this many IDs in a single bulk op
const MAX_BULK_IDS = 500

// Rate-limit helper: send notifications in batches with a pause between each
async function sendBatched<T>(
    items: T[],
    batchSize: number,
    delayMs: number,
    fn: (item: T) => Promise<boolean>,  // fn returns true = sent, false = failed
): Promise<{ sent: number; failed: number }> {
    let sent = 0
    let failed = 0
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const results = await Promise.allSettled(batch.map(fn))
        for (const r of results) {
            // settled fulfilled + returned true = email delivered
            if (r.status === 'fulfilled' && r.value) sent++
            else failed++
        }
        if (i + batchSize < items.length) {
            await new Promise(r => setTimeout(r, delayMs))
        }
    }
    return { sent, failed }
}

async function handleBulkStatus(req: Request) {
    let session
    try { session = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const applicationIds: string[] = body.applicationIds ?? body.ids ?? []
        const { status, statusNote, notify = true } = body

        // ── Validate status ─────────────────────────────────────────────────
        if (!VALID_STATUSES.includes(status)) {
            return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
        }

        // ── Resolve IDs — selectAllQuery or explicit list ───────────────────
        let resolvedIds = applicationIds

        if (body.selectAllQuery) {
            const { search, statusFilter, sort } = body
            const where: Record<string, unknown> = {
                // Fix #7: never touch withdrawn applications via bulk action
                status: { not: 'withdrawn' },
            }
            if (search) {
                where.OR = [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { email:    { contains: search, mode: 'insensitive' } },
                ]
            }
            if (statusFilter && statusFilter !== 'all') {
                // Override — if targeting a specific status, scope to it only (still excluding withdrawn)
                where.status = { not: 'withdrawn', equals: statusFilter }
            }

            const all = await prisma.application.findMany({
                where,
                select: { id: true },
                orderBy: sort === 'oldest' ? { createdAt: 'asc' }
                    : sort === 'score_high' ? { aiScore: 'desc' }
                    : sort === 'score_low'  ? { aiScore: 'asc' }
                    : { createdAt: 'desc' },
                // Fix #3: safety cap — never resolve an unbounded result set
                take: MAX_BULK_IDS,
            })
            resolvedIds = all.map(a => a.id)
        }

        if (resolvedIds.length === 0) {
            return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
        }

        // ── Dedup check: which apps have ALREADY been notified for this status ──
        const apps = await prisma.application.findMany({
            where: {
                id: { in: resolvedIds },
                // Fix #7: explicitly exclude withdrawn from explicit-ID lists too
                status: { not: 'withdrawn' },
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                userId: true,
                locale: true,
                aiScore: true,
                castingCall: {
                    select: {
                        roleName: true,
                        project: { select: { title: true } },
                    },
                },
                // Check notification history for this exact status
                notifications: {
                    where: { type: 'status_change', notifiedForStatus: status, status: 'sent' },
                    select: { id: true },
                },
            },
        })

        if (apps.length === 0) {
            return NextResponse.json({ error: 'No eligible applications found (all may be withdrawn)' }, { status: 400 })
        }

        // ── Apply status update ─────────────────────────────────────────────
        const updateResult = await prisma.application.updateMany({
            where: { id: { in: apps.map(a => a.id) } },
            data: { status },
        })

        // Fix #4: human-readable target summary (not a CSV of 200 UUIDs)
        const targetSummary = `${updateResult.count} application${updateResult.count !== 1 ? 's' : ''} → ${status}`

        logAdminAction({
            actor: session.userId,
            action: 'CHANGE_STATUS',
            target: resolvedIds.slice(0, 5).join(',') + (resolvedIds.length > 5 ? ` +${resolvedIds.length - 5} more` : ''),
            targetSummary,
            details: { newStatus: status, count: updateResult.count, statusNote: statusNote || null },
        })

        // ── Send notifications — only to apps not yet notified for this status ──
        const alreadyNotified = apps.filter(a => a.notifications.length > 0).length
        let notifiedCount = 0
        let failedCount = 0

        if (notify && NOTIFY_STATUSES.has(status)) {
            const toNotify = apps.filter(a => a.notifications.length === 0)

            // Fix #2: sendBatched now returns true/false per item so we count accurately
            const { sent, failed } = await sendBatched(toNotify, 10, 500, async (app) => {
                try {
                    await notifyApplicantStatusChange({
                        applicationId: app.id,
                        recipientEmail: app.email,
                        recipientName: app.fullName,
                        newStatus: status,
                        roleName: app.castingCall.roleName,
                        projectTitle: app.castingCall.project.title,
                        aiScore: app.aiScore ?? undefined,
                        statusNote: statusNote || null,
                        userId: app.userId ?? undefined,
                        locale: app.locale ?? 'en',
                    })

                    // Stamp the dedup record — notifyApplicantStatusChange already writes
                    // an ApplicationNotification row. We write a SECOND record here with
                    // notifiedForStatus set so future bulk runs can dedup correctly.
                    // (The base notification written by notifications.ts does NOT set this field.)
                    await prisma.applicationNotification.create({
                        data: {
                            applicationId: app.id,
                            type: 'status_change',
                            notifiedForStatus: status,
                            subject: `Bulk status → ${status}`,
                            body: statusNote || '',
                            recipientEmail: app.email,
                            status: 'sent',
                        },
                    }).catch(() => {/* non-critical — dedup stamp, not the actual email */})

                    return true  // email was sent
                } catch {
                    return false  // email failed, caller counts it as failed
                }
            })

            notifiedCount = sent
            failedCount = failed
        }

        const parts = [`${updateResult.count} updated`]
        if (notifiedCount > 0) parts.push(`${notifiedCount} notified`)
        if (failedCount > 0) parts.push(`${failedCount} notify failed`)
        if (alreadyNotified > 0) parts.push(`${alreadyNotified} already notified (skipped)`)
        const cappedWarning = body.selectAllQuery && resolvedIds.length === MAX_BULK_IDS
            ? ` — capped at ${MAX_BULK_IDS} records` : ''

        return NextResponse.json({
            success: true,
            updated: updateResult.count,
            notified: notifiedCount,
            notifyFailed: failedCount,
            skipped: alreadyNotified,
            capped: body.selectAllQuery && resolvedIds.length === MAX_BULK_IDS,
            message: parts.join(' · ') + cappedWarning,
        })
    } catch (error) {
        console.error('Bulk status update error:', error)
        return NextResponse.json({ error: 'Failed to update applications' }, { status: 500 })
    }
}

export const POST = handleBulkStatus
export const PATCH = handleBulkStatus
