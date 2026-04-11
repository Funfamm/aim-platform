import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function isAdmin() {
    const session = await getSession()
    return session?.role === 'admin' || session?.role === 'superadmin'
}

// GET — single script call
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const admin = await isAdmin()

    const call = await prisma.scriptCall.findUnique({
        where: { id },
        include: {
            project: { select: { title: true, slug: true, coverImage: true } },
            _count: { select: { submissions: true } },
        },
    })

    if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!admin && (!call.isPublic || call.status !== 'open')) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(call)
}

// PUT — admin update
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const call = await prisma.scriptCall.update({
        where: { id },
        data: {
            ...(body.title !== undefined && { title: body.title }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.genre !== undefined && { genre: body.genre || null }),
            ...(body.toneKeywords !== undefined && { toneKeywords: body.toneKeywords || null }),
            ...(body.targetLength !== undefined && { targetLength: body.targetLength || null }),
            ...(body.projectId !== undefined && { projectId: body.projectId || null }),
            ...(body.deadline !== undefined && { deadline: body.deadline || null }),
            ...(body.maxSubmissions !== undefined && { maxSubmissions: body.maxSubmissions }),
            ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
            ...(body.status !== undefined && { status: body.status }),
        },
    })

    return NextResponse.json(call)
}

// DELETE — admin delete
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    await prisma.scriptCall.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
