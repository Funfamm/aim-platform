/**
 * AIM Studio – Azure Communication Services Email Client
 * ---------------------------------------------------------------------------
 * Sends email via Azure Communication Services (ACS).
 * Used for bulk/marketing emails to protect Microsoft Graph reputation.
 *
 * Prerequisites:
 *   1. Email Communication Service resource in Azure
 *   2. Verified custom domain (mail.impactaistudio.com)
 *   3. Communication Services resource linked to Email resource
 *   4. Connection string stored in SiteSettings.acsConnectionString
 *
 * ACS SDK: @azure/communication-email
 */
import { logger } from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────

interface AcsEmailOptions {
    to: string
    subject: string
    html: string
    text?: string
    senderAddress: string     // must be a verified sender in ACS
    replyTo?: string
    /** Custom headers (e.g. List-Unsubscribe, Precedence) injected by the mailer */
    headers?: Record<string, string>
}

interface AcsConfig {
    connectionString: string
    senderAddress: string
}

// ── Lazy-loaded client cache ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedClient: any = null
let cachedConnectionString = ''

/**
 * Get or create an ACS EmailClient instance.
 * Lazy-loads the SDK to avoid import errors if not installed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAcsClient(connectionString: string): Promise<any> {
    if (cachedClient && cachedConnectionString === connectionString) {
        return cachedClient
    }

    try {
        const { EmailClient } = await import('@azure/communication-email')
        cachedClient = new EmailClient(connectionString)
        cachedConnectionString = connectionString
        return cachedClient
    } catch (err) {
        logger.error('acs-email', 'Failed to initialize ACS EmailClient. Is @azure/communication-email installed?', { error: err as Error })
        throw new Error('ACS EmailClient unavailable — install @azure/communication-email')
    }
}

/**
 * Invalidate the cached ACS client (call after admin changes connection string).
 */
export function invalidateAcsClient(): void {
    cachedClient = null
    cachedConnectionString = ''
}

// ── Send Email ─────────────────────────────────────────────────────────────

/**
 * Send a single email via Azure Communication Services.
 *
 * ACS uses a poller pattern:
 *   1. `client.beginSend(message)` → starts the send operation
 *   2. `poller.pollUntilDone()` → waits for delivery confirmation
 *
 * Timeout: 2 minutes (ACS usually delivers in <10s)
 */
export async function sendViaACS(config: AcsConfig, options: AcsEmailOptions): Promise<void> {
    const client = await getAcsClient(config.connectionString)

    const message = {
        senderAddress: options.senderAddress || config.senderAddress,
        content: {
            subject: options.subject,
            html: options.html,
            plainText: options.text || undefined,
        },
        recipients: {
            to: [{ address: options.to }],
        },
        replyTo: options.replyTo
            ? [{ address: options.replyTo }]
            : undefined,
        // ACS SDK supports custom headers via the 'headers' property on EmailMessage
        // This enables RFC 8058 List-Unsubscribe compliance on the ACS bulk transport
        headers: options.headers
            ? Object.entries(options.headers).map(([name, value]) => ({ name, value }))
            : undefined,
    }

    try {
        const poller = await client.beginSend(message)
        const result = await poller.pollUntilDone()

        if (result.status !== 'Succeeded') {
            const errorDetail = result.error?.message || `ACS send status: ${result.status}`
            throw new Error(errorDetail)
        }

        logger.info('acs-email', `Email sent via ACS to ${options.to}: ${options.subject}`)
    } catch (err) {
        // Re-throw with context for the mailer's retry logic
        const msg = err instanceof Error ? err.message : String(err)
        logger.error('acs-email', `ACS send failed to ${options.to}: ${msg}`)
        throw err
    }
}

/**
 * Test ACS configuration by sending a test email.
 * Unlike the main send, this throws on error so the admin can see the issue.
 */
export async function testAcsConnection(config: AcsConfig, toEmail: string): Promise<void> {
    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h2 style="color: #d4a853; margin-bottom: 8px;">ACS Email Working!</h2>
            <p style="color: #999; font-size: 14px;">Azure Communication Services is correctly configured for bulk email.</p>
            <p style="color: #666; font-size: 12px; margin-top: 24px;">Sender: <strong>${config.senderAddress}</strong></p>
        </div>
    `

    await sendViaACS(config, {
        to: toEmail,
        subject: '✅ AIM Studio | ACS Email Test Successful',
        html,
        senderAddress: config.senderAddress,
    })
}
