import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runAuditionAgent } from '@/lib/agents/audition-agent'
import { getAutoAdvanceStatus, notifyApplicantStatusChange } from '@/lib/notifications'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const application = await prisma.application.findUnique({
        where: { id },
        include: {
            castingCall: {
                include: { project: true },
            },
        },
    })

    if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Get locale from request body (auto-audit) or from stored application locale
    let locale = 'en'
    try {
        const body = await request.json().catch(() => ({}))
        locale = (body as { locale?: string })?.locale || application.locale || 'en'
    } catch { locale = application.locale || 'en' }

    // Parse experience data
    let experienceData = { text: '', specialSkills: '', personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' } }
    try { experienceData = JSON.parse(application.experience) } catch { experienceData = { text: application.experience, specialSkills: '', personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' } } }

    // Parse photo URLs
    let photoUrls: string[] = []
    if (application.headshotPath) {
        try { photoUrls = JSON.parse(application.headshotPath) } catch { /* single path or invalid */ }
    }

    // Run the AI audition
    try {
        const report = await runAuditionAgent({
            applicant: {
                fullName: application.fullName,
                age: application.age,
                gender: application.gender,
                experience: experienceData.text,
                specialSkills: application.specialSkills,
                personality: experienceData.personality,
                photoUrls,
            },
            role: {
                roleName: application.castingCall.roleName,
                roleType: application.castingCall.roleType,
                roleDescription: application.castingCall.roleDescription,
                requirements: application.castingCall.requirements,
                ageRange: application.castingCall.ageRange,
                gender: application.castingCall.gender,
                projectTitle: application.castingCall.project.title,
            },
            locale,
        })

        // Determine new status: auto-advance based on AI score, or just mark as reviewed
        let newStatus = application.status
        const autoStatus = await getAutoAdvanceStatus(application.status, report.overallScore)
        if (autoStatus) {
            newStatus = autoStatus as import('@prisma/client').ApplicationStatus
        } else if (application.status === 'submitted') {
            newStatus = 'under_review' as import('@prisma/client').ApplicationStatus
        }

        // ═══ DELAYED REVEAL — results visible after 5 hours ═══
        const REVEAL_DELAY_HOURS = 5
        const resultVisibleAt = new Date(Date.now() + REVEAL_DELAY_HOURS * 60 * 60 * 1000)

        // Update the application with AI results (stored immediately, revealed later)
        await prisma.application.update({
            where: { id },
            data: {
                aiScore: report.overallScore,
                aiFitLevel: report.recommendation,
                aiReport: JSON.stringify(report),
                statusNote: report.applicantFeedback || '',
                status: newStatus,
                reviewedAt: new Date(),
                resultVisibleAt,
            },
        })

        // Schedule notification for when results become visible
        // The notification is logged now but marked as 'scheduled' — 
        // a cron job or the user's next visit will trigger the actual send
        if (newStatus !== application.status) {
            notifyApplicantStatusChange({
                applicationId: id,
                recipientEmail: application.email,
                recipientName: application.fullName,
                newStatus,
                roleName: application.castingCall.roleName,
                projectTitle: application.castingCall.project.title,
                aiScore: report.overallScore,
                statusNote: report.applicantFeedback,
            }).catch(err => console.error('Notification error:', err))
        }

        return NextResponse.json({
            success: true,
            report,
            autoAdvanced: autoStatus !== null,
            newStatus,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'AI analysis failed'
        return NextResponse.json({ error: message }, { status: 422 })
    }
}
