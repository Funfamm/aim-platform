import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'
import { getGraphAccessToken } from '@/lib/graphClient'
import { decrypt } from '@/lib/secure'
import { logger } from './logger'
import { isEmailSuppressed, recordBounce, classifyBounceError } from '@/lib/suppression'
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token'

export type EmailType = 'authentication' | 'application' | 'notification' | 'subscribe' | 'general'

export interface EmailOptions {
    to: string
    subject: string
    html: string
    text?: string
    replyTo?: string
    /** Explicit email type for classification. When set, bypasses subject-line heuristic. */
    type?: EmailType
    /** When true, bypasses marketing suppression — for auth/security emails only. */
    isTransactional?: boolean
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

            // ── SMTP Domain-Alignment Safety Check ──────────────────────
            // Prevent unsafe mismatches like From: impactaistudio.com + SMTP: gmail.com
            // which cause SPF, DKIM, and DMARC failures (guaranteed spam/reject).
            // Known relay services (SendGrid, Postmark, etc.) authenticate via
            // domain-level DKIM and use a generic SMTP username, so they are exempt.
            const TRUSTED_RELAY_HOSTS = [
                'smtp.sendgrid.net',
                'smtp.postmarkapp.com',
                'smtp.mailgun.org',
                'email-smtp.us-east-1.amazonaws.com',  // Amazon SES
                'email-smtp.eu-west-1.amazonaws.com',
            ]
            const smtpHostLower = settings.smtpHost.toLowerCase()
            const isTrustedRelay = TRUSTED_RELAY_HOSTS.some(h => smtpHostLower.includes(h))

            if (!isTrustedRelay) {
                const smtpFromEmail = settings.smtpFromEmail || settings.smtpUser
                const fromDomain = smtpFromEmail.split('@')[1]?.toLowerCase()
                const userDomain = settings.smtpUser.split('@')[1]?.toLowerCase()

                if (fromDomain && userDomain && fromDomain !== userDomain) {
                    logger.error('mailer',
                        `⛔ SMTP domain mismatch BLOCKED: From="${smtpFromEmail}" but SMTP user="${settings.smtpUser}". ` +
                        `This will fail SPF/DKIM/DMARC alignment. Use a trusted relay (SendGrid, Postmark) ` +
                        `or ensure the From domain matches the SMTP credential domain.`
                    )
                    cachedConfig = null
                    cacheTime = now
                    return null
                }
            }

            const smtpPassword = settings.smtpPass.startsWith('ey') || settings.smtpPass.length > 50
                ? decrypt(settings.smtpPass)  // Encrypted in DB — decrypt before use
                : settings.smtpPass            // Plaintext fallback (legacy/env-based)

            cachedConfig = {
                fromName,
                fromEmail: settings.smtpFromEmail || settings.smtpUser,
                replyTo,
                transport: 'smtp',
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort || 587,
                smtpUser: settings.smtpUser,
                smtpPass: smtpPassword,
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

/**
 * Typed error for Microsoft Graph 429 throttle responses.
 * Carries the server-specified retry delay so callers can wait correctly.
 */
class GraphThrottleError extends Error {
    retryAfterMs: number
    constructor(retryAfterMs: number, detail: string) {
        super(`Graph 429 throttled (retry after ${retryAfterMs}ms): ${detail}`)
        this.name = 'GraphThrottleError'
        this.retryAfterMs = retryAfterMs
    }
}

async function sendViaGraph(config: MailConfig, options: EmailOptions, extraHeaders?: Record<string, string>): Promise<void> {
    const token = await getGraphAccessToken()

    // Convert headers to Graph's internetMessageHeaders format
    const internetMessageHeaders = extraHeaders
        ? Object.entries(extraHeaders).map(([name, value]) => ({ name, value }))
        : undefined

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
                ...(internetMessageHeaders?.length ? { internetMessageHeaders } : {}),
            },
        }),
    })
    if (!response.ok) {
        const body = await response.text()
        // Detect Graph 429 throttle and throw typed error with Retry-After
        if (response.status === 429) {
            const retryHeader = response.headers.get('retry-after')
            // Retry-After can be seconds (integer) or HTTP-date; Graph typically sends seconds
            let retryAfterMs = 30_000  // safe default: 30s
            if (retryHeader) {
                const seconds = parseInt(retryHeader, 10)
                if (!isNaN(seconds)) {
                    retryAfterMs = seconds * 1000
                } else {
                    // Try parsing as HTTP-date (RFC 7231)
                    const date = new Date(retryHeader).getTime()
                    if (!isNaN(date)) {
                        retryAfterMs = Math.max(date - Date.now(), 5_000)
                    }
                }
            }
            // Floor at 5s to prevent tight-looping on tiny values
            retryAfterMs = Math.max(retryAfterMs, 5_000)
            throw new GraphThrottleError(retryAfterMs, body)
        }
        throw new Error(`Graph send failed: ${response.status} ${body}`)
    }
}

async function sendViaSMTP(config: MailConfig, options: EmailOptions, extraHeaders?: Record<string, string>): Promise<void> {
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
        headers: extraHeaders,
    })
}

/**
 * Internal retry helper — 3 attempts.
 *  - On GraphThrottleError: wait the server-specified Retry-After duration (not exponential)
 *  - On other errors: exponential back-off (1 s, 2 s, 4 s)
 * Throws on exhaustion so callers can log/capture the error.
 */
async function sendWithRetry(
    fn: () => Promise<void>,
    label: string,
    maxAttempts = 3,
): Promise<void> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await fn()
            return          // success — exit immediately
        } catch (err) {
            lastErr = err
            if (attempt < maxAttempts) {
                // Respect Graph's Retry-After on 429; use exponential backoff for everything else
                const isThrottle = err instanceof GraphThrottleError
                const delay = isThrottle ? err.retryAfterMs : 1_000 * 2 ** (attempt - 1)
                logger.warn('mailer', `Attempt ${attempt}/${maxAttempts} failed for "${label}"${isThrottle ? ' (429 throttled)' : ''}, retrying in ${delay}ms`, { error: err as Error })
                await new Promise(r => setTimeout(r, delay))
            }
        }
    }
    throw lastErr  // all attempts exhausted
}

// ── List-Unsubscribe Headers (RFC 8058) ────────────────────────────────────

/**
 * Build RFC 8058 compliant List-Unsubscribe headers.
 * Gmail and Yahoo REQUIRE these for bulk senders (>5000/day).
 *
 * Returns headers as a flat Record for injection into both SMTP (nodemailer)
 * and Graph (internetMessageHeaders) transports.
 */
function buildUnsubscribeHeaders(recipientEmail: string, siteUrl: string): Record<string, string> {
    const unsubUrl = buildUnsubscribeUrl(siteUrl, recipientEmail, 'subscriber')
    return {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'Precedence': 'bulk',
    }
}

/**
 * Classify an outgoing email into a category based on its subject line.
 * Used for email analytics breakdowns.
 */
function detectEmailType(subject: string): string {
    const s = subject.toLowerCase()
    if (s.includes('subscri')) return 'subscribe'
    if (s.includes('verify') || s.includes('confirm') || s.includes('reset') || s.includes('login') || s.includes('password') || s.includes('welcome')) return 'authentication'
    if (s.includes('application') || s.includes('casting') || s.includes('audition') || s.includes('role') || s.includes('shortlist') || s.includes('selected') || s.includes('rejected')) return 'application'
    if (s.includes('notification') || s.includes('update') || s.includes('news') || s.includes('announcement')) return 'notification'
    return 'general'
}

/**
 * Send an email via whichever transport the admin has configured.
 * Gracefully no-ops if emails are disabled or not configured.
 * Retries up to 3 times with exponential back-off before giving up.
 * Errors are logged but never thrown — email sending is fire-and-forget.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
    // ── Suppression check — transactional emails bypass, marketing emails are blocked ──
    if (options.isTransactional) {
        const suppressed = await isEmailSuppressed(options.to)
        if (suppressed) {
            logger.warn('mailer', `Sending transactional to suppressed address (${suppressed}): ${options.to} — allowed by bypass`)
        }
        // Continue sending regardless — auth/security emails MUST be delivered
    } else {
        const suppressReason = await isEmailSuppressed(options.to)
        if (suppressReason) {
            logger.info('mailer', `Email SUPPRESSED (${suppressReason}): ${options.to} — ${options.subject}`)
            return false
        }
    }

    try {
        const config = await getMailConfig()
        if (!config) {
            logger.info('mailer', 'Email skipped — not configured or emails disabled')
            return false
        }

        // Generate a unique tracking ID for open analytics
        const trackingId = crypto.randomUUID()
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'

        // Skip tracking pixel for authentication/security emails — it triggers
        // Gmail/Outlook spam filters on transactional messages.  Only inject
        // the pixel for marketing/notification/general emails where open-rate
        // analytics are useful.
        // Use explicit type when provided; fall back to subject-line heuristic
        const emailType = options.type || detectEmailType(options.subject)
        const isAuthEmail = emailType === 'authentication'

        let htmlWithPixel = options.html
        if (!isAuthEmail && !options.isTransactional) {
            const pixelUrl = `${siteUrl}/api/track/open/${trackingId}`
            const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`

            // Inject tracking pixel before </body> or at the end of the HTML
            if (htmlWithPixel.includes('</body>')) {
                htmlWithPixel = htmlWithPixel.replace('</body>', `${trackingPixel}</body>`)
            } else if (htmlWithPixel.includes('</div>')) {
                // Append before last closing div
                const lastIdx = htmlWithPixel.lastIndexOf('</div>')
                htmlWithPixel = htmlWithPixel.slice(0, lastIdx) + trackingPixel + htmlWithPixel.slice(lastIdx)
            } else {
                htmlWithPixel += trackingPixel
            }
        }

        // ── List-Unsubscribe headers (RFC 8058) ─────────────────────────────
        // Only for non-auth, non-transactional emails — marketing/bulk emails
        // Gmail and Yahoo REQUIRE these headers for bulk senders
        const unsubHeaders = (!isAuthEmail && !options.isTransactional)
            ? buildUnsubscribeHeaders(options.to, siteUrl)
            : undefined

        // Use admin-configured reply-to unless caller explicitly set one
        const finalOptions: EmailOptions = {
            ...options,
            html: htmlWithPixel,
            replyTo: options.replyTo ?? config.replyTo,
        }

        if (config.transport === 'smtp') {
            await sendWithRetry(() => sendViaSMTP(config, finalOptions, unsubHeaders), options.subject)
        } else {
            await sendWithRetry(() => sendViaGraph(config, finalOptions, unsubHeaders), options.subject)
        }

        logger.info('mailer', `Email sent to ${options.to}: ${options.subject}`)

        // Fire-and-forget delivery log with tracking ID
        prisma.emailLog.create({
            data: {
                trackingId,
                to: options.to,
                subject: options.subject,
                type: emailType,
                transport: config.transport,
                success: true,
                bounceCategory: null,
            },
        }).catch(() => { /* non-critical log failure */ })

        return true
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        const bounceCategory = classifyBounceError(errorMsg)
        logger.error('mailer', `Email to ${options.to} failed after all retries: ${options.subject}`, { error: err as Error })

        // Log failure with bounce classification
        prisma.emailLog.create({
            data: {
                to: options.to,
                subject: options.subject,
                type: options.type || detectEmailType(options.subject),
                transport: 'unknown',
                success: false,
                error: errorMsg.slice(0, 2000),
                bounceCategory,
            },
        }).catch(() => { /* non-critical */ })

        // Record bounce in suppression engine (handles auto-suppress + subscriber deactivation)
        recordBounce(options.to, bounceCategory, errorMsg).catch(() => { /* non-critical */ })

        // Surface in Sentry if available
        try {
            const { captureException } = await import('@sentry/nextjs')
            captureException(err, { extra: { to: options.to, subject: options.subject } })
        } catch { /* Sentry not available */ }
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
