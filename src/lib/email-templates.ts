/**
 * Branded HTML email templates for AIM Studio.
 * All templates use inline CSS for max email-client compatibility.
 * Premium dark theme with gold accents matching the website design.
 *
 * ⚠️  INTENTIONAL EXCEPTION: These colour constants are hard-coded hex
 *     values on purpose, NOT CSS custom properties. Email clients
 *     (Gmail, Outlook, Yahoo) strip <style> blocks and do not evaluate
 *     CSS custom properties (var(...)). All colours in this file MUST
 *     remain as literal hex strings.
 */

// ── DB override loader ──────────────────────────────────────────
// Fetches admin-saved field overrides from SiteSettings and applies
// them over the default template field values before rendering.

import { prisma } from './db'

type TemplateFields = Record<string, string>
type AllOverrides = Record<string, TemplateFields>

let _overrideCache: AllOverrides | null = null
let _overrideCacheTime = 0
const OVERRIDE_CACHE_TTL = 60_000 // 1 min

async function getTemplateOverrides(): Promise<AllOverrides> {
    const now = Date.now()
    if (_overrideCache && now - _overrideCacheTime < OVERRIDE_CACHE_TTL) return _overrideCache
    try {
        const settings = await (prisma as any).siteSettings.findFirst({
            select: { emailTemplateOverrides: true },
        })
        const raw = settings?.emailTemplateOverrides
        _overrideCache = raw ? JSON.parse(raw as string) : {}
        _overrideCacheTime = now
    } catch {
        _overrideCache = {}
    }
    return _overrideCache!
}

/** Merge admin field overrides for a specific template key into the defaults */
async function mergeFields(templateKey: string, defaults: TemplateFields): Promise<TemplateFields> {
    const all = await getTemplateOverrides()
    const saved = all[templateKey] || {}
    return { ...defaults, ...saved }
}

/** Invalidate the override cache (call after admin saves a template) */
export function invalidateTemplateOverrideCache() {
    _overrideCache = null
    _overrideCacheTime = 0
}

const BRAND_COLOR = '#d4a853'
const BRAND_LIGHT = '#e8c36a'
const BG_DARK = '#0f1115'
const BG_CARD = '#1a1d23'
const BG_ELEVATED = '#22252d'
const TEXT_PRIMARY = '#e8e6e3'
const TEXT_SECONDARY = '#9ca3af'
const BORDER = '#2a2d35'
const ACCENT_RED = '#ef4444'
const ACCENT_GREEN = '#10b981'
const ACCENT_BLUE = '#3b82f6'

/** Shared email wrapper with premium branded header/footer */
function emailWrapper(content: string, preheader?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIM Studio</title>
    <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_DARK}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    ${preheader ? `<div style="display:none;font-size:1px;color:${BG_DARK};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_DARK};">
        <tr>
            <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%;">
                    <!-- Gold accent bar -->
                    <tr>
                        <td style="height: 4px; background: linear-gradient(90deg, ${BRAND_COLOR}, ${BRAND_LIGHT}, ${BRAND_COLOR}); border-radius: 12px 12px 0 0;"></td>
                    </tr>
                    <!-- Header -->
                    <tr>
                        <td style="padding: 28px 36px 20px; text-align: center; background-color: ${BG_CARD}; border-left: 1px solid ${BORDER}; border-right: 1px solid ${BORDER};">
                            <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                                <span style="color: ${BRAND_COLOR};">AIM</span>
                                <span style="color: ${TEXT_PRIMARY};"> Studio</span>
                            </span>
                        </td>
                    </tr>
                    <!-- Divider under header -->
                    <tr>
                        <td style="padding: 0 36px; background-color: ${BG_CARD}; border-left: 1px solid ${BORDER}; border-right: 1px solid ${BORDER};">
                            <div style="border-top: 1px solid ${BORDER};"></div>
                        </td>
                    </tr>
                    <!-- Content Card -->
                    <tr>
                        <td style="background-color: ${BG_CARD}; border-left: 1px solid ${BORDER}; border-right: 1px solid ${BORDER}; padding: 36px 36px 40px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Bottom accent bar -->
                    <tr>
                        <td style="height: 3px; background: linear-gradient(90deg, ${BRAND_COLOR}, ${BRAND_LIGHT}, ${BRAND_COLOR}); border-radius: 0 0 12px 12px;"></td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding-top: 28px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: ${TEXT_SECONDARY}; line-height: 1.6;">
                                &copy; ${new Date().getFullYear()} AIM Studio &bull; AI-Powered Filmmaking
                            </p>
                            <p style="margin: 8px 0 0; font-size: 11px; color: #6b7280;">
                                This email was sent automatically. Please do not reply directly.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

function heading(text: string): string {
    return `<h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: ${TEXT_PRIMARY}; line-height: 1.3;">${text}</h1>`
}

function subtext(text: string): string {
    return `<p style="margin: 0 0 24px; font-size: 14px; color: ${TEXT_SECONDARY}; line-height: 1.6;">${text}</p>`
}

function paragraph(text: string): string {
    return `<p style="margin: 0 0 16px; font-size: 15px; color: ${TEXT_PRIMARY}; line-height: 1.7;">${text}</p>`
}

/** Primary gold CTA button */
function button(text: string, url: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR}, #c49b3a); border-radius: 8px;">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; color: #0f1115; text-decoration: none; letter-spacing: 0.3px;">${text}</a>
            </td>
        </tr>
    </table>`
}

/** Secondary outline/ghost button */
function secondaryButton(text: string, url: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 12px 0;">
        <tr>
            <td style="border: 1px solid ${BORDER}; border-radius: 8px; background-color: ${BG_ELEVATED};">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 600; color: ${BRAND_COLOR}; text-decoration: none; letter-spacing: 0.3px;">${text}</a>
            </td>
        </tr>
    </table>`
}

function divider(): string {
    return `<hr style="border: none; border-top: 1px solid ${BORDER}; margin: 24px 0;">`
}

function infoRow(label: string, value: string): string {
    return `<tr>
        <td style="padding: 8px 0; font-size: 13px; color: ${TEXT_SECONDARY}; width: 120px; vertical-align: top;">${label}</td>
        <td style="padding: 8px 0; font-size: 13px; color: ${TEXT_PRIMARY}; font-weight: 600;">${value}</td>
    </tr>`
}

/** Styled info card with optional left-border accent */
function infoCard(content: string, accentColor?: string): string {
    const borderLeft = accentColor ? `border-left: 3px solid ${accentColor};` : ''
    return `<div style="background-color: ${BG_DARK}; border-radius: 8px; padding: 18px 22px; margin-bottom: 24px; ${borderLeft}">
        ${content}
    </div>`
}

// ──────────────────────────────────────────────────────────────
// Templates
// ──────────────────────────────────────────────────────────────

export function welcomeEmail(name: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading(`Welcome to AIM Studio, ${name}! 🎬`)}
        ${subtext('Your account has been created successfully.')}
        ${paragraph('You now have access to our exclusive AI-powered filmmaking platform. Explore our films, apply for casting calls, track your applications, and more.')}
        ${siteUrl ? button('Explore AIM Studio →', siteUrl) : ''}
        ${paragraph('If you have any questions, feel free to reach out through our contact page.')}
    `, `Welcome to AIM Studio, ${name}!`)
}

export function subscribeConfirmation(name?: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading(`You're In! 🎉`)}
        ${subtext(name ? `Hey ${name}, thanks for subscribing!` : 'Thanks for subscribing!')}
        ${paragraph("You'll be the first to know about our upcoming projects, casting calls, behind-the-scenes content, and exclusive announcements.")}
        ${paragraph("We don't spam. Only meaningful updates when we have something worth sharing.")}
        ${siteUrl ? `${divider()}${button('Visit AIM Studio', siteUrl)}` : ''}
    `, 'Subscription confirmed! Welcome to AIM Studio')
}

export function contactAcknowledgment(name: string, subject: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('Message Received ✓')}
        ${subtext(`Hi ${name}, we got your message.`)}
        ${paragraph(`Your message regarding "<strong>${subject}</strong>" has been received. Our team will review it and get back to you as soon as possible.`)}
        ${paragraph('Typical response time is 1 to 3 business days.')}
        ${siteUrl ? `${divider()}${secondaryButton('Back to Homepage', siteUrl)}` : ''}
    `, `We received your message about "${subject}"`)
}

export function contactAdminNotification(name: string, email: string, subject: string, message: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('📬 New Contact Message')}
        ${subtext('Someone reached out through the contact form.')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
            ${infoRow('From', name)}
            ${infoRow('Email', email)}
            ${infoRow('Subject', subject)}
        </table>
        ${divider()}
        ${infoCard(`<p style="margin: 0; font-size: 14px; color: ${TEXT_PRIMARY}; line-height: 1.7; white-space: pre-wrap;">${message}</p>`)}
        ${siteUrl ? secondaryButton('Open Admin Panel', `${siteUrl}/admin`) : ''}
    `, `New contact: ${subject} from ${name}`)
}

export function donationThankYou(name: string, amount: number, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('Thank You for Your Generosity! 💛')}
        ${subtext(`Dear ${name}, your support means the world to us.`)}
        <div style="text-align: center; padding: 24px 0;">
            <div style="display: inline-block; padding: 20px 40px; background-color: ${BG_DARK}; border-radius: 12px; border: 2px solid ${BRAND_COLOR};">
                <div style="font-size: 42px; font-weight: 800; color: ${BRAND_COLOR};">$${amount.toFixed(2)}</div>
                <div style="font-size: 13px; color: ${TEXT_SECONDARY}; margin-top: 6px;">Donation received</div>
            </div>
        </div>
        ${divider()}
        ${paragraph('Your contribution directly supports independent AI-powered filmmaking. Every dollar helps us push the boundaries of visual storytelling.')}
        ${paragraph('This email serves as your donation receipt for your records.')}
        ${siteUrl ? `${button('Visit AIM Studio', siteUrl)}` : ''}
    `, `Thank you for your $${amount.toFixed(2)} donation`)
}

export function donationAdminNotification(name: string, email: string, amount: number, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('💰 New Donation Received')}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Donor', name)}
                ${infoRow('Email', email)}
                ${infoRow('Amount', `<span style="color: ${ACCENT_GREEN}; font-weight: 700;">$${amount.toFixed(2)}</span>`)}
            </table>
        `, ACCENT_GREEN)}
        ${siteUrl ? secondaryButton('View Donations', `${siteUrl}/admin/donations`) : ''}
    `, `New donation: $${amount.toFixed(2)} from ${name}`)
}

export function applicationConfirmation(name: string, roleName: string, projectTitle?: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('Application Received! 🎭')}
        ${subtext(`Hi ${name}, thanks for applying.`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Role', roleName)}
                ${projectTitle ? infoRow('Project', projectTitle) : ''}
                ${infoRow('Status', '📋 Submitted')}
            </table>
        `, BRAND_COLOR)}
        ${paragraph("Your application has been submitted successfully. Our casting team will review it carefully. You'll receive updates as your application progresses through our review process.")}
        ${paragraph('Good luck! 🤞')}
        ${siteUrl ? button('View Your Dashboard', `${siteUrl}/dashboard`) : ''}
    `, `Application received for ${roleName}`)
}

export function applicationAdminNotification(name: string, email: string, roleName: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('📋 New Casting Application')}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Applicant', name)}
                ${infoRow('Email', email)}
                ${infoRow('Role', roleName)}
            </table>
        `, ACCENT_BLUE)}
        ${siteUrl ? secondaryButton('Review Applications', `${siteUrl}/admin/applications`) : ''}
    `, `New application for ${roleName} from ${name}`)
}

export function applicationStatusUpdate(name: string, roleName: string, newStatus: string, note?: string, siteUrl?: string): string {
    const statusLabels: Record<string, { emoji: string; label: string; color: string }> = {
        'under-review':    { emoji: '🔍', label: 'Under Review', color: ACCENT_BLUE },
        'under_review':    { emoji: '🔍', label: 'Under Review', color: ACCENT_BLUE },
        'shortlisted':     { emoji: '⭐', label: 'Shortlisted', color: '#f59e0b' },
        'callback':        { emoji: '✉️', label: 'Contacted', color: '#8b5cf6' },
        'contacted':       { emoji: '✉️', label: 'Contacted', color: '#8b5cf6' },
        'audition':        { emoji: '🎭', label: 'Moving to Next Round', color: '#8b5cf6' },
        'final-review':    { emoji: '🎯', label: 'Final Review', color: '#ec4899' },
        'final_review':    { emoji: '🎯', label: 'Final Review', color: '#ec4899' },
        'selected':        { emoji: '🎉', label: 'Selected for the Role!', color: ACCENT_GREEN },
        // All non-selection variants use professional, compassionate language
        'not-selected':    { emoji: '🎬', label: 'Not Selected at This Time', color: '#6b7280' },
        'not_selected':    { emoji: '🎬', label: 'Not Selected at This Time', color: '#6b7280' },
        'rejected':        { emoji: '🎬', label: 'Not Selected at This Time', color: '#6b7280' },
        'withdrawn':       { emoji: '📋', label: 'Application Withdrawn', color: '#6b7280' },
    }
    const st = statusLabels[newStatus] || { emoji: '📋', label: newStatus.replace(/_/g, ' ').replace(/-/g, ' '), color: TEXT_SECONDARY }

    // For non-selection, use a special compassionate message body
    const isNotSelected = ['rejected', 'not_selected', 'not-selected'].includes(newStatus)
    const mainMessage = isNotSelected
        ? paragraph(`We wanted to reach out with an update on your application for the <strong>${roleName}</strong> role. After thoughtful review, we've decided to move forward with other candidates for this particular role.`)
        + paragraph(`Please know that this is never an easy decision, and we truly appreciate your interest and the time you invested in your application. We encourage you to explore other roles on our platform — your passion for this craft is exactly what we look for.`)
        : paragraph(`There's an update on your application for the <strong>${roleName}</strong> role.`)

    return emailWrapper(`
        ${heading('Application Update')}
        ${subtext(`Hi ${name}, we have news for you.`)}
        <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 36px; margin-bottom: 8px;">${st.emoji}</div>
            <div style="display: inline-block; padding: 8px 24px; background-color: ${BG_DARK}; border-radius: 20px; border: 1px solid ${st.color};">
                <span style="font-size: 16px; font-weight: 700; color: ${st.color};">${st.label}</span>
            </div>
            <div style="font-size: 13px; color: ${TEXT_SECONDARY}; margin-top: 10px;">Role: ${roleName}</div>
        </div>
        ${divider()}
        ${mainMessage}
        ${note ? divider() + paragraph(`<em style="color: ${TEXT_SECONDARY};">${note}</em>`) : ''}
        ${siteUrl ? button('View More Casting Roles', `${siteUrl}/casting`) : ''}
    `, `Application update for ${roleName}`)
}


export function forgotPasswordCode(name: string, code: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('Password Reset Code')}
        ${subtext(`Hi ${name}, you requested a password reset.`)}
        <div style="text-align: center; padding: 24px 0;">
            <div style="display: inline-block; padding: 18px 44px; background-color: ${BG_DARK}; border-radius: 12px; border: 2px solid ${BRAND_COLOR};">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: ${BRAND_COLOR}; font-family: 'Courier New', monospace;">${code}</span>
            </div>
            <p style="margin: 12px 0 0; font-size: 13px; color: ${TEXT_SECONDARY};">This code expires in <strong style="color: ${TEXT_PRIMARY};">10 minutes</strong>.</p>
        </div>
        ${divider()}
        ${paragraph("Enter this code on the password reset page to set a new password. If you didn't request this, you can safely ignore this email.")}
        ${siteUrl ? secondaryButton('Back to Homepage', siteUrl) : ''}
    `, `Your AIM Studio password reset code is ${code}`)
}

export function scriptSubmissionConfirmation(name: string, title: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('Script Submitted! ✍️')}
        ${subtext(`Hi ${name}, your submission has been received.`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Script', title)}
                ${infoRow('Status', '📋 Submitted')}
            </table>
        `, BRAND_COLOR)}
        ${paragraph('Our team will review your screenplay submission. If selected, we may reach out for further discussion.')}
        ${paragraph('Thank you for sharing your creative work with us!')}
        ${siteUrl ? `${divider()}${button('View Your Dashboard', `${siteUrl}/dashboard`)}${secondaryButton('Visit Homepage', siteUrl)}` : ''}
    `, `Script "${title}" submitted successfully`)
}

export function verificationEmail(name: string, code: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('Confirm Your Email Address 📧')}
        ${subtext(`Hi ${name}, enter this code to activate your account.`)}
        <div style="text-align: center; padding: 28px 0;">
            <div style="display: inline-block; padding: 20px 48px; background-color: ${BG_DARK}; border-radius: 14px; border: 2px solid ${BRAND_COLOR};">
                <span style="font-size: 40px; font-weight: 800; letter-spacing: 14px; color: ${BRAND_COLOR}; font-family: 'Courier New', monospace;">${code}</span>
            </div>
            <p style="margin: 14px 0 0; font-size: 13px; color: ${TEXT_SECONDARY};">This code expires in <strong style="color: ${TEXT_PRIMARY};">15 minutes</strong>.</p>
        </div>
        ${divider()}
        ${paragraph("Enter this 6-digit code on the verification page to confirm your email and activate your AIM Studio account.")}
        ${paragraph("If you did not create this account, you can safely ignore this email.")}
        ${siteUrl ? secondaryButton('Visit AIM Studio', siteUrl) : ''}
    `, `Your AIM Studio verification code is ${code}`)
}

export function passwordChangedEmail(name: string, siteUrl?: string): string {
    const changedAt = new Date().toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    })
    return emailWrapper(`
        ${heading('Your Password Was Changed 🔐')}
        ${subtext(`Hi ${name}, this is a security notice for your AIM Studio account.`)}
        ${infoCard(`
            <p style="margin: 0; font-size: 13px; color: ${TEXT_SECONDARY}; margin-bottom: 4px;">Changed on</p>
            <p style="margin: 0; font-size: 15px; color: ${TEXT_PRIMARY}; font-weight: 600;">${changedAt}</p>
        `, BRAND_COLOR)}
        ${paragraph('If you made this change, you can safely ignore this email. You are all set.')}
        ${paragraph(`<strong style="color: ${ACCENT_RED};">If you did NOT make this change</strong>, someone may have accessed your account. Please contact us immediately and secure your email account.`)}
        ${siteUrl ? `${button('Contact Us Now', `${siteUrl}/contact`)}${secondaryButton('Visit Homepage', siteUrl)}` : ''}
    `, 'Your AIM Studio password was changed')
}

/**
 * Email sent when a login occurs from an unrecognized device.
 * Includes a "Change Password" button linking to the forgot-password page.
 */
export function newDeviceLoginEmail(name: string, deviceInfo: { ip: string; ua: string }, siteUrl?: string): string {
    const loginTime = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
    return emailWrapper(`
        ${heading('New Device Login Detected 🚨')}
        ${subtext(`Hi ${name}, we noticed a login to your account from a new device.`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Date', loginTime)}
                ${infoRow('Device', deviceInfo.ua || 'Unknown')}
                ${infoRow('IP Address', deviceInfo.ip || 'Unknown')}
            </table>
        `, ACCENT_RED)}
        ${paragraph('If this was you, you can safely ignore this email.')}
        ${paragraph(`<strong style="color: ${ACCENT_RED};">If you did NOT recognize this login</strong>, please change your password immediately to secure your account.`)}
        ${siteUrl ? `${divider()}${button('Change Password', `${siteUrl}/forgot-password`)}${secondaryButton('Visit Homepage', siteUrl)}` : ''}
    `, 'New device login alert for your AIM Studio account')
}

// ──────────────────────────────────────────────────────────────
// DB-aware async wrappers — apply admin overrides before rendering
// Use these instead of the plain functions when sending real emails
// ──────────────────────────────────────────────────────────────

export async function welcomeEmailWithOverrides(name: string, siteUrl?: string): Promise<string> {
    const f = await mergeFields('welcome', {
        heading: `Welcome to AIM Studio, ${name}! 🎬`,
        body: 'You now have access to our exclusive AI-powered filmmaking platform. Explore our films, apply for casting calls, track your applications, and more.',
        buttonText: 'Explore AIM Studio →',
        buttonUrl: siteUrl || '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext('Your account has been created successfully.')}
        ${paragraph(f.body)}
        ${f.buttonUrl ? button(f.buttonText, f.buttonUrl) : ''}
        ${paragraph('If you have any questions, feel free to reach out through our contact page.')}
    `, `Welcome to AIM Studio, ${name}!`)
}

export async function subscribeConfirmationWithOverrides(name?: string, siteUrl?: string): Promise<string> {
    const f = await mergeFields('subscribe', {
        heading: "You're In! 🎉",
        body: "You'll be the first to know about our upcoming projects, casting calls, behind-the-scenes content, and exclusive announcements.",
        buttonText: 'Visit AIM Studio',
        buttonUrl: siteUrl || '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(name ? `Hey ${name}, thanks for subscribing!` : 'Thanks for subscribing!')}
        ${paragraph(f.body)}
        ${paragraph("We don't spam. Only meaningful updates when we have something worth sharing.")}
        ${f.buttonUrl ? `${divider()}${button(f.buttonText, f.buttonUrl)}` : ''}
    `, 'Subscription confirmed! Welcome to AIM Studio')
}

export async function contactAcknowledgmentWithOverrides(name: string, subject: string, siteUrl?: string): Promise<string> {
    const f = await mergeFields('contact', {
        heading: 'Message Received ✓',
        body: 'Typical response time is 1 to 3 business days.',
        buttonText: 'Back to Homepage',
        buttonUrl: siteUrl || '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Hi ${name}, we got your message.`)}
        ${paragraph(`Your message regarding "<strong>${subject}</strong>" has been received. Our team will review it and get back to you as soon as possible.`)}
        ${paragraph(f.body)}
        ${f.buttonUrl ? `${divider()}${secondaryButton(f.buttonText, f.buttonUrl)}` : ''}
    `, `We received your message about "${subject}"`)
}

export async function donationThankYouWithOverrides(name: string, amount: number, siteUrl?: string): Promise<string> {
    const f = await mergeFields('donation', {
        heading: 'Thank You for Your Generosity! 💛',
        body: 'Your contribution directly supports independent AI-powered filmmaking. Every dollar helps us push the boundaries of visual storytelling.',
        buttonText: 'Visit AIM Studio',
        buttonUrl: siteUrl || '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Dear ${name}, your support means the world to us.`)}
        <div style="text-align: center; padding: 24px 0;">
            <div style="display: inline-block; padding: 20px 40px; background-color: ${BG_DARK}; border-radius: 12px; border: 2px solid ${BRAND_COLOR};">
                <div style="font-size: 42px; font-weight: 800; color: ${BRAND_COLOR};">$${amount.toFixed(2)}</div>
                <div style="font-size: 13px; color: ${TEXT_SECONDARY}; margin-top: 6px;">Donation received</div>
            </div>
        </div>
        ${divider()}
        ${paragraph(f.body)}
        ${paragraph('This email serves as your donation receipt for your records.')}
        ${f.buttonUrl ? button(f.buttonText, f.buttonUrl) : ''}
    `, `Thank you for your $${amount.toFixed(2)} donation`)
}

export async function applicationConfirmationWithOverrides(name: string, roleName: string, projectTitle?: string, siteUrl?: string): Promise<string> {
    const f = await mergeFields('application', {
        heading: 'Application Received! 🎭',
        body: "Your application has been submitted successfully. Our casting team will review it carefully. You'll receive updates as your application progresses through our review process.",
        buttonText: 'View Your Dashboard',
        buttonUrl: siteUrl ? `${siteUrl}/dashboard` : '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Hi ${name}, thanks for applying.`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Role', roleName)}
                ${projectTitle ? infoRow('Project', projectTitle) : ''}
                ${infoRow('Status', '📋 Submitted')}
            </table>
        `, BRAND_COLOR)}
        ${paragraph(f.body)}
        ${paragraph('Good luck! 🤞')}
        ${f.buttonUrl ? button(f.buttonText, f.buttonUrl) : ''}
    `, `Application received for ${roleName}`)
}

export async function scriptSubmissionConfirmationWithOverrides(name: string, title: string, siteUrl?: string): Promise<string> {
    const f = await mergeFields('scriptSubmission', {
        heading: 'Script Submitted! ✍️',
        body: 'Our team will review your screenplay submission. If selected, we may reach out for further discussion.',
        buttonText: 'View Your Dashboard',
        buttonUrl: siteUrl ? `${siteUrl}/dashboard` : '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Hi ${name}, your submission has been received.`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Script', title)}
                ${infoRow('Status', '📋 Submitted')}
            </table>
        `, BRAND_COLOR)}
        ${paragraph(f.body)}
        ${paragraph('Thank you for sharing your creative work with us!')}
        ${f.buttonUrl ? `${divider()}${button(f.buttonText, f.buttonUrl)}${secondaryButton('Visit Homepage', siteUrl || '')}` : ''}
    `, `Script "${title}" submitted successfully`)
}

// ── Broadcast Notification Templates ─────────────────────────────────────────

/** Sent to all opted-in users when admin publishes a new casting role */
export function newCastingRoleEmail(roleName: string, projectTitle: string, applyUrl: string): string {
    return emailWrapper(`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">🎭</div>
            <div style="display:inline-block;padding:6px 18px;background:${BG_DARK};border-radius:20px;border:1px solid ${BRAND_COLOR};">
                <span style="font-size:12px;font-weight:700;color:${BRAND_COLOR};letter-spacing:1.5px;text-transform:uppercase;">New Casting Call</span>
            </div>
        </div>
        ${heading(`Now Open: ${roleName}`)}
        ${subtext(`A new audition opportunity in <strong style="color:${BRAND_COLOR};">${projectTitle}</strong> is now live.`)}
        ${paragraph('Our casting team has just opened a new role. Applications are reviewed on a rolling basis — early applicants get priority attention.')}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Role', roleName)}
                ${infoRow('Project', projectTitle)}
                ${infoRow('Status', '<span style="color:#10b981;font-weight:700;">● Open</span>')}
            </table>
        `, BRAND_COLOR)}
        ${button('Apply Now →', applyUrl)}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">Roles close once filled. Don’t miss your chance.</span>`)}
    `, `New audition open: ${roleName} — Apply now`)
}

/** Sent to all opted-in users for platform announcements */
export function announcementEmail(title: string, message: string, link?: string, siteUrl?: string): string {
    const ctaUrl = link
        ? (link.startsWith('http') ? link : `${siteUrl || 'https://impactaistudio.com'}${link}`)
        : `${siteUrl || 'https://impactaistudio.com'}/notifications`
    const ctaText = link ? 'View Announcement →' : 'View in Notifications →'
    return emailWrapper(`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">📣</div>
            <div style="display:inline-block;padding:6px 18px;background:${BG_DARK};border-radius:20px;border:1px solid #8b5cf6;">
                <span style="font-size:12px;font-weight:700;color:#8b5cf6;letter-spacing:1.5px;text-transform:uppercase;">Platform Announcement</span>
            </div>
        </div>
        ${heading(title)}
        ${paragraph(message)}
        ${button(ctaText, ctaUrl)}
        ${divider()}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">You're receiving this because you opted in to platform announcements. <a href="${siteUrl || 'https://impactaistudio.com'}/notifications" style="color:#6b7280;text-decoration:underline;">Manage preferences</a></span>`)}
    `, title)
}

/** Sent to opted-in users when admin publishes new content */
export function contentPublishEmail(contentTitle: string, contentType: string, link: string): string {
    const typeEmoji: Record<string, string> = { project: '🎬', video: '▶️', blog: '📝', training: '🎓', default: '✨' }
    const emoji = typeEmoji[contentType.toLowerCase()] ?? typeEmoji.default
    return emailWrapper(`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">${emoji}</div>
            <div style="display:inline-block;padding:6px 18px;background:${BG_DARK};border-radius:20px;border:1px solid ${ACCENT_BLUE};">
                <span style="font-size:12px;font-weight:700;color:${ACCENT_BLUE};letter-spacing:1.5px;text-transform:uppercase;">New ${contentType}</span>
            </div>
        </div>
        ${heading(`Just Published: ${contentTitle}`)}
        ${paragraph(`We just released new ${contentType.toLowerCase()} content. Check it out on the platform.`)}
        ${button(`View ${contentType} →`, link)}
        ${divider()}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">You’re receiving this because you opted in to content updates.</span>`)}
    `, `New ${contentType}: ${contentTitle}`)
}
