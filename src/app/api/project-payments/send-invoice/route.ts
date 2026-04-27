/**
 * POST /api/project-payments/send-invoice
 *
 * Admin-only: Creates a PayPal order for a milestone and emails
 * a pay link to the client.
 *
 * Body: { projectRequestId, milestone }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { createPayPalOrder, calculateMilestoneAmount, type MilestoneType } from '@/lib/paypal'
import { sendTransactionalEmail } from '@/lib/email-router'

const VALID_MILESTONES = ['midpoint', 'final'] // deposit is in-flow only

export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { projectRequestId, milestone } = body

        if (!projectRequestId) {
            return NextResponse.json({ error: 'Missing projectRequestId' }, { status: 400 })
        }
        if (!milestone || !VALID_MILESTONES.includes(milestone)) {
            return NextResponse.json({ error: 'Invalid milestone. Must be midpoint or final.' }, { status: 400 })
        }

        const project = await prisma.projectRequest.findUnique({
            where: { id: projectRequestId },
            include: { payments: true },
        })
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }
        if (!project.agreedProjectTotal) {
            return NextResponse.json({ error: 'Project has no agreed total. Cannot generate invoice.' }, { status: 400 })
        }

        // Check milestone order
        if (milestone === 'midpoint' && project.paymentStatus === 'unpaid') {
            return NextResponse.json({ error: 'Deposit must be paid before midpoint invoice.' }, { status: 400 })
        }
        if (milestone === 'final' && project.paymentStatus !== 'midpoint_paid') {
            return NextResponse.json({ error: 'Midpoint must be paid before final invoice.' }, { status: 400 })
        }

        // Check not already paid
        const existingPaid = project.payments.find(
            p => p.milestone === milestone && p.status === 'completed'
        )
        if (existingPaid) {
            return NextResponse.json({ error: 'This milestone has already been paid.' }, { status: 409 })
        }

        const amount = calculateMilestoneAmount(project.agreedProjectTotal, milestone as MilestoneType)

        const customId = [
            milestone,
            project.id,
            project.email.slice(0, 60),
        ].join('|')

        const milestoneLabels: Record<string, string> = {
            midpoint: 'Midpoint Payment (30%)',
            final: 'Final Payment (30%)',
        }

        const { orderId, approveUrl } = await createPayPalOrder({
            amount,
            description: `${milestoneLabels[milestone]} — ${project.clientName}`,
            customId,
        })

        // Create pending payment record
        await prisma.projectPayment.create({
            data: {
                projectRequestId: project.id,
                milestone,
                amount,
                status: 'pending',
                paypalOrderId: orderId,
                invoiceSentAt: new Date(),
            },
        })

        // Build and send the pay-link email
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const payUrl = approveUrl || `${siteUrl}/en/my-projects?id=${project.id}&token=${project.accessToken}&pay=${milestone}`

        await sendTransactionalEmail({
            to: project.email,
            subject: `🎬 ${milestoneLabels[milestone]} Due — ${project.projectTitle}`,
            html: buildInvoiceEmail(
                project.clientName,
                project.id,
                project.projectTitle,
                milestoneLabels[milestone] || milestone,
                amount,
                payUrl,
            ),
        })

        return NextResponse.json({
            success: true,
            invoice: {
                milestone,
                amount,
                paypalOrderId: orderId,
                payUrl,
                sentTo: project.email,
            },
        })
    } catch (error) {
        console.error('[project-payments/send-invoice] Error:', error)
        return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
    }
}

// ── Invoice email template ───────────────────────────────────────────────────

function buildInvoiceEmail(
    clientName: string,
    projectId: string,
    projectTitle: string,
    milestoneLabel: string,
    amount: number,
    payUrl: string,
): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d0f14; color: #e8e6e3; padding: 40px 20px;">
<div style="max-width: 520px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 2rem;">🎬</span>
    </div>
    <h1 style="font-size: 1.3rem; text-align: center; color: #d4a853; margin-bottom: 8px;">
        Payment Due
    </h1>
    <p style="text-align: center; color: #9ca3af; font-size: 0.9rem; margin-bottom: 28px;">
        Hello ${clientName}, your next milestone payment is ready.
    </p>

    <div style="background: rgba(212,168,83,0.08); border: 1px solid rgba(212,168,83,0.2); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 0.88rem; color: #d1d5db;" cellpadding="6">
            <tr><td style="color: #9ca3af;">Project</td><td style="text-align: right; font-weight: 600;">${projectTitle}</td></tr>
            <tr><td style="color: #9ca3af;">Reference</td><td style="text-align: right; font-family: monospace;">${projectId}</td></tr>
            <tr><td style="color: #9ca3af;">Milestone</td><td style="text-align: right;">${milestoneLabel}</td></tr>
            <tr style="font-size: 1.1rem;"><td style="color: #d4a853; font-weight: 700;">Amount Due</td><td style="text-align: right; color: #d4a853; font-weight: 700;">$${amount.toFixed(2)}</td></tr>
        </table>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
        <a href="${payUrl}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #d4a853, #c49b48); color: #0d0f14; font-weight: 700; font-size: 0.95rem; border-radius: 8px; text-decoration: none;">
            Pay Now — $${amount.toFixed(2)}
        </a>
    </div>

    <p style="font-size: 0.82rem; color: #6b7280; text-align: center; line-height: 1.6;">
        Click the button above to complete your payment securely via PayPal. If you have questions, reply to this email.
    </p>

    <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06);">
        <span style="font-size: 0.72rem; color: #4b5563;">AIM Studio — Impact AI Studio</span>
    </div>
</div>
</body>
</html>`
}
