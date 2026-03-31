import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'
import { getGraphAccessToken } from '@/lib/graphClient'
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
    replyTo?: string        // admin-set reply-to e.g. noreply@impactaistudio.com
    transport: 'smtp' | 'graph'
    // SMTP-only fields
    smtpHost?: string
    smtpPort?: number
    smtpUser?: string
    smtpPass?: string
    smtpSecure?: boolean
}

let cachedConfig: MailConfig | null = null
let cacheTime = 0
const CACHE_TTL = 60_000 // 1 minute

async function getMailConfig(): Promise<MailConfig | null> {
    const now = Date.now()
    if (cachedConfig && now - cacheTime < CACHE_TTL) return cachedConfig

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings = await (prisma.siteSettings as any).findFirst({
            select: {
                emailsEnabled: true,
                emailTransport: true,
                smtpHost: true,
                smtpPort: true,
                smtpUser: true,
                smtpPass: true,
                smtpFromName: true,
                smtpFromEmail: true,
                smtpSecure: true,
                emailReplyTo: true,
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
        const transport: 'smtp' | 'graph' = settings.emailTransport === 'smtp' ? 'smtp' : 'graph'
        const replyTo: string | undefined = settings.emailReplyTo || undefined

        if (transport === 'smtp') {
            if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
                logger.warn('mailer', 'SMTP transport selected but credentials are incomplete')
                cachedConfig = null
                cacheTime = now
                return null
            }
            cachedConfig = {
                fromName,
                fromEmail: settings.smtpFromEmail || settings.smtpUser,
                replyTo,
                transport: 'smtp',
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort || 587,
                smtpUser: settings.smtpUser,
                smtpPass: settings.smtpPass,
                smtpSecure: settings.smtpSecure || false,
            }
        } else {
            // Graph transport — check Azure env vars
            const hasGraph = !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET)
            if (!hasGraph) {
                logger.warn('mailer', 'Microsoft Graph transport selected but Azure credentials are missing from environment')
                cachedConfig = null
                cacheTime = now
                return null
            }
            // Priority: admin DB setting > env var fallback
            const fromEmail = settings.smtpFromEmail || process.env.GRAPH_EMAIL_SENDER || 'aimstudio@impactaistudio.com'
            cachedConfig = { fromName, fromEmail, replyTo, transport: 'graph' }
        }

        cacheTime = now
        return cachedConfig
    } catch (err) {
        logger.error('mailer', 'Failed to load mail config', { error: err as Error })
        return null
    }
}

/** Invalidate config cache (call after admin saves settings) */
export function invalidateMailerCache() {
    cachedConfig = null
    cacheTime = 0
}

async function sendViaGraph(config: MailConfig, options: EmailOptions): Promise<void> {
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
                body: { contentType: 'HTML', content: options.html },
                toRecipients: [{ emailAddress: { address: options.to } }],
                from: { emailAddress: { address: config.fromEmail, name: config.fromName } },
                replyTo: options.replyTo ? [{ emailAddress: { address: options.replyTo } }] : undefined,
            },
        }),
    })
    if (!response.ok) {
        const err = await response.text()
        throw new Error(`Graph send failed: ${response.status} ${err}`)
    }
}

async function sendViaSMTP(config: MailConfig, options: EmailOptions): Promise<void> {
    const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure, // true = SSL 465, false = STARTTLS 587
        auth: { user: config.smtpUser, pass: config.smtpPass },
    })
    await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
    })
}

/**
 * Send an email via whichever transport the admin has configured.
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

        // Use admin-configured reply-to unless caller explicitly set one
        const finalOptions: EmailOptions = {
            ...options,
            replyTo: options.replyTo ?? config.replyTo,
        }

        if (config.transport === 'smtp') {
            await sendViaSMTP(config, finalOptions)
        } else {
            await sendViaGraph(config, finalOptions)
        }

        logger.info('mailer', `Email sent to ${options.to}: ${options.subject}`)
        return true
    } catch (err) {
        logger.error('mailer', `Email to ${options.to} failed: ${options.subject}`, { error: err as Error })
        return false
    }
}

/**
 * Send a test email to verify configuration.
 * Unlike sendEmail, this DOES throw on error so admin can see the issue.
 */
export async function sendTestEmail(to: string): Promise<void> {
    const config = await getMailConfig()
    if (!config) throw new Error('Email is not configured or emails are disabled in admin settings')

    const transportLabel = config.transport === 'graph' ? 'Microsoft Graph' : 'SMTP'
    const replyToLabel = config.replyTo ? `Reply-To: ${config.replyTo}` : 'No reply-to configured'

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h2 style="color: #d4a853; margin-bottom: 8px;">Email Configuration Working!</h2>
            <p style="color: #999; font-size: 14px;">Your AIM Studio email settings are correctly configured.</p>
            <p style="color: #666; font-size: 12px; margin-top: 24px;">Transport: <strong>${transportLabel}</strong></p>
            <p style="color: #666; font-size: 12px;">Sender: ${config.fromEmail}</p>
            <p style="color: #666; font-size: 12px;">${replyToLabel}</p>
        </div>
    `

    const finalOptions: EmailOptions = {
        to,
        subject: '✅ AIM Studio | Email Test Successful',
        html,
        replyTo: config.replyTo,
    }

    if (config.transport === 'smtp') {
        await sendViaSMTP(config, finalOptions)
    } else {
        await sendViaGraph(config, finalOptions)
    }
}
