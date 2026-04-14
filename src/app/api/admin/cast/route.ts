import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

async function requireAdmin() {
    const session = await getUserSession()
    if (!session?.userId) return { error: 'Unauthorized', status: 401 }
    if (session.role !== 'admin' && session.role !== 'superadmin') return { error: 'Forbidden', status: 403 }
    return null
}

// GET /api/admin/cast?projectId=xxx
export async function GET(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

    const projectId = new URL(req.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    const cast = await prisma.filmCast.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ cast })
}

// POST /api/admin/cast
export async function POST(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

    const body = await req.json()
    const { projectId, name, jobTitle, character, bio, photoUrl, instagramUrl, sortOrder } = body

    if (!projectId || !name || !jobTitle) {
        return NextResponse.json({ error: 'projectId, name, and jobTitle are required' }, { status: 400 })
    }

    const member = await prisma.filmCast.create({
        data: {
            projectId,
            name: name.trim(),
            jobTitle: jobTitle.trim(),
            character: character?.trim() || null,
            bio: bio?.trim().slice(0, 4000) || null,  // Rec 2: cap bio at 4000 chars
            photoUrl: photoUrl?.trim() || null,
            instagramUrl: instagramUrl?.trim() || null,
            sortOrder: sortOrder ?? 0,
        },
    })
    return NextResponse.json({ member }, { status: 201 })
}
