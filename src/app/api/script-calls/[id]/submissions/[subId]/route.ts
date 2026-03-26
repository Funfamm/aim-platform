import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function isAdmin() {
    const session = await getSession()
    return session?.role === 'admin' || session?.role === 'superadmin'
}

// GET — single submission with analysis
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; subId: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { subId } = await params

    const submission = await prisma.scriptSubmission.findUnique({
        where: { id: subId },
        include: { analysis: true, scriptCall: true },
    })

    if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(submission)
}

// PUT — admin updates submission status (shortlist, select, reject)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; subId: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { subId } = await params
    const { status } = await req.json()

    const validStatuses = ['submitted', 'analyzing', 'analyzed', 'shortlisted', 'selected', 'rejected']
    if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updated = await prisma.scriptSubmission.update({
        where: { id: subId },
        data: { status },
    })

    return NextResponse.json(updated)
}
