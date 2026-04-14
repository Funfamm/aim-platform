import { WebhookReceiver } from 'livekit-server-sdk'

let _receiver: WebhookReceiver | null = null

function getReceiver(): WebhookReceiver {
    if (!_receiver) {
        const key = process.env.LIVEKIT_API_KEY
        const secret = process.env.LIVEKIT_WEBHOOK_SECRET ?? process.env.LIVEKIT_API_SECRET
        if (!key || !secret) {
            throw new Error('LIVEKIT_API_KEY and LIVEKIT_WEBHOOK_SECRET must be set')
        }
        _receiver = new WebhookReceiver(key, secret)
    }
    return _receiver
}

/**
 * Validates and decodes a signed LiveKit webhook payload.
 * `rawBody` must be the exact text string — not parsed JSON.
 */
export async function receiveLiveKitWebhook(rawBody: string, authHeader?: string) {
    return getReceiver().receive(rawBody, authHeader)
}
