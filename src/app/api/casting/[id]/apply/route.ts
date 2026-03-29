import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { sendEmail } from '@/lib/mailer'
import { applicationConfirmationWithOverrides, applicationAdminNotification } from '@/lib/email-templates'
import { uploadLimiter } from '@/lib/rate-limit'
import { checkMagicBytes, guardPathTraversal } from '@/lib/upload-safety'
import { logUploadEvent } from '@/lib/upload-audit'

// ═══ FILE UPLOAD SECURITY ═══
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_PHOTO_SIZE = 5 * 1024 * 1024 // 5 MB

const ALLOWED_VOICE_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a', 'audio/mp3']
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
        const castingCall = await prisma.castingCall.findUnique({ where: { id } })
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

        // Try to link to a logged-in user (resolved early so it can be used in duplicate checks)
        let userId: string | null = null
        try {
            const session = await getUserSession()
            if (session?.userId) userId = session.userId
        } catch { /* guest application is fine */ }

        // ═══ DUPLICATE / REAPPLY CHECK ═══
        if (userId) {
            const existingByUser = await prisma.application.findFirst({
                where: { castingCallId: id, userId },
            })
            if (existingByUser) {
                // Allow reapply only if previously withdrawn (once only)
                if (existingByUser.status === 'withdrawn') {
                    // Update existing record back to submitted — counts as reapplication
                    await prisma.application.update({
                        where: { id: existingByUser.id },
                        data: { status: 'submitted', updatedAt: new Date() },
                    })
                    return NextResponse.json({
                        success: true,
                        applicationId: existingByUser.id,
                        message: 'Application resubmitted successfully',
                        reapplied: true,
                    })
                }
                return NextResponse.json({
                    error: `You've already submitted an application for this role.`,
                }, { status: 409 })
            }
        }

        // ═══ DUPLICATE CHECK — same email, same role ═══
        const existingApplication = await prisma.application.findFirst({
            where: { castingCallId: id, email, status: { not: 'withdrawn' } },
        })

        if (existingApplication) {
            return NextResponse.json({
                error: `You've already applied for this role! You can apply for other roles in different projects. Check your email (${email}) for confirmation.`,
            }, { status: 409 })
        }

        // ═══ RATE LIMIT — max 5 applications per email per day ═══
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const recentApplications = await prisma.application.count({
            where: { email, createdAt: { gte: oneDayAgo } },
        })
        if (recentApplications >= 5) {
            return NextResponse.json({
                error: 'You\'ve submitted too many applications today. Please try again tomorrow. This limit is to ensure fair review for all applicants.',
            }, { status: 429 })
        }

        // userId already resolved above for duplicate checks

        // Create upload directory for this application
        const timestamp = Date.now()
        const safeName = fullName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', `${safeName}_${timestamp}`)
        await mkdir(uploadDir, { recursive: true })

        // Save photos
        const photoPaths: string[] = []
        const photoKeys = ['front_headshot', 'side_profile', 'full_body', 'expression', 'optional_1', 'optional_2']

        for (const key of photoKeys) {
            const file = formData.get(`photo_${key}`) as File | null
            if (file && file.size > 0) {
                // ═══ PHOTO VALIDATION ═══
                const ext = '.' + (file.name.split('.').pop() || 'jpg').toLowerCase()
                if (!ALLOWED_PHOTO_EXTS.includes(ext)) {
                    logUploadEvent({
                        action: 'upload_rejected', route: '/api/casting/apply',
                        userId, fileName: file.name, mimeType: file.type, fileSize: file.size,
                        reason: `Invalid photo extension: ${ext}`, code: 'EXT_REJECTED',
                    })
                    return NextResponse.json({ error: `Invalid photo format for ${key}. Allowed: JPG, PNG, WebP.` }, { status: 400 })
                }
                if (file.type && !ALLOWED_PHOTO_TYPES.includes(file.type)) {
                    logUploadEvent({
                        action: 'upload_rejected', route: '/api/casting/apply',
                        userId, fileName: file.name, mimeType: file.type, fileSize: file.size,
                        reason: `Invalid photo MIME: ${file.type}`, code: 'MIME_REJECTED',
                    })
                    return NextResponse.json({ error: `Invalid photo type for ${key}. Allowed: JPEG, PNG, WebP.` }, { status: 400 })
                }
                if (file.size > MAX_PHOTO_SIZE) {
                    return NextResponse.json({ error: `Photo ${key} is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 5 MB.` }, { status: 400 })
                }

                const fileName = `${key}${ext}`
                const filePath = path.join(uploadDir, fileName)
                const buffer = Buffer.from(await file.arrayBuffer())

                // ═══ MAGIC-BYTE CHECK ═══
                if (file.type) {
                    const magicCheck = checkMagicBytes(buffer, file.type)
                    if (!magicCheck.valid) {
                        logUploadEvent({
                            action: 'upload_rejected', route: '/api/casting/apply',
                            userId, fileName: file.name, mimeType: file.type, fileSize: file.size,
                            reason: magicCheck.error, code: 'MAGIC_BYTE_MISMATCH',
                        })
                        return NextResponse.json({
                            error: `Photo "${key}" failed content verification: the file does not appear to be a valid image. It may be corrupted or disguised.`,
                        }, { status: 400 })
                    }
                }

                // ═══ PATH TRAVERSAL GUARD ═══
                let resolvedPath: string
                try {
                    resolvedPath = guardPathTraversal(filePath, uploadDir)
                } catch {
                    logUploadEvent({
                        action: 'upload_rejected', route: '/api/casting/apply',
                        userId, fileName: file.name, mimeType: file.type, fileSize: file.size,
                        reason: 'Path traversal attempt', code: 'PATH_TRAVERSAL',
                    })
                    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
                }

                await writeFile(resolvedPath, buffer)

                logUploadEvent({
                    action: 'upload_accepted', route: '/api/casting/apply',
                    userId, fileName: file.name, mimeType: file.type, fileSize: file.size,
                })

                photoPaths.push(`/uploads/${safeName}_${timestamp}/${fileName}`)
            }
        }

        // Save voice recording
        let voicePath: string | null = null
        const voiceFile = formData.get('voiceRecording') as File | null
        if (voiceFile && voiceFile.size > 0) {
            // ═══ VOICE VALIDATION ═══
            const vExt = '.' + (voiceFile.name.split('.').pop() || 'mp3').toLowerCase()
            if (!ALLOWED_VOICE_EXTS.includes(vExt)) {
                logUploadEvent({
                    action: 'upload_rejected', route: '/api/casting/apply',
                    userId, fileName: voiceFile.name, mimeType: voiceFile.type, fileSize: voiceFile.size,
                    reason: `Invalid voice extension: ${vExt}`, code: 'EXT_REJECTED',
                })
                return NextResponse.json({ error: `Invalid voice file format. Allowed: MP3, MP4, M4A, WAV, WebM, OGG.` }, { status: 400 })
            }
            if (voiceFile.type && !ALLOWED_VOICE_TYPES.includes(voiceFile.type)) {
                logUploadEvent({
                    action: 'upload_rejected', route: '/api/casting/apply',
                    userId, fileName: voiceFile.name, mimeType: voiceFile.type, fileSize: voiceFile.size,
                    reason: `Invalid voice MIME: ${voiceFile.type}`, code: 'MIME_REJECTED',
                })
                return NextResponse.json({ error: `Invalid voice file type. Allowed: audio/mpeg, audio/mp4, audio/wav, audio/webm, audio/ogg.` }, { status: 400 })
            }
            if (voiceFile.size > MAX_VOICE_SIZE) {
                return NextResponse.json({ error: `Voice recording is too large (${(voiceFile.size / 1024 / 1024).toFixed(1)} MB). Maximum 25 MB.` }, { status: 400 })
            }

            const fileName = `voice_recording${vExt}`
            const filePath = path.join(uploadDir, fileName)
            const buffer = Buffer.from(await voiceFile.arrayBuffer())

            // ═══ MAGIC-BYTE CHECK ═══
            if (voiceFile.type) {
                const magicCheck = checkMagicBytes(buffer, voiceFile.type)
                if (!magicCheck.valid) {
                    logUploadEvent({
                        action: 'upload_rejected', route: '/api/casting/apply',
                        userId, fileName: voiceFile.name, mimeType: voiceFile.type, fileSize: voiceFile.size,
                        reason: magicCheck.error, code: 'MAGIC_BYTE_MISMATCH',
                    })
                    return NextResponse.json({
                        error: `Voice recording failed content verification: the file does not appear to be valid audio. It may be corrupted or disguised.`,
                    }, { status: 400 })
                }
            }

            // ═══ PATH TRAVERSAL GUARD ═══
            let resolvedPath: string
            try {
                resolvedPath = guardPathTraversal(filePath, uploadDir)
            } catch {
                logUploadEvent({
                    action: 'upload_rejected', route: '/api/casting/apply',
                    userId, fileName: voiceFile.name, mimeType: voiceFile.type, fileSize: voiceFile.size,
                    reason: 'Path traversal attempt', code: 'PATH_TRAVERSAL',
                })
                return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
            }

            await writeFile(resolvedPath, buffer)

            logUploadEvent({
                action: 'upload_accepted', route: '/api/casting/apply',
                userId, fileName: voiceFile.name, mimeType: voiceFile.type, fileSize: voiceFile.size,
            })

            voicePath = `/uploads/${safeName}_${timestamp}/${fileName}`
        }
        // ═══ MAX APPLICATION CHECK — prevent overflow ═══
        const currentCount = await prisma.application.count({ where: { castingCallId: id } })
        if (castingCall.maxApplications && currentCount >= castingCall.maxApplications) {
            return NextResponse.json({
                error: `This role has reached its maximum number of applications (${castingCall.maxApplications}). The casting team is reviewing current submissions.`,
            }, { status: 410 })
        }

        // Create the application record
        const application = await prisma.application.create({
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
        })

        // ═══ AUTO-CLOSE — close casting when limit reached ═══
        const newCount = currentCount + 1
        if (castingCall.maxApplications && newCount >= castingCall.maxApplications) {
            await prisma.castingCall.update({
                where: { id },
                data: { status: 'closed' },
            })
        }

        // ═══ AUTO-AUDIT — run AI analysis if enabled ═══
        const siteSettings = await prisma.siteSettings.findFirst()
        if (siteSettings?.aiAutoAudit) {
            // Fire-and-forget — don't block the response
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
            fetch(`${baseUrl}/api/admin/applications/${application.id}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale }),
            }).catch(err => console.error('Auto-audit trigger failed:', err))
        }

        // Fire-and-forget: confirmation email to applicant
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
        sendEmail({
            to: email,
            subject: `Application received for ${castingCall.roleName} 🎭`,
            html: await applicationConfirmationWithOverrides(fullName, castingCall.roleName, undefined, siteUrl),
        })

        // Fire-and-forget: notify admin of new application
        const adminSettings = siteSettings || await prisma.siteSettings.findFirst()
        if (adminSettings?.notifyOnApplication) {
            const adminEmail = adminSettings.notifyEmail || adminSettings.contactEmail
            if (adminEmail) {
                sendEmail({
                    to: adminEmail,
                    subject: `📋 New Application: ${fullName} for ${castingCall.roleName}`,
                    html: applicationAdminNotification(fullName, email, castingCall.roleName),
                })
            }
        }

        return NextResponse.json({
            success: true,
            applicationId: application.id,
            message: 'Application submitted successfully',
        })
    } catch (error) {
        console.error('Application submission error:', error)
        return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
    }
}
