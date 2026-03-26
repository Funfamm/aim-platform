import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as templates from '@/lib/email-templates'

const SITE = 'https://aimstudio.ai'

/**
 * GET /api/admin/email-preview?template=welcome
 * Returns the rendered HTML of a specific email template with sample data.
 * Also returns any saved field overrides for the template.
 * Admin-only.
 */
export async function GET(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const template = searchParams.get('template') || 'welcome'

    const previews: Record<string, { subject: string; html: string }> = {
        welcome: {
            subject: 'Welcome to AIM Studio! 🎬',
            html: templates.welcomeEmail('Alexandra Rivera', SITE),
        },
        subscribe: {
            subject: "You're subscribed to AIM Studio! 🎬",
            html: templates.subscribeConfirmation('Alex', SITE),
        },
        contact: {
            subject: 'Message received: Collaboration Inquiry',
            html: templates.contactAcknowledgment('Jordan', 'Collaboration Inquiry', SITE),
        },
        contactAdmin: {
            subject: '📬 New Contact: Collaboration Inquiry',
            html: templates.contactAdminNotification('Jordan Kim', 'jordan@example.com', 'Collaboration Inquiry', 'Hey! I\'m a filmmaker interested in collaborating with AIM Studio on upcoming projects. Would love to chat.', SITE),
        },
        donation: {
            subject: 'Thank you for your $50.00 donation! 💛',
            html: templates.donationThankYou('Michael Chen', 50, SITE),
        },
        donationAdmin: {
            subject: '💰 New Donation: $50.00 from Michael Chen',
            html: templates.donationAdminNotification('Michael Chen', 'michael@example.com', 50, SITE),
        },
        application: {
            subject: 'Application received for Lead Protagonist 🎭',
            html: templates.applicationConfirmation('Sarah Johnson', 'Lead Protagonist', 'The Last Horizon', SITE),
        },
        applicationAdmin: {
            subject: '📋 New Application: Sarah Johnson for Lead Protagonist',
            html: templates.applicationAdminNotification('Sarah Johnson', 'sarah@example.com', 'Lead Protagonist', SITE),
        },
        statusUpdate: {
            subject: 'Application Update: Shortlisted',
            html: templates.applicationStatusUpdate('Sarah Johnson', 'Lead Protagonist', 'shortlisted', 'Your submission stood out to our team! We loved your headshots and voice recording. We\'ll be in touch via email with next steps.', SITE),
        },
        forgotPassword: {
            subject: 'Password Reset Code | AIM Studio',
            html: templates.forgotPasswordCode('Alexandra', '847293', SITE),
        },
        scriptSubmission: {
            subject: 'Script "The Morning After" submitted ✍️',
            html: templates.scriptSubmissionConfirmation('David Park', 'The Morning After', SITE),
        },
        verification: {
            subject: 'Verify your AIM Studio account',
            html: templates.verificationEmail('Alexandra Rivera', '384921', SITE),
        },
        passwordChanged: {
            subject: 'Your AIM Studio Password Was Changed',
            html: templates.passwordChangedEmail('Alexandra Rivera', SITE),
        },
        newDeviceLogin: {
            subject: 'New Device Login Detected 🚨',
            html: templates.newDeviceLoginEmail('Alexandra Rivera', { ip: '192.168.1.42', ua: 'Chrome 124 on Windows 11' }, SITE),
        },
    }

    const preview = previews[template]
    if (!preview) {
        return NextResponse.json({ error: 'Unknown template', available: Object.keys(previews) }, { status: 400 })
    }

    // Fetch saved field overrides for this template
    let overrides: Record<string, string> | null = null
    try {
        const settings = await prisma.siteSettings.findFirst() as any
        if (settings?.emailTemplateOverrides) {
            const all = JSON.parse(settings.emailTemplateOverrides)
            if (all[template]) overrides = all[template]
        }
    } catch { /* ignore */ }

    return NextResponse.json({ template, subject: preview.subject, html: preview.html, overrides })
}
