import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { sendTransactionalEmail } from '@/lib/email-router'
import { projectStatusUpdateEmail, projectInvoiceEmail } from '@/lib/project-request-emails'

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
    const request = await prisma.projectRequest.findUnique({
        where: { id },
        include: {
            payments: {
                orderBy: { createdAt: 'asc' },
            },
        },
    })
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        deadline: request.deadline?.toISOString() || null,
        payments: request.payments.map(p => ({
            ...p,
            paidAt: p.paidAt?.toISOString() || null,
            invoiceSentAt: p.invoiceSentAt?.toISOString() || null,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
        })),
    })
}

// ── PATCH — Admin: update status, notes, urgent, pricing, send invoice ──────
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
    const current = await prisma.projectRequest.findUnique({
        where: { id },
        include: { payments: true },
    })
    if (!current) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.status && VALID_STATUSES.includes(body.status)) data.status = body.status
    if (typeof body.adminNotes === 'string') data.adminNotes = body.adminNotes
    if (typeof body.urgent === 'boolean') data.urgent = body.urgent

    // ── Pricing: set agreedProjectTotal ──────────────────────────────────
    if (typeof body.agreedProjectTotal === 'number' && body.agreedProjectTotal > 0) {
        // Lock: cannot change price after any payment is completed
        const completedPayments = current.payments.filter(p => p.status === 'completed')
        if (completedPayments.length > 0) {
            return NextResponse.json(
                { error: 'Cannot change price after a payment has been received' },
                { status: 409 }
            )
        }
        data.agreedProjectTotal = body.agreedProjectTotal
    }

    // ── Send Invoice ────────────────────────────────────────────────────
    if (body.sendInvoice === true) {
        const total = (body.agreedProjectTotal as number) || (current.agreedProjectTotal as number | null)
        if (!total || total <= 0) {
            return NextResponse.json(
                { error: 'Set the agreed project total before sending an invoice' },
                { status: 400 }
            )
        }

        const depositAmount = Math.round(total * 0.4 * 100) / 100

        // Find existing pending deposit or create new one
        const existingDeposit = current.payments.find(p => p.milestone === 'deposit')

        if (existingDeposit && existingDeposit.status === 'completed') {
            return NextResponse.json({ error: 'Deposit already paid' }, { status: 409 })
        }

        let paymentRecord
        if (existingDeposit) {
            // Update existing pending record (handles price changes before payment)
            paymentRecord = await prisma.projectPayment.update({
                where: { id: existingDeposit.id },
                data: {
                    amount: depositAmount,
                    invoiceSentAt: new Date(),
                    paypalOrderId: null, // Clear any stale order ID
                },
            })
        } else {
            paymentRecord = await prisma.projectPayment.create({
                data: {
                    projectRequestId: id,
                    milestone: 'deposit',
                    amount: depositAmount,
                    status: 'pending',
                    invoiceSentAt: new Date(),
                },
            })
        }

        // Build payment URL using existing accessToken
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const paymentUrl = `${siteUrl}/en/pay/${id}?token=${current.accessToken}`

        // Auto-advance to scope_confirmed if currently reviewing
        if (current.status === 'reviewing') {
            data.status = 'scope_confirmed'
        }

        // Send invoice email
        sendTransactionalEmail({
            to: current.email,
            subject: `Your Project Quote is Ready - ${current.projectTitle}`,
            html: projectInvoiceEmail(
                current.clientName,
                current.id,
                current.projectTitle,
                total,
                depositAmount,
                paymentUrl,
            ),
        }).catch(err => console.error('[project-requests] Invoice email failed:', err))

        // Update the project record (price + status if changed)
        const updated = await prisma.projectRequest.update({ where: { id }, data })

        return NextResponse.json({
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            deadline: updated.deadline?.toISOString() || null,
            success: true,
            paymentUrl,
            invoiceSentAt: paymentRecord.invoiceSentAt?.toISOString() || null,
            payment: {
                id: paymentRecord.id,
                milestone: paymentRecord.milestone,
                amount: paymentRecord.amount,
                status: paymentRecord.status,
                invoiceSentAt: paymentRecord.invoiceSentAt?.toISOString() || null,
            },
        })
    }

    // ── Resend Invoice ──────────────────────────────────────────────────
    if (body.resendInvoice === true) {
        const pendingDeposit = current.payments.find(
            p => p.milestone === 'deposit' && p.status === 'pending'
        )
        if (!pendingDeposit) {
            return NextResponse.json(
                { error: 'No pending invoice to resend. Send a new invoice first.' },
                { status: 400 }
            )
        }

        // Update invoiceSentAt (reuse same record, no duplicate)
        await prisma.projectPayment.update({
            where: { id: pendingDeposit.id },
            data: { invoiceSentAt: new Date() },
        })

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const paymentUrl = `${siteUrl}/en/pay/${id}?token=${current.accessToken}`

        sendTransactionalEmail({
            to: current.email,
            subject: `Reminder: Payment Link for ${current.projectTitle}`,
            html: projectInvoiceEmail(
                current.clientName,
                current.id,
                current.projectTitle,
                current.agreedProjectTotal || pendingDeposit.amount / 0.4,
                pendingDeposit.amount,
                paymentUrl,
            ),
        }).catch(err => console.error('[project-requests] Resend invoice email failed:', err))

        return NextResponse.json({ success: true, message: 'Invoice resent' })
    }

    // ── Standard update (status, notes, urgent, price without invoice) ──
    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await prisma.projectRequest.update({ where: { id }, data })

    // ── Send client notification email on status change ──────────────
    const statusChanged = data.status && data.status !== current.status
    if (statusChanged && !SILENT_STATUSES.has(data.status as string)) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aimstudio.com'
        const trackingUrl = current.accessToken
            ? `${siteUrl}/en/my-projects?id=${current.id}&token=${current.accessToken}`
            : `${siteUrl}/en/my-projects`

        const html = projectStatusUpdateEmail(
            current.clientName,
            current.id,
            current.projectTitle,
            data.status as string,
            trackingUrl,
        )

        // Fire-and-forget — don't block the admin response
        sendTransactionalEmail({
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
