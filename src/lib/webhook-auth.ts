/**
 * AIM Studio – Webhook Authentication
 * ---------------------------------------------------------------------------
 * Signature verification for inbound ESP webhooks.
 *
 * Currently supports:
 *   - Azure Communication Services (ACS) via Event Grid HMAC-SHA256
 *
 * Dev mode: verification is skipped if the corresponding env var is not set,
 * allowing local testing without configuring secrets.
 */
import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

// ── ACS Event Grid Verification ────────────────────────────────────────────

/**
 * Verify an ACS Event Grid webhook signature.
 *
 * Azure Event Grid sends the signature in the `aeg-signature` header
 * as a Base64-encoded HMAC-SHA256 of the request body using the shared secret.
 *
 * @param req - the incoming request
 * @param body - the raw request body string
 * @returns true if valid or if secret is not configured (dev mode)
 */
export function verifyAcsWebhookSignature(req: NextRequest, body: string): boolean {
    const secret = process.env.ACS_WEBHOOK_SECRET
    if (!secret) {
        logger.warn('webhook-auth', 'ACS_WEBHOOK_SECRET not set — skipping verification (dev mode)')
        return true
    }

    const signature = req.headers.get('aeg-signature')
    if (!signature) {
        logger.warn('webhook-auth', 'Missing aeg-signature header')
        return false
    }

    try {
        const expectedSig = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('base64')

        // Constant-time comparison
        const sigBuf = Buffer.from(signature)
        const expBuf = Buffer.from(expectedSig)
        if (sigBuf.length !== expBuf.length) return false
        return crypto.timingSafeEqual(sigBuf, expBuf)
    } catch (err) {
        logger.error('webhook-auth', 'ACS signature verification failed', { error: err as Error })
        return false
    }
}

// ── Normalized ACS Event ───────────────────────────────────────────────────

export type NormalizedAcsEvent =
    | { kind: 'bounce';    email: string; bounceType: 'hard_bounce' | 'soft_bounce' | 'complaint'; detail: string }
    | { kind: 'delivered'; email: string }

/**
 * Normalize an ACS Event Grid event into our internal event format.
 *
 * ACS EventGrid EmailDeliveryReportReceived events have:
 *   - status: 'Delivered' | 'Bounced' | 'FilteredSpam' | 'Quarantined' | 'Suppressed' | 'Expanded'
 *   - deliveryStatusDetails: SMTP response details (may contain 5.x.x codes)
 *   - recipient: the email address
 *
 * Classification:
 *   - Delivered / Expanded → { kind: 'delivered' }  → stamps deliveredAt on EmailLog
 *   - Bounced             → hard_bounce (ACS already retried transient failures)
 *   - FilteredSpam        → complaint
 *   - Quarantined/Suppressed → hard_bounce
 */
export function normalizeAcsEvent(event: Record<string, unknown>): NormalizedAcsEvent | null {
    const eventType = event.eventType as string | undefined
    if (eventType !== 'Microsoft.Communication.EmailDeliveryReportReceived') return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = event.data as Record<string, any> | undefined
    if (!data) return null

    const status = data.status as string | undefined
    const recipient = data.recipient as string | undefined
    const details = (data.deliveryStatusDetails as string) || ''

    if (!recipient || !status) return null

    switch (status) {
        // ── Delivery confirmations ────────────────────────────────────────
        case 'Delivered':
        case 'Expanded':
            return { kind: 'delivered', email: recipient.toLowerCase() }

        // ── Bounce events ─────────────────────────────────────────────────
        case 'Bounced': {
            // ACS has already retried transient failures, so most "Bounced" are permanent
            const isDefinitelySoft = /^4\.\d+\.\d+/.test(details)
            return {
                kind: 'bounce',
                email: recipient.toLowerCase(),
                bounceType: isDefinitelySoft ? 'soft_bounce' : 'hard_bounce',
                detail: `ACS Bounced: ${details || 'no details'}`,
            }
        }
        case 'FilteredSpam':
            return {
                kind: 'bounce',
                email: recipient.toLowerCase(),
                bounceType: 'complaint',
                detail: `ACS FilteredSpam — treated as complaint: ${details}`,
            }
        case 'Quarantined':
        case 'Suppressed':
            return {
                kind: 'bounce',
                email: recipient.toLowerCase(),
                bounceType: 'hard_bounce',
                detail: `ACS ${status}: ${details || 'no details'}`,
            }
        default:
            return null
    }
}
