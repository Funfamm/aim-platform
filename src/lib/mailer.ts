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

interface MailConfig {
    fromName: string
    fromEmail: string
    transport: 'graph' | 'smtp'
}

let cachedConfig: MailConfig | null = null
let cacheTime = 0
const CACHE_TTL = 60_000 // 1 minute

/** Check whether Microsoft Graph credentials are available */
function hasGraphCredentials(): boolean {
    return !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET)
}

async function getMailConfig(): Promise<MailConfig | null> {
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

        // Emails must be enabled in the admin panel
        if (!settings?.emailsEnabled) {
            cachedConfig = null
            cacheTime = now
            return null
        }

        const fromName = settings.smtpFromName || settings.siteName || 'AIM Studio'

        // Prefer Microsoft Graph when Azure credentials are present
        if (hasGraphCredentials()) {
            const fromEmail = process.env.GRAPH_EMAIL_SENDER || settings.smtpFromEmail || settings.smtpUser || 'aimstudio@impactaistudio.com'
            cachedConfig = { fromName, fromEmail, transport: 'graph' }
            cacheTime = now
            return cachedConfig
        }

        // Fallback: require SMTP fields
        if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
            cachedConfig = null
            cacheTime = now
            return null
        }

        cachedConfig = {
            fromName,
            fromEmail: settings.smtpFromEmail || settings.smtpUser,
            transport: 'smtp',
        }
        cacheTime = now
        return cachedConfig
    } catch (err) {
        logger.error('mailer', 'Failed to load mail config', { error: err as Error })
        return null
    }
}

/** Invalidate SMTP config cache (call after admin saves settings) */
export function invalidateMailerCache() {
    cachedConfig = null
    cacheTime = 0
}

/**
 * Send an email via Microsoft Graph (preferred) or SMTP fallback.
 * Gracefully no-ops if emails are disabled or not configured.
 * Errors are logged but never thrown — email sending is fire-and-forget.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
    try {
        const config = await getMailConfig()
        if (!config) {
            logger.info('mailer', 'Email skipped — not configured or emails disabled')
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
 * Send a test email to verify email configuration.
 * Unlike sendEmail, this DOES throw on error so admin can see the issue.
 */
export async function sendTestEmail(to: string): Promise<void> {
    const config = await getMailConfig()
    if (!config) throw new Error('Email is not configured or emails are disabled in admin settings')

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
