import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyApplicantStatusChange } from '@/lib/notifications'

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

    // Admin override: reveal AI result immediately (clear the delay)
    if (revealNow === true) {
        updateData.resultVisibleAt = null
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

    await prisma.application.update({
        where: { id },
        data: updateData,
    })

    // Send notification if status actually changed
    if (status && previousStatus !== status) {
        notifyApplicantStatusChange({
            applicationId: id,
            recipientEmail: application.email,
            recipientName: application.fullName,
            newStatus: status,
            roleName: application.castingCall.roleName,
            projectTitle: application.castingCall.project.title,
            statusNote: application.statusNote,
        }).catch(err => console.error('Notification error:', err))
    }

    return NextResponse.json({ success: true })
}
