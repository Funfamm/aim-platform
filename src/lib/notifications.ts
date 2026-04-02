/**
 * AIM Studio – Notification Service
 * ---------------------------------------------------------------------------
 * Central hub for all platform notifications.
 *
 * Channels:
 *  - Email  (via mailer.ts → SMTP or Microsoft Graph)
 *  - In-App (persisted to UserNotification table → bell icon)
 *  - SMS    (stubbed – enabled via ENABLE_SMS_NOTIFICATIONS env var)
 *
 * Every delivery respects the user's UserNotificationPreference record.
 * If no preference record exists, safe defaults (email + in-app) are used.
 */
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { sendSMS, buildSMSBody } from '@/lib/sms'
import { logger } from '@/lib/logger'
import {
    applicationStatusUpdate,
    newCastingRoleEmail,
    announcementEmail,
    contentPublishEmail,
} from '@/lib/email-templates'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
    | 'status_change'
    | 'new_role'
    | 'announcement'
    | 'content_publish'
    | 'system'

interface NotifyUserOptions {
    userId: string
    type: NotificationType
    title: string
    message: string
    link?: string
    /** Pre-built HTML email body. If omitted, uses message as plain text. */
    emailHtml?: string
    /** Email subject. Defaults to title. */
    emailSubject?: string
}

interface NotifyAllOptions {
    type: NotificationType
    title: string
    message: string
    link?: string
    emailHtml?: string
    emailSubject?: string
    /** Only notify users who have this preference flag set to true */
    preferenceKey?: 'newRole' | 'announcement' | 'contentPublish' | 'statusChange'
}

// ─── Core: notify a single user ───────────────────────────────────────────────

/**
 * Deliver a notification to a single user via their preferred channels.
 */
export async function notifyUser(opts: NotifyUserOptions): Promise<void> {
    try {
        // Load user + preference record in one query
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = await (prisma as any).user.findUnique({
            where: { id: opts.userId },
            select: {
                id: true,
                name: true,
                email: true,
                notificationPreference: {
                    select: {
                        email: true,
                        inApp: true,
                        sms: true,
                        newRole: true,
                        announcement: true,
                        contentPublish: true,
                        statusChange: true,
                        phoneNumber: true,
                    },
                },
            },
        })
        if (!user) return

        // Safe defaults: email + inApp on, sms off
        const pref = user.notificationPreference ?? {
            email: true,
            inApp: true,
            sms: false,
            newRole: true,
            announcement: true,
            contentPublish: false,
            statusChange: true,
        }

        // ── In-App ──────────────────────────────────────────────────────────
        if (pref.inApp) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).userNotification.create({
                data: {
                    userId: opts.userId,
                    type: opts.type,
                    title: opts.title,
                    message: opts.message,
                    link: opts.link ?? null,
                },
            })
        }

        // ── Email ────────────────────────────────────────────────────────────
        if (pref.email) {
            const subject = opts.emailSubject ?? opts.title
            const html    = opts.emailHtml   ?? buildPlainHtml(opts.title, opts.message, opts.link)
            await sendEmail({ to: user.email, subject, html })
        }

        // ── SMS ──────────────────────────────────────────────────────────────
        if (pref.sms && pref.phoneNumber) {
            const body = buildSMSBody(opts.title, opts.message, opts.link)
            await sendSMS(pref.phoneNumber, body)
        }
    } catch (err) {
        logger.error('notifications', `notifyUser failed for ${opts.userId}`, { error: err })
    }
}

// ─── Broadcast: notify all opted-in users ────────────────────────────────────

/**
 * Broadcast a notification to ALL users who have opted-in to the given type.
 * Runs in background — batched for efficiency.
 */
export async function broadcastNotification(opts: NotifyAllOptions): Promise<void> {
    try {
        // Check the platform-level kill switch first
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings = await (prisma as any).siteSettings.findFirst({
            select: {
                notifyOnNewRole: true,
                notifyOnAnnouncement: true,
                notifyOnContentPublish: true,
                emailsEnabled: true,
            },
        })

        // Respect platform toggles
        if (opts.type === 'new_role'         && !settings?.notifyOnNewRole)        return
        if (opts.type === 'announcement'     && !settings?.notifyOnAnnouncement)   return
        if (opts.type === 'content_publish'  && !settings?.notifyOnContentPublish) return

        // Fetch all users who have opted in
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const prefKey = opts.preferenceKey
        const whereClause = prefKey ? { notificationPreference: { [prefKey]: true } } : {}
        const users: { id: string }[] = await db.user.findMany({
            where: whereClause,
            select: { id: true },
        })

        logger.info('notifications', `Broadcasting "${opts.type}" to ${users.length} users`)

        // Process in batches of 50 to avoid DB overload
        const BATCH = 50
        for (let i = 0; i < users.length; i += BATCH) {
            const batch = users.slice(i, i + BATCH)
            await Promise.allSettled(
                batch.map((u: { id: string }) => notifyUser({ ...opts, userId: u.id }))
            )
        }
    } catch (err) {
        logger.error('notifications', 'broadcastNotification failed', { error: err })
    }
}

// ─── Application Status Change (existing flow, refactored) ────────────────────

interface StatusChangeOptions {
    applicationId: string
    recipientEmail: string
    recipientName: string
    newStatus: string
    roleName: string
    projectTitle: string
    aiScore?: number | null
    statusNote?: string | null
    userId?: string // if available, also write in-app notification
}

export async function notifyApplicantStatusChange(opts: StatusChangeOptions): Promise<void> {
    const template = STATUS_EMAIL_TEMPLATES[opts.newStatus]
    if (!template) return

    try {
        const settings = await prisma.siteSettings.findFirst({
            select: { notifyApplicantOnStatusChange: true, siteName: true },
        })
        if (settings && !settings.notifyApplicantOnStatusChange) return

        const siteName = settings?.siteName || 'AIM Studio'
        const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || ''
        const subject  = `[${siteName}] ${template.subject}`

        const html = applicationStatusUpdate(
            opts.recipientName,
            opts.roleName,
            opts.newStatus,
            opts.statusNote || undefined,
            siteUrl,
        )

        const sent = await sendEmail({ to: opts.recipientEmail, subject, html })

        // Persist email log
        await prisma.applicationNotification.create({
            data: {
                applicationId: opts.applicationId,
                type: 'status_change',
                subject,
                body: buildStatusBody({ ...template, ...opts, siteName }),
                recipientEmail: opts.recipientEmail,
                status: sent ? 'sent' : 'failed',
            },
        })

        // In-app notification if userId is known
        if (opts.userId) {
            await prisma.userNotification.create({
                data: {
                    userId: opts.userId,
                    type: 'status_change',
                    title: template.subject,
                    message: `Your application for "${opts.roleName}" has been updated.`,
                    link: `/dashboard/applications`,
                },
            })
        }

        logger.info('notifications', `${sent ? '📧' : '❌'} Status notification ${sent ? 'sent' : 'failed'} → ${opts.recipientEmail}`)
    } catch (err) {
        logger.error('notifications', 'notifyApplicantStatusChange failed', { error: err })
    }
}

// ─── High-level helpers ───────────────────────────────────────────────────────

/** Call this when admin publishes a new casting role */
export async function notifyNewRole(roleId: string, roleName: string, projectTitle: string): Promise<void> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    await broadcastNotification({
        type: 'new_role',
        preferenceKey: 'newRole',
        title: `New Audition: ${roleName}`,
        message: `A new casting call for "${roleName}" in "${projectTitle}" is now open. Apply before it closes!`,
        link: `${siteUrl}/casting/${roleId}`,
        emailSubject: `🎭 New Audition Open: ${roleName} | AIM Studio`,
        emailHtml: newCastingRoleEmail(roleName, projectTitle, `${siteUrl}/casting/${roleId}`),
    })
}

/** Call this when admin posts a platform announcement */
export async function notifyAnnouncement(title: string, message: string, link?: string): Promise<void> {
    await broadcastNotification({
        type: 'announcement',
        preferenceKey: 'announcement',
        title,
        message,
        link,
        emailSubject: `📣 ${title} | AIM Studio`,
        emailHtml: announcementEmail(title, message, link),
    })
}

/** Call this when admin publishes new content (project, blog, video) */
export async function notifyContentPublish(contentTitle: string, contentType: string, link: string): Promise<void> {
    await broadcastNotification({
        type: 'content_publish',
        preferenceKey: 'contentPublish',
        title: `New ${contentType}: ${contentTitle}`,
        message: `We just published "${contentTitle}". Check it out!`,
        link,
        emailSubject: `✨ New ${contentType}: ${contentTitle} | AIM Studio`,
        emailHtml: contentPublishEmail(contentTitle, contentType, link),
    })
}

// ─── Auto-advance logic ───────────────────────────────────────────────────────

export async function getAutoAdvanceStatus(
    currentStatus: string,
    aiScore: number
): Promise<'shortlisted' | 'not_selected' | 'under_review' | null> {
    const settings = await prisma.siteSettings.findFirst()
    if (!settings?.pipelineAutoAdvance) return null

    const shortlistThreshold = settings.autoShortlistThreshold ?? 75
    const rejectThreshold    = settings.autoRejectThreshold    ?? 25

    const autoAdvanceFrom = ['submitted', 'under_review']
    if (!autoAdvanceFrom.includes(currentStatus)) return null

    if (aiScore >= shortlistThreshold) return 'shortlisted'
    if (aiScore <= rejectThreshold)    return 'not_selected'
    return 'under_review'
}

// ─── Status email templates ───────────────────────────────────────────────────

const STATUS_EMAIL_TEMPLATES: Record<string, { subject: string; heading: string; body: string; emoji: string }> = {
    under_review: {
        subject: 'Your Application is Being Reviewed',
        heading: "We're Reviewing Your Application! 🔍",
        body: "Great news! Our casting team is currently reviewing your application. We'll be in touch soon with next steps.",
        emoji: '🔍',
    },
    shortlisted: {
        subject: "Congratulations, You've Been Shortlisted! ⭐",
        heading: "You're on the Shortlist!",
        body: "We were impressed by your application and you've been added to our shortlist. This means you're being seriously considered for the role. Stay tuned for further updates.",
        emoji: '⭐',
    },
    contacted: {
        subject: "We'd Like to Move Forward With You",
        heading: 'Great News About Your Application! ✉️',
        body: "We've reviewed your submission and we're excited about your potential for this role. Please check your email for details and next steps from our casting team.",
        emoji: '✉️',
    },
    callback: {
        subject: "We'd Like to Move Forward With You",
        heading: 'Great News About Your Application! ✉️',
        body: "We've reviewed your submission and we're excited about your potential for this role. Please check your email for details and next steps from our casting team.",
        emoji: '✉️',
    },
    audition: {
        subject: "You've Been Selected for the Next Round! 🎭",
        heading: "You're Moving Forward!",
        body: "Congratulations! Your submission impressed our casting team and you've been selected to advance to the next round.",
        emoji: '🎭',
    },
    final_review: {
        subject: "You've Been Selected for Final Review! 🎭",
        heading: "You're in Final Review!",
        body: "Congratulations! Your submission impressed our casting team and you've been selected for final review.",
        emoji: '🎭',
    },
    selected: {
        subject: "🏆 Congratulations, You've Been Cast!",
        heading: 'You Got the Role!',
        body: "We're thrilled to inform you that you've been selected for the role! Our team will reach out shortly with contract details and next steps. Welcome aboard!",
        emoji: '🏆',
    },
    rejected: {
        subject: 'Application Update',
        heading: 'Thank You for Your Application',
        body: "After careful consideration, we've decided to go in a different direction for this particular role. We truly appreciate your interest and encourage you to apply for future roles.",
        emoji: '🎬',
    },
    not_selected: {
        subject: 'Application Update',
        heading: 'Thank You for Your Application',
        body: "After careful consideration, we've decided to go in a different direction for this particular role. We truly appreciate your interest and encourage you to apply for future roles.",
        emoji: '🎬',
    },
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function buildStatusBody(opts: {
    heading: string; body: string; emoji: string
    recipientName: string; roleName: string; projectTitle: string; siteName: string
    aiScore?: number | null; statusNote?: string | null
}): string {
    return `Hi ${opts.recipientName},\n\n${opts.heading}\n\n${opts.body}\n\nRole: ${opts.roleName}\nProject: ${opts.projectTitle}${opts.aiScore ? `\nAI Compatibility Score: ${opts.aiScore}/100` : ''}${opts.statusNote ? `\n\nNote from our team:\n${opts.statusNote}` : ''}\n\nBest regards,\n${opts.siteName} Casting Team`.trim()
}

function buildPlainHtml(title: string, message: string, link?: string): string {
    return `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;">
            <h2 style="color:#d4a853;margin-bottom:8px;">${title}</h2>
            <p style="color:#ccc;font-size:15px;line-height:1.6;">${message}</p>
            ${link ? `<a href="${link}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#d4a853;color:#000;border-radius:6px;text-decoration:none;font-weight:600;">View Now</a>` : ''}
        </div>
    `.trim()
}
