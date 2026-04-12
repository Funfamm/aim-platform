import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { scriptSubmissionConfirmationWithOverrides } from '@/lib/email-templates'
import { t as emailT } from '@/lib/email-i18n'
import { mirrorToNotificationBoard } from '@/lib/notifications'

// POST — public submission (no auth required)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const call = await prisma.scriptCall.findUnique({
        where: { id },
        select: {
            id: true, title: true, status: true, deadline: true,
            maxSubmissions: true,
            _count: { select: { submissions: true } },
        },
    })

    if (!call || call.status !== 'open') {
        return NextResponse.json({ error: 'This script call is no longer accepting submissions' }, { status: 400 })
    }

    // ── Deadline enforcement ──────────────────────────────────────────────────
    if (call.deadline) {
        const deadlineDate = new Date(call.deadline)
        // Set to end-of-day so submissions on the deadline day are still allowed
        deadlineDate.setHours(23, 59, 59, 999)
        if (new Date() > deadlineDate) {
            // Auto-close the call so future checks are instant
            await prisma.scriptCall.update({ where: { id }, data: { status: 'closed' } }).catch(() => {})
            return NextResponse.json({ error: 'The submission deadline for this script call has passed' }, { status: 400 })
        }
    }

    if (call._count.submissions >= call.maxSubmissions) {
        return NextResponse.json({ error: 'Maximum submissions reached for this call' }, { status: 400 })
    }

    const body = await req.json()
    const { authorName, authorEmail, authorBio, title, logline, synopsis, scriptText, genre, estimatedDuration, scriptFilePath } = body

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
            scriptFilePath: scriptFilePath || null,
            genre: genre || null,
            estimatedDuration: estimatedDuration || null,
        },
    })

    // Look up author's preferred language (non-blocking fallback to 'en')
    const authorUser = await prisma.user.findUnique({
        where: { email: authorEmail },
        select: { id: true, preferredLanguage: true },
    }).catch(() => null)
    const authorLocale: string = (authorUser as any)?.preferredLanguage || 'en'

    // Fire-and-forget: confirmation email to author + mirror to notification board
    const emailSubject = (emailT('scriptSubmission', authorLocale, 'subject') || 'Script "{title}" submitted successfully ✍️').replace('{title}', title)
    sendEmail({
        to: authorEmail,
        subject: emailSubject,
        html: await scriptSubmissionConfirmationWithOverrides(authorName, title, undefined, authorLocale),
    })

    void (async () => {
        try {
            if (authorUser) {
                const notifTitle = (emailT('scriptSubmission', authorLocale, 'notifTitle') || 'Script Submitted ✍️ "{title}"').replace('{title}', title)
                const notifBody  = (emailT('scriptSubmission', authorLocale, 'notifBody')  || 'Your screenplay "{title}" has been submitted. Our team will review it and reach out if selected.').replace(/{title}/g, title)
                await mirrorToNotificationBoard(authorUser.id, 'system', notifTitle, notifBody, '/dashboard', `script-confirm-${submission.id}`)
            }
        } catch { /* non-critical */ }
    })()

    return NextResponse.json({ success: true, id: submission.id })
}
