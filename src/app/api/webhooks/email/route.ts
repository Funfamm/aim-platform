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
 *   - EmailDeliveryReportReceived / Delivered → stamp EmailLog.deliveredAt
 *   - EmailDeliveryReportReceived / Bounce    → recordBounce() + write back to EmailLog
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

    // ── Process events ──────────────────────────────────────────────────────
    const events = Array.isArray(payload) ? payload : [payload]
    let delivered = 0
    let processed = 0
    let skipped = 0
    let deduplicated = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    for (const event of events) {
        if (typeof event !== 'object' || !event) continue

        const normalized = normalizeAcsEvent(event as Record<string, unknown>)
        if (!normalized) { skipped++; continue }

        // ── Delivery confirmation ─────────────────────────────────────────
        if (normalized.kind === 'delivered') {
            // Stamp deliveredAt on the most recent EmailLog for this recipient
            // that hasn't been confirmed yet (success=true, deliveredAt null).
            try {
                await db.$executeRawUnsafe(`
                    UPDATE "EmailLog" SET "deliveredAt" = NOW()
                    WHERE id = (
                        SELECT id FROM "EmailLog"
                        WHERE "to" = $1
                          AND success = true
                          AND "deliveredAt" IS NULL
                        ORDER BY "sentAt" DESC
                        LIMIT 1
                    )
                `, normalized.email)
                delivered++
                logger.info('webhook/email', `Delivery confirmed: ${normalized.email}`)
            } catch (err) {
                logger.error('webhook/email', `Failed to stamp deliveredAt for ${normalized.email}`, { error: err as Error })
            }
            continue
        }

        // ── Bounce event ──────────────────────────────────────────────────
        // Dedup: skip if same bounce recorded within last 5 minutes
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
        try {
            const existing = await db.emailBounceEvent.findFirst({
                where: {
                    email: normalized.email,
                    bounceType: normalized.bounceType,
                    source: 'webhook',
                    occurredAt: { gte: fiveMinAgo },
                },
            })
            if (existing) { deduplicated++; continue }
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

        // ── Write bounce back to the original EmailLog row ────────────────
        // The EmailLog row was created with success=true when ACS accepted the
        // message. We now correct it with the real delivery outcome.
        try {
            await db.$executeRawUnsafe(`
                UPDATE "EmailLog"
                SET success = false,
                    "bounceCategory" = $2,
                    error = $3
                WHERE id = (
                    SELECT id FROM "EmailLog"
                    WHERE "to" = $1
                      AND success = true
                      AND "bounceCategory" IS NULL
                    ORDER BY "sentAt" DESC
                    LIMIT 1
                )
            `, normalized.email, normalized.bounceType, normalized.detail.slice(0, 2000))
        } catch (err) {
            // Non-critical — bounce is already recorded in EmailBounceEvent
            logger.error('webhook/email', `Failed to write bounce back to EmailLog for ${normalized.email}`, { error: err as Error })
        }

        processed++
    }

    logger.info('webhook/email', `Delivered: ${delivered}, bounces: ${processed}, skipped: ${skipped}, deduped: ${deduplicated}`)

    return NextResponse.json({
        ok: true,
        delivered,
        processed,
        skipped,
        deduplicated,
    })
}
