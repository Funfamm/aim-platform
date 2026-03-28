import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

const VALID_STATUSES = [
    'submitted', 'under_review', 'shortlisted', 'contacted',
    'audition', 'selected', 'rejected', 'approved', 'pending',
]

async function handleBulkStatus(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        // Support both 'ids' (legacy) and 'applicationIds'
        const applicationIds = body.applicationIds ?? body.ids
        const { status } = body

        if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
            return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
        }

        if (!VALID_STATUSES.includes(status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
        }

        const result = await prisma.application.updateMany({
            where: { id: { in: applicationIds } },
            data: { status },
        })

        return NextResponse.json({
            success: true,
            updated: result.count,
            message: `${result.count} application(s) updated to "${status}"`,
        })
    } catch (error) {
        console.error('Bulk status update error:', error)
        return NextResponse.json({ error: 'Failed to update applications' }, { status: 500 })
    }
}

// Frontend sends POST; support both POST and PATCH
export const POST = handleBulkStatus
export const PATCH = handleBulkStatus
