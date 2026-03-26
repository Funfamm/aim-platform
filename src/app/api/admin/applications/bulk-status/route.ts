import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { applicationIds, status } = await req.json()

        if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
            return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
        }

        const validStatuses = ['pending', 'shortlisted', 'approved', 'rejected']
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
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
