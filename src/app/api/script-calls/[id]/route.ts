import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { translateAndSave } from '@/lib/translate'

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
        select: {
            id: true, title: true, description: true, genre: true,
            toneKeywords: true, targetLength: true, deadline: true,
            status: true, isPublic: true, maxSubmissions: true,
            projectId: true, createdAt: true, updatedAt: true,
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

    // Fire-and-forget: auto-translate text content to all supported languages
    const hasTextChange = body.title !== undefined || body.description !== undefined ||
        body.genre !== undefined || body.toneKeywords !== undefined

    if (hasTextChange) {
        const fieldsToTranslate: Record<string, string> = {}
        if (call.title) fieldsToTranslate.title = call.title
        if (call.description) fieldsToTranslate.description = call.description
        if (call.genre) fieldsToTranslate.genre = call.genre
        if (call.toneKeywords) fieldsToTranslate.toneKeywords = call.toneKeywords

        if (Object.keys(fieldsToTranslate).length > 0) {
            translateAndSave(fieldsToTranslate, async (translations) => {
                try {
                    await prisma.scriptCall.update({
                        where: { id },
                        data: { contentTranslations: translations },
                    })
                } catch { /* contentTranslations column may not exist in DB yet */ }
            }, 'scripts')
        }
    }

    return NextResponse.json(call)
}

// DELETE — admin delete
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    await prisma.scriptCall.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
