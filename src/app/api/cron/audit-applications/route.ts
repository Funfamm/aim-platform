import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runAuditionAgent } from '@/lib/agents/audition-agent'
import { getAutoAdvanceStatus, notifyApplicantStatusChange } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — cron jobs can process multiple applications

/**
 * GET /api/cron/audit-applications
 *
 * Called by Vercel Cron every hour (see vercel.json).
 * Picks up applications whose `scheduledAuditAt` is in the past
 * and haven't been audited yet (aiScore is null), then runs the AI audit
 * on each with pacing to avoid AI rate limits.
 *
 * Security: Vercel sets Authorization: Bearer <CRON_SECRET> on each invocation.
 * Set CRON_SECRET in the Vercel dashboard to prevent public triggering.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Raw query — scheduledAuditAt won't exist in Prisma types until migration runs
    // Using $queryRaw to safely read the new column regardless of type-gen state
    const due = await (prisma.application as any).findMany({
        where: {
            scheduledAuditAt: { lte: now },
            aiScore: null,
            aiReport: null,
        },
        include: {
            castingCall: {
                include: { project: true },
            },
        },
        orderBy: { scheduledAuditAt: 'asc' },
        take: 20,
    }) as Array<Record<string, any>>

    if (due.length === 0) {
        return NextResponse.json({ message: 'No applications due for audit', processed: 0 })
    }

    console.log(`[Cron/Audit] Found ${due.length} application(s) due for audit`)

    const settings = await prisma.siteSettings.findFirst().catch(() => null)
    const REVEAL_DELAY_HOURS = (settings as any)?.resultRevealDelayHours ?? 6
    const PACE_MS = 8_000 // 8s between AI calls

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < due.length; i++) {
        const app = due[i]

        if (i > 0) {
            await new Promise(r => setTimeout(r, PACE_MS))
        }

        try {
            let experienceData = {
                text: '',
                specialSkills: '',
                personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' },
            }
            try { experienceData = JSON.parse(app.experience) } catch {
                experienceData.text = app.experience
            }

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

            let newStatus = app.status
            const autoStatus = await getAutoAdvanceStatus(app.status, report.overallScore)
            if (autoStatus) {
                newStatus = autoStatus
            } else if (app.status === 'submitted') {
                newStatus = 'under_review'
            }

            const resultVisibleAt = new Date(Date.now() + REVEAL_DELAY_HOURS * 60 * 60 * 1000)

            await (prisma.application as any).update({
                where: { id: app.id },
                data: {
                    aiScore: report.overallScore,
                    aiFitLevel: report.recommendation,
                    aiReport: JSON.stringify(report),
                    statusNote: report.applicantFeedback || '',
                    status: newStatus,
                    reviewedAt: new Date(),
                    resultVisibleAt,
                    scheduledAuditAt: null, // clear so it won't re-run
                    photoScreeningStatus: report.screeningSkipped ? 'skipped' : 'completed',
                },
            })

            if (newStatus !== app.status) {
                notifyApplicantStatusChange({
                    applicationId: app.id,
                    recipientEmail: app.email,
                    recipientName: app.fullName,
                    newStatus,
                    roleName: app.castingCall.roleName,
                    projectTitle: app.castingCall.project.title,
                    aiScore: report.overallScore,
                    statusNote: report.applicantFeedback,
                }).catch(err => console.error('[Cron/Audit] Notification error:', err))
            }

            successCount++
            console.log(`[Cron/Audit] ✓ ${app.fullName} — ${report.overallScore}/100 (${report.recommendation})`)
        } catch (err) {
            errorCount++
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[Cron/Audit] ✗ ${app.fullName} (${app.id}): ${msg}`)

            // Clear scheduledAuditAt to avoid re-queuing broken records indefinitely
            await (prisma.application as any).update({
                where: { id: app.id },
                data: { scheduledAuditAt: null },
            }).catch(() => null)
        }
    }

    return NextResponse.json({
        message: 'Cron audit complete',
        processed: due.length,
        success: successCount,
        errors: errorCount,
    })
}
