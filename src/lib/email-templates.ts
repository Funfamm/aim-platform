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
import { t as emailT } from './email-i18n'

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
function emailWrapper(content: string, preheader?: string, footerText?: string, locale = 'en'): string {
    const tagline    = emailT('emailWrapper', locale, 'tagline') || 'AI-Powered Filmmaking'
    const autoFooter = footerText ?? (emailT('emailWrapper', locale, 'autoFooter') || 'This email was sent automatically. Please do not reply directly.')
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
                                &copy; ${new Date().getFullYear()} AIM Studio &bull; ${tagline}
                            </p>
                            <p style="margin: 8px 0 0; font-size: 11px; color: #6b7280;">
                                ${autoFooter}
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

/** Primary gold CTA button — uses table layout for bulletproof mobile tap targets */
function button(text: string, url: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
            <td align="center" style="background-color: ${BRAND_COLOR}; border-radius: 8px;">
                <a href="${url}" target="_blank" style="display: block; padding: 14px 32px; font-size: 14px; font-weight: 700; color: #0f1115; text-decoration: none; letter-spacing: 0.3px; mso-padding-alt: 14px 32px;">${text}</a>
            </td>
        </tr>
    </table>
    <p style="margin: 0; font-size: 11px; color: #6b7280; word-break: break-all;">Or copy this link: <a href="${url}" style="color: ${BRAND_COLOR}; text-decoration: underline;">${url}</a></p>`
}

/** Secondary outline/ghost button — uses table layout for bulletproof mobile tap targets */
function secondaryButton(text: string, url: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 12px 0;">
        <tr>
            <td align="center" style="border: 1px solid ${BORDER}; border-radius: 8px; background-color: ${BG_ELEVATED};">
                <a href="${url}" target="_blank" style="display: block; padding: 12px 28px; font-size: 13px; font-weight: 600; color: ${BRAND_COLOR}; text-decoration: none; letter-spacing: 0.3px; mso-padding-alt: 12px 28px;">${text}</a>
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

export async function contactAcknowledgmentWithOverrides(name: string, subject: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const localizedSubject   = (emailT('contactAcknowledgment', locale, 'subject')   || 'We received your message: {subject}').replace('{subject}', subject)
    const localizedBodyIntro = (emailT('contactAcknowledgment', locale, 'bodyIntro') || 'Your message regarding "{subject}" has been received. Our team will review it and get back to you as soon as possible.').replace(/{subject}/g, subject)
    const localizedFooter    =  emailT('contactAcknowledgment', locale, 'footerAuto') || 'This email was sent automatically. Please do not reply directly.'
    const f = await mergeFields('contact', {
        heading:    emailT('contactAcknowledgment', locale, 'heading') || 'Message Received ✓',
        body:       emailT('contactAcknowledgment', locale, 'body') || 'Typical response time is 1 to 3 business days.',
        buttonText: emailT('contactAcknowledgment', locale, 'buttonText') || 'Back to Homepage',
        buttonUrl:  siteUrl || '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Hi ${name}, ${emailT('contactAcknowledgment', locale, 'subtext') || 'we got your message.'}`)}
        ${paragraph(localizedBodyIntro)}
        ${paragraph(f.body)}
        ${f.buttonUrl ? `${divider()}${secondaryButton(f.buttonText, f.buttonUrl)}` : ''}
    `, localizedSubject, localizedFooter)
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

export function applicationStatusUpdate(name: string, roleName: string, newStatus: string, note?: string, siteUrl?: string, locale = 'en'): string {
    // Normalise status key (both 'under-review' and 'under_review' map to 'under_review')
    const normStatus = newStatus.replace(/-/g, '_')
    // Map status -> i18n section key
    const i18nKeyMap: Record<string, string> = {
        under_review: 'castingStatus_under_review',
        shortlisted:  'castingStatus_shortlisted',
        callback:     'castingStatus_callback',
        contacted:    'castingStatus_callback',
        audition:     'castingStatus_callback',
        final_review: 'castingStatus_shortlisted',
        selected:     'castingStatus_selected',
        not_selected: 'castingStatus_not_selected',
        rejected:     'castingStatus_not_selected',
        withdrawn:    'castingStatus_not_selected',
    }
    const i18nKey = i18nKeyMap[normStatus] || 'castingStatus_under_review'
    // Pull fully localized strings from static map
    const localizedSubject  = (emailT(i18nKey, locale, 'subject')  || 'Application Update').replace('{role}', roleName)
    const localizedHeading  =  emailT(i18nKey, locale, 'heading')  || emailT('applicationStatusUpdate', locale, 'heading') || 'Application Update'
    const localizedBody     =  emailT(i18nKey, locale, 'body')     || ''
    const localizedLabel    =  emailT(i18nKey, locale, 'label')    || normStatus.replace(/_/g, ' ')
    const localizedButton   =  emailT('applicationStatusUpdate', locale, 'buttonText') || 'View More Casting Roles'
    const localizedSubtext  =  emailT('applicationStatusUpdate', locale, 'subtext')   || 'we have news for you.'
    // Status display colours
    const colorMap: Record<string, string> = {
        under_review: ACCENT_BLUE, shortlisted: '#f59e0b',
        callback: '#8b5cf6', contacted: '#8b5cf6', audition: '#8b5cf6',
        final_review: '#ec4899', selected: ACCENT_GREEN,
        not_selected: '#6b7280', rejected: '#6b7280', withdrawn: '#6b7280',
    }
    const emojiMap: Record<string, string> = {
        under_review: '🔍', shortlisted: '⭐', callback: '✉️', contacted: '✉️',
        audition: '🎭', final_review: '🎯', selected: '🎉',
        not_selected: '🎬', rejected: '🎬', withdrawn: '📋',
    }
    const color = colorMap[normStatus] || TEXT_SECONDARY
    const emoji = emojiMap[normStatus] || '📋'
    const isNotSelected = ['rejected', 'not_selected', 'withdrawn'].includes(normStatus)
    const mainMessage = localizedBody
        ? paragraph(localizedBody)
        : (isNotSelected
            ? paragraph(`We appreciate your interest and the time you invested in your application for <strong>${roleName}</strong>. We encourage you to explore other roles.`)
            : paragraph(`There's an update on your application for the <strong>${roleName}</strong> role.`))
    return emailWrapper(`
        ${heading(localizedHeading)}
        ${subtext(`Hi ${name}, ${localizedSubtext}`)}
        <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 36px; margin-bottom: 8px;">${emoji}</div>
            <div style="display: inline-block; padding: 8px 24px; background-color: ${BG_DARK}; border-radius: 20px; border: 1px solid ${color};">
                <span style="font-size: 16px; font-weight: 700; color: ${color};">${localizedLabel}</span>
            </div>
        </div>
        ${divider()}
        ${mainMessage}
        ${note ? divider() + paragraph(`<em style="color: ${TEXT_SECONDARY};">${note}</em>`) : ''}
        ${siteUrl ? button(localizedButton, `${siteUrl}/casting`) : ''}
    `, localizedSubject)
}


/** Locale-aware MFA OTP email — use this in all routes */
export async function mfaOtpEmailLocalized(name: string, code: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const h   = emailT('securityVerification', locale, 'heading')    || 'Two-Factor Authentication Code 🔐'
    const sub = emailT('securityVerification', locale, 'subtext')    || 'use the code below to complete your sign-in.'
    const exp = emailT('securityVerification', locale, 'expiry')     || 'This code expires in'
    const tm  = emailT('securityVerification', locale, 'expiryTime') || '10 minutes'
    const ign = emailT('securityVerification', locale, 'ignore')     || 'If you did not create this account, you can safely ignore this email.'
    const btn = emailT('securityVerification', locale, 'button')     || 'Visit AIM Studio'
    return emailWrapper(`
        ${heading(h)}
        ${subtext(`Hi ${name}, ${sub}`)}
        <div style="text-align: center; padding: 28px 0;">
            <div style="display: inline-block; padding: 20px 48px; background-color: ${BG_DARK}; border-radius: 14px; border: 2px solid ${BRAND_COLOR};">
                <span style="font-size: 40px; font-weight: 800; letter-spacing: 14px; color: ${BRAND_COLOR}; font-family: 'Courier New', monospace;">${code}</span>
            </div>
            <p style="margin: 14px 0 0; font-size: 13px; color: ${TEXT_SECONDARY};">${exp} <strong style="color: ${TEXT_PRIMARY};">${tm}</strong>.</p>
        </div>
        ${divider()}
        ${paragraph(ign)}
        ${siteUrl ? secondaryButton(btn, `${siteUrl}/contact`) : ''}
    `, `Your AIM Studio sign-in code is ${code}`)
}

/** Sync English-only version — kept for backward compatibility */
export function mfaOtpEmail(name: string, code: string, siteUrl?: string): string {
    return emailWrapper(`
        ${heading('Two-Factor Authentication Code 🔐')}
        ${subtext(`Hi ${name}, use the code below to complete your sign-in.`)}
        <div style="text-align: center; padding: 28px 0;">
            <div style="display: inline-block; padding: 20px 48px; background-color: ${BG_DARK}; border-radius: 14px; border: 2px solid ${BRAND_COLOR};">
                <span style="font-size: 40px; font-weight: 800; letter-spacing: 14px; color: ${BRAND_COLOR}; font-family: 'Courier New', monospace;">${code}</span>
            </div>
            <p style="margin: 14px 0 0; font-size: 13px; color: ${TEXT_SECONDARY};">This code expires in <strong style="color: ${TEXT_PRIMARY};">10 minutes</strong>.</p>
        </div>
        ${divider()}
        ${paragraph("Enter this 6-digit code on the login page to complete your sign-in. This code can only be used once.")}
        ${paragraph(`<strong style="color: ${ACCENT_RED};">If you did not request this code</strong>, please change your password immediately — someone may have your credentials.`)}
        ${siteUrl ? secondaryButton('Contact Support', `${siteUrl}/contact`) : ''}
    `, `Your AIM Studio sign-in code is ${code}`)
}

/** Locale-aware async version — use this in all routes */
export async function forgotPasswordCodeLocalized(name: string, code: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const heading_str    = emailT('securityForgotPassword', locale, 'heading')    || 'Password Reset Code'
    const subtext_str    = emailT('securityForgotPassword', locale, 'subtext')    || 'you requested a password reset.'
    const expiry_str     = emailT('securityForgotPassword', locale, 'expiry')     || 'This code expires in'
    const expiryTime_str = emailT('securityForgotPassword', locale, 'expiryTime') || '10 minutes'
    const body_str       = emailT('securityForgotPassword', locale, 'body')       || "Enter this code on the password reset page to set a new password."
    const button_str     = emailT('securityForgotPassword', locale, 'button')     || 'Back to Homepage'
    return emailWrapper(`
        ${heading(heading_str)}
        ${subtext(`Hi ${name}, ${subtext_str}`)}
        <div style="text-align: center; padding: 24px 0;">
            <div style="display: inline-block; padding: 18px 44px; background-color: ${BG_DARK}; border-radius: 12px; border: 2px solid ${BRAND_COLOR};">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: ${BRAND_COLOR}; font-family: 'Courier New', monospace;">${code}</span>
            </div>
            <p style="margin: 12px 0 0; font-size: 13px; color: ${TEXT_SECONDARY};">${expiry_str} <strong style="color: ${TEXT_PRIMARY};">${expiryTime_str}</strong>.</p>
        </div>
        ${divider()}
        ${paragraph(body_str)}
        ${siteUrl ? secondaryButton(button_str, siteUrl) : ''}
    `, `Your AIM Studio password reset code is ${code}`)
}

/** Sync English-only shim — kept for backward compatibility */
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

/** Locale-aware async version — use this in all routes */
export async function verificationEmailLocalized(name: string, code: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const h   = emailT('securityVerification', locale, 'heading')    || 'Confirm Your Email Address 📧'
    const sub = emailT('securityVerification', locale, 'subtext')    || 'enter this code to activate your account.'
    const exp = emailT('securityVerification', locale, 'expiry')     || 'This code expires in'
    const tm  = emailT('securityVerification', locale, 'expiryTime') || '15 minutes'
    const bod = emailT('securityVerification', locale, 'body')       || 'Enter this 6-digit code on the verification page to confirm your email and activate your AIM Studio account.'
    const ign = emailT('securityVerification', locale, 'ignore')     || 'If you did not create this account, you can safely ignore this email.'
    const btn = emailT('securityVerification', locale, 'button')     || 'Visit AIM Studio'
    return emailWrapper(`
        ${heading(h)}
        ${subtext(`Hi ${name}, ${sub}`)}
        <div style="text-align: center; padding: 28px 0;">
            <div style="display: inline-block; padding: 20px 48px; background-color: ${BG_DARK}; border-radius: 14px; border: 2px solid ${BRAND_COLOR};">
                <span style="font-size: 40px; font-weight: 800; letter-spacing: 14px; color: ${BRAND_COLOR}; font-family: 'Courier New', monospace;">${code}</span>
            </div>
            <p style="margin: 14px 0 0; font-size: 13px; color: ${TEXT_SECONDARY};">${exp} <strong style="color: ${TEXT_PRIMARY};">${tm}</strong>.</p>
        </div>
        ${divider()}
        ${paragraph(bod)}
        ${paragraph(ign)}
        ${siteUrl ? secondaryButton(btn, siteUrl) : ''}
    `, `Your AIM Studio verification code is ${code}`)
}

/** Sync English-only shim — kept for backward compatibility */
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

/** Locale-aware async version — use this in all routes */
export async function passwordChangedEmailLocalized(name: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const localeStr = locale === 'en' ? 'en-US' : locale
    const changedAt = new Date().toLocaleString(localeStr, { dateStyle: 'long', timeStyle: 'short' })
    const h    = emailT('securityPasswordChanged', locale, 'heading')       || 'Your Password Was Changed 🔐'
    const sub  = emailT('securityPasswordChanged', locale, 'subtext')       || 'this is a security notice for your AIM Studio account.'
    const chOn = emailT('securityPasswordChanged', locale, 'changedOn')     || 'Changed on'
    const safe = emailT('securityPasswordChanged', locale, 'safe')          || 'If you made this change, you are all set.'
    const warn = emailT('securityPasswordChanged', locale, 'warning')       || 'If you did NOT make this change, someone may have accessed your account. Please contact us immediately.'
    const btn1 = emailT('securityPasswordChanged', locale, 'buttonContact') || 'Contact Us Now'
    const btn2 = emailT('securityPasswordChanged', locale, 'buttonHome')    || 'Visit Homepage'
    return emailWrapper(`
        ${heading(h)}
        ${subtext(`Hi ${name}, ${sub}`)}
        ${infoCard(`
            <p style="margin: 0; font-size: 13px; color: ${TEXT_SECONDARY}; margin-bottom: 4px;">${chOn}</p>
            <p style="margin: 0; font-size: 15px; color: ${TEXT_PRIMARY}; font-weight: 600;">${changedAt}</p>
        `, BRAND_COLOR)}
        ${paragraph(safe)}
        ${paragraph(`<strong style="color: ${ACCENT_RED};">${warn}</strong>`)}
        ${siteUrl ? `${button(btn1, `${siteUrl}/contact`)}${secondaryButton(btn2, siteUrl)}` : ''}
    `, emailT('securityPasswordChanged', locale, 'subject') || 'Your AIM Studio password was changed')
}

/** Sync English-only shim — kept for backward compatibility */
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
 * Locale-aware async version — use this in all routes
 */
export async function newDeviceLoginEmailLocalized(name: string, deviceInfo: { ip: string; ua: string }, siteUrl?: string, locale = 'en'): Promise<string> {
    const localeStr = locale === 'en' ? 'en-US' : locale
    const loginTime = new Date().toLocaleString(localeStr, { dateStyle: 'long', timeStyle: 'short' })
    const h    = emailT('securityNewDevice', locale, 'heading')    || 'New Device Login Detected 🚨'
    const sub  = emailT('securityNewDevice', locale, 'subtext')    || 'we noticed a login to your account from a new device.'
    const date = emailT('securityNewDevice', locale, 'date')       || 'Date'
    const dev  = emailT('securityNewDevice', locale, 'device')     || 'Device'
    const ip   = emailT('securityNewDevice', locale, 'ipAddress')  || 'IP Address'
    const unk  = emailT('securityNewDevice', locale, 'unknown')    || 'Unknown'
    const safe = emailT('securityNewDevice', locale, 'safe')       || 'If this was you, you can safely ignore this email.'
    const warn = emailT('securityNewDevice', locale, 'warning')    || 'If you did NOT recognize this login, please change your password immediately.'
    const btn1 = emailT('securityNewDevice', locale, 'button')     || 'Change Password'
    const btn2 = emailT('securityNewDevice', locale, 'buttonHome') || 'Visit Homepage'
    return emailWrapper(`
        ${heading(h)}
        ${subtext(`Hi ${name}, ${sub}`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow(date, loginTime)}
                ${infoRow(dev, deviceInfo.ua || unk)}
                ${infoRow(ip, deviceInfo.ip || unk)}
            </table>
        `, ACCENT_RED)}
        ${paragraph(safe)}
        ${paragraph(`<strong style="color: ${ACCENT_RED};">${warn}</strong>`)}
        ${siteUrl ? `${divider()}${button(btn1, `${siteUrl}/forgot-password`)}${secondaryButton(btn2, siteUrl)}` : ''}
    `, emailT('securityNewDevice', locale, 'subject') || 'New device login alert for your AIM Studio account')
}

/**
 * Sync English-only shim — kept for backward compatibility.
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

export async function welcomeEmailWithOverrides(name: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const f = await mergeFields('welcome', {
        heading:    emailT('welcome', locale, 'heading') || `Welcome to AIM Studio, ${name}! 🎬`,
        subtext:    emailT('welcome', locale, 'subtext') || 'Your account has been created successfully.',
        body:       emailT('welcome', locale, 'body') || 'You now have access to our exclusive AI-powered filmmaking platform. Explore our films, apply for casting calls, track your applications, and more.',
        buttonText: emailT('welcome', locale, 'buttonText') || 'Explore AIM Studio →',
        footer:     emailT('welcome', locale, 'footer') || 'If you have any questions, feel free to reach out through our contact page.',
        buttonUrl:  siteUrl || '',
    })
    return emailWrapper(`
        ${heading(f.heading.replace('{name}', name))}
        ${subtext(f.subtext)}
        ${paragraph(f.body)}
        ${f.buttonUrl ? button(f.buttonText, f.buttonUrl) : ''}
        ${paragraph(f.footer)}
    `, `Welcome to AIM Studio, ${name}!`)
}

export async function subscribeConfirmationWithOverrides(name?: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const f = await mergeFields('subscribe', {
        heading:    emailT('subscribe', locale, 'heading')    || "You're In! 🎉",
        body:       emailT('subscribe', locale, 'body')       || "You'll be the first to know about our upcoming projects, casting calls, behind-the-scenes content, and exclusive announcements.",
        noSpam:     emailT('subscribe', locale, 'noSpam')     || "We don't spam. Only meaningful updates when we have something worth sharing.",
        buttonText: emailT('subscribe', locale, 'buttonText') || 'Visit AIM Studio',
        buttonUrl:  siteUrl || '',
        footer:     emailT('subscribe', locale, 'footer')     || "You received this email because you subscribed to updates from AIM Studio.",
    })
    const subtextStr = name
        ? (emailT('subscribe', locale, 'subtext') || 'Thanks for subscribing!').replace('{name}', name)
        : (emailT('subscribe', locale, 'subtext') || 'Thanks for subscribing!')
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(name ? `Hey ${name}, ${subtextStr.toLowerCase()}` : subtextStr)}
        ${paragraph(f.body)}
        ${paragraph(f.noSpam)}
        ${f.buttonUrl ? `${divider()}${button(f.buttonText, f.buttonUrl)}` : ''}
    `, 'Subscription confirmed! Welcome to AIM Studio')
}

/** Sent to brand-new subscribers on immediate confirmation — warm onboarding tone */
export async function subscribeWelcomeWithOverrides(name?: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const f = await mergeFields('subscribeWelcome', {
        heading:    emailT('subscribeWelcome', locale, 'heading')    || 'Welcome to AIM Studio! 🎬',
        subtext:    emailT('subscribeWelcome', locale, 'subtext')    || "We're glad you're here.",
        body:       emailT('subscribeWelcome', locale, 'body')       || "You're now part of our creative community. Here's what you can look forward to:",
        highlights: emailT('subscribeWelcome', locale, 'highlights') || '🎥 Early access to new film releases\n🎭 Casting call announcements\n🎬 Behind-the-scenes exclusives\n📢 Platform updates & news',
        noSpam:     emailT('subscribeWelcome', locale, 'noSpam')     || "We don't spam. Only meaningful updates when we have something worth sharing.",
        buttonText: emailT('subscribeWelcome', locale, 'buttonText') || 'Explore AIM Studio →',
        buttonUrl:  siteUrl || '',
    })
    const greetName = name ? `Hey ${name}, ` : ''
    const highlightItems = f.highlights.split('\n').filter(Boolean).map(
        item => `<tr><td style="padding: 4px 0; font-size: 14px; color: ${TEXT_PRIMARY}; line-height: 1.6;">${item}</td></tr>`
    ).join('')
    return emailWrapper(
        heading(f.heading) +
        subtext(`${greetName}${f.subtext}`) +
        paragraph(f.body) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 8px 0 24px; padding: 16px 20px; background-color: ${BG_DARK}; border-radius: 8px; border-left: 3px solid ${BRAND_COLOR};">${highlightItems}</table>` +
        paragraph(f.noSpam) +
        (f.buttonUrl ? divider() + button(f.buttonText, f.buttonUrl) : ''),
        emailT('subscribeWelcome', locale, 'subject') || 'Welcome to AIM Studio! 🎬'
    )
}
export async function subscribeWelcomeBackWithOverrides(name?: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const f = await mergeFields('subscribe', {
        heading:    emailT('subscribeWelcomeBack', locale, 'heading')    || 'Welcome Back! 🎬',
        body:       emailT('subscribeWelcomeBack', locale, 'body')       || "You've re-joined our newsletter. You'll be the first to know about new projects, casting calls, behind-the-scenes content, and exclusive announcements.",
        noSpam:     emailT('subscribeWelcomeBack', locale, 'noSpam')     || "We don't spam. Only meaningful updates when we have something worth sharing.",
        buttonText: emailT('subscribeWelcomeBack', locale, 'buttonText') || 'Visit AIM Studio',
        buttonUrl:  siteUrl || '',
        footer:     emailT('subscribeWelcomeBack', locale, 'footer')     || 'You received this email because you re-subscribed to updates from AIM Studio.',
    })
    const subtextStr = emailT('subscribeWelcomeBack', locale, 'subtext') || 'Great to have you with us again!'
    const subtextFinal = name ? subtextStr.replace('{name}', name) : subtextStr
    return emailWrapper(
        heading(f.heading) +
        subtext(name ? `Hey ${name}, ${subtextFinal.toLowerCase()}` : subtextFinal) +
        paragraph(f.body) +
        paragraph(f.noSpam) +
        (f.buttonUrl ? divider() + button(f.buttonText, f.buttonUrl) : ''),
        emailT('subscribeWelcomeBack', locale, 'subject') || 'Welcome back to AIM Studio! 🎬'
    )
}

export async function donationThankYouWithOverrides(name: string, amount: number, siteUrl?: string, locale = 'en'): Promise<string> {
    const f = await mergeFields('donation', {
        heading:          emailT('donationThankYou', locale, 'heading') || 'Thank You for Your Generosity! 💛',
        donationReceived: emailT('donationThankYou', locale, 'donationReceived') || 'Donation received',
        body:             emailT('donationThankYou', locale, 'body') || 'Your contribution directly supports independent AI-powered filmmaking. Every dollar helps us push the boundaries of visual storytelling.',
        receipt:          emailT('donationThankYou', locale, 'receipt') || 'This email serves as your donation receipt for your records.',
        buttonText:       emailT('donationThankYou', locale, 'buttonText') || 'Visit AIM Studio',
        buttonUrl:        siteUrl || '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Dear ${name}, ${emailT('donationThankYou', locale, 'subtext') || 'your support means the world to us.'}`)}
        <div style="text-align: center; padding: 24px 0;">
            <div style="display: inline-block; padding: 20px 40px; background-color: ${BG_DARK}; border-radius: 12px; border: 2px solid ${BRAND_COLOR};">
                <div style="font-size: 42px; font-weight: 800; color: ${BRAND_COLOR};">$${amount.toFixed(2)}</div>
                <div style="font-size: 13px; color: ${TEXT_SECONDARY}; margin-top: 6px;">${f.donationReceived}</div>
            </div>
        </div>
        ${divider()}
        ${paragraph(f.body)}
        ${paragraph(f.receipt)}
        ${f.buttonUrl ? button(f.buttonText, f.buttonUrl) : ''}
    `, `Thank you for your $${amount.toFixed(2)} donation`)
}

export async function applicationConfirmationWithOverrides(name: string, roleName: string, projectTitle?: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const f = await mergeFields('application', {
        heading:    emailT('applicationConfirmation', locale, 'heading') || 'Application Received! 🎭',
        body:       emailT('applicationConfirmation', locale, 'body') || "Your application has been submitted successfully. Our casting team will review it carefully. You'll receive updates as your application progresses.",
        luck:       emailT('applicationConfirmation', locale, 'luck') || 'Good luck! 🤞',
        buttonText: emailT('applicationConfirmation', locale, 'buttonText') || 'View Your Dashboard',
        buttonUrl:  siteUrl ? `${siteUrl}/dashboard` : '',
    })
    const roleLabel    = emailT('castingConfirmation', locale, 'roleLabel')      || 'Role'
    const projectLabel = emailT('castingConfirmation', locale, 'projectLabel')   || 'Project'
    const statusLabel  = emailT('castingConfirmation', locale, 'statusLabel')    || 'Status'
    const statusVal    = emailT('castingConfirmation', locale, 'statusSubmitted') || '📋 Submitted'
    const footer       = emailT('castingConfirmation', locale, 'footer') || 'You received this because you applied for a casting role on AIM Studio.'
    const subject      = (emailT('castingConfirmation', locale, 'subject') || 'Application received for {role} 🎭').replace('{role}', roleName)
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Hi ${name}, ${emailT('applicationConfirmation', locale, 'subtext') || 'thanks for applying.'}`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow(roleLabel, roleName)}
                ${projectTitle ? infoRow(projectLabel, projectTitle) : ''}
                ${infoRow(statusLabel, statusVal)}
            </table>
        `, BRAND_COLOR)}
        ${paragraph(f.body)}
        ${paragraph(f.luck)}
        ${f.buttonUrl ? button(f.buttonText, f.buttonUrl) : ''}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">${footer}</span>`)}
    `, subject)
}

/**
 * Sent when an applicant's AI audit result is revealed (resultVisibleAt has passed
 * or admin triggered "Reveal Now"). Locale-aware, no symbols — inline CSS only.
 */
export function auditResultRevealEmail(
    name: string,
    roleName: string,
    projectTitle: string,
    newStatus: string,
    statusNote: string | null | undefined,
    aiScore: number | null | undefined,
    siteUrl: string,
    locale = 'en'
): string {
    // Locale-aware strings for this template
    const aiReviewReadyMap: Record<string, string> = {
        en: 'AI Review Ready', ar: 'نتيجة المراجعة جاهزة', de: 'KI-Prüfung bereit',
        es: 'Revisión IA lista', fr: 'Examen IA prêt', hi: 'AI समीक्षा तैयार',
        ja: 'AI審査完了', ko: 'AI 심사 완료', pt: 'Revisão IA pronta',
        ru: 'Результат ИИ готов', zh: 'AI审核已完成',
    }
    const notSelectedMsgMap: Record<string, string> = {
        en: 'We appreciate your interest and the time you invested in your application. We encourage you to explore other casting opportunities on our platform.',
        ar: 'نقدر اهتمامك والوقت الذي خصصته لطلبك. نشجعك على استكشاف فرص الكاستينج الأخرى على منصتنا.',
        de: 'Wir schätzen dein Interesse und die Zeit, die du in deine Bewerbung investiert hast. Wir ermutigen dich, andere Casting-Möglichkeiten auf unserer Plattform zu erkunden.',
        es: 'Apreciamos tu interés y el tiempo que invertiste en tu solicitud. Te animamos a explorar otras oportunidades de casting en nuestra plataforma.',
        fr: "Nous apprécions votre intérêt et le temps que vous avez consacré à votre candidature. Nous vous encourageons à explorer d'autres opportunités de casting sur notre plateforme.",
        hi: 'हम आपकी रुचि और आवेदन में लगाए समय की सराहना करते हैं। हम आपको हमारे प्लेटफ़ॉर्म पर अन्य कास्टिंग अवसर खोजने के लिए प्रोत्साहित करते हैं।',
        ja: 'ご応募にかけていただいた時間と関心に感謝いたします。ぜひ他のキャスティング機会もご覧ください。',
        ko: '지원에 투자하신 시간과 관심에 감사드립니다. 플랫폼에서 다른 캐스팅 기회를 탐색해 보시길 권장합니다.',
        pt: 'Agradecemos seu interesse e o tempo investido em sua candidatura. Incentivamos você a explorar outras oportunidades de elenco em nossa plataforma.',
        ru: 'Мы ценим ваш интерес и время, вложенное в заявку. Рекомендуем изучить другие возможности кастинга на нашей платформе.',
        zh: '我们感谢您的兴趣和为申请付出的时间。我们鼓励您探索我们平台上的其他选角机会。',
    }
    const roleLabel    = emailT('castingConfirmation', locale, 'roleLabel')    || 'Role'
    const projectLabel = emailT('castingConfirmation', locale, 'projectLabel') || 'Project'
    const statusLabel  = emailT('castingConfirmation', locale, 'statusLabel')  || 'Status'
    const aiScoreLabel: Record<string, string> = {
        en: 'AI Score', ar: 'نقاط الذكاء الاصطناعي', de: 'KI-Bewertung',
        es: 'Puntuación IA', fr: 'Score IA', hi: 'AI स्कोर',
        ja: 'AIスコア', ko: 'AI 점수', pt: 'Pontuação IA',
        ru: 'Оценка ИИ', zh: 'AI评分',
    }

    const statusLabels: Record<string, { emoji: string; label: string; color: string }> = {
        submitted:    { emoji: '📋', label: 'Submitted',           color: ACCENT_BLUE },
        under_review: { emoji: '🔍', label: 'Under Review',        color: ACCENT_BLUE },
        shortlisted:  { emoji: '⭐', label: 'Shortlisted',          color: '#f59e0b' },
        callback:     { emoji: '✉️', label: 'Callback',             color: '#8b5cf6' },
        final_review: { emoji: '🎯', label: 'Final Review',         color: '#ec4899' },
        selected:     { emoji: '🎉', label: 'Selected for the Role!', color: ACCENT_GREEN },
        not_selected: { emoji: '🎬', label: 'Not Selected at This Time', color: '#6b7280' },
        rejected:     { emoji: '🎬', label: 'Not Selected at This Time', color: '#6b7280' },
    }
    const st = statusLabels[newStatus] ?? { emoji: '📋', label: newStatus.replace(/_/g, ' '), color: TEXT_SECONDARY }
    const isNotSelected = ['rejected', 'not_selected'].includes(newStatus)

    // Locale-aware subject lines (keep short, no special chars)
    const subjectMap: Record<string, string> = {
        en: `Your audition result for ${roleName} is ready`,
        ar: `نتيجة الأداء الخاصة بك لدور ${roleName} متاحة`,
        de: `Dein Vorsprechen-Ergebnis für ${roleName} ist bereit`,
        es: `Tu resultado de audición para ${roleName} está listo`,
        fr: `Votre résultat d'audition pour ${roleName} est disponible`,
        hi: `${roleName} भूमिका के लिए आपका ऑडिशन परिणाम तैयार है`,
        ja: `${roleName} のオーディション結果をご確認ください`,
        ko: `${roleName} 오디션 결과가 준비되었습니다`,
        pt: `Seu resultado de audição para ${roleName} está disponível`,
        ru: `Результат вашего кастинга на роль ${roleName} готов`,
        zh: `您参加 ${roleName} 试镜的结果已公布`,
    }

    // Locale-aware intro salutations (natural-sounding, no machine symbols)
    const introMap: Record<string, string> = {
        en: `your AI review for the <strong>${roleName}</strong> role in <em>${projectTitle}</em> is complete and ready to view.`,
        ar: `اكتملت مراجعة الذكاء الاصطناعي لطلبك على دور <strong>${roleName}</strong> في <em>${projectTitle}</em> وأصبحت متاحة للعرض.`,
        de: `deine KI-Überprüfung für die Rolle <strong>${roleName}</strong> in <em>${projectTitle}</em> ist abgeschlossen und kann eingesehen werden.`,
        es: `tu revisión de IA para el papel de <strong>${roleName}</strong> en <em>${projectTitle}</em> ha finalizado y está lista para ver.`,
        fr: `votre examen IA pour le rôle de <strong>${roleName}</strong> dans <em>${projectTitle}</em> est terminé et disponible.`,
        hi: `<em>${projectTitle}</em> में <strong>${roleName}</strong> भूमिका के लिए आपकी AI समीक्षा पूरी हो गई है।`,
        ja: `<em>${projectTitle}</em> の <strong>${roleName}</strong> 役のAI審査が完了しました。`,
        ko: `<em>${projectTitle}</em>의 <strong>${roleName}</strong> 역할에 대한 AI 심사가 완료되었습니다.`,
        pt: `sua revisão de IA para o papel de <strong>${roleName}</strong> em <em>${projectTitle}</em> está concluída e disponível.`,
        ru: `ваша AI-проверка для роли <strong>${roleName}</strong> в <em>${projectTitle}</em> завершена и готова к просмотру.`,
        zh: `您在 <em>${projectTitle}</em> 中 <strong>${roleName}</strong> 角色的AI审核已完成，可以查看结果。`,
    }

    const ctaMap: Record<string, string> = {
        en: 'View My Result',  ar: 'عرض نتيجتي',         de: 'Mein Ergebnis anzeigen',
        es: 'Ver mi resultado', fr: 'Voir mon résultat',   hi: 'मेरा परिणाम देखें',
        ja: '結果を確認する',   ko: '내 결과 보기',         pt: 'Ver meu resultado',
        ru: 'Просмотреть результат', zh: '查看我的结果',
    }

    const noteIntroMap: Record<string, string> = {
        en: 'Feedback from the team:',    ar: 'ملاحظات من الفريق:',         de: 'Feedback vom Team:',
        es: 'Comentarios del equipo:',    fr: "Commentaires de l'équipe :", hi: 'हमारी टीम की प्रतिक्रिया:',
        ja: 'チームからのフィードバック:', ko: '팀의 피드백:',                pt: 'Feedback da equipe:',
        ru: 'Отзыв команды:',             zh: '团队反馈：',
    }

    const intro      = introMap[locale]     ?? introMap['en']
    const cta        = ctaMap[locale]       ?? ctaMap['en']
    const noteIntro  = noteIntroMap[locale] ?? noteIntroMap['en']
    const subject    = subjectMap[locale]   ?? subjectMap['en']
    const dashUrl    = `${siteUrl}/dashboard`

    return emailWrapper(`
        <div style="text-align: center; padding: 20px 0 28px;">
            <div style="font-size: 52px; margin-bottom: 12px;">🎭</div>
            <div style="display: inline-block; padding: 6px 18px; background: ${BG_DARK}; border-radius: 20px; border: 1px solid ${st.color};">
                <span style="font-size: 12px; font-weight: 700; color: ${st.color}; letter-spacing: 1.5px; text-transform: uppercase;">${aiReviewReadyMap[locale] ?? aiReviewReadyMap['en']}</span>
            </div>
        </div>
        ${heading(`${st.emoji} ${st.label}`)}
        ${subtext(`Hi ${name}, ${intro}`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow(roleLabel, roleName)}
                ${infoRow(projectLabel, projectTitle)}
                ${infoRow(statusLabel, `<span style="color: ${st.color}; font-weight: 700;">${st.label}</span>`)}
                ${aiScore != null ? infoRow(aiScoreLabel[locale] ?? 'AI Score', `<span style="color: ${BRAND_COLOR}; font-weight: 800; font-size: 16px;">${aiScore}<span style="font-size: 11px; font-weight: 400; color: ${TEXT_SECONDARY};"> /100</span></span>`) : ''}
            </table>
        `, st.color)}
        ${statusNote
            ? `${divider()}<p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: ${TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px;">${noteIntro}</p><p style="margin: 0; font-size: 14px; color: ${TEXT_PRIMARY}; line-height: 1.7; font-style: italic;">${statusNote}</p>`
            : ''}
        ${isNotSelected
            ? `${divider()}<p style="margin: 0 0 12px; font-size: 14px; color: ${TEXT_SECONDARY}; line-height: 1.7;">${notSelectedMsgMap[locale] ?? notSelectedMsgMap['en']}</p>`
            : ''}
        ${button(cta, dashUrl)}
    `, subject, undefined, locale)
}


export async function scriptSubmissionConfirmationWithOverrides(name: string, title: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const scriptLabel = emailT('scriptSubmission', locale, 'scriptLabel') || 'Script'
    const statusLabel = emailT('scriptSubmission', locale, 'statusLabel') || 'Status'
    const statusValue = emailT('scriptSubmission', locale, 'statusValue') || '\u{1F4CB} Submitted'
    const footer      = emailT('scriptSubmission', locale, 'footer')      || 'You received this because you submitted a script to AIM Studio.'
    const subject     = (emailT('scriptSubmission', locale, 'subject') || 'Script "{title}" submitted successfully').replace('{title}', title)
    const f = await mergeFields('scriptSubmission', {
        heading:    emailT('scriptSubmission', locale, 'heading')    || 'Script Submitted! \u270d\ufe0f',
        subtext:    emailT('scriptSubmission', locale, 'subtext')    || 'your submission has been received.',
        body:       emailT('scriptSubmission', locale, 'body')       || 'Our team will review your screenplay submission. If selected, we may reach out for further discussion.',
        thanks:     emailT('scriptSubmission', locale, 'thanks')     || 'Thank you for sharing your creative work with us!',
        buttonText: emailT('scriptSubmission', locale, 'buttonText') || 'View Your Dashboard',
        buttonUrl:  siteUrl ? `${siteUrl}/dashboard` : '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Hi ${name}, ${f.subtext}`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow(scriptLabel, title)}
                ${infoRow(statusLabel, statusValue)}
            </table>
        `, BRAND_COLOR)}
        ${paragraph(f.body)}
        ${paragraph(f.thanks)}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">${footer}</span>`)}
        ${f.buttonUrl ? button(f.buttonText, f.buttonUrl) : ''}
    `, subject)
}

// ── Broadcast Notification Templates ─────────────────────────────────────────

/** Sent to all opted-in users when admin publishes a new casting role — fully localized */
export function newCastingRoleEmail(roleName: string, projectTitle: string, applyUrl: string, locale = 'en'): string {
    const r = (s: string) => s.replace('{role}', roleName).replace('{project}', projectTitle)
    const badge       = emailT('castingNewRole', locale, 'badge')      || 'New Casting Call'
    const h           = r(emailT('castingNewRole', locale, 'heading')  || 'Now Open: {role}')
    const sub         = r(emailT('castingNewRole', locale, 'subtext')  || 'A new audition in {project} is now live.')
    const bodyTxt     =   emailT('castingNewRole', locale, 'body')     || 'Applications reviewed on a rolling basis.'
    const statusOpen  =   emailT('castingNewRole', locale, 'statusOpen') || 'Open'
    const btnTxt      =   emailT('castingNewRole', locale, 'buttonText') || 'Apply Now'
    const footerTxt   =   emailT('castingNewRole', locale, 'footer')   || 'Roles close once filled.'
    const roleLabel   =   emailT('castingConfirmation', locale, 'roleLabel')    || 'Role'
    const projLabel   =   emailT('castingConfirmation', locale, 'projectLabel') || 'Project'
    const statusLabel =   emailT('castingConfirmation', locale, 'statusLabel')  || 'Status'
    const subject     = r(emailT('castingNewRole', locale, 'subject') || 'New Audition Open: {role} | AIM Studio')
    return emailWrapper(`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">&#127917;</div>
            <div style="display:inline-block;padding:6px 18px;background:${BG_DARK};border-radius:20px;border:1px solid ${BRAND_COLOR};">
                <span style="font-size:12px;font-weight:700;color:${BRAND_COLOR};letter-spacing:1.5px;text-transform:uppercase;">${badge}</span>
            </div>
        </div>
        ${heading(h)}
        ${subtext(sub)}
        ${paragraph(bodyTxt)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow(roleLabel, roleName)}
                ${infoRow(projLabel, projectTitle)}
                ${infoRow(statusLabel, `<span style="color:#10b981;font-weight:700;">${statusOpen}</span>`)}
            </table>
        `, BRAND_COLOR)}
        ${button(btnTxt, applyUrl)}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">${footerTxt}</span>`)}
    `, subject)
}

/** Sent to applicant when they withdraw their application — fully localized */
export function applicationWithdrawalEmail(name: string, roleName: string, castingUrl: string, locale = 'en'): string {
    const r = (s: string) => s.replace('{role}', roleName)
    const h       = emailT('castingWithdrawal', locale, 'heading')    || 'Application Withdrawn'
    const sub     = emailT('castingWithdrawal', locale, 'subtext')    || 'your application has been withdrawn.'
    const bodyTxt = r(emailT('castingWithdrawal', locale, 'body')     || 'Your application for the role has been withdrawn.')
    const btnTxt  = emailT('castingWithdrawal', locale, 'buttonText') || 'Browse Other Roles'
    const footer  = emailT('castingWithdrawal', locale, 'footer')     || 'You received this because you withdrew a casting application on AIM Studio.'
    const subject = r(emailT('castingWithdrawal', locale, 'subject')  || 'Application Withdrawn: {role}')
    return emailWrapper(`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">&#128203;</div>
        </div>
        ${heading(h)}
        ${subtext(`Hi ${name}, ${sub}`)}
        ${paragraph(bodyTxt)}
        ${castingUrl ? button(btnTxt, castingUrl) : ''}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">${footer}</span>`)}
    `, subject)
}


/** Sent to all opted-in users for platform announcements */
export function announcementEmail(
    title: string,
    message: string,
    link?: string,
    siteUrl?: string,
    i18n?: {
        badgeText?: string
        buttonText?: string
        footerOptIn?: string
        managePrefs?: string
    },
    imageUrl?: string,
    bodyHtml?: string,
): string {
    const ctaUrl       = link
        ? (link.startsWith('http') ? link : `${siteUrl || 'https://impactaistudio.com'}${link}`)
        : `${siteUrl || 'https://impactaistudio.com'}/notifications`
    const ctaText      = i18n?.buttonText  ?? (link ? 'View Announcement \u2192' : 'View in Notifications \u2192')
    const badge        = i18n?.badgeText   ?? 'Platform Announcement'
    const footerOptIn  = i18n?.footerOptIn ?? "You're receiving this because you opted in to platform announcements."
    const managePrefs  = i18n?.managePrefs ?? 'Manage preferences'
    // Banner image — only https URLs are trusted
    const bannerBlock  = (imageUrl && imageUrl.startsWith('https://'))
        ? `<div style="margin:0 0 24px;border-radius:10px;overflow:hidden;"><img src="${imageUrl}" alt="" width="100%" style="display:block;width:100%;max-height:300px;object-fit:cover;border-radius:10px;" /></div>`
        : ''
    // Rich body — strip to safe subset (p,strong,em,h2,h3,ul,ol,li,a,br)
    const allowedTags  = /(<\/?(?:p|strong|em|h2|h3|ul|ol|li|a|br)[^>]*>)/gi
    const safeBody     = bodyHtml ? bodyHtml.replace(/<[^>]+>/g, (t) => allowedTags.test(t) ? t : '') : ''
    const bodyBlock    = safeBody ? `<div style="margin:16px 0;font-size:15px;color:#c9c7c4;line-height:1.75;">${safeBody}</div>` : ''
    return emailWrapper(`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">📣</div>
            <div style="display:inline-block;padding:6px 18px;background:${BG_DARK};border-radius:20px;border:1px solid #8b5cf6;">
                <span style="font-size:12px;font-weight:700;color:#8b5cf6;letter-spacing:1.5px;text-transform:uppercase;">${badge}</span>
            </div>
        </div>
        ${bannerBlock}
        ${heading(title)}
        ${paragraph(message)}
        ${bodyBlock}
        ${button(ctaText, ctaUrl)}
        ${divider()}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">${footerOptIn} <a href="${siteUrl || 'https://impactaistudio.com'}/notifications" style="color:#6b7280;text-decoration:underline;">${managePrefs}</a></span>`)}
    `, title)
}

/** Security alert: account locked after repeated failed login attempts */
export function accountLockedEmail(
    name: string,
    _email: string,
    minutesLocked: number,
    locale: string = 'en',
    resetLink: string = '',
): { subject: string; html: string } {
    const strings: Record<string, { subject: string; heading: string; body: string; hint: string; btn: string; footer: string }> = {
        en: { subject: '⚠️ Your AIM Studio account has been locked', heading: 'Account temporarily locked', body: `Someone tried to sign in to your account ${minutesLocked === 60 ? '5' : 'multiple'} times with the wrong password. For your protection, your account has been locked for <strong>${minutesLocked} minute${minutesLocked !== 1 ? 's' : ''}</strong>.`, hint: 'If this was you, simply wait and try again. If you suspect unauthorized access, reset your password immediately.', btn: 'Reset My Password', footer: 'If you did not attempt to log in, your account information may have been compromised. Reset your password immediately.' },
        ar: { subject: '⚠️ تم قفل حسابك في AIM Studio', heading: 'تم قفل الحساب مؤقتاً', body: `حاول شخص ما تسجيل الدخول إلى حسابك بكلمة مرور خاطئة عدة مرات. تم قفل حسابك لمدة <strong>${minutesLocked} دقيقة</strong> لحمايتك.`, hint: 'إذا كنت أنت من حاول تسجيل الدخول، فانتظر وحاول مجدداً. إذا اشتبهت في وصول غير مصرح به، قم بإعادة تعيين كلمة المرور.', btn: 'إعادة تعيين كلمة المرور', footer: 'إذا لم تحاول تسجيل الدخول، فقد يكون حسابك في خطر.' },
        de: { subject: '⚠️ Ihr AIM Studio Konto wurde gesperrt', heading: 'Konto vorübergehend gesperrt', body: `Jemand hat versucht, sich mehrfach mit einem falschen Passwort in Ihr Konto einzuloggen. Zum Schutz wurde Ihr Konto für <strong>${minutesLocked} Minuten</strong> gesperrt.`, hint: 'Wenn Sie das waren, warten Sie und versuchen Sie es erneut. Bei Verdacht auf unbefugten Zugriff setzen Sie Ihr Passwort zurück.', btn: 'Passwort zurücksetzen', footer: 'Wenn Sie sich nicht angemeldet haben, könnte Ihr Konto gefährdet sein.' },
        es: { subject: '⚠️ Tu cuenta de AIM Studio ha sido bloqueada', heading: 'Cuenta bloqueada temporalmente', body: `Alguien intentó iniciar sesión en tu cuenta varias veces con una contraseña incorrecta. Tu cuenta ha sido bloqueada por <strong>${minutesLocked} minutos</strong> para protegerte.`, hint: 'Si fuiste tú, espera y vuelve a intentarlo. Si sospechas acceso no autorizado, restablece tu contraseña.', btn: 'Restablecer mi contraseña', footer: 'Si no intentaste iniciar sesión, tu cuenta puede estar en riesgo.' },
        fr: { subject: '⚠️ Votre compte AIM Studio a été verrouillé', heading: 'Compte temporairement verrouillé', body: `Quelqu'un a tenté de se connecter à votre compte plusieurs fois avec un mot de passe incorrect. Votre compte a été verrouillé pendant <strong>${minutesLocked} minutes</strong> pour votre protection.`, hint: "Si c'était vous, attendez et réessayez. Si vous soupçonnez un accès non autorisé, réinitialisez votre mot de passe.", btn: 'Réinitialiser mon mot de passe', footer: "Si vous n'avez pas tenté de vous connecter, votre compte est peut-être compromis." },
        hi: { subject: '⚠️ आपका AIM Studio खाता लॉक हो गया है', heading: 'खाता अस्थायी रूप से लॉक है', body: `किसी ने आपके खाते में गलत पासवर्ड से कई बार लॉगिन करने की कोशिश की। आपकी सुरक्षा के लिए आपका खाता <strong>${minutesLocked} मिनट</strong> के लिए लॉक कर दिया गया है।`, hint: 'यदि यह आप थे, तो प्रतीक्षा करें और पुनः प्रयास करें। यदि आपको अनधिकृत पहुंच का संदेह है, तो अपना पासवर्ड रीसेट करें।', btn: 'पासवर्ड रीसेट करें', footer: 'यदि आपने लॉगिन का प्रयास नहीं किया, तो आपका खाता खतरे में हो सकता है।' },
        ja: { subject: '⚠️ AIM Studio アカウントがロックされました', heading: 'アカウントが一時的にロックされています', body: `誰かが誤ったパスワードで複数回ログインを試みました。お客様の保護のため、アカウントは <strong>${minutesLocked}分間</strong>ロックされました。`, hint: 'ご自身の操作であれば、しばらくお待ちの上再度お試しください。不正アクセスが疑われる場合は、すぐにパスワードをリセットしてください。', btn: 'パスワードをリセット', footer: 'ログインを試みていない場合、アカウントが危険にさらされている可能性があります。' },
        ko: { subject: '⚠️ AIM Studio 계정이 잠겼습니다', heading: '계정이 일시적으로 잠겼습니다', body: `누군가 잘못된 비밀번호로 여러 번 로그인을 시도했습니다. 계정 보호를 위해 <strong>${minutesLocked}분</strong> 동안 계정이 잠겼습니다.`, hint: '본인의 시도였다면 잠시 기다렸다가 다시 시도하세요. 무단 접근이 의심되면 즉시 비밀번호를 재설정하세요.', btn: '비밀번호 재설정', footer: '로그인을 시도하지 않으셨다면 계정이 위험에 처했을 수 있습니다.' },
        pt: { subject: '⚠️ Sua conta AIM Studio foi bloqueada', heading: 'Conta temporariamente bloqueada', body: `Alguém tentou entrar na sua conta várias vezes com uma senha incorreta. Sua conta foi bloqueada por <strong>${minutesLocked} minutos</strong> para sua proteção.`, hint: 'Se foi você, aguarde e tente novamente. Se suspeitar de acesso não autorizado, redefina sua senha.', btn: 'Redefinir minha senha', footer: 'Se você não tentou fazer login, sua conta pode estar comprometida.' },
        ru: { subject: '⚠️ Ваш аккаунт AIM Studio заблокирован', heading: 'Аккаунт временно заблокирован', body: `Кто-то несколько раз пытался войти в ваш аккаунт с неверным паролем. Для вашей защиты аккаунт заблокирован на <strong>${minutesLocked} минут</strong>.`, hint: 'Если это были вы, подождите и попробуйте снова. При подозрении на несанкционированный доступ немедленно сбросьте пароль.', btn: 'Сбросить пароль', footer: 'Если вы не пытались войти, ваш аккаунт мог быть скомпрометирован.' },
        zh: { subject: '⚠️ 您的 AIM Studio 帐户已被锁定', heading: '帐户已暂时锁定', body: `有人多次尝试使用错误密码登录您的帐户。为了保护您，您的帐户已被锁定 <strong>${minutesLocked} 分钟</strong>。`, hint: '如果是您本人操作，请等待后重试。如果怀疑是未经授权的访问，请立即重置密码。', btn: '重置密码', footer: '如果您未尝试登录，您的帐户可能已遭到泄露。' },
    }
    const s = strings[locale] ?? strings['en']
    const html = emailWrapper(`
        <div style="text-align:center;padding:8px 0 24px;">
            <div style="font-size:56px;margin-bottom:12px;">🔒</div>
        </div>
        ${heading(s.heading)}
        ${paragraph(s.body)}
        ${paragraph(`<span style="font-size:14px;color:${TEXT_SECONDARY};">${s.hint}</span>`)}
        ${resetLink ? button(s.btn, resetLink) : ''}
        ${divider()}
        ${paragraph(`<span style="font-size:12px;color:#6b7280;">${s.footer}</span>`)}
    `, s.subject, undefined, locale)
    return { subject: s.subject, html }
}

/** Sent to opted-in users when admin publishes new content */
// ── Unsubscribe label map (inline — no DB call, email-safe) ──────────────────
const UNSUB_LABEL: Record<string, string> = {
    en: 'Unsubscribe', ar: 'إلغاء الاشتراك', de: 'Abmelden', es: 'Cancelar suscripción',
    fr: 'Se désabonner', hi: 'सदस्यता रद्द करें', ja: '配信停止', ko: '구독 취소',
    pt: 'Cancelar inscrição', ru: 'Отписаться', zh: '取消订阅',
}
const UNSUB_REASON: Record<string, string> = {
    en: "You're receiving this because you opted in to content updates.",
    ar: 'أنت تتلقى هذا لأنك اشتركت في تحديثات المحتوى.',
    de: 'Sie erhalten diese E-Mail, weil Sie sich für Inhaltsaktualisierungen angemeldet haben.',
    es: 'Recibes esto porque te suscribiste a las actualizaciones de contenido.',
    fr: 'Vous recevez ceci parce que vous avez choisi de recevoir des mises à jour de contenu.',
    hi: 'आप यह इसलिए प्राप्त कर रहे हैं क्योंकि आपने सामग्री अपडेट के लिए साइन अप किया था।',
    ja: 'コンテンツ更新のオプトインをされたため、このメールをお送りしています。',
    ko: '콘텐츠 업데이트에 동의하셨기 때문에 이 이메일을 받으셨습니다.',
    pt: 'Você está recebendo isso porque optou por atualizações de conteúdo.',
    ru: 'Вы получили это письмо, потому что подписались на обновления контента.',
    zh: '您收到此邮件是因为您订阅了内容更新。',
}

export function contentPublishEmail(
    contentTitle: string,
    contentType: string,
    link: string,
    locale: string = 'en',
    status: string = 'completed',
    sponsorData?: { name: string; logoUrl?: string; description?: string } | null,
    unsubscribeUrl?: string,
): string {
    const typeEmoji: Record<string, string> = { project: '🎬', video: '▶️', blog: '📝', training: '🎓', default: '✨' }
    const emoji = typeEmoji[contentType.toLowerCase()] ?? typeEmoji.default

    // Status-aware badge and CTA text
    const statusBadgeMap: Record<string, Record<string, string>> = {
        upcoming:        { en: 'Coming Soon',     ar: 'قريبًا',       de: 'Demnächst',       es: 'Próximamente',    fr: 'Bientôt',       hi: 'जल्द आ रहा है', ja: '近日公開', ko: '곧 공개', pt: 'Em breve',        ru: 'Скоро',       zh: '即将上映' },
        'in-production': { en: 'In Production',   ar: 'قيد الإنتاج',   de: 'In Produktion',   es: 'En producción',   fr: 'En production', hi: 'निर्माणाधीन',   ja: '制作中',   ko: '제작 중', pt: 'Em produção',    ru: 'В производстве', zh: '制作中' },
        completed:       { en: 'Now Streaming',   ar: 'متاح الآن',     de: 'Jetzt streamen',  es: 'Ya disponible',   fr: 'Disponible',    hi: 'अभी देखें',     ja: '配信中',   ko: '공개 중', pt: 'Já disponível',  ru: 'Смотрите сейчас', zh: '正在播出' },
    }
    const statusCtaMap: Record<string, Record<string, string>> = {
        upcoming:        { en: 'Watch Trailer →',       ar: 'شاهد العرض الدعائي →',  de: 'Trailer ansehen →',     es: 'Ver tráiler →',         fr: 'Voir la bande-annonce →', hi: 'ट्रेलर देखें →',     ja: '予告編を見る →', ko: '예고편 보기 →', pt: 'Ver trailer →',       ru: 'Смотреть трейлер →',  zh: '观看预告片 →' },
        'in-production': { en: 'View Movie Details →',  ar: 'عرض تفاصيل الفيلم →',   de: 'Filmdetails ansehen →', es: 'Ver detalles →',        fr: 'Voir les détails →',      hi: 'विवरण देखें →',       ja: '詳細を見る →',   ko: '상세 보기 →',   pt: 'Ver detalhes →',      ru: 'Подробнее →',         zh: '查看详情 →' },
        completed:       { en: 'Watch Full Movie →',    ar: 'شاهد الفيلم كاملاً →',   de: 'Film ansehen →',        es: 'Ver película completa →', fr: 'Regarder le film →',      hi: 'पूरी फ़िल्म देखें →', ja: '本編を見る →',   ko: '본편 보기 →',   pt: 'Assistir filme →',    ru: 'Смотреть фильм →',   zh: '观看完整影片 →' },
    }
    const badgeText = statusBadgeMap[status]?.[locale] ?? statusBadgeMap[status]?.['en'] ?? statusBadgeMap['completed']['en']
    const ctaText   = statusCtaMap[status]?.[locale]   ?? statusCtaMap[status]?.['en']   ?? statusCtaMap['completed']['en']

    // Badge colour per status
    const badgeColorMap: Record<string, string> = { upcoming: '#f59e0b', 'in-production': ACCENT_BLUE, completed: ACCENT_GREEN }
    const badgeColor = badgeColorMap[status] ?? ACCENT_BLUE

    // Use i18n strings — fall back to English literals if key is missing
    const headingText = (emailT('castingContentPublish', locale, 'heading') || 'Just Published: {title}').replace('{title}', contentTitle)
    const bodyText    = (emailT('castingContentPublish', locale, 'body')    || 'We just released new {type} content. Check it out on the platform.').replace(/{type}/g, contentType.toLowerCase())
    const footerText  = emailT('castingContentPublish', locale, 'footer') || "You're receiving this because you opted in to content updates."

    // Sponsor section (rendered before CTA when present)
    let sponsorHtml = ''
    if (sponsorData?.name) {
        const sponsoredByMap: Record<string, string> = {
            en: 'Sponsored by', ar: 'برعاية', de: 'Gesponsert von', es: 'Patrocinado por',
            fr: 'Sponsorisé par', hi: 'प्रायोजक', ja: '提供', ko: '후원',
            pt: 'Patrocinado por', ru: 'При поддержке', zh: '赞助商',
        }
        const sponsoredBy = sponsoredByMap[locale] ?? sponsoredByMap['en']
        sponsorHtml = `
            ${divider()}
            <div style="text-align:center;padding:16px 0;">
                <p style="margin:0 0 8px;font-size:11px;color:${TEXT_SECONDARY};text-transform:uppercase;letter-spacing:1.5px;">${sponsoredBy}</p>
                ${sponsorData.logoUrl ? `<img src="${sponsorData.logoUrl}" alt="${sponsorData.name}" style="max-width:160px;max-height:60px;margin-bottom:8px;" />` : ''}
                <p style="margin:0;font-size:14px;font-weight:700;color:${TEXT_PRIMARY};">${sponsorData.name}</p>
                ${sponsorData.description ? `<p style="margin:4px 0 0;font-size:12px;color:${TEXT_SECONDARY};line-height:1.5;">${sponsorData.description}</p>` : ''}
            </div>
        `
    }

    return emailWrapper(`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">${emoji}</div>
            <div style="display:inline-block;padding:6px 18px;background:${BG_DARK};border-radius:20px;border:1px solid ${badgeColor};">
                <span style="font-size:12px;font-weight:700;color:${badgeColor};letter-spacing:1.5px;text-transform:uppercase;">${badgeText}</span>
            </div>
        </div>
        ${heading(headingText)}
        ${paragraph(bodyText)}
        ${sponsorHtml}
        ${button(ctaText, link)}
        ${divider()}
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-align:center;line-height:1.6;">${UNSUB_REASON[locale] ?? UNSUB_REASON['en']}</p>
        ${unsubscribeUrl ? `<p style="margin:6px 0 0;font-size:11px;text-align:center;"><a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">${UNSUB_LABEL[locale] ?? UNSUB_LABEL['en']}</a></p>` : ''}
    `, `New ${contentType}: ${contentTitle}`)
}

export function courseEnrollmentEmail(
    userName: string,
    courseTitle: string,
    courseUrl: string,
    locale: string = 'en',
    overrides?: { heading?: string; body?: string; button?: string; badge?: string }
): string {
    const BD = '#0f1115', BC = '#d4a853', BL = '#e8c36a', CARD = '#1a1d23', BORDER = '#2a2d35', TP = '#e8e6e3'
    const h   = overrides?.heading ?? emailT('trainingEnrollment', locale, 'heading').replace('{title}', courseTitle)
    const b   = overrides?.body    ?? emailT('trainingEnrollment', locale, 'body').replace('{title}', courseTitle).replace('{name}', userName ? ', ' + userName : '')
    const btn = overrides?.button  ?? emailT('trainingEnrollment', locale, 'buttonText')
    const badge = overrides?.badge ?? emailT('trainingEnrollment', locale, 'badge')
    const footer = emailT('trainingEnrollment', locale, 'footer')
    const parts: string[] = []
    parts.push('<!DOCTYPE html><html><body style="margin:0;padding:0;background:' + BD + '">')
    parts.push('<table width="100%" style="background:' + BD + '"><tr><td align="center" style="padding:40px 16px">')
    parts.push('<table width="580" style="max-width:580px;width:100%">')
    parts.push('<tr><td style="height:4px;background:linear-gradient(90deg,' + BC + ',' + BL + ',' + BC + ');border-radius:12px 12px 0 0"></td></tr>')
    parts.push('<tr><td style="padding:28px 36px;text-align:center;background:' + CARD + ';border-left:1px solid ' + BORDER + ';border-right:1px solid ' + BORDER + '">')
    parts.push('<span style="font-size:26px;font-weight:800"><span style="color:' + BC + '">AIM</span><span style="color:' + TP + '"> Studio</span></span>')
    parts.push('</td></tr>')
    parts.push('<tr><td style="background:' + CARD + ';border-left:1px solid ' + BORDER + ';border-right:1px solid ' + BORDER + ';padding:36px">')
    parts.push('<div style="text-align:center;margin-bottom:24px"><div style="font-size:52px;margin-bottom:12px">&#127891;</div>')
    parts.push('<div style="display:inline-block;padding:6px 18px;background:' + BD + ';border-radius:20px;border:1px solid ' + BC + '">')
    parts.push('<span style="font-size:12px;font-weight:700;color:' + BC + ';letter-spacing:1.5px;text-transform:uppercase">' + badge + '</span></div></div>')
    parts.push('<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:' + TP + ';line-height:1.3">' + h + '</h1>')
    parts.push('<p style="margin:0 0 16px;font-size:15px;color:' + TP + ';line-height:1.7">' + b + '</p>')
    parts.push('<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr>')
    parts.push('<td align="center" style="background-color:' + BC + ';border-radius:8px">')
    parts.push('<a href="' + courseUrl + '" style="display:block;padding:14px 32px;font-size:14px;font-weight:700;color:#0f1115;text-decoration:none;mso-padding-alt:14px 32px">' + btn + '</a>')
    parts.push('</td></tr></table>')
    parts.push('<p style="margin:0 0 16px;font-size:11px;color:#6b7280;word-break:break-all">Or copy this link: <a href="' + courseUrl + '" style="color:' + BC + ';text-decoration:underline">' + courseUrl + '</a></p>')
    parts.push('<p style="margin:0;font-size:12px;color:#6b7280">' + footer + '</p>')
    parts.push('</td></tr>')
    parts.push('<tr><td style="height:3px;background:linear-gradient(90deg,' + BC + ',' + BL + ',' + BC + ');border-radius:0 0 12px 12px"></td></tr>')
    parts.push('<tr><td style="padding-top:28px;text-align:center"><p style="margin:0;font-size:12px;color:#6b7280">&copy; ' + new Date().getFullYear() + ' AIM Studio</p></td></tr>')
    parts.push('</table></td></tr></table></body></html>')
    return parts.join('')
}

// --- Course Completion Email ---

export function courseCompletionEmail(
    userName: string,
    courseTitle: string,
    courseUrl: string,
    locale: string = 'en',
): string {
    const BD = '#0f1115', BC = '#d4a853', BL = '#e8c36a', CARD = '#1a1d23', BORDER = '#2a2d35', TP = '#e8e6e3'
    const h      = emailT('trainingCompletion', locale, 'heading')
    const b      = emailT('trainingCompletion', locale, 'body').replace('{title}', courseTitle)
    const btn    = emailT('trainingCompletion', locale, 'buttonText')
    const badge  = emailT('trainingCompletion', locale, 'badge')
    const footer = emailT('trainingCompletion', locale, 'footer')
    const parts: string[] = []
    parts.push('<!DOCTYPE html><html><body style="margin:0;padding:0;background:' + BD + '">')
    parts.push('<table width="100%" style="background:' + BD + '"><tr><td align="center" style="padding:40px 16px">')
    parts.push('<table width="580" style="max-width:580px;width:100%">')
    parts.push('<tr><td style="height:4px;background:linear-gradient(90deg,' + BC + ',' + BL + ',' + BC + ');border-radius:12px 12px 0 0"></td></tr>')
    parts.push('<tr><td style="padding:28px 36px;text-align:center;background:' + CARD + ';border-left:1px solid ' + BORDER + ';border-right:1px solid ' + BORDER + '">')
    parts.push('<span style="font-size:26px;font-weight:800"><span style="color:' + BC + '">AIM</span><span style="color:' + TP + '"> Studio</span></span>')
    parts.push('</td></tr>')
    parts.push('<tr><td style="background:' + CARD + ';border-left:1px solid ' + BORDER + ';border-right:1px solid ' + BORDER + ';padding:36px">')
    parts.push('<div style="text-align:center;margin-bottom:24px"><div style="font-size:60px;margin-bottom:12px">🏆</div>')
    parts.push('<div style="display:inline-block;padding:6px 18px;background:' + BD + ';border-radius:20px;border:1px solid ' + BC + '">')
    parts.push('<span style="font-size:12px;font-weight:700;color:' + BC + ';letter-spacing:1.5px;text-transform:uppercase">' + badge + '</span></div></div>')
    parts.push('<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:' + TP + ';line-height:1.3">' + h + '</h1>')
    parts.push('<p style="margin:4px 0 4px;font-size:13px;font-weight:600;color:' + BC + '">' + courseTitle + (userName ? ' · ' + userName : '') + '</p>')
    parts.push('<p style="margin:12px 0 16px;font-size:15px;color:' + TP + ';line-height:1.7">' + b + '</p>')
    parts.push('<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr>')
    parts.push('<td align="center" style="background-color:' + BC + ';border-radius:8px">')
    parts.push('<a href="' + courseUrl + '" style="display:block;padding:14px 32px;font-size:14px;font-weight:700;color:#0f1115;text-decoration:none;mso-padding-alt:14px 32px">' + btn + '</a>')
    parts.push('</td></tr></table>')
    parts.push('<p style="margin:0 0 16px;font-size:11px;color:#6b7280;word-break:break-all">Or copy this link: <a href="' + courseUrl + '" style="color:' + BC + ';text-decoration:underline">' + courseUrl + '</a></p>')
    parts.push('<p style="margin:0;font-size:12px;color:#6b7280">' + footer + '</p>')
    parts.push('</td></tr>')
    parts.push('<tr><td style="height:3px;background:linear-gradient(90deg,' + BC + ',' + BL + ',' + BC + ');border-radius:0 0 12px 12px"></td></tr>')
    parts.push('<tr><td style="padding-top:28px;text-align:center"><p style="margin:0;font-size:12px;color:#6b7280">&copy; ' + new Date().getFullYear() + ' AIM Studio</p></td></tr>')
    parts.push('</table></td></tr></table></body></html>')
    return parts.join('')
}

// --- Badge Earned Email ---

const BADGE_EMOJI: Record<string, string> = {
    first_lesson: '🌟',
    first_course: '🏅',
    streak_7: '🔥',
    streak_30: '💪',
}

const BADGE_I18N_KEY: Record<string, string> = {
    first_lesson: 'trainingBadgeFirstLesson',
    first_course: 'trainingBadgeFirstCourse',
    streak_7: 'trainingBadgeStreak7',
    streak_30: 'trainingBadgeStreak30',
}

export function badgeEarnedEmail(
    userName: string,
    badgeType: string,
    courseUrl: string,
    locale: string = 'en',
): string {
    const BD = '#0f1115', BC = '#d4a853', BL = '#e8c36a', CARD = '#1a1d23', BORDER = '#2a2d35', TP = '#e8e6e3'
    const i18nKey = BADGE_I18N_KEY[badgeType] || 'trainingBadgeFirstLesson'
    const emoji  = BADGE_EMOJI[badgeType] || '🌟'
    const h      = emailT(i18nKey, locale, 'heading')
    const b      = emailT(i18nKey, locale, 'body')
    const btn    = emailT(i18nKey, locale, 'buttonText')
    const badge  = emailT(i18nKey, locale, 'badge')
    const footer = emailT(i18nKey, locale, 'footer')
    const parts: string[] = []
    parts.push('<!DOCTYPE html><html><body style="margin:0;padding:0;background:' + BD + '">')
    parts.push('<table width="100%" style="background:' + BD + '"><tr><td align="center" style="padding:40px 16px">')
    parts.push('<table width="580" style="max-width:580px;width:100%">')
    parts.push('<tr><td style="height:4px;background:linear-gradient(90deg,' + BC + ',' + BL + ',' + BC + ');border-radius:12px 12px 0 0"></td></tr>')
    parts.push('<tr><td style="padding:28px 36px;text-align:center;background:' + CARD + ';border-left:1px solid ' + BORDER + ';border-right:1px solid ' + BORDER + '">')
    parts.push('<span style="font-size:26px;font-weight:800"><span style="color:' + BC + '">AIM</span><span style="color:' + TP + '"> Studio</span></span>')
    parts.push('</td></tr>')
    parts.push('<tr><td style="background:' + CARD + ';border-left:1px solid ' + BORDER + ';border-right:1px solid ' + BORDER + ';padding:36px">')
    parts.push('<div style="text-align:center;margin-bottom:24px"><div style="font-size:60px;margin-bottom:12px">' + emoji + '</div>')
    parts.push('<div style="display:inline-block;padding:6px 18px;background:' + BD + ';border-radius:20px;border:1px solid ' + BC + '">')
    parts.push('<span style="font-size:12px;font-weight:700;color:' + BC + ';letter-spacing:1.5px;text-transform:uppercase">' + badge + '</span></div></div>')
    parts.push('<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:' + TP + ';line-height:1.3">' + h + '</h1>')
    if (userName) parts.push('<p style="margin:4px 0 4px;font-size:13px;color:#9ca3af">' + userName + '</p>')
    parts.push('<p style="margin:12px 0 16px;font-size:15px;color:' + TP + ';line-height:1.7">' + b + '</p>')
    parts.push('<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr>')
    parts.push('<td align="center" style="background-color:' + BC + ';border-radius:8px">')
    parts.push('<a href="' + courseUrl + '" style="display:block;padding:14px 32px;font-size:14px;font-weight:700;color:#0f1115;text-decoration:none;mso-padding-alt:14px 32px">' + btn + '</a>')
    parts.push('</td></tr></table>')
    parts.push('<p style="margin:0 0 16px;font-size:11px;color:#6b7280;word-break:break-all">Or copy this link: <a href="' + courseUrl + '" style="color:' + BC + ';text-decoration:underline">' + courseUrl + '</a></p>')
    parts.push('<p style="margin:0;font-size:12px;color:#6b7280">' + footer + '</p>')
    parts.push('</td></tr>')
    parts.push('<tr><td style="height:3px;background:linear-gradient(90deg,' + BC + ',' + BL + ',' + BC + ');border-radius:0 0 12px 12px"></td></tr>')
    parts.push('<tr><td style="padding-top:28px;text-align:center"><p style="margin:0;font-size:12px;color:#6b7280">&copy; ' + new Date().getFullYear() + ' AIM Studio</p></td></tr>')
    parts.push('</table></td></tr></table></body></html>')
    return parts.join('')
}


// ── Script Status Update Email ────────────────────────────────────────────────

/**
 * Localized email sent to script submitters when admin changes the submission status.
 * Mirrors the casting applicationStatusUpdate() pattern.
 */
export function scriptStatusUpdateEmail(
    name: string,
    scriptTitle: string,
    newStatus: string,
    callTitle: string,
    note?: string,
    siteUrl?: string,
    locale = 'en',
): string {
    // Map status → i18n key
    const i18nKeyMap: Record<string, string> = {
        shortlisted: 'scriptStatus_shortlisted',
        selected:    'scriptStatus_selected',
        rejected:    'scriptStatus_rejected',
    }
    const i18nKey = i18nKeyMap[newStatus] || 'scriptStatus_rejected'

    const localizedHeading = emailT(i18nKey, locale, 'heading') || 'Script Submission Update'
    const localizedBody    = emailT(i18nKey, locale, 'body')    || ''
    const localizedLabel   = emailT(i18nKey, locale, 'label')   || newStatus.replace(/_/g, ' ')
    const localizedSubtext = emailT(i18nKey, locale, 'subtext') || 'we have an update about your screenplay.'
    const localizedButton  = emailT('scriptSubmission', locale, 'buttonText') || 'View Script Calls'

    // Status display colours
    const colorMap: Record<string, string> = {
        shortlisted: '#f59e0b',
        selected:    ACCENT_GREEN,
        rejected:    '#6b7280',
    }
    const emojiMap: Record<string, string> = {
        shortlisted: '⭐',
        selected:    '🏆',
        rejected:    '📝',
    }
    const color = colorMap[newStatus] || TEXT_SECONDARY
    const emoji = emojiMap[newStatus] || '📋'

    const mainMessage = localizedBody
        ? paragraph(localizedBody
            .replace(/{title}/g, scriptTitle)
            .replace(/{call}/g, callTitle))
        : paragraph(`There is an update on your script <strong>"${scriptTitle}"</strong> submitted to <strong>${callTitle}</strong>.`)

    return emailWrapper(`
        ${heading(localizedHeading)}
        ${subtext(`Hi ${name}, ${localizedSubtext}`)}
        <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 36px; margin-bottom: 8px;">${emoji}</div>
            <div style="display: inline-block; padding: 8px 24px; background-color: ${BG_DARK}; border-radius: 20px; border: 1px solid ${color};">
                <span style="font-size: 16px; font-weight: 700; color: ${color};">${localizedLabel}</span>
            </div>
        </div>
        ${divider()}
        ${mainMessage}
        ${infoCard(`
            <p style="margin: 0; font-size: 13px; color: ${TEXT_SECONDARY}; margin-bottom: 4px;">${emailT('scriptInfoCard', locale, 'scriptLabel') || 'Script'}</p>
            <p style="margin: 0; font-size: 15px; color: ${TEXT_PRIMARY}; font-weight: 600;">${scriptTitle}</p>
            <p style="margin: 10px 0 0; font-size: 13px; color: ${TEXT_SECONDARY}; margin-bottom: 4px;">${emailT('scriptInfoCard', locale, 'callLabel') || 'Call'}</p>
            <p style="margin: 0; font-size: 15px; color: ${TEXT_PRIMARY}; font-weight: 600;">${callTitle}</p>
        `, color)}
        ${note ? divider() + paragraph(`<em style="color: ${TEXT_SECONDARY};">${note}</em>`) : ''}
        ${siteUrl ? button(localizedButton, `${siteUrl}/scripts`) : ''}
    `, emailT(i18nKey, locale, 'subject') || `Script Submission Update — ${scriptTitle}`)
}


// ── Script Withdrawal Confirmation Email ──────────────────────────────────────

/**
 * Localized email confirming a script submission withdrawal.
 */
export function scriptWithdrawalEmail(
    name: string,
    scriptTitle: string,
    callTitle: string,
    siteUrl: string,
    locale = 'en',
): string {
    const localizedHeading = emailT('scriptWithdrawal', locale, 'heading') || 'Submission Withdrawn'
    const localizedBody = (emailT('scriptWithdrawal', locale, 'body') || '')
        .replace('{title}', scriptTitle).replace('{call}', callTitle)
    const localizedSubtext = emailT('scriptWithdrawal', locale, 'subtext') || 'your submission has been withdrawn.'
    const localizedButton = emailT('scriptWithdrawal', locale, 'buttonText') || 'Browse Script Calls'
    const localizedFooter = emailT('scriptWithdrawal', locale, 'footer') || 'You can resubmit to this call at any time while it remains open.'

    return emailWrapper(`
        ${heading(localizedHeading)}
        ${subtext(`Hi ${name}, ${localizedSubtext}`)}
        ${divider()}
        ${localizedBody ? paragraph(localizedBody) : paragraph(`Your script <strong>"${scriptTitle}"</strong> submitted to <strong>${callTitle}</strong> has been withdrawn.`)}
        ${infoCard(`
            <p style="margin: 0; font-size: 13px; color: ${TEXT_SECONDARY}; margin-bottom: 4px;">${emailT('scriptInfoCard', locale, 'scriptLabel') || 'Script'}</p>
            <p style="margin: 0; font-size: 15px; color: ${TEXT_PRIMARY}; font-weight: 600;">${scriptTitle}</p>
            <p style="margin: 10px 0 0; font-size: 13px; color: ${TEXT_SECONDARY}; margin-bottom: 4px;">${emailT('scriptInfoCard', locale, 'callLabel') || 'Call'}</p>
            <p style="margin: 0; font-size: 15px; color: ${TEXT_PRIMARY}; font-weight: 600;">${callTitle}</p>
        `, '#6b7280')}
        ${paragraph(`<em style="color: ${TEXT_SECONDARY};">${localizedFooter}</em>`)}
        ${button(localizedButton, `${siteUrl}/scripts`)}
    `, emailT('scriptWithdrawal', locale, 'subject')?.replace('{title}', scriptTitle) || `Script Withdrawn: ${scriptTitle}`)
}
