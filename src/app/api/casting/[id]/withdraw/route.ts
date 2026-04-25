'use server'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { sendTransactionalEmail } from '@/lib/email-router'
import { applicationWithdrawalEmail } from '@/lib/email-templates'
import { mirrorToNotificationBoard } from '@/lib/notifications'
import { t as emailT } from '@/lib/email-i18n'

/**
 * POST /api/casting/[id]/withdraw
 * Allows a user to withdraw their application for a casting call.
 * Sends a localized confirmation email + in-app notification.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: castingCallId } = await params

    const session = await getUserSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.userId

    const application = await prisma.application.findFirst({
      where: { castingCallId, userId },
      include: { castingCall: { select: { roleName: true } } },
    })
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const nonWithdrawableStatuses = ['shortlisted', 'callback', 'final_review', 'selected', 'not_selected']
    if (nonWithdrawableStatuses.includes(application.status)) {
      return NextResponse.json({ error: 'Cannot withdraw after the audition has been processed' }, { status: 409 })
    }

    await prisma.application.update({
      where: { id: application.id },
      data: { status: 'withdrawn' },
    })

    // Fire-and-forget: localized withdrawal email + in-app notification
    const roleName = application.castingCall.roleName
    Promise.resolve().then(async () => {
      try {
        // Resolve user locale
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = await (prisma as any).user.findUnique({
          where: { id: userId },
          select: { email: true, name: true, preferredLanguage: true, receiveLocalizedEmails: true },
        })
        const locale: string = (user?.receiveLocalizedEmails !== false && user?.preferredLanguage) ? user.preferredLanguage : 'en'
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const castingUrl = `${siteUrl}/casting`

        // Email
        if (user?.email) {
          const subject = emailT('castingWithdrawal', locale, 'subject').replace('{role}', roleName) || `Application Withdrawn: ${roleName}`
          await sendTransactionalEmail({
            to: user.email,
            subject,
            html: applicationWithdrawalEmail(user.name || '', roleName, castingUrl, locale),
          }).catch(err => console.error('[withdraw] email failed:', err))
        }

        // In-app notification
        const notifTitle   = emailT('castingWithdrawal', locale, 'notifTitle').replace('{role}', roleName)   || `Application withdrawn: ${roleName}`
        const notifMessage = emailT('castingWithdrawal', locale, 'notifMessage').replace('{role}', roleName) || `Your application for "${roleName}" has been withdrawn.`
        await mirrorToNotificationBoard(
          userId,
          'status_change',
          notifTitle,
          notifMessage,
          `/casting/${castingCallId}/apply`,
          `app-withdrawn-${application.id}`,
        )
      } catch (err) {
        console.error('[withdraw] notification error:', err)
      }
    }).catch(() => null)

    return NextResponse.json({ success: true, message: 'Application withdrawn' })
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json({ error: 'Failed to withdraw application' }, { status: 500 })
  }
}
