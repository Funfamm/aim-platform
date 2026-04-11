import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notifyScriptStatusChange } from '@/lib/notifications'

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
    const { status, statusNote } = await req.json()

    const validStatuses = ['submitted', 'analyzing', 'analyzed', 'shortlisted', 'selected', 'rejected']
    if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Fetch current submission before update (for notification context + previous status check)
    const submission = await prisma.scriptSubmission.findUnique({
        where: { id: subId },
        include: { scriptCall: true },
    })

    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

    const previousStatus = submission.status

    const updated = await prisma.scriptSubmission.update({
        where: { id: subId },
        data: { status },
    })

    // Send notification if status actually changed
    if (previousStatus !== status) {
        notifyScriptStatusChange({
            submissionId: subId,
            recipientEmail: submission.authorEmail,
            recipientName: submission.authorName,
            scriptTitle: submission.title,
            callTitle: submission.scriptCall.title,
            newStatus: status,
            statusNote: statusNote || null,
        }).catch(err => console.error('[ScriptStatus] Notification error:', err))
    }

    return NextResponse.json(updated)
}
