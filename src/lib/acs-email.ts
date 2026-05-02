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
import { EmailClient } from '@azure/communication-email'

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
let cachedClient: EmailClient | null = null
let cachedConnectionString = ''

/**
 * Get or create an ACS EmailClient instance.
 */
function getAcsClient(connectionString: string): EmailClient {
    if (cachedClient && cachedConnectionString === connectionString) {
        return cachedClient
    }

    cachedClient = new EmailClient(connectionString)
    cachedConnectionString = connectionString
    return cachedClient
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
 * ACS uses a two-phase pattern:
 *   1. `client.beginSend(message)` → queues the email in ACS (HTTP POST)
 *   2. `poller.pollUntilDone()`    → polls for delivery confirmation
 *
 * For BULK email we use fire-and-forget:
 *   - Once `beginSend()` succeeds, ACS has accepted the message and WILL
 *     deliver it. We do NOT wait for `pollUntilDone()` because that blocks
 *     10–60+ seconds per email, which stalls the entire worker.
 *   - Delivery failures (bounces) are handled asynchronously via ACS
 *     webhooks / the EmailBounceEvent table.
 */
export async function sendViaACS(config: AcsConfig, options: AcsEmailOptions): Promise<void> {
    const client = getAcsClient(config.connectionString)

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
        // ACS SDK expects headers as Record<string, string> (not array)
        // This enables RFC 8058 List-Unsubscribe compliance on the ACS bulk transport
        headers: options.headers || undefined,
    }

    try {
        // Phase 1: Queue the email in ACS (~1-2s HTTP round-trip)
        await client.beginSend(message)

        // beginSend() succeeded — ACS has accepted the message and will deliver it.
        // We do NOT call pollUntilDone() — that blocks 10-60s per email
        // and is the root cause of the worker stalling.
        logger.info('acs-email', `Email queued in ACS to ${options.to}: ${options.subject}`)
    } catch (err) {
        // beginSend() itself failed — bad credentials, invalid sender, network error
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
