import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runAuditionAgent } from '@/lib/agents/audition-agent'
import { getAutoAdvanceStatus, notifyApplicantStatusChange } from '@/lib/notifications'

/**
 * POST /api/admin/applications/batch-audit
 * 
 * Processes multiple applications through AI audition sequentially
 * with built-in pacing to avoid API rate limits.
 * 
 * Body: { applicationIds: string[], delaySeconds?: number }
 * 
 * Returns a streaming JSON response with per-application results.
 */
export async function POST(request: NextRequest) {
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

    // Process sequentially with pacing
    const results: Array<{
        id: string
        fullName: string
        status: 'success' | 'error' | 'skipped'
        aiScore?: number
        recommendation?: string
        newStatus?: string
        error?: string
    }> = []

    const REVEAL_DELAY_HOURS = 5

    for (let i = 0; i < applications.length; i++) {
        const app = applications[i]

        // Skip if already audited
        if (app.aiScore !== null && app.aiReport) {
            results.push({
                id: app.id,
                fullName: app.fullName,
                status: 'skipped',
                aiScore: app.aiScore,
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
                newStatus = autoStatus
            } else if (app.status === 'submitted' || app.status === 'pending') {
                newStatus = 'under_review'
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

            results.push({
                id: app.id,
                fullName: app.fullName,
                status: 'success',
                aiScore: report.overallScore,
                recommendation: report.recommendation,
                newStatus,
            })

            console.log(`[Batch Audit] ✓ ${i + 1}/${applications.length} — ${app.fullName}: ${report.overallScore}/100 (${report.recommendation})`)
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            results.push({
                id: app.id,
                fullName: app.fullName,
                status: 'error',
                error: errMsg,
            })
            console.error(`[Batch Audit] ✗ ${i + 1}/${applications.length} — ${app.fullName}: ${errMsg}`)
        }
    }

    const summary = {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
    }

    return NextResponse.json({ results, summary })
}
