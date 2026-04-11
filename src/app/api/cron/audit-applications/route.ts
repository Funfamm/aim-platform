import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runAuditionAgent } from '@/lib/agents/audition-agent'
import { getAutoAdvanceStatus, notifyAuditResultRevealed } from '@/lib/notifications'
import {
    getNextBatch,
    markProcessing,
    markScoredHidden,
    markFailed,
    releaseStuck,
    getDueForReveal,
    markScoredVisible,
} from '@/lib/audit-queue'
import { resetExpiredWindows, getAvailableKey, consumeKey, cooldownKey } from '@/lib/key-quota'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — process as many as quota allows

/**
 * GET /api/cron/audit-applications
 *
 * Called by Vercel Cron once per day (see vercel.json: "0 0 * * *").
 * Hobby-plan compatible — no hourly cron required.
 *
 * Pass 1 — Score queued applications:
 *   1. Reset expired API-key quota windows.
 *   2. Release any stuck 'processing' jobs (crash recovery).
 *   3. While quota is available: pull next queued app → score → store as scored_hidden.
 *
 * Pass 2 — Reveal scored results:
 *   4. Find all scored_hidden apps whose resultVisibleAt ≤ now.
 *   5. Flip them to scored_visible and send notifications.
 *
 * Security: Vercel sets Authorization: Bearer <CRON_SECRET> on each invocation.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await prisma.siteSettings.findFirst().catch(() => null)
    const REVEAL_DELAY_HOURS = (settings as any)?.resultRevealDelayHours ?? 6
    const BATCH_SIZE: number = (settings as any)?.auditQueueBatchSize ?? 10

    // ── Pass 1: Score queued applications ──────────────────────────────────
    const resetCount = await resetExpiredWindows()
    const stuckCount = await releaseStuck()

    let scored = 0
    let skipped = 0
    let failed = 0

    const batch = await getNextBatch(BATCH_SIZE)

    for (const app of batch) {
        // Check quota before each call — stop if no key available
        const key = await getAvailableKey()
        if (!key) {
            console.log('[Cron/Audit] No API key quota available — stopping scoring pass')
            skipped = batch.length - scored - failed
            break
        }

        await markProcessing(app.id)

        try {
            // Parse experience data
            let experienceData = {
                text: '',
                specialSkills: '',
                personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' },
            }
            try { experienceData = JSON.parse(app.experience) } catch {
                experienceData.text = app.experience
            }

            // Parse photo URLs
            let photoUrls: string[] = []
            if (app.headshotPath) {
                try { photoUrls = JSON.parse(app.headshotPath) } catch { /* */ }
            }

            const report = await runAuditionAgent({
                applicant: {
                    fullName: app.fullName,
                    age: app.age,
                    gender: app.gender,
                    experience: experienceData.text,
                    specialSkills: app.specialSkills,
                    personality: experienceData.personality,
                    photoUrls,
                    voiceUrl: app.selfTapePath || undefined,
                },
                role: {
                    roleName: app.castingCall.roleName,
                    roleType: app.castingCall.roleType,
                    roleDescription: app.castingCall.roleDescription,
                    requirements: app.castingCall.requirements,
                    ageRange: app.castingCall.ageRange,
                    gender: app.castingCall.gender,
                    projectTitle: app.castingCall.project.title,
                },
                locale: app.locale || 'en',
            })

            // Determine pipeline status
            let newStatus = app.status
            const autoStatus = await getAutoAdvanceStatus(app.status, report.overallScore)
            if (autoStatus) {
                newStatus = autoStatus
            } else if (app.status === 'submitted') {
                newStatus = 'under_review'
            }

            // Store result privately — visible only after reveal delay
            await markScoredHidden(app.id, REVEAL_DELAY_HOURS, {
                aiScore: report.overallScore,
                aiFitLevel: report.recommendation,
                aiReport: JSON.stringify(report),
                statusNote: report.applicantFeedback || '',
                status: newStatus,
                reviewedAt: new Date(),
                photoScreeningStatus: report.screeningSkipped ? 'skipped' : 'completed',
                scheduledAuditAt: null, // clear legacy field
            })

            await consumeKey(key.id)
            scored++
            console.log(`[Cron/Audit] ✓ ${app.fullName} — ${report.overallScore}/100 (${report.recommendation})`)

        } catch (err) {
            failed++
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[Cron/Audit] ✗ ${app.fullName} (${app.id}): ${msg}`)

            // If the error looks like a quota/auth error from the AI provider, cooldown the key
            if (/quota|rate.limit|429|auth|api.?key/i.test(msg)) {
                await cooldownKey(key.id, 60)
            }
            await markFailed(app.id, msg)
        }
    }

    // ── Pass 2: Reveal results whose timer has expired ─────────────────────
    const dueForReveal = await getDueForReveal()
    let revealed = 0

    for (const app of dueForReveal) {
        await markScoredVisible(app.id)

        // Fire the dedicated reveal notification with localized email + in-app
        notifyAuditResultRevealed({
            applicationId: app.id,
            userId: app.user?.id ?? null,
            recipientEmail: app.email,
            recipientName: app.fullName,
            roleName: app.castingCall.roleName,
            projectTitle: app.castingCall.project.title,
            newStatus: app.status,
            aiScore: app.aiScore,
            statusNote: app.statusNote,
            locale: app.locale || 'en',
        }).catch(err => console.error('[Cron/Reveal] Notification error:', err))

        revealed++
        console.log(`[Cron/Reveal] ✓ Result released for ${app.fullName}`)
    }

    return NextResponse.json({
        message: 'Cron run complete',
        pass1: { scored, skipped, failed, batchSize: BATCH_SIZE },
        pass2: { revealed },
        maintenance: { resetWindows: resetCount, releasedStuck: stuckCount },
    })
}
