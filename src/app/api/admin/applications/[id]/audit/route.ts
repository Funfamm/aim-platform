import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runAuditionAgent } from '@/lib/agents/audition-agent'
import { getAutoAdvanceStatus, notifyApplicantStatusChange } from '@/lib/notifications'
import { aiLimiter } from '@/lib/rate-limit'
import { enqueueApplication, markProcessing, markScoredHidden, markScoredVisible } from '@/lib/audit-queue'

// Internal secret for server-to-server auto-audit calls (no admin session required)
const INTERNAL_SECRET = process.env.JWT_SECRET || ''

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const blocked = aiLimiter.check(request)
    if (blocked) return blocked

    // Check for internal auto-audit bypass OR require admin session
    const internalToken = request.headers.get('x-internal-secret')
    const isInternalCall = internalToken && INTERNAL_SECRET && internalToken === INTERNAL_SECRET

    if (!isInternalCall) {
        try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    const { id } = await params

    // ── Parse action from request body ──────────────────────────────────────
    let action: string | undefined
    let locale = 'en'
    try {
        const body = await request.json().catch(() => ({}))
        action = (body as { action?: string })?.action
        locale = (body as { locale?: string })?.locale || 'en'
    } catch { /* no body */ }

    // ── REVEAL NOW: flip a scored_hidden result to visible immediately ───────
    if (action === 'reveal_now') {
        const app = await prisma.application.findUnique({
            where: { id },
            include: { castingCall: { include: { project: true } } },
        })
        if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

        const auditState = (app as any).auditState
        if (auditState !== 'scored_hidden') {
            return NextResponse.json({
                error: `Cannot reveal: application is in state "${auditState ?? 'unknown'}". It must be "scored_hidden".`,
            }, { status: 409 })
        }

        await (prisma.application as any).update({
            where: { id },
            data: {
                auditState: 'scored_visible',
                resultVisibleAt: new Date(),
                adminRevealOverride: true,
            },
        })

        // Fire notification immediately
        notifyApplicantStatusChange({
            applicationId: id,
            recipientEmail: app.email,
            recipientName: app.fullName,
            newStatus: app.status,
            roleName: app.castingCall.roleName,
            projectTitle: app.castingCall.project.title,
            aiScore: app.aiScore ?? undefined,
            statusNote: app.statusNote ?? undefined,
        }).catch(err => console.error('[Admin/RevealNow] Notification error:', err))

        return NextResponse.json({ success: true, action: 'reveal_now', applicationId: id })
    }

    // ── PROCESS NOW: score immediately, bypassing quota ──────────────────────
    // For "process_now" or standard admin audit trigger (action = undefined)
    if (action === 'process_now') {
        // Bump priority and re-queue so it's first if something else delays it
        await enqueueApplication(id, 999)
    }

    // ── Load and validate application ────────────────────────────────────────
    const application = await prisma.application.findUnique({
        where: { id },
        include: {
            castingCall: { include: { project: true } },
        },
    })

    if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Idempotency: skip if already audited (prevents double auto-audit)
    if (isInternalCall && application.aiScore !== null) {
        console.log(`[Auto-Audit] Skipping ${id} — already audited (score: ${application.aiScore})`)
        return NextResponse.json({ success: true, skipped: true, reason: 'already_audited' })
    }

    // Use application locale if not provided in body
    locale = locale || application.locale || 'en'

    // Parse experience data
    let experienceData = {
        text: '', specialSkills: '',
        personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' },
    }
    try { experienceData = JSON.parse(application.experience) } catch {
        experienceData = { text: application.experience, specialSkills: '', personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' } }
    }

    // Parse photo URLs
    let photoUrls: string[] = []
    if (application.headshotPath) {
        try { photoUrls = JSON.parse(application.headshotPath) } catch { /* single path or invalid */ }
    }

    // Mark as processing in the queue
    await markProcessing(id)

    // ── Run the AI audition ───────────────────────────────────────────────────
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
                voiceUrl: application.selfTapePath || undefined,
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

        // Determine new pipeline status
        let newStatus = application.status
        const autoStatus = await getAutoAdvanceStatus(application.status, report.overallScore)
        if (autoStatus) {
            newStatus = autoStatus as import('@prisma/client').ApplicationStatus
        } else if (application.status === 'submitted') {
            newStatus = 'under_review' as import('@prisma/client').ApplicationStatus
        }

        const settings = await prisma.siteSettings.findFirst().catch(() => null)
        const REVEAL_DELAY_HOURS = (settings as any)?.resultRevealDelayHours ?? 6

        // Store result — admin-triggered audits are also subject to reveal delay
        // unless the admin immediately follows up with reveal_now
        await markScoredHidden(id, REVEAL_DELAY_HOURS, {
            aiScore: report.overallScore,
            aiFitLevel: report.recommendation,
            aiReport: JSON.stringify(report),
            statusNote: report.applicantFeedback || '',
            status: newStatus,
            reviewedAt: new Date(),
            photoScreeningStatus: report.screeningSkipped ? 'skipped' : 'completed',
        })

        // Notify on status change (result still hidden — applicant sees "under review")
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
            action: action || 'audit',
            report,
            warnings: report.warnings ?? [],
            autoAdvanced: autoStatus !== null,
            newStatus,
            auditState: 'scored_hidden',
        })
    } catch (error) {
        // Reset queue state on failure
        await (prisma.application as any).update({
            where: { id },
            data: { auditState: 'queued', lastProcessingError: (error instanceof Error ? error.message : String(error)).slice(0, 500) },
        }).catch(() => null)

        console.error('AI audit error:', error)
        const message = process.env.NODE_ENV === 'development'
            ? (error instanceof Error ? error.message : 'AI analysis failed')
            : 'AI analysis failed'
        return NextResponse.json({ error: message }, { status: 422 })
    }
}
