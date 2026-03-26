import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function isAdmin() {
    const session = await getSession()
    return session?.role === 'admin' || session?.role === 'superadmin'
}

// GET — admin: list submissions for a script call
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const submissions = await prisma.scriptSubmission.findMany({
        where: { scriptCallId: id },
        include: { analysis: true },
        orderBy: [
            { analysis: { overallScore: 'desc' } },
            { createdAt: 'desc' },
        ],
    })

    return NextResponse.json(submissions)
}
