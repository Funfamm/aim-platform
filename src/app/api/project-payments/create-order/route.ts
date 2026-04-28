/**
 * POST /api/project-payments/create-order
 *
 * Creates a PayPal checkout order for a project milestone payment.
 * Used by the DepositStep in the Start a Project flow (deposit milestone)
 * and by the client pay-link for midpoint/final milestones.
 *
 * Body: { projectRequestId, milestone, amount, clientName, email }
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createPayPalOrder, calculateMilestoneAmount, type MilestoneType } from '@/lib/paypal'

const VALID_MILESTONES = ['deposit', 'midpoint', 'final']

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { projectRequestId, milestone, amount, clientName, email } = body

        if (!milestone || !VALID_MILESTONES.includes(milestone)) {
            return NextResponse.json({ error: 'Invalid milestone' }, { status: 400 })
        }
        if (!amount || amount <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        // For deposit during flow, projectRequestId may not exist yet (pre-submission).
        // In that case we create a pending payment record after capture.
        // For midpoint/final, project must exist.
        if (milestone !== 'deposit' && projectRequestId) {
            const project = await prisma.projectRequest.findUnique({
                where: { id: projectRequestId },
                include: { payments: true },
            })
            if (!project) {
                return NextResponse.json({ error: 'Project not found' }, { status: 404 })
            }

            // Check milestone hasn't been paid
            const existingPayment = project.payments.find(
                p => p.milestone === milestone && p.status === 'completed'
            )
            if (existingPayment) {
                return NextResponse.json({ error: 'This milestone has already been paid' }, { status: 409 })
            }

            // Verify amount matches expected milestone
            if (project.agreedProjectTotal) {
                const expected = calculateMilestoneAmount(project.agreedProjectTotal, milestone as MilestoneType)
                if (Math.abs(amount - expected) > 0.01) {
                    return NextResponse.json({
                        error: `Amount mismatch. Expected $${expected.toFixed(2)} for ${milestone}`,
                    }, { status: 400 })
                }
            }
        }

        // Compact custom_id (≤127 chars for PayPal): milestone|projectId|email
        const customId = [
            milestone,
            projectRequestId || 'PENDING',
            email.slice(0, 60),
        ].join('|')

        const milestoneLabels: Record<string, string> = {
            deposit: 'Project Deposit',
            midpoint: 'Midpoint Payment',
            final: 'Final Payment',
        }

        const safeAmount = parseFloat(Number(amount).toFixed(2))
        const safeClientName = (clientName || 'Client').replace(/[^\w\s.-]/g, '').slice(0, 50)

        const { orderId } = await createPayPalOrder({
            amount: safeAmount,
            description: `${milestoneLabels[milestone] || 'Payment'} - ${safeClientName}`,
            customId,
        })

        // Create pending payment record if project already exists
        if (projectRequestId && projectRequestId !== 'PENDING') {
            await prisma.projectPayment.upsert({
                where: { paypalOrderId: orderId },
                create: {
                    projectRequestId,
                    milestone,
                    amount: parseFloat(amount.toFixed(2)),
                    status: 'pending',
                    paypalOrderId: orderId,
                },
                update: {},
            })
        }

        return NextResponse.json({ orderID: orderId })
    } catch (error) {
        console.error('[project-payments/create-order] Error:', error)
        return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
    }
}
