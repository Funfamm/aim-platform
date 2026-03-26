import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { sendEmail } from '@/lib/mailer'
import { applicationConfirmationWithOverrides, applicationAdminNotification } from '@/lib/email-templates'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        // ═══ DUPLICATE CHECK — same email, same role ═══
        const existingApplication = await prisma.application.findFirst({
            where: { castingCallId: id, email },
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

        // Try to link to a logged-in user
        let userId: string | null = null
        try {
            const session = await getUserSession()
            if (session?.userId) userId = session.userId
        } catch { /* guest application is fine */ }

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
                const ext = file.name.split('.').pop() || 'jpg'
                const fileName = `${key}.${ext}`
                const filePath = path.join(uploadDir, fileName)
                const buffer = Buffer.from(await file.arrayBuffer())
                await writeFile(filePath, buffer)
                photoPaths.push(`/uploads/${safeName}_${timestamp}/${fileName}`)
            }
        }

        // Save voice recording
        let voicePath: string | null = null
        const voiceFile = formData.get('voiceRecording') as File | null
        if (voiceFile && voiceFile.size > 0) {
            const ext = voiceFile.name.split('.').pop() || 'mp3'
            const fileName = `voice_recording.${ext}`
            const filePath = path.join(uploadDir, fileName)
            const buffer = Buffer.from(await voiceFile.arrayBuffer())
            await writeFile(filePath, buffer)
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
                status: 'pending',
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
