import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withDbRetry } from '@/lib/db-retry'
import { getUserSession } from '@/lib/auth'
import { sendEmail } from '@/lib/mailer'
import { applicationConfirmationWithOverrides, applicationAdminNotification } from '@/lib/email-templates'
import { mirrorToNotificationBoard } from '@/lib/notifications'
import { uploadLimiter } from '@/lib/rate-limit'
import { checkMagicBytes } from '@/lib/upload-safety'
import { logUploadEvent } from '@/lib/upload-audit'
import { uploadBufferToR2 } from '@/lib/r2Upload'

// ═══ FILE UPLOAD SECURITY ═══
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ALLOWED_PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']
const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10 MB (mobile cameras produce large files)

const ALLOWED_VOICE_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a', 'audio/mp3', 'audio/flac', 'audio/x-wav']
const ALLOWED_VOICE_TYPE_PREFIXES = ['audio/']
const ALLOWED_VOICE_EXTS = ['.mp3', '.mp4', '.m4a', '.wav', '.webm', '.ogg']
const MAX_VOICE_SIZE = 25 * 1024 * 1024 // 25 MB

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // IP-based rate limit (5 uploads/min)
    const blocked = uploadLimiter.check(request)
    if (blocked) return blocked

    try {
        const { id } = await params

        // Verify casting call exists and is open
        const castingCall = await withDbRetry(() => prisma.castingCall.findUnique({ where: { id } }), 'apply_find_casting')
        if (!castingCall || castingCall.status !== 'open') {
            return NextResponse.json({ error: 'Casting call not found or closed' }, { status: 404 })
        }

        const formData = await request.formData()

        // Extract text fields
        const fullName = (formData.get('fullName') as string || '').trim().slice(0, 100)
        const email = (formData.get('email') as string || '').trim().toLowerCase().slice(0, 200)
        const phone = (formData.get('phone') as string || '').trim().slice(0, 30) || null
        const age = parseInt(formData.get('age') as string) || null
        const gender = formData.get('gender') as string || null
        const location = (formData.get('location') as string || '').trim().slice(0, 200) || null
        const experience = (formData.get('experience') as string || '').slice(0, 5000)
        const specialSkills = (formData.get('specialSkills') as string || '').slice(0, 500) || null
        const locale = (formData.get('locale') as string || 'en').slice(0, 10)

        // Personality answers
        const personalityData = {
            describe_yourself: (formData.get('describe_yourself') as string || '').slice(0, 1000),
            why_acting: (formData.get('why_acting') as string || '').slice(0, 2000),
            dream_role: (formData.get('dream_role') as string || '').slice(0, 2000),
            unique_quality: (formData.get('unique_quality') as string || '').slice(0, 2000),
        }

        // Social media
        const socialPlatform = formData.get('socialPlatform') as string || ''
        const socialUsername = (formData.get('socialUsername') as string || '').slice(0, 200)
        const socialPlatform2 = formData.get('socialPlatform2') as string || ''
        const socialUsername2 = (formData.get('socialUsername2') as string || '').slice(0, 200)

        const socialData = {
            primary: { platform: socialPlatform, username: socialUsername },
            secondary: socialPlatform2 ? { platform: socialPlatform2, username: socialUsername2 } : null,
        }

        if (!fullName || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
        }

        // Try to link to a logged-in user
        let userId: string | null = null
        try {
            const session = await getUserSession()
            if (session?.userId) userId = session.userId
        } catch { /* guest application is fine */ }

        // ═══ DUPLICATE / REAPPLY CHECK (By Email) ═══
        // The database enforcing @@unique([castingCallId, email]) means we MUST check by email.
        const existingApplication = await withDbRetry(() => prisma.application.findFirst({
            where: { castingCallId: id, email },
            select: { id: true, status: true },
        }), 'apply_check_duplicate')

        if (existingApplication) {
            // Allow reapply only if previously withdrawn
            if (existingApplication.status === 'withdrawn') {
                // Update existing record back to submitted — counts as reapplication
                await prisma.application.update({
                    where: { id: existingApplication.id },
                    data: { 
                        status: 'submitted', 
                        updatedAt: new Date(),
                        // Always update userId if they are logged in now
                        ...(userId && { userId })
                    },
                })
                return NextResponse.json({
                    success: true,
                    applicationId: existingApplication.id,
                    message: 'Application resubmitted successfully',
                    reapplied: true,
                })
            }
            return NextResponse.json({
                error: `You've already applied for this role! You can apply for other roles in different projects. Check your email (${email}) for confirmation.`,
            }, { status: 409 })
        }

        // ═══ RATE LIMIT — max 5 applications per email per day ═══
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const recentApplications = await withDbRetry(() => prisma.application.count({
            where: { email, createdAt: { gte: oneDayAgo } },
        }), 'apply_rate_limit_count')
        if (recentApplications >= 5) {
            return NextResponse.json({
                error: "You've submitted too many applications today. Please try again tomorrow. This limit is to ensure fair review for all applicants.",
            }, { status: 429 })
        }

        // ═══ VERIFY PRESIGNED URL UPLOADS ═══
        const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
        
        // Helper to validate submitted URLs belong to our R2 bucket
        const getValidR2Url = (formKey: string): string | null => {
            const urlStr = formData.get(formKey) as string;
            if (!urlStr || typeof urlStr !== 'string') return null;
            
            try {
                const url = new URL(urlStr);
                if (r2PublicUrl && !urlStr.startsWith(r2PublicUrl)) {
                    console.warn(`[Suspicious Upload] Rejected URL not matching R2_PUBLIC_URL: ${urlStr}`);
                    return null;
                }
                return urlStr;
            } catch {
                return null;
            }
        };

        // Collect photos
        const photoPaths: string[] = [];
        const photoKeys = ['front_headshot', 'side_profile', 'full_body', 'expression', 'optional_1', 'optional_2'];
        
        for (const key of photoKeys) {
            const r2Url = getValidR2Url(`photo_${key}`);
            if (r2Url) {
                photoPaths.push(r2Url);
                
                logUploadEvent({
                    action: 'upload_accepted', route: '/api/casting/apply/presigned',
                    userId, fileName: r2Url.split('/').pop() || key, mimeType: 'image/presigned', fileSize: 0,
                });
            }
        }

        // Collect voice recording
        const voicePath = getValidR2Url('voiceRecording');
        if (voicePath) {
            logUploadEvent({
                action: 'upload_accepted', route: '/api/casting/apply/presigned',
                userId, fileName: voicePath.split('/').pop() || 'voice', mimeType: 'audio/presigned', fileSize: 0,
            });
        }
        // ═══ MAX APPLICATION CHECK — prevent overflow ═══
        const currentCount = await withDbRetry(() => prisma.application.count({ where: { castingCallId: id } }), 'apply_max_count')
        if (castingCall.maxApplications && currentCount >= castingCall.maxApplications) {
            return NextResponse.json({
                error: `This role has reached its maximum number of applications (${castingCall.maxApplications}). The casting team is reviewing current submissions.`,
            }, { status: 410 })
        }

        // Create the application record
        const application = await withDbRetry(() => prisma.application.create({
            data: {
                castingCallId: id,
                userId,
                fullName,
                email,
                phone,
                age,
                gender,
                location,
                experience: JSON.stringify({
                    text: experience,
                    specialSkills,
                    personality: personalityData,
                }),
                specialSkills,
                headshotPath: photoPaths.length > 0 ? JSON.stringify(photoPaths) : null,
                selfTapePath: voicePath,
                portfolioUrl: JSON.stringify(socialData),
                locale,
                status: 'submitted',
            },
            // Explicit select avoids fetching non-existent columns (e.g. audioUrl)
            select: { id: true, status: true },
        }), 'apply_create_application')

        // ═══ AUTO-CLOSE — close casting when limit reached ═══
        const newCount = currentCount + 1
        if (castingCall.maxApplications && newCount >= castingCall.maxApplications) {
            await prisma.castingCall.update({
                where: { id },
                data: { status: 'closed' },
            })
        }

        // ═══ AUTO-AUDIT — run AI analysis if enabled ═══
        let siteSettings: Awaited<ReturnType<typeof prisma.siteSettings.findFirst>> = null
        try {
            siteSettings = await prisma.siteSettings.findFirst()
        } catch (settingsErr) {
            console.error('Failed to load SiteSettings (schema drift?):', settingsErr)
        }
        if (siteSettings?.aiAutoAudit) {
            // Fire-and-forget with staggered delay — prevents burst RPM exhaustion
            // when multiple applications arrive simultaneously
            const staggerMs = Math.floor(Math.random() * 25_000) + 5_000 // 5-30s random delay
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
            const internalSecret = process.env.JWT_SECRET || ''
            console.log(`[Auto-Audit] Scheduling audit for ${application.id} in ${Math.round(staggerMs / 1000)}s`)
            setTimeout(() => {
                fetch(`${baseUrl}/api/admin/applications/${application.id}/audit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Internal-Secret': internalSecret,
                    },
                    body: JSON.stringify({ locale }),
                })
                    .then(async (res) => {
                        if (!res.ok) {
                            const err = await res.text().catch(() => 'unknown')
                            console.error(`[Auto-Audit] Failed for ${application.id}: ${res.status} — ${err}`)
                        } else {
                            console.log(`[Auto-Audit] Completed successfully for ${application.id}`)
                        }
                    })
                    .catch(err => console.error(`[Auto-Audit] Network error for ${application.id}:`, err))
            }, staggerMs)
        }

        // Fire-and-forget: confirmation email to applicant + admin notification + in-app mirror
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
        Promise.resolve().then(async () => {
            try {
                await sendEmail({
                    to: email,
                    subject: `Application received for ${castingCall.roleName} 🎭`,
                    html: await applicationConfirmationWithOverrides(fullName, castingCall.roleName, undefined, siteUrl),
                })
                // Mirror to notification board if user is logged in
                if (userId) {
                    await mirrorToNotificationBoard(
                        userId,
                        'status_change',
                        `Application Received: ${castingCall.roleName} 🎭`,
                        `Your application for "${castingCall.roleName}" has been submitted successfully. Our team will be in touch!`,
                        '/dashboard/applications',
                        `app-confirm-${application.id}`,
                    )
                }
            } catch (emailErr) {
                console.error('[apply] Confirmation email failed:', emailErr)
            }
            try {
                if (siteSettings?.notifyOnApplication) {
                    const adminEmail = siteSettings.notifyEmail || siteSettings.contactEmail
                    if (adminEmail) {
                        await sendEmail({
                            to: adminEmail,
                            subject: `📋 New Application: ${fullName} for ${castingCall.roleName}`,
                            html: applicationAdminNotification(fullName, email, castingCall.roleName),
                        })
                    }
                }
            } catch (adminEmailErr) {
                console.error('[apply] Admin notification email failed:', adminEmailErr)
            }
        }).catch(() => null)

        return NextResponse.json({
            success: true,
            applicationId: application.id,
            message: 'Application submitted successfully',
        })
    } catch (error: any) {
        console.error('Application submission error:', error)
        return NextResponse.json({ error: error.message || 'Failed to submit application' }, { status: 500 })
    }
}
