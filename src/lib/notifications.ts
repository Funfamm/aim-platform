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
import { logger } from '@/lib/logger'
import { translateContent } from '@/lib/translate'
import { t } from '@/lib/email-i18n'
import {
    applicationStatusUpdate,
    auditResultRevealEmail,
    newCastingRoleEmail,
    announcementEmail,
    contentPublishEmail,
    scriptStatusUpdateEmail,
} from '@/lib/email-templates'
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token'

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
    /** Optional map of locale -> localized title/message */
    translations?: Record<string, Record<string, string>> | null
    /** Optional banner image URL — only https URLs are used */
    imageUrl?: string
    /** Optional rich HTML body from RichTextEditor */
    bodyHtml?: string
    /**
     * Raw role name for new_role email rebuilds.
     * Avoids brittle title-stripping (e.g. "New Audition: " prefix differs per locale).
     */
    roleName?: string
    /** Project status — threaded to contentPublishEmail for status-aware CTA */
    contentStatus?: string
    /** Project sponsor data — threaded to contentPublishEmail */
    sponsorData?: { name: string; logoUrl?: string; description?: string } | null
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
    /** Optional map of locale -> localized title/message */
    translations?: Record<string, Record<string, string>> | null
    /** Optional banner image URL — only https URLs are used */
    imageUrl?: string
    /** Optional rich HTML body from RichTextEditor */
    bodyHtml?: string
    /** Raw role name — threaded through to notifyUser for new_role email rebuilds */
    roleName?: string
    /** Project status — threaded to contentPublishEmail for status-aware CTA */
    contentStatus?: string
    /** Project sponsor data — threaded to contentPublishEmail */
    sponsorData?: { name: string; logoUrl?: string; description?: string } | null
    /** When set, only notify these specific user IDs (e.g. cast applicants) */
    targetUserIds?: string[]
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
                preferredLanguage: true,
                receiveLocalizedEmails: true,
                notificationPreference: {
                    select: {
                        email: true,
                        inApp: true,
                        newRole: true,
                        announcement: true,
                        contentPublish: true,
                        statusChange: true,
                    },
                },
            },
        })
        if (!user) return

        // Safe defaults: email + inApp on
        const pref = user.notificationPreference ?? {
            email: true,
            inApp: true,
            newRole: true,
            announcement: true,
            contentPublish: false,
            statusChange: true,
        }
        // If the user opted out of localized emails, force English for all channels
        const locale: string = (user.receiveLocalizedEmails !== false && user.preferredLanguage)
            ? user.preferredLanguage
            : 'en'

        let displayTitle = opts.title
        let displayMessage = opts.message

        // Apply pre-batch translations if available for this locale
        // Also pick up any per-locale link override (e.g. /fr/casting/[id] for new_role emails)
        let localizedLink = opts.link ?? null
        if (locale !== 'en' && opts.translations?.[locale]) {
            displayTitle = opts.translations[locale].title || displayTitle
            displayMessage = opts.translations[locale].message || displayMessage
            // Use per-locale link if the translations map provides one (new_role uses this)
            if (opts.translations[locale].link) {
                localizedLink = opts.translations[locale].link
            }
        } else if (locale !== 'en') {
            // Fallback: pre-batch translation was null or didn't include this locale —
            // translate on-demand just for this user (10s timeout)
            try {
                const fallbackTimeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 10_000))
                const tx = await Promise.race([
                    translateContent({ title: opts.title, message: opts.message }, 'all').catch(() => null),
                    fallbackTimeout,
                ])
                if (tx?.[locale]) {
                    displayTitle = tx[locale].title || displayTitle
                    displayMessage = tx[locale].message || displayMessage
                }
            } catch { /* non-critical — deliver in English */ }
        }

        // ── In-App ──────────────────────────────────────────────────────────
        if (pref.inApp) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).userNotification.create({
                data: {
                    userId: opts.userId,
                    type: opts.type,
                    title: displayTitle,
                    message: displayMessage,
                    link: localizedLink,
                },
            })
        }

        // ── Email ────────────────────────────────────────────────────────────
        // If emailSubject is explicitly '' the caller wants in-app only — skip email channel
        if (pref.email && user.email && opts.emailSubject !== '') {
            let subject = opts.emailSubject ?? displayTitle
            let html = opts.emailHtml

            // Rebuild HTML using the user's localized strings
            if (locale !== 'en') {
                subject = opts.emailSubject
                    ? opts.emailSubject.replace(/(^[^|]+\|)/, `${displayTitle} |`)
                    : displayTitle
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
                const lt = opts.translations?.[locale] as Record<string, string> | undefined

                if (opts.type === 'announcement') {
                    html = announcementEmail(displayTitle, displayMessage, localizedLink ?? opts.link, siteUrl, {
                        badgeText: lt?.badgeText || undefined,
                        buttonText: lt?.buttonText || undefined,
                        footerOptIn: lt?.footerOptIn || undefined,
                        managePrefs: lt?.managePrefs || undefined,
                    // Use the translated body if the admin form stored one for this locale,
                    // otherwise fall back to the English rich HTML
                    }, opts.imageUrl, lt?.bodyHtml || opts.bodyHtml)
                } else if (opts.type === 'new_role') {
                    // Rebuild the email using the localized CTA link for this user's locale.
                    // opts.roleName carries the raw role name — no need to strip the composed
                    // title prefix (which differs per locale, making regex stripping unreliable).
                    const bareRoleName = opts.roleName || displayTitle.replace(/^New Audition:\s*/i, '') || opts.title
                    html = newCastingRoleEmail(
                        bareRoleName,
                        '',
                        localizedLink ?? opts.link ?? '',
                        locale
                    )
                } else if (opts.type === 'content_publish') {
                    const siteUrl = (localizedLink ?? opts.link ?? '').split('/').slice(0, 3).join('/')
                    const unsubUrl = buildUnsubscribeUrl(siteUrl, user.email, 'member')
                    html = contentPublishEmail(displayTitle, displayMessage, localizedLink ?? opts.link ?? '', locale, opts.contentStatus ?? 'completed', opts.sponsorData, unsubUrl)
                } else {
                    // Generic fallback: rebuild plain HTML with localized text
                    html = buildPlainHtml(displayTitle, displayMessage, localizedLink ?? opts.link, locale)
                }
            }

            // Final safety net — ensure html is always a string
            if (!html) html = buildPlainHtml(displayTitle, displayMessage, localizedLink ?? opts.link, locale)

            await sendEmail({ to: user.email, subject, html })
        }
    } catch (err) {
        logger.error('notifications', `notifyUser failed for ${opts.userId}`, { error: err })
    }
}

// ─── Mirror: write a transactional event to the notification board ─────────────

/**
 * Creates a UserNotification row for a transactional event (welcome, donation, etc.).
 * Security events (OTP, password reset, new device) must NEVER be passed here.
 *
 * @param userId   The user's DB id
 * @param type     Notification type: 'system' | 'status_change' | 'new_role' | etc.
 * @param title    Short heading shown in the bell panel
 * @param message  Body text
 * @param link     Optional deep-link for the "View" button
 * @param eventId  Optional deterministic dedup key — if supplied and already exists, insert is skipped
 */
export async function mirrorToNotificationBoard(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
    eventId?: string,
): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any

        if (eventId) {
            // Upsert — skip if already created (idempotent retry-safe)
            await db.userNotification.upsert({
                where: { eventId },
                update: {},  // never overwrite an existing entry
                create: { userId, type, title, message, link: link ?? null, eventId },
            })
        } else {
            await db.userNotification.create({
                data: { userId, type, title, message, link: link ?? null },
            })
        }
    } catch (err) {
        // Non-critical — log but never crash the calling flow
        logger.error('notifications', `mirrorToNotificationBoard failed for ${userId}`, { error: err })
    }
}

// ─── Broadcast: notify all opted-in users ────────────────────────────────────

/**
 * Broadcast a notification to ALL users who have opted-in to the given type.
 * Runs in background — batched for efficiency.
 */
export async function broadcastNotification(opts: NotifyAllOptions): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings = await (prisma as any).siteSettings.findFirst({
            select: {
                notifyOnNewRole: true,
                notifyOnAnnouncement: true,
                notifyOnContentPublish: true,
                emailsEnabled: true,
            },
        })

        if (opts.type === 'new_role' && !settings?.notifyOnNewRole) return
        if (opts.type === 'announcement' && !settings?.notifyOnAnnouncement) return
        if (opts.type === 'content_publish' && !settings?.notifyOnContentPublish) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const users: { id: string; notificationPreference: Record<string, boolean> | null }[] =
            await db.user.findMany({
                where: opts.targetUserIds ? { id: { in: opts.targetUserIds } } : undefined,
                select: {
                    id: true,
                    notificationPreference: opts.preferenceKey
                        ? { select: { [opts.preferenceKey]: true, inApp: true, email: true } }
                        : true,
                },
            })

        const prefKey = opts.preferenceKey
        const targeted = users.filter((u) => {
            if (!u.notificationPreference) return true
            if (prefKey) return u.notificationPreference[prefKey] !== false
            return true
        })

        logger.info('notifications', `Broadcasting "${opts.type}" to ${targeted.length}/${users.length} users`)

        const BATCH = 50
        for (let i = 0; i < targeted.length; i += BATCH) {
            const batch = targeted.slice(i, i + BATCH)
            await Promise.allSettled(
                batch.map((u: { id: string }) => notifyUser({ ...opts, userId: u.id }))
            )
        }

        // NOTE: Subscriber emails are handled separately by notifyContentPublish()
        // and notifyAnnouncement() with proper notifyGroups gating. Do NOT add
        // subscriber logic here — it would bypass the audience selection gate.
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
    userId?: string  // if available, also write in-app notification
    locale?: string  // applicant's locale at submission — used as fallback for guest applicants
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
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || ''

        // Resolve locale:
        //  1. Prefer user.preferredLanguage from DB (registered applicants)
        //  2. Fall back to opts.locale — the locale stored on Application at submission time
        //     This ensures guest applicants get emails in the language they applied in.
        //  3. Final fallback: 'en'
        let locale = opts.locale || 'en'
        if (opts.userId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userLang = await (prisma as any).user.findUnique({
                where: { id: opts.userId },
                select: { preferredLanguage: true, receiveLocalizedEmails: true },
            }).catch(() => null)
            if (userLang?.receiveLocalizedEmails !== false && userLang?.preferredLanguage) {
                locale = userLang.preferredLanguage
            }
        }

        // Map pipeline status -> castingStatus_* i18n key
        const normStatus = opts.newStatus.replace(/-/g, '_')
        const i18nKeyMap: Record<string, string> = {
            under_review: 'castingStatus_under_review',
            shortlisted:  'castingStatus_shortlisted',
            callback:     'castingStatus_callback',
            contacted:    'castingStatus_callback',
            audition:     'castingStatus_callback',
            final_review: 'castingStatus_shortlisted',
            selected:     'castingStatus_selected',
            not_selected: 'castingStatus_not_selected',
            rejected:     'castingStatus_not_selected',
            withdrawn:    'castingStatus_not_selected',
        }
        const i18nKey = i18nKeyMap[normStatus] || 'castingStatus_under_review'

        // All strings from static map — no runtime API call, no timeout risk
        const subject = `[${siteName}] ` + (t(i18nKey, locale, 'subject') || template.subject).replace('{role}', opts.roleName)
        const inAppTitle   = (t(i18nKey, locale, 'notifTitle')   || template.subject).replace('{role}', opts.roleName)
        const inAppMessage = (t(i18nKey, locale, 'notifMessage') || `Your application for "${opts.roleName}" has been updated.`).replace('{role}', opts.roleName)

        const html = applicationStatusUpdate(
            opts.recipientName,
            opts.roleName,
            opts.newStatus,
            opts.statusNote || undefined,
            siteUrl,
            locale,
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
            const appRecord = await prisma.application.findUnique({
                where: { id: opts.applicationId },
                select: { castingCallId: true },
            }).catch(() => null)
            const appLink = appRecord?.castingCallId
                ? `/casting/${appRecord.castingCallId}/apply`
                : null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).userNotification.create({
                data: {
                    userId: opts.userId,
                    type: 'status_change',
                    title: inAppTitle,
                    message: inAppMessage,
                    link: appLink,
                },
            })
        }

        logger.info('notifications', `${sent ? '📧' : '❌'} Status notification ${sent ? 'sent' : 'failed'} → ${opts.recipientEmail} (locale: ${locale})`)
    } catch (err) {
        logger.error('notifications', 'notifyApplicantStatusChange failed', { error: err })
    }
}


/** Call this when Pass 2 of the cron reveals an applicant's audit result. */
export async function notifyAuditResultRevealed(opts: {
    applicationId: string
    userId: string | null
    recipientEmail: string
    recipientName: string
    roleName: string
    projectTitle: string
    newStatus: string
    aiScore?: number | null
    statusNote?: string | null
}): Promise<void> {
    try {
        const settings = await prisma.siteSettings.findFirst({
            select: { notifyApplicantOnStatusChange: true, siteName: true },
        })
        if (settings && !settings.notifyApplicantOnStatusChange) return

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'

        // Look up user's preferred locale
        let locale = 'en'
        if (opts.userId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const user = await (prisma as any).user.findUnique({
                where: { id: opts.userId },
                select: { preferredLanguage: true, receiveLocalizedEmails: true },
            }).catch(() => null)
            if (user?.receiveLocalizedEmails !== false && user?.preferredLanguage) {
                locale = user.preferredLanguage
            }
        }

        const html = auditResultRevealEmail(
            opts.recipientName,
            opts.roleName,
            opts.projectTitle,
            opts.newStatus,
            opts.statusNote,
            opts.aiScore,
            siteUrl,
            locale,
        )

        const siteName = settings?.siteName || 'AIM Studio'
        // Build subject from the first line of the per-locale subject map (synced with template)
        const subjectMap: Record<string, string> = {
            en: `[${siteName}] Your audition result for ${opts.roleName} is ready`,
            ar: `[${siteName}] نتيجة الأداء الخاصة بك لدور ${opts.roleName} متاحة`,
            de: `[${siteName}] Dein Ergebnis für ${opts.roleName} ist bereit`,
            es: `[${siteName}] Tu resultado de audición para ${opts.roleName} está listo`,
            fr: `[${siteName}] Votre résultat pour ${opts.roleName} est disponible`,
            hi: `[${siteName}] ${opts.roleName} का परिणाम तैयार है`,
            ja: `[${siteName}] ${opts.roleName} の審査結果のお知らせ`,
            ko: `[${siteName}] ${opts.roleName} 결과 안내`,
            pt: `[${siteName}] Seu resultado para ${opts.roleName} está disponível`,
            ru: `[${siteName}] Результат кастинга на роль ${opts.roleName} готов`,
            zh: `[${siteName}] ${opts.roleName} 的审核结果已公布`,
        }
        const subject = subjectMap[locale] ?? subjectMap['en']

        const sent = await sendEmail({ to: opts.recipientEmail, subject, html })

        // Log in ApplicationNotification table
        await prisma.applicationNotification.create({
            data: {
                applicationId: opts.applicationId,
                type: 'status_change',
                subject,
                body: `AI audit result revealed for ${opts.recipientName} — ${opts.roleName}`,
                recipientEmail: opts.recipientEmail,
                status: sent ? 'sent' : 'failed',
            },
        })

        // In-app notification (localized title/message using locale-specific strings)
        if (opts.userId) {
            const inAppTitleMap: Record<string, string> = {
                en: 'Your audition result is ready',
                ar: 'نتيجتك في التصفية متاحة',
                de: 'Dein Vorsprechen-Ergebnis ist da',
                es: 'Tu resultado de audición está listo',
                fr: 'Votre résultat d\'audition est disponible',
                hi: 'आपका ऑडिशन परिणाम तैयार है',
                ja: 'オーディション結果のお知らせ',
                ko: '오디션 결과 안내',
                pt: 'Seu resultado de audição está disponível',
                ru: 'Результат вашего кастинга готов',
                zh: '您的试镜结果已公布',
            }
            const inAppMsgMap: Record<string, string> = {
                en: `Your AI review result for "${opts.roleName}" is now available. Tap to view.`,
                ar: `نتيجة مراجعة الذكاء الاصطناعي لدور "${opts.roleName}" متاحة الآن.`,
                de: `Dein KI-Überprüfungsergebnis für "${opts.roleName}" ist jetzt verfügbar.`,
                es: `Tu resultado de revisión de IA para "${opts.roleName}" ya está disponible.`,
                fr: `Votre résultat d\'examen IA pour "${opts.roleName}" est maintenant disponible.`,
                hi: `"${opts.roleName}" के लिए AI समीक्षा परिणाम अब उपलब्ध है।`,
                ja: `"${opts.roleName}" のAI審査結果が確認できます。`,
                ko: `"${opts.roleName}" AI 심사 결과를 확인하세요.`,
                pt: `Seu resultado de revisão de IA para "${opts.roleName}" está disponível.`,
                ru: `Результат AI-проверки для "${opts.roleName}" доступен.`,
                zh: `"${opts.roleName}" 的AI审核结果现已可查看。`,
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const auditAppRecord = await (prisma as any).application.findUnique({
                where: { id: opts.applicationId },
                select: { castingCallId: true },
            }).catch(() => null)
            const auditAppLink = auditAppRecord?.castingCallId
                ? `/casting/${auditAppRecord.castingCallId}/apply`
                : null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).userNotification.create({
                data: {
                    userId: opts.userId,
                    type: 'status_change',
                    title: inAppTitleMap[locale] ?? inAppTitleMap['en'],
                    message: inAppMsgMap[locale] ?? inAppMsgMap['en'],
                    link: auditAppLink,
                },
            })
        }

        logger.info('notifications', `${sent ? '📧' : '❌'} Audit result reveal notification ${sent ? 'sent' : 'failed'} → ${opts.recipientEmail} (locale: ${locale})`)
    } catch (err) {
        logger.error('notifications', 'notifyAuditResultRevealed failed', { error: err })
    }
}

// ─── High-level helpers ───────────────────────────────────────────────────────

/** Call this when admin publishes a new casting role */
export async function notifyNewRole(roleId: string, roleName: string, projectTitle: string): Promise<void> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    // Default English role URL — per-locale URLs are built inside the translations map
    const roleUrl = `${siteUrl}/en/casting/${roleId}`

    // Build static i18n translations for all supported locales — no runtime API needed
    const LOCALES = ['en', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh']
    const translations: Record<string, Record<string, string>> = {}
    for (const loc of LOCALES) {
        const localizedLink = `${siteUrl}/${loc}/casting/${roleId}`
        translations[loc] = {
            title:   (t('castingNewRole', loc, 'notifTitle')   || t('castingNewRole', 'en', 'notifTitle')   || `New Audition: ${roleName}`).replace('{role}', roleName).replace('{project}', projectTitle),
            message: (t('castingNewRole', loc, 'notifMessage') || t('castingNewRole', 'en', 'notifMessage') || `A new casting call for "${roleName}" is now open.`).replace('{role}', roleName).replace('{project}', projectTitle),
            // Per-locale Apply Now link so email CTAs use the correct locale prefix
            link: localizedLink,
        }
    }

    const titleEn   = translations['en'].title
    const messageEn = translations['en'].message
    // Default (English) email — notifyUser will use opts.emailHtml directly for all locales
    // since the subject/title are already resolved per-locale from the translations map
    const defaultHtml = newCastingRoleEmail(roleName, projectTitle, roleUrl, 'en')
    const subject     = (t('castingNewRole', 'en', 'subject') || '🎭 New Audition Open: {role} | AIM Studio').replace('{role}', roleName)

    await broadcastNotification({
        type: 'new_role',
        preferenceKey: 'newRole',
        title: titleEn,
        message: messageEn,
        link: roleUrl,
        emailSubject: subject,
        emailHtml: defaultHtml,
        translations,
        // Thread raw roleName so notifyUser can build per-locale emails without
        // brittle stripping of locale-specific "New Audition:" prefixes
        roleName,
    })
}

/** Call this when admin posts a platform announcement */
export async function notifyAnnouncement(
    title: string,
    message: string,
    link?: string,
    prebuiltTranslations?: Record<string, Record<string, string>> | null,
    imageUrl?: string,
    bodyHtml?: string,
    notifyGroups: { subscribers?: boolean; members?: boolean; cast?: boolean } = { subscribers: false, members: true, cast: false },
    specificUserIds?: string[],
): Promise<void> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const inAppLink = link || '/notifications'

    let translations: Record<string, Record<string, string>> | null = prebuiltTranslations ?? null

    // Only auto-translate when the admin did NOT pre-translate (fallback for legacy callers)
    if (!translations) {
        const translationTimeout = new Promise<null>(resolve => setTimeout(() => {
            logger.warn('notifications', 'translateContent timed out after 10s — broadcasting in English only')
            resolve(null)
        }, 10_000))

        translations = await Promise.race([
            translateContent({
                title,
                message,
                badgeText: 'Platform Announcement',
                buttonText: link ? 'View Announcement →' : 'View in Notifications →',
                footerOptIn: "You're receiving this because you opted in to platform announcements.",
                managePrefs: 'Manage preferences',
            }, 'all').catch((err) => {
                logger.warn('notifications', 'translateContent failed', { error: err })
                return null
            }),
            translationTimeout,
        ])
    }

    const broadcastOpts = {
        type: 'announcement' as const,
        preferenceKey: 'announcement' as const,
        title,
        message,
        link: inAppLink,
        emailSubject: `📣 ${title} | AIM Studio`,
        // Default English HTML — rebuilt per-user locale inside notifyUser()
        emailHtml: announcementEmail(title, message, link, siteUrl, undefined, imageUrl, bodyHtml),
        translations,
        // Thread these through so every per-locale rebuild also gets the banner + rich body
        imageUrl,
        bodyHtml,
    }

    // ── Registered members (opted-in) ─────────────────────────────────────────
    if (notifyGroups.members === true) {
        await broadcastNotification(broadcastOpts)
    }

    // ── Newsletter subscribers ─────────────────────────────────────────────────
    if (notifyGroups.subscribers === true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const registeredEmails = await db.user.findMany({ select: { email: true } })
            .then((rows: { email: string }[]) => new Set(rows.map((r: { email: string }) => r.email.toLowerCase())))

        const subscribers = await db.subscriber.findMany({
            where: { active: true },
            select: { email: true, name: true },
        })

        const uniqueSubs = subscribers.filter((s: { email: string }) => !registeredEmails.has(s.email.toLowerCase()))
        logger.info('notifications', `Announcement to ${uniqueSubs.length} newsletter subscribers`)

        const BATCH = 50
        for (let i = 0; i < uniqueSubs.length; i += BATCH) {
            const batch = uniqueSubs.slice(i, i + BATCH)
            await Promise.allSettled(batch.map(async (sub: { email: string; name: string | null }) => {
                const sent = await sendEmail({
                    to: sub.email,
                    subject: `📣 ${title} | AIM Studio`,
                    html: announcementEmail(title, message, link, siteUrl, undefined, imageUrl, bodyHtml),
                })
                if (!sent) logger.warn('notifications', `Subscriber announcement email failed: ${sub.email}`)
            }))
        }
    }

    // ── Cast members (all applicants across all projects) ──────────────────────
    if (notifyGroups.cast === true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const castApplicants = await db.application.findMany({
            where: { userId: { not: null } },
            select: { userId: true },
            distinct: ['userId'],
        })
        const castUserIds = castApplicants.map((a: { userId: string }) => a.userId)
        if (castUserIds.length > 0) {
            logger.info('notifications', `Announcement to ${castUserIds.length} cast members`)
            await broadcastNotification({ ...broadcastOpts, targetUserIds: castUserIds })
        }
    }

    // ── Specific users (admin-selected individual targets) ─────────────────────
    if (specificUserIds && specificUserIds.length > 0) {
        // Deduplicate: exclude users already notified via Members (all) or Cast groups
        const alreadyNotified = new Set<string>()
        if (notifyGroups.members === true) {
            // Members broadcast hits ALL users — so every specificUserId is already covered
            // No need to re-send to any of them
            logger.info('notifications', `Skipping ${specificUserIds.length} specific users — already covered by Members broadcast`)
        } else {
            // Only exclude cast member IDs if cast was also selected
            if (notifyGroups.cast === true) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const db2 = prisma as any
                const castApps = await db2.application.findMany({
                    where: { userId: { not: null } },
                    select: { userId: true },
                    distinct: ['userId'],
                })
                castApps.forEach((a: { userId: string }) => alreadyNotified.add(a.userId))
            }
            const dedupedIds = specificUserIds.filter(id => !alreadyNotified.has(id))
            if (dedupedIds.length > 0) {
                logger.info('notifications', `Announcement to ${dedupedIds.length} specific users (${specificUserIds.length - dedupedIds.length} deduped)`)
                await broadcastNotification({ ...broadcastOpts, targetUserIds: dedupedIds })
            }
        }
    }
}



/** Call this when admin publishes new content (project, blog, video) */
export async function notifyContentPublish(
    contentTitle: string,
    contentType: string,
    link: string,
    status: string = 'completed',
    sponsorData?: { name: string; logoUrl?: string; description?: string } | null,
    notifyGroups: { subscribers?: boolean; members?: boolean; cast?: boolean } = { subscribers: true, members: true, cast: false },
    projectId?: string,
): Promise<void> {
    const titleEn = `New ${contentType}: ${contentTitle}`
    const messageEn = `We just published "${contentTitle}". Check it out!`

    // Pre-translate for non-English users
    const translationTimeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 10_000))
    const translations = await Promise.race([
        translateContent({ title: titleEn, message: messageEn }, 'all').catch(() => null),
        translationTimeout,
    ])

    const broadcastOpts = {
        type: 'content_publish' as const,
        preferenceKey: 'contentPublish' as const,
        title: titleEn,
        message: messageEn,
        link,
        emailSubject: `✨ New ${contentType}: ${contentTitle} | AIM Studio`,
        emailHtml: contentPublishEmail(contentTitle, contentType, link, 'en', status, sponsorData),
        translations,
        contentStatus: status,
        sponsorData,
    }

    // ── Registered members ─────────────────────────────────────────────────────
    if (notifyGroups.members === true) {
        await broadcastNotification(broadcastOpts)
    }

    // ── Newsletter subscribers (non-registered) ────────────────────────────────
    if (notifyGroups.subscribers === true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const registeredEmails = await db.user.findMany({ select: { email: true } })
            .then((rows: { email: string }[]) => new Set(rows.map((r: { email: string }) => r.email.toLowerCase())))

        const subscribers = await db.subscriber.findMany({
            where: { active: true },
            select: { email: true, name: true },
        })

        const uniqueSubs = subscribers.filter((s: { email: string }) => !registeredEmails.has(s.email.toLowerCase()))
        logger.info('notifications', `Publishing to ${uniqueSubs.length} newsletter subscribers`)

        const BATCH = 50
        for (let i = 0; i < uniqueSubs.length; i += BATCH) {
            const batch = uniqueSubs.slice(i, i + BATCH)
            await Promise.allSettled(batch.map(async (sub: { email: string; name: string | null }) => {
                const unsubUrl = buildUnsubscribeUrl(link.split('/').slice(0, 3).join('/'), sub.email, 'subscriber')
                const html = contentPublishEmail(contentTitle, contentType, link, 'en', status, sponsorData, unsubUrl)
                const sent = await sendEmail({
                    to: sub.email,
                    subject: `✨ New ${contentType}: ${contentTitle} | AIM Studio`,
                    html,
                })
                if (!sent) logger.warn('notifications', `Subscriber email failed: ${sub.email}`)
            }))
        }
    }

    // ── Cast members (applicants of this specific project) ────────────────────
    if (notifyGroups.cast && projectId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        // Find users who applied to casting calls on this project
        const castApplicants = await db.application.findMany({
            where: {
                castingCall: { projectId },
                userId: { not: null },
            },
            select: { userId: true },
            distinct: ['userId'],
        })
        const castUserIds = castApplicants.map((a: { userId: string }) => a.userId).filter(Boolean)
        if (castUserIds.length > 0) {
            logger.info('notifications', `Publishing to ${castUserIds.length} cast applicants for project ${projectId}`)
            await broadcastNotification({ ...broadcastOpts, targetUserIds: castUserIds })
        }
    }
}

// ─── Auto-advance logic ───────────────────────────────────────────────────────

export async function getAutoAdvanceStatus(
    currentStatus: string,
    aiScore: number
): Promise<'shortlisted' | 'not_selected' | 'under_review' | null> {
    const settings = await prisma.siteSettings.findFirst()
    if (!settings?.pipelineAutoAdvance) return null

    const shortlistThreshold = settings.autoShortlistThreshold ?? 75
    const rejectThreshold = settings.autoRejectThreshold ?? 25

    const autoAdvanceFrom = ['submitted', 'under_review']
    if (!autoAdvanceFrom.includes(currentStatus)) return null

    if (aiScore >= shortlistThreshold) return 'shortlisted'
    if (aiScore <= rejectThreshold) return 'not_selected'
    return 'under_review'
}

// ─── Status email templates ───────────────────────────────────────────────────

const STATUS_EMAIL_TEMPLATES: Record<string, { subject: string; heading: string; body: string; emoji: string }> = {
    // 'submitted' and 'under_review' are intentionally excluded:
    // the applicant already got a confirmation on submission.
    // Moving to "under review" is a silent internal admin action.
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

function buildPlainHtml(title: string, message: string, link?: string, locale: string = 'en'): string {
    const viewNow = t('genericNotif', locale, 'viewNow') || 'View Now'
    return `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;">
            <h2 style="color:#d4a853;margin-bottom:8px;">${title}</h2>
            <p style="color:#ccc;font-size:15px;line-height:1.6;">${message}</p>
            ${link ? `<a href="${link}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#d4a853;color:#000;border-radius:6px;text-decoration:none;font-weight:600;">${viewNow}</a>` : ''}
        </div>
    `.trim()
}


// ─── Script Submission Status Change ──────────────────────────────────────────

interface ScriptStatusChangeOptions {
    submissionId: string
    recipientEmail: string
    recipientName: string
    scriptTitle: string
    callTitle: string
    newStatus: string
    statusNote?: string | null
}

/**
 * Send email + in-app notification when admin changes a script submission status.
 * Mirrors the casting flow's notifyApplicantStatusChange().
 */
export async function notifyScriptStatusChange(opts: ScriptStatusChangeOptions): Promise<void> {
    // Only notify on meaningful status changes
    const notifyStatuses = ['shortlisted', 'selected', 'rejected']
    if (!notifyStatuses.includes(opts.newStatus)) return

    try {
        const settings = await prisma.siteSettings.findFirst({
            select: { notifyApplicantOnStatusChange: true, siteName: true },
        })
        // Respect global toggle (reuses casting toggle — same intent)
        if (settings && !settings.notifyApplicantOnStatusChange) return

        const siteName = settings?.siteName || 'AIM Studio'
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || ''

        // Resolve locale — script submissions store authorEmail but not userId,
        // so look up user by email if they have an account
        let locale = 'en'
        let userId: string | null = null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userRecord = await (prisma as any).user.findUnique({
            where: { email: opts.recipientEmail },
            select: { id: true, preferredLanguage: true, receiveLocalizedEmails: true },
        }).catch(() => null)

        if (userRecord) {
            userId = userRecord.id
            if (userRecord.receiveLocalizedEmails !== false && userRecord.preferredLanguage) {
                locale = userRecord.preferredLanguage
            }
        }

        // Map status → i18n key
        const i18nKeyMap: Record<string, string> = {
            shortlisted: 'scriptStatus_shortlisted',
            selected:    'scriptStatus_selected',
            rejected:    'scriptStatus_rejected',
        }
        const i18nKey = i18nKeyMap[opts.newStatus] || 'scriptStatus_rejected'

        // Build subject and in-app strings
        const subject = `${siteName} — ` + (t(i18nKey, locale, 'subject') || 'Script Submission Update').replace('{title}', opts.scriptTitle).replace('{call}', opts.callTitle)
        const inAppTitle   = (t(i18nKey, locale, 'notifTitle')   || 'Script Update').replace('{title}', opts.scriptTitle)
        const inAppMessage = (t(i18nKey, locale, 'notifMessage') || 'Your screenplay submission has been updated.').replace('{title}', opts.scriptTitle).replace('{call}', opts.callTitle)

        // Render email HTML
        const html = scriptStatusUpdateEmail(
            opts.recipientName,
            opts.scriptTitle,
            opts.newStatus,
            opts.callTitle,
            opts.statusNote || undefined,
            siteUrl,
            locale,
        )

        // Send email
        const sent = await sendEmail({ to: opts.recipientEmail, subject, html })

        // In-app notification if user has an account
        if (userId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).userNotification.create({
                data: {
                    userId,
                    type: 'status_change',
                    title: inAppTitle,
                    message: inAppMessage,
                    link: '/scripts',
                },
            }).catch(() => {})
        }

        logger.info('notifications', `${sent ? '📧' : '❌'} Script status notification ${sent ? 'sent' : 'failed'} → ${opts.recipientEmail} (status: ${opts.newStatus}, locale: ${locale})`)
    } catch (err) {
        logger.error('notifications', 'notifyScriptStatusChange failed', { error: err })
    }
}
