'use server'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { sendTransactionalEmail } from '@/lib/email-router'
import { mirrorToNotificationBoard } from '@/lib/notifications'
import { t as emailT } from '@/lib/email-i18n'

/**
 * POST /api/script-calls/[id]/withdraw
 * Allows a user to withdraw their script submission.
 * Sends a localized confirmation email + in-app notification.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: scriptCallId } = await params

        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId as string },
            select: { email: true, name: true, preferredLanguage: true, receiveLocalizedEmails: true },
        })

        if (!user?.email) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const submission = await prisma.scriptSubmission.findFirst({
            where: { scriptCallId, authorEmail: user.email },
            include: { scriptCall: { select: { title: true } } },
            orderBy: { createdAt: 'desc' },
        })

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        // Cannot withdraw once shortlisted or beyond
        const nonWithdrawable = ['shortlisted', 'selected', 'rejected', 'withdrawn']
        if (nonWithdrawable.includes(submission.status)) {
            return NextResponse.json({ error: 'Cannot withdraw at this stage' }, { status: 409 })
        }

        await prisma.scriptSubmission.update({
            where: { id: submission.id },
            data: { status: 'withdrawn' },
        })

        // Fire-and-forget: email + in-app notification
        const callTitle = submission.scriptCall.title
        const scriptTitle = submission.title
        Promise.resolve().then(async () => {
            try {
                const locale: string = (user.receiveLocalizedEmails !== false && user.preferredLanguage)
                    ? user.preferredLanguage : 'en'
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'

                // Email
                const subject = emailT('scriptWithdrawal', locale, 'subject')
                    .replace('{title}', scriptTitle) || `Script Withdrawn: ${scriptTitle}`
                const heading = emailT('scriptWithdrawal', locale, 'heading') || 'Submission Withdrawn'
                const body = (emailT('scriptWithdrawal', locale, 'body') || '')
                    .replace('{title}', scriptTitle)
                    .replace('{call}', callTitle)

                // Simple branded email (reuse the wrapper pattern)
                const { scriptWithdrawalEmail } = await import('@/lib/email-templates')
                await sendTransactionalEmail({
                    to: user.email!,
                    subject,
                    html: scriptWithdrawalEmail(user.name || '', scriptTitle, callTitle, siteUrl, locale),
                }).catch(err => console.error('[script-withdraw] email failed:', err))

                // In-app notification
                const notifTitle = (emailT('scriptWithdrawal', locale, 'notifTitle') || 'Submission Withdrawn')
                    .replace('{title}', scriptTitle)
                const notifMsg = (emailT('scriptWithdrawal', locale, 'notifMessage') || `Your submission "${scriptTitle}" has been withdrawn.`)
                    .replace('{title}', scriptTitle)
                await mirrorToNotificationBoard(
                    session.userId as string,
                    'status_change',
                    notifTitle,
                    notifMsg,
                    '/scripts',
                    `script-withdrawn-${submission.id}`,
                )
            } catch (err) {
                console.error('[script-withdraw] notification error:', err)
            }
        }).catch(() => null)

        return NextResponse.json({ success: true, message: 'Submission withdrawn' })
    } catch (error) {
        console.error('Script withdraw error:', error)
        return NextResponse.json({ error: 'Failed to withdraw submission' }, { status: 500 })
    }
}
