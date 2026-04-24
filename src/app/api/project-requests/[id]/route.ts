import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['received', 'reviewing', 'scope_confirmed', 'in_production', 'awaiting_client', 'delivered', 'completed', 'cancelled']

// ── GET — Admin: fetch single request details ───────────────────────────────
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const request = await prisma.projectRequest.findUnique({ where: { id } })
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        deadline: request.deadline?.toISOString() || null,
    })
}

// ── PATCH — Admin: update status, notes, urgent flag ────────────────────────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.status && VALID_STATUSES.includes(body.status)) data.status = body.status
    if (typeof body.adminNotes === 'string') data.adminNotes = body.adminNotes
    if (typeof body.urgent === 'boolean') data.urgent = body.urgent

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    try {
        const updated = await prisma.projectRequest.update({ where: { id }, data })
        return NextResponse.json({
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            deadline: updated.deadline?.toISOString() || null,
        })
    } catch {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
}

// ── DELETE — Admin: delete a request ────────────────────────────────────────
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    try {
        await prisma.projectRequest.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
}
