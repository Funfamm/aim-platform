import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAdminAction } from '@/lib/audit-log'

export async function POST(req: Request) {
    let session
    try { session = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { applicationIds } = await req.json()

        if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
            return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
        }

        const result = await prisma.application.deleteMany({
            where: { id: { in: applicationIds } },
        })

        logAdminAction({
            actor: session.userId,
            action: 'DELETE_APPLICATIONS',
            target: applicationIds.join(','),
            details: { count: result.count },
        })

        return NextResponse.json({
            success: true,
            deleted: result.count,
            message: `${result.count} application(s) permanently deleted`,
        })
    } catch (error) {
        console.error('Bulk delete error:', error)
        return NextResponse.json({ error: 'Failed to delete applications' }, { status: 500 })
    }
}
