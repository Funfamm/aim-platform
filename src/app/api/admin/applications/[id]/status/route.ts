import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyApplicantStatusChange } from '@/lib/notifications'

// Statuses that require a delay before notifying the applicant.
// Admin can bypass by passing revealNow: true in the request body.
const DELAYED_NOTIFY_STATUSES = new Set(['audition', 'final_review'])
const NOTIFY_DELAY_HOURS = 5

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const body = await request.json()
    const { status, statusNote, revealNow } = body

    // Build update data
    const updateData: Record<string, unknown> = {}

    // Handle status update
    if (status) {
        const validStatuses = [
            'submitted', 'under_review', 'reviewed', 'shortlisted',
            'contacted', 'audition', 'callback', 'final_review',
            'selected', 'not_selected', 'rejected', 'withdrawn',
            'pending', 'approved',
        ]
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }
        updateData.status = status
    }

    // Handle statusNote (applicant feedback) update
    if (statusNote !== undefined) {
        updateData.statusNote = statusNote
    }

    // Admin override: reveal AI result immediately (clear the AI audit delay)
    if (revealNow === true) {
        updateData.resultVisibleAt = null
        // Also clear any pending status notification delay
        updateData.pendingNotifyStatus = null
        updateData.notifyAfter = null
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    // Fetch application for notification context
    const application = await prisma.application.findUnique({
        where: { id },
        include: { castingCall: { include: { project: true } } },
    })
    if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const previousStatus = application.status

    // Determine if this status change needs a delayed notification
    const statusChanged = status && previousStatus !== status
    const needsDelay = statusChanged && DELAYED_NOTIFY_STATUSES.has(status) && revealNow !== true

    if (needsDelay) {
        // Schedule notification — cron will fire it after NOTIFY_DELAY_HOURS
        updateData.pendingNotifyStatus = status
        updateData.notifyAfter = new Date(Date.now() + NOTIFY_DELAY_HOURS * 60 * 60 * 1000)
    } else if (statusChanged && status && !DELAYED_NOTIFY_STATUSES.has(status)) {
        // Non-delayed status — clear any stale pending notification
        updateData.pendingNotifyStatus = null
        updateData.notifyAfter = null
    }

    await prisma.application.update({
        where: { id },
        data: updateData,
    })

    // Send notification immediately only for non-delayed statuses
    if (statusChanged && !needsDelay) {
        // If admin forced revealNow on a delayed status, send immediately
        const shouldNotifyNow = revealNow === true || (status && !DELAYED_NOTIFY_STATUSES.has(status))
        if (shouldNotifyNow) {
            notifyApplicantStatusChange({
                applicationId: id,
                recipientEmail: application.email,
                recipientName: application.fullName,
                newStatus: status,
                roleName: application.castingCall.roleName,
                projectTitle: application.castingCall.project.title,
                statusNote: application.statusNote,
                locale: application.locale ?? 'en',
            }).catch(err => console.error('Notification error:', err))
        }
    }

    return NextResponse.json({
        success: true,
        notificationScheduled: needsDelay
            ? `Notification will be sent after ${NOTIFY_DELAY_HOURS} hours`
            : undefined,
    })
}
