/**
 * Application Pipeline Notification Utility
 * Logs and sends email notifications to applicants when their status changes.
 */
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'
import { applicationStatusUpdate } from '@/lib/email-templates'

// Status → human-friendly label and email content
const STATUS_EMAIL_TEMPLATES: Record<string, {
    subject: string
    heading: string
    body: string
    emoji: string
}> = {
    under_review: {
        subject: 'Your Application is Being Reviewed',
        heading: 'We\'re Reviewing Your Application! 🔍',
        body: 'Great news! Our casting team is currently reviewing your application. We\'ll be in touch soon with next steps.',
        emoji: '🔍',
    },
    shortlisted: {
        subject: 'Congratulations, You\'ve Been Shortlisted! ⭐',
        heading: 'You\'re on the Shortlist!',
        body: 'We were impressed by your application and you\'ve been added to our shortlist. This means you\'re being seriously considered for the role. Stay tuned for further updates.',
        emoji: '⭐',
    },
    contacted: {
        subject: 'We\'d Like to Move Forward With You',
        heading: 'Great News About Your Application! ✉️',
        body: 'We\'ve reviewed your submission and we\'re excited about your potential for this role. Please check your email for details and next steps from our casting team.',
        emoji: '✉️',
    },
    audition: {
        subject: 'You\'ve Been Selected for the Next Round! 🎭',
        heading: 'You\'re Moving Forward!',
        body: 'Congratulations! Your submission impressed our casting team and you\'ve been selected to advance to the next round. We\'ll reach out via email with everything you need to know, including any additional materials we may need.',
        emoji: '🎭',
    },
    selected: {
        subject: '🏆 Congratulations, You\'ve Been Cast!',
        heading: 'You Got the Role!',
        body: 'We\'re thrilled to inform you that you\'ve been selected for the role! Our team will reach out shortly with contract details and next steps. Welcome aboard!',
        emoji: '🏆',
    },
    rejected: {
        subject: 'Application Update',
        heading: 'Thank You for Your Application',
        body: 'After careful consideration, we\'ve decided to go in a different direction for this particular role. We truly appreciate your interest and encourage you to apply for future roles. Your talent didn\'t go unnoticed.',
        emoji: '🎬',
    },
}

interface NotifyOptions {
    applicationId: string
    recipientEmail: string
    recipientName: string
    newStatus: string
    roleName: string
    projectTitle: string
    aiScore?: number | null
    statusNote?: string | null
}

/**
 * Log + send an email notification for an application status change.
 */
export async function notifyApplicantStatusChange(opts: NotifyOptions): Promise<void> {
    const template = STATUS_EMAIL_TEMPLATES[opts.newStatus]
    if (!template) return // No template for this status

    try {
        // Check if notifications are enabled
        const settings = await prisma.siteSettings.findFirst()
        if (settings && !settings.notifyApplicantOnStatusChange) return

        const siteName = settings?.siteName || 'AIM Studio'
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || ''

        const subject = `[${siteName}] ${template.subject}`
        const body = buildEmailBody({
            ...template,
            recipientName: opts.recipientName,
            roleName: opts.roleName,
            projectTitle: opts.projectTitle,
            aiScore: opts.aiScore,
            statusNote: opts.statusNote,
            siteName,
        })

        // Send email first, then log with accurate status
        const sent = await sendEmail({
            to: opts.recipientEmail,
            subject,
            html: applicationStatusUpdate(
                opts.recipientName,
                opts.roleName,
                opts.newStatus,
                opts.statusNote || undefined,
                siteUrl,
            ),
        })

        await prisma.applicationNotification.create({
            data: {
                applicationId: opts.applicationId,
                type: 'status_change',
                subject,
                body,
                recipientEmail: opts.recipientEmail,
                status: sent ? 'sent' : 'failed',
            },
        })

        // Use structured logger

        logger.info('notifications', `${sent ? '📧' : '❌'} Notification ${sent ? 'sent' : 'failed'} to ${opts.recipientEmail}: ${subject}`)
    } catch (error) {
        logger.error('notifications', 'Notification pipeline failed', { error })
    }
}

function buildEmailBody(opts: {
    heading: string
    body: string
    emoji: string
    recipientName: string
    roleName: string
    projectTitle: string
    siteName: string
    aiScore?: number | null
    statusNote?: string | null
}): string {
    return `
Hi ${opts.recipientName},

${opts.heading}

${opts.body}

Role: ${opts.roleName}
Project: ${opts.projectTitle}
${opts.aiScore ? `AI Compatibility Score: ${opts.aiScore}/100` : ''}
${opts.statusNote ? `\nNote from our team:\n${opts.statusNote}` : ''}

Best regards,
${opts.siteName} Casting Team
    `.trim()
}

/**
 * Auto-advance logic: given an AI score, determines the new status
 */
export async function getAutoAdvanceStatus(
    currentStatus: string,
    aiScore: number
): Promise<string | null> {
    const settings = await prisma.siteSettings.findFirst()
    if (!settings?.pipelineAutoAdvance) return null

    const shortlistThreshold = settings.autoShortlistThreshold ?? 75
    const rejectThreshold = settings.autoRejectThreshold ?? 25

    // Only auto-advance from early pipeline stages
    const autoAdvanceFrom = ['submitted', 'pending', 'under_review']
    if (!autoAdvanceFrom.includes(currentStatus)) return null

    if (aiScore >= shortlistThreshold) return 'shortlisted'
    if (aiScore <= rejectThreshold) return 'rejected'

    return 'under_review' // Middle range → just mark as reviewed
}
