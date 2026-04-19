/**
 * src/lib/subtitle-worker-hmac.ts
 *
 * HMAC-based request signing for the Vercel ↔ faster-whisper worker channel.
 *
 * HOW IT WORKS
 * ─────────────
 * - The Vercel app and the worker share a single secret: WORKER_SECRET.
 * - When Vercel calls the worker, it signs the JSON body and attaches
 *   `X-Signature: <hex-digest>` to the request.
 * - The worker verifies the header before doing any work.
 * - When the worker calls the Vercel callback, it signs its own payload the
 *   same way so we can verify the origin before updating the DB.
 *
 * ALGORITHM: HMAC-SHA256 over the UTF-8 JSON body string (not base64).
 * This matches the standard pattern used by Stripe, GitHub webhooks, etc.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const WORKER_SECRET = (process.env.WORKER_SECRET ?? '').trim().replace(/^["']|["']$/g, '')

/**
 * Sign an arbitrary payload object.
 * Returns the hex digest — attach it as the `X-Signature` HTTP header.
 */
export function signPayload(payload: object): string {
    if (!WORKER_SECRET) throw new Error('[subtitle-worker-hmac] WORKER_SECRET is not set.')
    const body = JSON.stringify(payload)
    return createHmac('sha256', WORKER_SECRET).update(body, 'utf8').digest('hex')
}

/**
 * Verify that `X-Signature` in an incoming request matches the body.
 *
 * @param body     Raw JSON string (the request body, NOT parsed).
 * @param provided The value of the `X-Signature` header from the request.
 * @returns true if valid, false otherwise.
 */
export function verifySignature(body: string, provided: string | null): boolean {
    if (!WORKER_SECRET) {
        console.error('[subtitle-worker-hmac] WORKER_SECRET not set — rejecting all requests.')
        return false
    }
    if (!provided) return false

    const expected = createHmac('sha256', WORKER_SECRET).update(body, 'utf8').digest()
    const received = Buffer.from(provided, 'hex')

    // Use timing-safe comparison to prevent timing attacks
    if (expected.length !== received.length) return false
    return timingSafeEqual(expected, received)
}
