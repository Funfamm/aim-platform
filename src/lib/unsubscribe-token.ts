/**
 * Unsubscribe token utilities — HMAC-SHA256 signed, stateless.
 *
 * Token format: base64url( HMAC-SHA256( email + ':' + type ) )
 * type: 'subscriber' | 'member'
 *
 * The token is embedded in every publish email and verified on GET /api/unsubscribe.
 * No database lookup is needed to verify — the signature proves authenticity.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || 'aim-unsubscribe-secret'

export function generateUnsubscribeToken(email: string, type: 'subscriber' | 'member'): string {
    const payload = `${email.toLowerCase()}:${type}`
    const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
    // Encode payload + sig together so the route can reconstruct without a DB call
    const encoded = Buffer.from(payload).toString('base64url')
    return `${encoded}.${sig}`
}

export function verifyUnsubscribeToken(token: string): { email: string; type: 'subscriber' | 'member' } | null {
    try {
        const dot = token.lastIndexOf('.')
        if (dot === -1) return null
        const encodedPayload = token.slice(0, dot)
        const sig = token.slice(dot + 1)
        const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8')
        const expectedSig = createHmac('sha256', SECRET).update(payload).digest('base64url')

        // Constant-time comparison to prevent timing attacks
        const sigBuf = Buffer.from(sig)
        const expBuf = Buffer.from(expectedSig)
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null

        const [email, type] = payload.split(':')
        if (!email || (type !== 'subscriber' && type !== 'member')) return null
        return { email, type: type as 'subscriber' | 'member' }
    } catch {
        return null
    }
}

/** Build the full unsubscribe URL to embed in emails */
export function buildUnsubscribeUrl(siteUrl: string, email: string, type: 'subscriber' | 'member'): string {
    const token = generateUnsubscribeToken(email, type)
    return `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`
}
