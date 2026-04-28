/**
 * GET /api/pay/[id]?token=...
 *
 * Public endpoint for the client payment page.
 * Validates project ID + access token, returns payment info.
 * Rate limited: 20 requests per IP per minute.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// ── Rate limiting ───────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW = 60_000 // 1 minute

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(ip)
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
        return false
    }
    entry.count++
    return entry.count > RATE_LIMIT
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { id } = await params
    const token = req.nextUrl.searchParams.get('token')

    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    }

    const project = await prisma.projectRequest.findUnique({
        where: { id },
        select: {
            id: true,
            accessToken: true,
            projectTitle: true,
            clientName: true,
            email: true,
            agreedProjectTotal: true,
            paymentStatus: true,
            payments: {
                where: { milestone: 'deposit' },
                select: {
                    id: true,
                    status: true,
                    amount: true,
                    paidAt: true,
                    invoiceSentAt: true,
                },
            },
        },
    })

    if (!project || project.accessToken !== token) {
        return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
    }

    const depositPayment = project.payments[0]

    // No invoice sent yet — payment page shouldn't be accessible
    if (!depositPayment) {
        return NextResponse.json({ error: 'No invoice has been sent for this project yet' }, { status: 404 })
    }

    const alreadyPaid = depositPayment.status === 'completed'

    return NextResponse.json({
        projectId: project.id,
        projectTitle: project.projectTitle,
        clientName: project.clientName,
        email: project.email,
        agreedTotal: project.agreedProjectTotal,
        depositAmount: depositPayment.amount,
        milestone: 'deposit',
        alreadyPaid,
        paidAt: depositPayment.paidAt?.toISOString() || null,
    })
}
