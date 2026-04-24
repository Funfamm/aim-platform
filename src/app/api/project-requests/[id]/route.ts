import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { sendEmail } from '@/lib/mailer'
import { projectStatusUpdateEmail } from '@/lib/project-request-emails'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['received', 'reviewing', 'scope_confirmed', 'in_production', 'awaiting_client', 'delivered', 'completed', 'cancelled']

// Statuses that the client should NOT be emailed about (internal-only changes)
const SILENT_STATUSES = new Set<string>([])  // empty = notify on all changes

// ── GET — Admin: fetch single request details ───────────────────────────────
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const request = await prisma.projectRequest.findUnique({ where: { id } })
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        deadline: request.deadline?.toISOString() || null,
    })
}

// ── PATCH — Admin: update status, notes, urgent flag ────────────────────────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    // Fetch current record to detect actual status changes
    const current = await prisma.projectRequest.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.status && VALID_STATUSES.includes(body.status)) data.status = body.status
    if (typeof body.adminNotes === 'string') data.adminNotes = body.adminNotes
    if (typeof body.urgent === 'boolean') data.urgent = body.urgent

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await prisma.projectRequest.update({ where: { id }, data })

    // ── Send client notification email on status change ──────────────
    const statusChanged = data.status && data.status !== current.status
    if (statusChanged && !SILENT_STATUSES.has(data.status as string)) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aimstudio.com'
        const trackingUrl = current.accessToken
            ? `${siteUrl}/my-projects?id=${current.id}&token=${current.accessToken}`
            : `${siteUrl}/my-projects`

        const html = projectStatusUpdateEmail(
            current.clientName,
            current.id,
            current.projectTitle,
            data.status as string,
            trackingUrl,
        )

        // Fire-and-forget — don't block the admin response
        sendEmail({
            to: current.email,
            subject: `Project Update: ${current.projectTitle} — ${(data.status as string).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
            html,
        }).catch(err => console.error('[project-requests] Status email failed:', err))
    }

    return NextResponse.json({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        deadline: updated.deadline?.toISOString() || null,
    })
}

// ── DELETE — Admin: delete a request ────────────────────────────────────────
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    try {
        await prisma.projectRequest.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
}
