import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

const MAX_BULK = 200

export async function DELETE(req: NextRequest) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const ids: string[] = (body.ids ?? []).slice(0, MAX_BULK)

        if (ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
        }

        // Delete submissions first (cascade may not be set), then the calls
        await prisma.scriptSubmission.deleteMany({ where: { callId: { in: ids } } })
        const result = await prisma.scriptCall.deleteMany({ where: { id: { in: ids } } })

        return NextResponse.json({ success: true, deleted: result.count })
    } catch (err) {
        console.error('Bulk script-call delete error:', err)
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }
}
