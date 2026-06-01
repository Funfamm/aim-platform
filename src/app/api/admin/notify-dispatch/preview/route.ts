/**
 * Phase 3 — Notify Me Dispatch Preview (Read-Only)
 * ─────────────────────────────────────────────────
 * GET /api/admin/notify-dispatch/preview?signupTag=xxx
 *
 * Returns audience analysis for a signupTag without any mutations.
 * Admin-only. Zero writes. Zero emails. Zero notifications.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { isEmailSuppressed } from '@/lib/suppression'
import { getDispatchSubject } from '@/lib/email-templates'
import { t as emailT } from '@/lib/email-i18n'

// ── Readable labels for signupTags ───────────────────────────────────────────
function getReadableLabel(tag: string): string {
    const labels: Record<string, string> = {
        footer_cta: 'Footer Newsletter',
        subscribe_general: 'Subscribe Page',
        casting_general: 'Casting Updates',
        training_general: 'Training Updates',
    }
    if (labels[tag]) return labels[tag]
    if (tag.startsWith('scripts_')) return `Script Call: ${tag.replace('scripts_', '')}`
    return tag
}

// ── Infer sourceType from signupTag ──────────────────────────────────────────
function inferSourceType(tag: string, records: { sourceType: string | null }[]): string {
    // If records have explicit sourceType, use the most common one
    const types = records.map(r => r.sourceType).filter(Boolean)
    if (types.length > 0) {
        const counts: Record<string, number> = {}
        types.forEach(t => { counts[t!] = (counts[t!] || 0) + 1 })
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    }
    // Fallback: infer from tag
    if (tag.startsWith('casting')) return 'casting'
    if (tag.startsWith('training')) return 'training'
    if (tag.startsWith('scripts')) return 'scripts'
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

        // ── Sample subject/body ───────────────────────────────────────────────
        const sampleSourceType = inferSourceType(signupTag, eligible)
        const sampleSubject = getDispatchSubject(sampleSourceType, 'en')
        const sampleBody = emailT('notify_dispatch', 'en', `body_${sampleSourceType}`)
            || 'You asked to be notified about AIM Studio updates. A new update is now available.'

        return NextResponse.json({
            signupTag,
            label: getReadableLabel(signupTag),
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
