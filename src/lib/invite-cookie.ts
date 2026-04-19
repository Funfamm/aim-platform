/**
 * invite-cookie.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared helpers for the `invite_ctx` HttpOnly cookie written when a user
 * clicks an invite link and read on login to redirect them to the event.
 *
 * Extracted from the route file so non-route modules (e.g. /api/auth/login)
 * can import it without triggering Next.js's "invalid Route export" error.
 */

import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

export const INVITE_COOKIE_NAME = 'invite_ctx'
export const INVITE_COOKIE_MAX_AGE = 60 * 60 // 1 hour

function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not set')
    return new TextEncoder().encode(secret)
}

export async function signInviteCookie(payload: {
    tokenHash: string
    eventPath: string
}): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(getJwtSecret())
}

export async function readInviteCookie(): Promise<{
    tokenHash: string
    eventPath: string
} | null> {
    try {
        const jar = await cookies()
        const cookie = jar.get(INVITE_COOKIE_NAME)
        if (!cookie?.value) return null
        const { payload } = await jwtVerify(cookie.value, getJwtSecret())
        return payload as { tokenHash: string; eventPath: string }
    } catch {
        return null
    }
}
