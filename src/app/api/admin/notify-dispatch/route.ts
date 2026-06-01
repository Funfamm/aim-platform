/**
 * Phase 3 — Notify Me Dispatch Send
 * ──────────────────────────────────
 * POST /api/admin/notify-dispatch
 *
 * Sends availability notice to eligible Notify Me audience.
 * Admin-only. Requires confirmed=true. Supports dryRun=true.
 *
 * Safety:
 *  - Re-queries audience server-side (never trusts client counts)
 *  - Re-checks suppression before each email
 *  - Deduplicates by lowercase email
 *  - Skips already-notified records
 *  - Per-recipient error handling (one failure doesn't stop others)
 *  - Updates records only after queue acceptance
 *  - Does NOT update confirmationSentAt or confirmationInAppAt
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { isEmailSuppressed } from '@/lib/suppression'
import { sendBulkEmail } from '@/lib/email-router'
import { notifyMeDispatchEmail, getDispatchSubject } from '@/lib/email-templates'
import { emailStrings } from '@/lib/email-i18n'
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token'
import { logger } from '@/lib/logger'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'

// ── Resolve source link (verified routes only) ──────────────────────────────
function resolveSourceLink(
    sourceType: string | null,
    sourceEntityId: string | null,
    locale: string,
    slugMap: Map<string, string>,
): string {
    const l = locale || 'en'
    switch (sourceType) {
        case 'casting':
            // NO detail page exists — always link to list
            return `${SITE_URL}/${l}/casting`
        case 'training': {
            const slug = sourceEntityId ? slugMap.get(`course:${sourceEntityId}`) : null
            return slug ? `${SITE_URL}/${l}/training/${slug}` : `${SITE_URL}/${l}/training`
        }
        case 'scripts':
            return sourceEntityId
                ? `${SITE_URL}/${l}/scripts/${sourceEntityId}`
                : `${SITE_URL}/${l}/scripts`
        case 'work': {
            const slug = sourceEntityId ? slugMap.get(`project:${sourceEntityId}`) : null
            return slug ? `${SITE_URL}/${l}/works/${slug}` : `${SITE_URL}/${l}/works`
        }
        default:
            return `${SITE_URL}/${l}`
    }
}

// ── Resolve recipient language ───────────────────────────────────────────────
async function resolveLanguage(
    record: { userId: string | null; language: string; email: string },
): Promise<string> {
    // For members: check user.preferredLanguage
    if (record.userId) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const user = await (prisma as any).user.findUnique({
                where: { id: record.userId },
                select: { preferredLanguage: true, receiveLocalizedEmails: true },
            })
            if (user?.receiveLocalizedEmails !== false && user?.preferredLanguage) {
                return user.preferredLanguage
            }
        } catch { /* fall through */ }
    }

    // For all: use signup language
    if (record.language) return record.language

    // For subscribers: check locale
    try {
        const sub = await prisma.subscriber.findFirst({
            where: { email: record.email.toLowerCase().trim() },
            select: { locale: true },
        })
        if (sub?.locale) return sub.locale
    } catch { /* fall through */ }

    return 'en'
}

// ── Infer sourceType from signupTag ──────────────────────────────────────────
function inferSourceType(tag: string): string {
    if (tag.startsWith('casting')) return 'casting'
    if (tag.startsWith('training')) return 'training'
    if (tag.startsWith('scripts')) return 'scripts'
    return 'general'
}

export async function POST(request: Request) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    let admin: { userId: string; email: string }
    try {
        admin = await requireAdmin() as { userId: string; email: string }
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: {
        signupTag: string
        message?: string
        sourceType?: string
        sourceEntityId?: string
        dryRun?: boolean
        confirmed?: boolean
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { signupTag, message, dryRun, confirmed } = body
    if (!signupTag) {
        return NextResponse.json({ error: 'signupTag is required' }, { status: 400 })
    }
    if (!dryRun && !confirmed) {
        return NextResponse.json({ error: 'confirmed=true is required to send' }, { status: 400 })
    }

    const dispatchId = `dispatch_${Date.now()}_${signupTag}`

    try {
        // ── Query eligible records (server-side, never trust client) ──────────
        const records = await prisma.notificationSignup.findMany({
            where: {
                signupTag,
                status: 'active',
                notifiedAt: null,
                finalNoticeSentAt: null,
            },
            select: {
                id: true,
                email: true,
                language: true,
                userId: true,
                requestedBy: true,
                sourceType: true,
                sourceEntityId: true,
            },
        })

        if (records.length === 0) {
            return NextResponse.json({
                dispatchId,
                signupTag,
                sentCount: 0,
                skippedCount: 0,
                failedCount: 0,
                suppressedCount: 0,
                duplicateCount: 0,
                alreadyNotifiedCount: 0,
                unsupportedLanguages: [],
                languageBreakdown: {},
                inAppCreated: 0,
                dryRun: !!dryRun,
                message: 'No eligible records found.',
            })
        }

        // ── Deduplicate by email ──────────────────────────────────────────────
        const seenEmails = new Set<string>()
        const uniqueRecords: typeof records = []
        let duplicateCount = 0

        for (const r of records) {
            const emailKey = r.email.toLowerCase().trim()
            if (seenEmails.has(emailKey)) {
                duplicateCount++
                continue
            }
            seenEmails.add(emailKey)
            uniqueRecords.push(r)
        }

        // ── Pre-batch: resolve slugs for training/work links ─────────────────
        const slugMap = new Map<string, string>()
        const courseIds = [...new Set(uniqueRecords
            .filter(r => r.sourceType === 'training' && r.sourceEntityId)
            .map(r => r.sourceEntityId!))]
        const projectIds = [...new Set(uniqueRecords
            .filter(r => r.sourceType === 'work' && r.sourceEntityId)
            .map(r => r.sourceEntityId!))]

        if (courseIds.length > 0) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const courses = await (prisma as any).course.findMany({
                    where: { id: { in: courseIds } },
                    select: { id: true, slug: true },
                })
                for (const c of courses) {
                    if (c.slug) slugMap.set(`course:${c.id}`, c.slug)
                }
            } catch { /* non-critical */ }
        }
        if (projectIds.length > 0) {
            try {
                const projects = await prisma.project.findMany({
                    where: { id: { in: projectIds } },
                    select: { id: true, slug: true },
                })
                for (const p of projects) {
                    if (p.slug) slugMap.set(`project:${p.id}`, p.slug)
                }
            } catch { /* non-critical */ }
        }

        // ── Resolve project title for work-type emails ───────────────────────
        let workTitle: string | undefined
        if (projectIds.length > 0) {
            try {
                const project = await prisma.project.findFirst({
                    where: { id: projectIds[0] },
                    select: { title: true },
                })
                workTitle = project?.title || undefined
            } catch { /* non-critical */ }
        }

        // ── Dispatch loop ─────────────────────────────────────────────────────
        let sentCount = 0
        let failedCount = 0
        let suppressedCount = 0
        let inAppCreated = 0
        const languageBreakdown: Record<string, number> = {}
        const unsupportedLanguages: string[] = []
        const adminMessage = message || ''

        for (const record of uniqueRecords) {
            try {
                // 1. Re-check suppression
                const suppressReason = await isEmailSuppressed(record.email)
                if (suppressReason) {
                    suppressedCount++
                    continue
                }

                // 2. Resolve language
                const locale = await resolveLanguage(record)
                languageBreakdown[locale] = (languageBreakdown[locale] || 0) + 1

                // Check if template exists for this locale
                if (!emailStrings['notify_dispatch']?.[locale]) {
                    if (!unsupportedLanguages.includes(locale)) {
                        unsupportedLanguages.push(locale)
                    }
                    // Fallback to English — do not skip
                }

                // 3. Resolve sourceType and link
                const sourceType = record.sourceType || inferSourceType(signupTag)
                const actionUrl = resolveSourceLink(sourceType, record.sourceEntityId, locale, slugMap)

                // 4. Build unsubscribe URL
                const unsubType = record.userId ? 'member' : 'subscriber'
                const unsubscribeUrl = buildUnsubscribeUrl(SITE_URL, record.email, unsubType as 'subscriber' | 'member')

                // 5. Build email
                const subject = getDispatchSubject(sourceType, locale, workTitle)
                const html = notifyMeDispatchEmail(sourceType, adminMessage, actionUrl, unsubscribeUrl, locale, workTitle)

                // ── DRY RUN: skip sending ────────────────────────────────────
                if (dryRun) {
                    sentCount++
                    continue
                }

                // 6. Send via bulk queue
                const queueResult = await sendBulkEmail({
                    to: record.email,
                    subject,
                    html,
                    type: 'notify_dispatch',
                })

                // 7. Handle queue result
                if (queueResult === 'suppressed') {
                    suppressedCount++
                    continue
                }

                // Queue accepted (cuid ID or 'fallback-immediate') → mark notified
                // 8. Update NotificationSignup with race-condition guard
                await prisma.notificationSignup.updateMany({
                    where: {
                        id: record.id,
                        status: 'active',
                        notifiedAt: null,
                        finalNoticeSentAt: null,
                    },
                    data: {
                        notifiedAt: new Date(),
                        finalNoticeSentAt: new Date(),
                        status: 'notified',
                    },
                })

                // 9. Create in-app notification for members only
                if (record.userId) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (prisma as any).userNotification.create({
                            data: {
                                userId: record.userId,
                                type: 'system',
                                title: subject,
                                message: adminMessage || (
                                    emailStrings['notify_dispatch']?.[locale]?.[`body_${sourceType}`]
                                    || emailStrings['notify_dispatch']?.['en']?.[`body_${sourceType}`]
                                    || 'A new update is now available.'
                                ),
                                link: actionUrl,
                                eventId: `notifyme_${signupTag}_${record.id}`,
                            },
                        })
                        inAppCreated++
                    } catch (inAppErr) {
                        // Duplicate eventId or other error — non-fatal
                        logger.warn('dispatch', `In-app notification failed for ${record.userId}`, { error: inAppErr })
                    }
                }

                sentCount++
            } catch (recipientErr) {
                // Per-recipient failure — continue to next
                failedCount++
                logger.error('dispatch', `Dispatch failed for record ${record.id}`, { error: recipientErr })
            }
        }

        // ── Audit log ─────────────────────────────────────────────────────────
        logger.info('dispatch', `[DISPATCH] id=${dispatchId} tag=${signupTag} admin=${admin.email || admin.userId} eligible=${uniqueRecords.length} sent=${sentCount} skipped=${suppressedCount + duplicateCount} failed=${failedCount} inApp=${inAppCreated} dryRun=${!!dryRun} languages=${JSON.stringify(languageBreakdown)} at=${new Date().toISOString()}`)

        return NextResponse.json({
            dispatchId,
            signupTag,
            sentCount,
            skippedCount: suppressedCount + duplicateCount,
            failedCount,
            suppressedCount,
            duplicateCount,
            alreadyNotifiedCount: 0, // pre-filtered in WHERE clause
            unsupportedLanguages,
            languageBreakdown,
            inAppCreated,
            dryRun: !!dryRun,
        })
    } catch (err) {
        logger.error('dispatch', `[DISPATCH] Fatal error for ${signupTag}`, { error: err })
        return NextResponse.json({ error: 'Dispatch failed' }, { status: 500 })
    }
}
