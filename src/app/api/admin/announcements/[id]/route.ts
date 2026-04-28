import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * DELETE /api/admin/announcements/[id]
 * Deletes a single announcement history record.
 */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    if (!id) {
        return NextResponse.json({ error: 'Missing announcement id' }, { status: 400 })
    }

    try {
        await db.announcement.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[announcements] failed to delete:', err)
        return NextResponse.json({ error: 'Announcement not found or already deleted' }, { status: 404 })
    }
}
