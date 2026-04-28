/**
 * POST /api/admin/email-suppression/import
 *
 * Bulk import email addresses into the suppression list.
 * Admin-only endpoint. Validates emails, skips duplicates, and creates
 * EmailSuppression records + deactivates matching subscribers.
 *
 * Body: { entries: [{ email: string, reason?: string }] }
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { suppressEmail } from '@/lib/suppression'
import { logAdminAction } from '@/lib/audit-log'
import { logger } from '@/lib/logger'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_IMPORT_SIZE = 5000
const VALID_REASONS = ['hard_bounce', 'soft_bounce', 'complaint', 'unsubscribe', 'manual'] as const

export async function POST(request: Request) {
    let session
    try { session = await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const entries: Array<{ email: string; reason?: string }> = body.entries

        if (!Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json({ error: 'entries array is required' }, { status: 400 })
        }

        if (entries.length > MAX_IMPORT_SIZE) {
            return NextResponse.json({
                error: `Maximum ${MAX_IMPORT_SIZE} entries per import`,
            }, { status: 400 })
        }

        // ── Validate + deduplicate ──────────────────────────────────────────
        const seen = new Set<string>()
        const valid: Array<{ email: string; reason: string }> = []
        const invalid: string[] = []

        for (const entry of entries) {
            if (!entry.email || typeof entry.email !== 'string') continue

            const email = entry.email.toLowerCase().trim()
            if (!EMAIL_REGEX.test(email)) {
                invalid.push(email)
                continue
            }
            if (seen.has(email)) continue
            seen.add(email)

            const reason = entry.reason && VALID_REASONS.includes(entry.reason as typeof VALID_REASONS[number])
                ? entry.reason
                : 'manual'

            valid.push({ email, reason })
        }

        // ── Check existing suppressions ─────────────────────────────────────
        const existingSuppressions = await prisma.emailSuppression.findMany({
            where: {
                email: { in: valid.map(v => v.email) },
                removedAt: null,
            },
            select: { email: true },
        })
        const existingSet = new Set(existingSuppressions.map(s => s.email))

        // ── Import new suppressions ─────────────────────────────────────────
        let imported = 0
        let skipped = 0

        for (const { email, reason } of valid) {
            if (existingSet.has(email)) {
                skipped++
                continue
            }

            try {
                await suppressEmail(email, reason as 'hard_bounce' | 'manual', `Bulk import by admin ${session.userId}`, 'admin')
                imported++
            } catch (err) {
                logger.error('suppression-import', `Failed to suppress ${email}`, { error: err as Error })
            }
        }

        // ── Audit log ───────────────────────────────────────────────────────
        logAdminAction({
            actor: session.userId,
            action: 'SUPPRESS_EMAIL',
            target: `bulk-import:${imported}`,
            details: { imported, skipped, invalid: invalid.length, message: `Bulk suppression import` },
        })

        logger.info('suppression-import', `Admin ${session.userId}: imported ${imported}, skipped ${skipped}, invalid ${invalid.length}`)

        return NextResponse.json({
            ok: true,
            imported,
            skipped,
            invalid: invalid.length,
            invalidEmails: invalid.slice(0, 20), // Show first 20 invalid for debugging
        })
    } catch (err) {
        logger.error('suppression-import', 'Import failed', { error: err as Error })
        return NextResponse.json({ error: 'Import failed' }, { status: 500 })
    }
}
