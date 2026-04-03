import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runAuditionAgent } from '@/lib/agents/audition-agent'
import { getAutoAdvanceStatus, notifyApplicantStatusChange } from '@/lib/notifications'
import { aiLimiter } from '@/lib/rate-limit'

/**
 * POST /api/admin/applications/batch-audit
 *
 * Processes multiple applications through AI audition sequentially
 * with built-in pacing to avoid API rate limits.
 *
 * Body: { applicationIds: string[], delaySeconds?: number }
 *
 * Returns an NDJSON stream — one JSON line per application as it completes,
 * plus a final `{"type":"eof","summary":{...}}` line.
 */
export async function POST(request: NextRequest) {
    const blocked = aiLimiter.check(request)
    if (blocked) return blocked

    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }


    const body = await request.json()
    const { applicationIds, delaySeconds = 8 } = body as {
        applicationIds: string[]
        delaySeconds?: number
    }

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        return NextResponse.json({ error: 'No application IDs provided' }, { status: 400 })
    }

    // Cap batch size to prevent abuse
    const MAX_BATCH = 200
    const ids = applicationIds.slice(0, MAX_BATCH)

    // Fetch all applications
    const applications = await prisma.application.findMany({
        where: { id: { in: ids } },
        include: {
            castingCall: {
                include: { project: true },
            },
        },
    })

    if (applications.length === 0) {
        return NextResponse.json({ error: 'No valid applications found' }, { status: 404 })
    }

    // Admin-configurable reveal delay (default 6 hours)
    const settings = await prisma.siteSettings.findFirst().catch(() => null)
    const REVEAL_DELAY_HOURS = (settings as any)?.resultRevealDelayHours ?? 6
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (obj: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
            }

            let successCount = 0
            let skippedCount = 0
            let errorCount = 0

            for (let i = 0; i < applications.length; i++) {
                const app = applications[i]

                // Skip if already audited
                if (app.aiScore !== null && app.aiReport) {
                    skippedCount++
                    emit({
                        type: 'result',
                        id: app.id,
                        fullName: app.fullName,
                        status: 'skipped',
                        aiScore: app.aiScore,
                        index: i + 1,
                        total: applications.length,
                    })
                    continue
                }

                // Pace: wait between calls (except first)
                if (i > 0) {
                    const delay = Math.max(3, Math.min(30, delaySeconds))
                    await new Promise(r => setTimeout(r, delay * 1000))
                }

                try {
                    // Parse experience
                    let experienceData = {
                        text: '', specialSkills: '',
                        personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' }
                    }
                    try { experienceData = JSON.parse(app.experience) }
                    catch { experienceData = { text: app.experience, specialSkills: '', personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' } } }

                    // Parse photos
                    let photoUrls: string[] = []
                    if (app.headshotPath) {
                        try { photoUrls = JSON.parse(app.headshotPath) } catch { /* */ }
                    }

                    // Run audit
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
                        locale: (app as Record<string, unknown>).locale as string || 'en',
                    })

                    // Determine new status
                    let newStatus = app.status
                    const autoStatus = await getAutoAdvanceStatus(app.status, report.overallScore)
                    if (autoStatus) {
                        newStatus = autoStatus as import('@prisma/client').ApplicationStatus
                    } else if (app.status === 'submitted') {
                        newStatus = 'under_review' as import('@prisma/client').ApplicationStatus
                    }

                    const resultVisibleAt = new Date(Date.now() + REVEAL_DELAY_HOURS * 60 * 60 * 1000)

                    // Update application
                    await prisma.application.update({
                        where: { id: app.id },
                        data: {
                            aiScore: report.overallScore,
                            aiFitLevel: report.recommendation,
                            aiReport: JSON.stringify(report),
                            statusNote: report.applicantFeedback || '',
                            status: newStatus,
                            reviewedAt: new Date(),
                            resultVisibleAt,
                            photoScreeningStatus: report.screeningSkipped ? 'skipped' : 'completed',
                        } as any,
                    })

                    // Send notification if status changed
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
                        }).catch(err => console.error('Notification error:', err))
                    }

                    successCount++
                    emit({
                        type: 'result',
                        id: app.id,
                        fullName: app.fullName,
                        status: 'success',
                        aiScore: report.overallScore,
                        recommendation: report.recommendation,
                        screeningSkipped: report.screeningSkipped || false,
                        newStatus,
                        index: i + 1,
                        total: applications.length,
                    })

                    console.log(`[Batch Audit] ✓ ${i + 1}/${applications.length} — ${app.fullName}: ${report.overallScore}/100 (${report.recommendation})`)
                } catch (error) {
                    const errMsg = error instanceof Error ? error.message : String(error)
                    errorCount++
                    emit({
                        type: 'result',
                        id: app.id,
                        fullName: app.fullName,
                        status: 'error',
                        error: errMsg,
                        index: i + 1,
                        total: applications.length,
                    })
                    console.error(`[Batch Audit] ✗ ${i + 1}/${applications.length} — ${app.fullName}: ${errMsg}`)
                }
            }

            // Final EOF line with summary
            emit({
                type: 'eof',
                summary: {
                    total: applications.length,
                    success: successCount,
                    skipped: skippedCount,
                    errors: errorCount,
                },
            })

            controller.close()
        },
    })

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-cache',
        },
    })
}
