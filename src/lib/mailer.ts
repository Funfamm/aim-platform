// import nodemailer from 'nodemailer' // removed in favor of Microsoft Graph
import { prisma } from './db'
import { getGraphAccessToken } from './graphClient'
import { logger } from './logger'

interface EmailOptions {
    to: string
    subject: string
    html: string
    text?: string
    replyTo?: string
}

interface SmtpConfig {
    host: string
    port: number
    user: string
    pass: string
    fromName: string
    fromEmail: string
    secure: boolean
}

let cachedConfig: SmtpConfig | null = null
let cacheTime = 0
const CACHE_TTL = 60_000 // 1 minute

async function getSmtpConfig(): Promise<SmtpConfig | null> {
    const now = Date.now()
    if (cachedConfig && now - cacheTime < CACHE_TTL) return cachedConfig

    try {
        const settings = await prisma.siteSettings.findFirst({
            select: {
                emailsEnabled: true,
                smtpHost: true,
                smtpPort: true,
                smtpUser: true,
                smtpPass: true,
                smtpFromName: true,
                smtpFromEmail: true,
                smtpSecure: true,
                siteName: true,
            },
        })

        if (!settings?.emailsEnabled || !settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
            cachedConfig = null
            cacheTime = now
            return null
        }

        cachedConfig = {
            host: settings.smtpHost,
            port: settings.smtpPort ?? 587,
            user: settings.smtpUser,
            pass: settings.smtpPass,
            fromName: settings.smtpFromName || settings.siteName || 'AIM Studio',
            fromEmail: settings.smtpFromEmail || settings.smtpUser,
            secure: settings.smtpSecure ?? false,
        }
        cacheTime = now
        return cachedConfig
    } catch (err) {
        logger.error('mailer', 'Failed to load SMTP config', { error: err as Error })
        return null
    }
}

/** Invalidate SMTP config cache (call after admin saves settings) */
export function invalidateMailerCache() {
    cachedConfig = null
    cacheTime = 0
}

/**
 * Send an email via SMTP.
 * Gracefully no-ops if emails are disabled or SMTP is not configured.
 * Errors are logged but never thrown — email sending is fire-and-forget.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
    try {
        const config = await getSmtpConfig()
        if (!config) {
            logger.info('mailer', 'Email skipped — SMTP not configured or emails disabled')
            return false
        }

        const token = await getGraphAccessToken()
        const response = await fetch(`https://graph.microsoft.com/v1.0/users/${config.fromEmail}/sendMail`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: {
                    subject: options.subject,
                    body: {
                        contentType: 'HTML',
                        content: options.html,
                    },
                    toRecipients: [{ emailAddress: { address: options.to } }],
                    from: { emailAddress: { address: config.fromEmail, name: config.fromName } },
                    replyTo: options.replyTo ? [{ emailAddress: { address: options.replyTo } }] : undefined,
                },
            }),
        })
        if (!response.ok) {
            const err = await response.text()
            throw new Error(`Graph mail send failed: ${response.status} ${err}`)
        }

        logger.info('mailer', `Email sent to ${options.to}: ${options.subject}`)
        return true
    } catch (err) {
        logger.error('mailer', `Email to ${options.to} failed: ${options.subject}`, { error: err as Error })
        return false
    }
}

/**
 * Send a test email to verify SMTP configuration.
 * Unlike sendEmail, this DOES throw on error so admin can see the issue.
 */
export async function sendTestEmail(to: string): Promise<void> {
    const config = await getSmtpConfig()
    if (!config) throw new Error('SMTP is not configured or emails are disabled')

    const token = await getGraphAccessToken()
        const response = await fetch(`https://graph.microsoft.com/v1.0/users/${config.fromEmail}/sendMail`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: {
                    subject: '✅ AIM Studio | Email Test Successful',
                    body: {
                        contentType: 'HTML',
                        content: `
                            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center;">
                                <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                                <h2 style="color: #d4a853; margin-bottom: 8px;">Email Configuration Working!</h2>
                                <p style="color: #999; font-size: 14px;">Your AIM Studio email settings are correctly configured.</p>
                                <p style="color: #666; font-size: 12px; margin-top: 24px;">Sender: ${config.fromEmail}</p>
                            </div>
                        `,
                    },
                    toRecipients: [{ emailAddress: { address: to } }],
                    from: { emailAddress: { address: config.fromEmail, name: config.fromName } },
                },
            }),
        })
        if (!response.ok) {
            const err = await response.text()
            throw new Error(`Graph test mail send failed: ${response.status} ${err}`)
        }
}

/** Strip HTML tags for plain-text fallback */
function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
