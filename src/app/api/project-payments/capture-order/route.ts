/**
 * POST /api/project-payments/capture-order
 *
 * Captures a PayPal order after client approval.
 * Finds/creates/updates the ProjectPayment record and advances paymentStatus.
 *
 * Body: { orderID }
 *
 * 3-step record lookup:
 *  1. By paypalOrderId (backward compat / idempotency)
 *  2. By pending invoice record (admin-created via sendInvoice)
 *  3. Fallback: create new record
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { capturePayPalOrder, type MilestoneType } from '@/lib/paypal'
import { sendTransactionalEmail } from '@/lib/email-router'

const PAYMENT_STATUS_PROGRESSION: Record<string, string> = {
    deposit: 'deposit_paid',
    midpoint: 'midpoint_paid',
    final: 'fully_paid',
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { orderID } = body

        if (!orderID) {
            return NextResponse.json({ error: 'Missing orderID' }, { status: 400 })
        }

        // Capture the payment via PayPal
        const capture = await capturePayPalOrder(orderID)

        if (capture.status !== 'COMPLETED') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
        }

        // Parse custom_id: milestone|projectRequestId|email
        const parts = (capture.customId || '').split('|')
        const milestone = parts[0] as MilestoneType
        const projectRequestId = parts[1] !== 'PENDING' ? parts[1] : null

        if (!projectRequestId) {
            // Legacy: deposit during old flow — return details for client-side submission
            return NextResponse.json({
                success: true,
                payment: {
                    milestone,
                    amount: capture.amount,
                    paypalOrderId: orderID,
                    paypalCaptureId: capture.captureId,
                    status: 'completed',
                },
            })
        }

        // ── 3-step record lookup ────────────────────────────────────────

        // Step 1: Find by paypalOrderId (idempotency — catches double-capture)
        let payment = await prisma.projectPayment.findUnique({
            where: { paypalOrderId: orderID },
        })

        // If already completed, this is a duplicate capture — return success
        if (payment && payment.status === 'completed') {
            return NextResponse.json({
                success: true,
                payment: {
                    milestone,
                    amount: capture.amount,
                    paypalOrderId: orderID,
                    paypalCaptureId: capture.captureId,
                    status: 'completed',
                },
            })
        }

        // Step 2: Find pending invoice record (admin-created, no paypalOrderId yet)
        if (!payment) {
            payment = await prisma.projectPayment.findFirst({
                where: {
                    projectRequestId,
                    milestone,
                    status: 'pending',
                    paypalOrderId: null,
                },
            })
        }

        // Step 3: Update existing or create new
        if (payment) {
            await prisma.projectPayment.update({
                where: { id: payment.id },
                data: {
                    status: 'completed',
                    paypalOrderId: orderID,
                    paypalCaptureId: capture.captureId,
                    amount: capture.amount || payment.amount,
                    paidAt: new Date(),
                },
            })
        } else {
            // Fallback: create record (edge case — no admin invoice pre-created)
            await prisma.projectPayment.create({
                data: {
                    projectRequestId,
                    milestone,
                    amount: capture.amount || 0,
                    status: 'completed',
                    paypalOrderId: orderID,
                    paypalCaptureId: capture.captureId,
                    paidAt: new Date(),
                },
            })
        }

        // ── Advance project payment status (ALL paths) ──────────────────
        const newPaymentStatus = PAYMENT_STATUS_PROGRESSION[milestone] || 'deposit_paid'
        await prisma.projectRequest.update({
            where: { id: projectRequestId },
            data: { paymentStatus: newPaymentStatus },
        })

        // ── Send confirmation email ─────────────────────────────────────
        const project = await prisma.projectRequest.findUnique({
            where: { id: projectRequestId },
        })
        if (project) {
            const milestoneLabels: Record<string, string> = {
                deposit: 'Deposit (40%)',
                midpoint: 'Midpoint (30%)',
                final: 'Final (30%)',
            }
            sendTransactionalEmail({
                to: project.email,
                subject: `Payment Received - ${milestoneLabels[milestone]} for ${project.projectTitle}`,
                html: buildPaymentConfirmationEmail(
                    project.clientName,
                    project.id,
                    project.projectTitle,
                    milestoneLabels[milestone] || milestone,
                    capture.amount || 0,
                ),
            }).catch(err => console.error('[project-payments] Email error:', err))

            // Notify admin
            const settings = await prisma.siteSettings.findFirst({ select: { notifyEmail: true, contactEmail: true } })
            const adminEmail = settings?.notifyEmail || settings?.contactEmail
            if (adminEmail) {
                sendTransactionalEmail({
                    to: adminEmail,
                    subject: `Payment: $${(capture.amount || 0).toFixed(2)} - ${milestoneLabels[milestone]} - ${project.projectTitle}`,
                    html: `<p><strong>${project.clientName}</strong> paid <strong>$${(capture.amount || 0).toFixed(2)}</strong> (${milestoneLabels[milestone]}) for project <strong>${project.projectTitle}</strong> (${project.id}).</p>`,
                    replyTo: project.email,
                }).catch(() => {})
            }
        }

        return NextResponse.json({
            success: true,
            payment: {
                milestone,
                amount: capture.amount,
                paypalOrderId: orderID,
                paypalCaptureId: capture.captureId,
                status: 'completed',
            },
        })
    } catch (error) {
        console.error('[project-payments/capture-order] Error:', error)
        const message = error instanceof Error ? error.message : 'Failed to capture payment'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// ── Simple payment confirmation email ────────────────────────────────────────

function buildPaymentConfirmationEmail(
    clientName: string,
    projectId: string,
    projectTitle: string,
    milestoneLabel: string,
    amount: number,
): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d0f14; color: #e8e6e3; padding: 40px 20px;">
<div style="max-width: 520px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 2rem;">✅</span>
    </div>
    <h1 style="font-size: 1.3rem; text-align: center; color: #d4a853; margin-bottom: 8px;">
        Payment Confirmed
    </h1>
    <p style="text-align: center; color: #9ca3af; font-size: 0.9rem; margin-bottom: 28px;">
        Thank you, ${clientName}!
    </p>

    <div style="background: rgba(212,168,83,0.08); border: 1px solid rgba(212,168,83,0.2); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 0.88rem; color: #d1d5db;" cellpadding="6">
            <tr><td style="color: #9ca3af;">Project</td><td style="text-align: right; font-weight: 600;">${projectTitle}</td></tr>
            <tr><td style="color: #9ca3af;">Reference</td><td style="text-align: right; font-family: monospace;">${projectId}</td></tr>
            <tr><td style="color: #9ca3af;">Milestone</td><td style="text-align: right;">${milestoneLabel}</td></tr>
            <tr style="font-size: 1.1rem;"><td style="color: #d4a853; font-weight: 700;">Amount Paid</td><td style="text-align: right; color: #d4a853; font-weight: 700;">$${amount.toFixed(2)}</td></tr>
        </table>
    </div>

    <p style="font-size: 0.82rem; color: #6b7280; text-align: center; line-height: 1.6;">
        You will receive updates on your project's progress. If you have questions, simply reply to this email.
    </p>

    <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06);">
        <span style="font-size: 0.72rem; color: #4b5563;">AIM Studio — Impact AI Studio</span>
    </div>
</div>
</body>
</html>`
}
