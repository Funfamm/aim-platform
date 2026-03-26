import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { invalidateSettings } from '@/lib/cached-settings'
import { invalidateMailerCache } from '@/lib/mailer'
import { logger } from '@/lib/logger'

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const settings = await prisma.siteSettings.upsert({
        where: { id: 'default' },
        create: { id: 'default' },
        update: {},
    })

    // Mask secrets for security
    const masked = {
        ...settings,
        geminiApiKey: settings.geminiApiKey
            ? '••••••••' + settings.geminiApiKey.slice(-4)
            : null,
        smtpPass: settings.smtpPass
            ? '••••••••' + settings.smtpPass.slice(-4)
            : null,
    }

    return NextResponse.json(masked)
}

export async function PUT(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()

        // If API key is masked (starts with ••), don't update it
        const isKeyMasked = body.geminiApiKey?.startsWith('••')
        const updateData: Record<string, unknown> = {
            siteName: body.siteName ?? '',
            tagline: body.tagline ?? '',
            aboutText: body.aboutText ?? '',
            studioStory: body.studioStory ?? '',
            mission: body.mission ?? '',
            logoUrl: body.logoUrl || null,
            socialLinks: body.socialLinks || null,
            contactEmail: body.contactEmail || null,
            contactPhone: body.contactPhone || null,
            address: body.address || null,
            // AI
            aiModel: body.aiModel || 'gemini-2.5-flash',
            aiCustomPrompt: body.aiCustomPrompt || null,
            aiAutoAudit: body.aiAutoAudit ?? false,
            // Casting
            defaultDeadlineDays: body.defaultDeadlineDays ?? 30,
            castingAutoClose: body.castingAutoClose ?? false,
            requireVoice: body.requireVoice ?? false,
            maxPhotoUploads: body.maxPhotoUploads ?? 6,
            // Content Access
            requireLoginForFilms: body.requireLoginForFilms ?? true,
            allowPublicTrailers: body.allowPublicTrailers ?? true,
            requireLoginForCasting: body.requireLoginForCasting ?? false,
            requireLoginForDonate: body.requireLoginForDonate ?? false,
            requireLoginForSponsors: body.requireLoginForSponsors ?? false,
            allowPublicProjectPages: body.allowPublicProjectPages ?? true,
            // Donations
            donationsEnabled: body.donationsEnabled ?? true,
            donationMinAmount: body.donationMinAmount ?? 5.0,
            // Notifications
            notifyOnApplication: body.notifyOnApplication ?? true,
            notifyOnDonation: body.notifyOnDonation ?? true,
            notifyEmail: body.notifyEmail || null,
            // Section Visibility
            scriptCallsEnabled: body.scriptCallsEnabled ?? false,
            castingCallsEnabled: body.castingCallsEnabled ?? true,
            trainingEnabled: body.trainingEnabled ?? false,
            // OAuth
            googleClientId: body.googleClientId || null,
            googleClientSecret: body.googleClientSecret || null,
            appleClientId: body.appleClientId || null,
            appleTeamId: body.appleTeamId || null,
            appleKeyId: body.appleKeyId || null,
            applePrivateKey: body.applePrivateKey || null,
            // Email / SMTP
            smtpHost: body.smtpHost || null,
            smtpPort: body.smtpPort ?? 587,
            smtpUser: body.smtpUser || null,
            smtpFromName: body.smtpFromName || null,
            smtpFromEmail: body.smtpFromEmail || null,
            smtpSecure: body.smtpSecure ?? false,
            emailsEnabled: body.emailsEnabled ?? false,
        }

        // Only update API key if user provided a new one (not masked)
        if (!isKeyMasked && body.geminiApiKey !== undefined) {
            updateData.geminiApiKey = body.geminiApiKey || null
        }

        // Only update SMTP password if user provided a new one (not masked)
        const isSmtpPassMasked = body.smtpPass?.startsWith('••')
        if (!isSmtpPassMasked && body.smtpPass !== undefined) {
            updateData.smtpPass = body.smtpPass || null
        }

        // Try update first, create if doesn't exist
        let settings
        const existing = await prisma.siteSettings.findUnique({ where: { id: 'default' } })
        if (existing) {
            settings = await prisma.siteSettings.update({
                where: { id: 'default' },
                data: updateData,
            })
        } else {
            settings = await prisma.siteSettings.create({
                data: { id: 'default', ...updateData } as any,
            })
        }

        // Invalidate caches so changes take effect immediately
        invalidateSettings()
        invalidateMailerCache()

        // Mask secrets in response
        const masked = {
            ...settings,
            geminiApiKey: settings.geminiApiKey
                ? '••••••••' + settings.geminiApiKey.slice(-4)
                : null,
            smtpPass: settings.smtpPass
                ? '••••••••' + settings.smtpPass.slice(-4)
                : null,
        }

        return NextResponse.json(masked)
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        const errStack = err instanceof Error ? err.stack : undefined
        logger.error('admin/settings', 'Settings save failed', { error: err })
        console.error('Settings save FULL error:', err)
        return NextResponse.json({ error: 'Save failed', details: errMsg, stack: errStack }, { status: 500 })
    }
}
