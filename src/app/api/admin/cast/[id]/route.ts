import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

async function requireAdmin() {
    const session = await getUserSession()
    if (!session?.userId) return { error: 'Unauthorized', status: 401 }
    if (session.role !== 'admin' && session.role !== 'superadmin') return { error: 'Forbidden', status: 403 }
    return null
}

// PUT /api/admin/cast/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

    const { id } = await params
    const body = await req.json()
    const { name, jobTitle, character, bio, photoUrl, instagramUrl, sortOrder } = body

    try {
        const member = await prisma.filmCast.update({
            where: { id },
            data: {
                ...(name && { name: name.trim() }),
                ...(jobTitle && { jobTitle: jobTitle.trim() }),
                character: character?.trim() || null,
                bio: bio?.trim().slice(0, 4000) || null,
                photoUrl: photoUrl?.trim() || null,
                instagramUrl: instagramUrl?.trim() || null,
                ...(sortOrder !== undefined && { sortOrder }),
            },
        })
        return NextResponse.json({ member })
    } catch (e: unknown) {
        if ((e as { code?: string }).code === 'P2025') {
            return NextResponse.json({ error: 'Cast member not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
}

// DELETE /api/admin/cast/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

    const { id } = await params
    try {
        await prisma.filmCast.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (e: unknown) {
        if ((e as { code?: string }).code === 'P2025') {
            return NextResponse.json({ error: 'Cast member not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }
}
