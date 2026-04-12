import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Eligibility state machine — which current statuses can move to each target
const ELIGIBLE_FROM: Record<string, string[]> = {
    under_review:  ['submitted', 'pending'],
    shortlisted:   ['submitted', 'under_review', 'pending'],
    callback:      ['shortlisted'],
    final_review:  ['shortlisted', 'callback'],
    selected:      ['final_review', 'shortlisted'],
    rejected:      ['submitted', 'under_review', 'shortlisted', 'callback', 'final_review'],
    not_selected:  ['submitted', 'under_review', 'shortlisted', 'callback', 'final_review'],
    audition:      ['shortlisted', 'callback'],
    contacted:     ['shortlisted', 'callback'],
}

const NOTIFY_STATUSES = new Set([
    'shortlisted', 'callback', 'contacted', 'audition',
    'final_review', 'selected', 'rejected', 'not_selected',
])

/**
 * Dry-run preview — no DB writes, no emails.
 * Returns a breakdown of what a bulk action WOULD do so the admin can confirm.
 */
export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const applicationIds: string[] = body.applicationIds ?? []
        const { status } = body

        if (!applicationIds.length || !status) {
            return NextResponse.json({ error: 'applicationIds and status are required' }, { status: 400 })
        }

        const eligibleStatuses = ELIGIBLE_FROM[status] ?? null

        const apps = await prisma.application.findMany({
            where: { id: { in: applicationIds } },
            select: {
                id: true,
                status: true,
                notifications: {
                    where: { type: 'status_change', notifiedForStatus: status, status: 'sent' },
                    select: { id: true },
                },
            },
        })

        let eligible = 0
        let ineligible = 0
        let alreadyNotified = 0
        let wouldNotify = 0

        for (const app of apps) {
            const isEligible = !eligibleStatuses || eligibleStatuses.includes(app.status)
            if (!isEligible) { ineligible++; continue }
            eligible++
            if (app.notifications.length > 0) {
                alreadyNotified++
            } else if (NOTIFY_STATUSES.has(status)) {
                wouldNotify++
            }
        }

        return NextResponse.json({ eligible, ineligible, alreadyNotified, wouldNotify })
    } catch (error) {
        console.error('Bulk preview error:', error)
        return NextResponse.json({ error: 'Preview failed' }, { status: 500 })
    }
}
