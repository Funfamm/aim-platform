/**
 * Email Webhook Endpoint
 * ---------------------------------------------------------------------------
 * POST /api/webhooks/email
 *
 * Receives asynchronous delivery status notifications from Azure Communication
 * Services (ACS) via Azure Event Grid.
 *
 * Handles:
 *   - Event Grid subscription validation handshake (echo validationCode)
 *   - EmailDeliveryReportReceived events → recordBounce() → auto-suppression
 *   - Webhook deduplication via EmailBounceEvent (5-minute window)
 *
 * Security: HMAC-SHA256 signature verification via ACS_WEBHOOK_SECRET.
 * In dev mode (no secret set), verification is skipped.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { recordBounce } from '@/lib/suppression'
import { verifyAcsWebhookSignature, normalizeAcsEvent } from '@/lib/webhook-auth'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
    let body: string
    try {
        body = await request.text()
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    let payload: unknown
    try {
        payload = JSON.parse(body)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // ── Event Grid Validation Handshake (MUST come BEFORE auth) ─────────────
    // Azure sends a SubscriptionValidation event when setting up the webhook.
    // We must echo back the validationCode within 30 seconds to complete
    // subscription registration. If this is blocked by signature verification,
    // the subscription creation fails and no bounce webhooks will ever arrive.
    if (Array.isArray(payload)) {
        const validationEvent = payload.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e: any) => e.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent'
        )
        if (validationEvent) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const code = (validationEvent as any).data?.validationCode
            logger.info('webhook/email', `Event Grid validation handshake — echoing code`)
            return NextResponse.json({ validationResponse: code })
        }
    }

    // ── Verify signature (only for non-validation events) ───────────────────
    if (!verifyAcsWebhookSignature(request, body)) {
        logger.warn('webhook/email', 'Signature verification failed')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Process bounce events ───────────────────────────────────────────────
    const events = Array.isArray(payload) ? payload : [payload]
    let processed = 0
    let skipped = 0
    let deduplicated = 0

    for (const event of events) {
        if (typeof event !== 'object' || !event) continue

        const normalized = normalizeAcsEvent(event as Record<string, unknown>)
        if (!normalized) {
            skipped++
            continue
        }

        // ── Deduplication: skip if same bounce recorded within last 5 minutes ──
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existing = await (prisma as any).emailBounceEvent.findFirst({
                where: {
                    email: normalized.email.toLowerCase(),
                    bounceType: normalized.bounceType,
                    source: 'webhook',
                    occurredAt: { gte: fiveMinAgo },
                },
            })

            if (existing) {
                deduplicated++
                continue
            }
        } catch {
            // If dedup check fails, proceed anyway — better to double-record than miss
        }

        // Record the bounce → triggers suppression engine
        await recordBounce(
            normalized.email,
            normalized.bounceType,
            normalized.detail,
            'webhook'
        )
        processed++
    }

    logger.info('webhook/email', `Processed ${processed}, skipped ${skipped}, deduped ${deduplicated}`)

    return NextResponse.json({
        ok: true,
        processed,
        skipped,
        deduplicated,
    })
}
