import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

async function requireAdmin() {
    const session = await getUserSession()
    return !!session?.userId && (session.role === 'admin' || session.role === 'superadmin')
}

/** Update admin-only fields. Body: { adminNotes?, status? } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data: { adminNotes?: string; status?: string } = {}
    if (typeof body.adminNotes === 'string') data.adminNotes = body.adminNotes.slice(0, 10_000)
    if (body.status === 'in_progress' || body.status === 'submitted') data.status = body.status
    try {
        const brief = await prisma.clientBrief.update({ where: { id }, data })
        return NextResponse.json({ brief })
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    await prisma.clientBrief.delete({ where: { id } }).catch(() => null)
    return NextResponse.json({ ok: true })
}
