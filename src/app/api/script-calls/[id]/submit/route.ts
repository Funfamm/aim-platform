import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { scriptSubmissionConfirmationWithOverrides } from '@/lib/email-templates'
import { mirrorToNotificationBoard } from '@/lib/notifications'

// POST — public submission (no auth required)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const call = await prisma.scriptCall.findUnique({
        where: { id },
        include: { _count: { select: { submissions: true } } },
    })

    if (!call || call.status !== 'open') {
        return NextResponse.json({ error: 'This script call is no longer accepting submissions' }, { status: 400 })
    }

    if (call._count.submissions >= call.maxSubmissions) {
        return NextResponse.json({ error: 'Maximum submissions reached for this call' }, { status: 400 })
    }

    const body = await req.json()
    const { authorName, authorEmail, authorBio, title, logline, synopsis, scriptText, genre, estimatedDuration } = body

    if (!authorName || !authorEmail || !title || !logline || !synopsis) {
        return NextResponse.json({ error: 'Name, email, title, logline, and synopsis are required' }, { status: 400 })
    }

    const submission = await prisma.scriptSubmission.create({
        data: {
            scriptCallId: id,
            authorName,
            authorEmail,
            authorBio: authorBio || null,
            title,
            logline,
            synopsis,
            scriptText: scriptText || null,
            genre: genre || null,
            estimatedDuration: estimatedDuration || null,
        },
    })

    // Fire-and-forget: confirmation email to author + mirror to notification board
    sendEmail({
        to: authorEmail,
        subject: `Script "${title}" submitted successfully ✍️`,
        html: await scriptSubmissionConfirmationWithOverrides(authorName, title),
    })

    // Mirror to notification board if author has an account
    void (async () => {
        try {
            const authorUser = await prisma.user.findUnique({ where: { email: authorEmail }, select: { id: true } })
            if (authorUser) {
                await mirrorToNotificationBoard(
                    authorUser.id,
                    'system',
                    `Script Submitted ✍️ "${title}"`,
                    `Your screenplay "${title}" has been submitted. Our team will review it and reach out if selected.`,
                    '/dashboard',
                    `script-confirm-${submission.id}`,
                )
            }
        } catch { /* non-critical */ }
    })()

    return NextResponse.json({ success: true, id: submission.id })
}
