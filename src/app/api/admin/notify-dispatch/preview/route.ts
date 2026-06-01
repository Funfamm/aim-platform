/**
 * Phase 3 — Notify Me Dispatch Preview (Read-Only)
 * ─────────────────────────────────────────────────
 * GET /api/admin/notify-dispatch/preview?signupTag=xxx
 *
 * Returns audience analysis for a signupTag without any mutations.
 * Admin-only. Zero writes. Zero emails. Zero notifications.
 *
 * Supports all source types dynamically: casting, training, scripts,
 * work/end-card CTAs (any video/project), footer, subscribe, general.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { isEmailSuppressed } from '@/lib/suppression'
import { getDispatchSubject } from '@/lib/email-templates'
import { t as emailT } from '@/lib/email-i18n'

// ── Resolve readable label for signupTag ─────────────────────────────────────
// Returns a human-friendly label. For end-card CTAs, resolves project title
// via CtaConfiguration → Project. Falls back to formatted tag string.
async function getReadableLabel(tag: string): Promise<string> {
    const labels: Record<string, string> = {
        footer_cta: 'Footer Newsletter',
        subscribe_general: 'Subscribe Page',
        casting_general: 'Casting Updates',
        training_general: 'Training Updates',
        scripts_general: 'Scripts Updates',
    }
    if (labels[tag]) return labels[tag]
    if (tag.startsWith('scripts_')) return `Script Call: ${tag.replace('scripts_', '')}`

    // For end-card CTA signupTags: resolve via CtaConfiguration → Project
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctaConfig = await (prisma as any).ctaConfiguration.findFirst({
            where: { signupTag: tag },
            select: {
                notificationType: true,
                videoId: true,
                project: { select: { title: true } },
            },
        })
        if (ctaConfig?.project?.title) {
            const typeLabel = ctaConfig.notificationType === 'release' ? 'Release CTA'
                : ctaConfig.notificationType === 'more' ? 'More Updates CTA'
                : 'CTA'
            return `${ctaConfig.project.title} — ${typeLabel}`
        }
    } catch { /* non-critical — fall through */ }

    // Final fallback: format the raw tag
    return tag
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
}

// ── Resolve project title for work-type signupTags ───────────────────────────
// Checks CtaConfiguration first, then falls back to sourceEntityId on records.
async function resolveWorkTitle(
    tag: string,
    records: { sourceEntityId: string | null }[],
): Promise<string | undefined> {
    // Strategy 1: Resolve via CtaConfiguration → Project
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctaConfig = await (prisma as any).ctaConfiguration.findFirst({
            where: { signupTag: tag },
            select: { project: { select: { title: true } } },
        })
        if (ctaConfig?.project?.title) return ctaConfig.project.title
    } catch { /* non-critical */ }

    // Strategy 2: Resolve via sourceEntityId on records
    const entityIds = [...new Set(
        records.map(r => r.sourceEntityId).filter(Boolean) as string[]
    )]
    if (entityIds.length > 0) {
        try {
            const project = await prisma.project.findFirst({
                where: { id: { in: entityIds } },
                select: { title: true },
            })
            if (project?.title) return project.title
        } catch { /* non-critical */ }
    }

    return undefined
}

// ── Infer sourceType from signupTag + records ────────────────────────────────
async function inferSourceType(
    tag: string,
    records: { sourceType: string | null }[],
): Promise<string> {
    // Priority 1: Records have explicit sourceType — use most common
    const types = records.map(r => r.sourceType).filter(Boolean)
    if (types.length > 0) {
        const counts: Record<string, number> = {}
        types.forEach(t => { counts[t!] = (counts[t!] || 0) + 1 })
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    }

    // Priority 2: Known prefix patterns
    if (tag.startsWith('casting')) return 'casting'
    if (tag.startsWith('training')) return 'training'
    if (tag.startsWith('scripts')) return 'scripts'

    // Priority 3: Check if this tag belongs to a CtaConfiguration (end-card CTA)
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctaConfig = await (prisma as any).ctaConfiguration.findFirst({
            where: { signupTag: tag },
            select: { id: true },
        })
        if (ctaConfig) return 'work'
    } catch { /* non-critical */ }

    return 'general'
}

export async function GET(request: Request) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const signupTag = searchParams.get('signupTag')
    if (!signupTag) {
        return NextResponse.json({ error: 'signupTag is required' }, { status: 400 })
    }

    try {
        // ── Query all records for this tag ────────────────────────────────────
        const allRecords = await prisma.notificationSignup.findMany({
            where: { signupTag },
            select: {
                id: true,
                email: true,
                status: true,
                notifiedAt: true,
                finalNoticeSentAt: true,
                language: true,
                requestedBy: true,
                sourceType: true,
                sourceEntityId: true,
                userId: true,
            },
        })

        // ── Separate eligible vs already notified ─────────────────────────────
        const alreadyNotified = allRecords.filter(r =>
            r.status === 'notified' || r.notifiedAt !== null || r.finalNoticeSentAt !== null
        )
        const activeRecords = allRecords.filter(r =>
            r.status === 'active' && r.notifiedAt === null && r.finalNoticeSentAt === null
        )
        const nonActiveRecords = allRecords.filter(r =>
            r.status !== 'active' && r.status !== 'notified'
        )

        // ── Deduplicate by email ──────────────────────────────────────────────
        const seenEmails = new Set<string>()
        const uniqueRecords: typeof activeRecords = []
        let duplicateEmailCount = 0

        for (const r of activeRecords) {
            const emailKey = r.email.toLowerCase().trim()
            if (seenEmails.has(emailKey)) {
                duplicateEmailCount++
                continue
            }
            seenEmails.add(emailKey)
            uniqueRecords.push(r)
        }

        // ── Suppression check (read-only) ─────────────────────────────────────
        let suppressedCount = 0
        const eligible: typeof uniqueRecords = []

        for (const r of uniqueRecords) {
            const reason = await isEmailSuppressed(r.email)
            if (reason) {
                suppressedCount++
            } else {
                eligible.push(r)
            }
        }

        // ── Breakdowns ────────────────────────────────────────────────────────
        const languageBreakdown: Record<string, number> = {}
        const requestedByBreakdown: Record<string, number> = {}
        const sourceTypeBreakdown: Record<string, number> = {}
        let inAppCount = 0

        for (const r of eligible) {
            const lang = r.language || 'en'
            languageBreakdown[lang] = (languageBreakdown[lang] || 0) + 1

            const reqBy = r.requestedBy || 'unknown'
            requestedByBreakdown[reqBy] = (requestedByBreakdown[reqBy] || 0) + 1

            const srcType = r.sourceType || 'general'
            sourceTypeBreakdown[srcType] = (sourceTypeBreakdown[srcType] || 0) + 1

            if (r.userId) inAppCount++
        }

        // ── Resolve source type and project title ─────────────────────────────
        const sampleSourceType = await inferSourceType(signupTag, eligible)
        const workTitle = await resolveWorkTitle(signupTag, allRecords)

        // ── Sample subject/body (with {title} substituted) ────────────────────
        const sampleSubject = getDispatchSubject(sampleSourceType, 'en', workTitle)
        let sampleBody = emailT('notify_dispatch', 'en', `body_${sampleSourceType}`)
            || 'You asked to be notified about AIM Studio updates. A new update is now available.'
        if (workTitle) {
            sampleBody = sampleBody.replace('{title}', workTitle)
        }

        // ── Resolve readable label ────────────────────────────────────────────
        const label = await getReadableLabel(signupTag)

        return NextResponse.json({
            signupTag,
            label,
            sourceType: sampleSourceType,
            workTitle: workTitle || null,
            totalEligible: eligible.length,
            totalSkipped: alreadyNotified.length + suppressedCount + duplicateEmailCount + nonActiveRecords.length,
            alreadyNotifiedCount: alreadyNotified.length,
            suppressedCount,
            duplicateEmailCount,
            nonActiveCount: nonActiveRecords.length,
            languageBreakdown,
            requestedByBreakdown,
            sourceTypeBreakdown,
            inAppCount,
            sampleSubject,
            sampleBody,
            warning: 'This will send emails to real users.',
        })
    } catch (err) {
        console.error('[DISPATCH-PREVIEW] Error:', err)
        return NextResponse.json({ error: 'Failed to load preview' }, { status: 500 })
    }
}
