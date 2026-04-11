import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function isAdmin() {
    const session = await getSession()
    return session?.role === 'admin' || session?.role === 'superadmin'
}

// GET — public: list open+public calls, admin: list all
export async function GET() {
    const admin = await isAdmin()

    const where = admin ? {} : { isPublic: true, status: 'open' }

    const calls = await prisma.scriptCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            project: { select: { title: true, slug: true, coverImage: true } },
            _count: { select: { submissions: true } },
        },
    })

    return NextResponse.json(calls)
}

// POST — admin creates new script call
export async function POST(req: Request) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, description, genre, toneKeywords, targetLength, projectId, deadline, maxSubmissions, isPublic, status } = body

    if (!title || !description) {
        return NextResponse.json({ error: 'Title and description required' }, { status: 400 })
    }

    const call = await prisma.scriptCall.create({
        data: {
            title,
            description,
            genre: genre || null,
            toneKeywords: toneKeywords || null,
            targetLength: targetLength || null,
            projectId: projectId || null,
            deadline: deadline || null,
            maxSubmissions: maxSubmissions || 100,
            isPublic: isPublic ?? false,
            status: status || 'draft',
        },
    })

    return NextResponse.json(call)
}
