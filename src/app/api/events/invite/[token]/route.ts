/**
 * GET/POST /api/events/invite/[token]
 * --------------------------------------------------------------------------
 * EventInvite access model.
 *
 * GET  — Validate an invite token. Returns event metadata + role.
 *        Sets an encrypted HttpOnly cookie preserving the invite context
 *        so auth redirects work without query strings.
 *
 * POST — Mark invite as accepted (called after successful login).
 *        Reads the invite cookie, validates, sets acceptedAt.
 *
 * Token security:
 *   - Raw token is 256-bit crypto.randomBytes(32) hex (sent in invite URL).
 *   - DB stores SHA-256(rawToken) only. Raw value never persisted.
 *   - Comparison: incoming raw token is hashed before lookup.
 *
 * Cookie: invite_ctx (HttpOnly, Secure, SameSite=Lax, 1h max-age)
 *   Payload: { tokenHash, eventPath }  — signed with JWT_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { logLiveEventAnalytic } from '@/lib/liveEvent/analytics'

// ── Cookie helpers ─────────────────────────────────────────────────────────

const COOKIE_NAME = 'invite_ctx'
const COOKIE_MAX_AGE = 60 * 60 // 1 hour

function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not set')
    return new TextEncoder().encode(secret)
}

async function signInviteCookie(payload: { tokenHash: string; eventPath: string }) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(getJwtSecret())
}

export async function readInviteCookie(): Promise<{ tokenHash: string; eventPath: string } | null> {
    try {
        const jar = await cookies()
        const cookie = jar.get(COOKIE_NAME)
        if (!cookie?.value) return null
        const { payload } = await jwtVerify(cookie.value, getJwtSecret())
        return payload as { tokenHash: string; eventPath: string }
    } catch {
        return null
    }
}

function hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex')
}

// ── GET — validate token ───────────────────────────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token: rawToken } = await params
    const tokenHash = hashToken(rawToken)

    const invite = await prisma.eventInvite.findUnique({
        where: { tokenHash },
        include: {
            event: {
                select: {
                    id:          true,
                    title:       true,
                    roomName:    true,
                    eventType:   true,
                    status:      true,
                    scheduledAt: true,
                },
            },
        },
    })

    // ── Validation ────────────────────────────────────────────────────────────
    if (!invite) {
        return NextResponse.json({ error: 'invalid' }, { status: 404 })
    }
    if (invite.status === 'revoked') {
        return NextResponse.json({ error: 'revoked', title: invite.event.title }, { status: 410 })
    }
    if (invite.expiresAt < new Date()) {
        return NextResponse.json({ error: 'expired', title: invite.event.title }, { status: 410 })
    }

    // ── Build locale-aware event path ─────────────────────────────────────────
    const locale = invite.locale ?? 'en'
    const isWatchParty = invite.event.eventType === 'watch_party'
    const eventPath = isWatchParty
        ? `/${locale}/events/watch/${invite.event.roomName}`
        : `/${locale}/events/${invite.event.roomName}`

    // ── Log analytics ─────────────────────────────────────────────────────────
    await logLiveEventAnalytic(invite.event.id, null, 'invite_opened', { locale })

    // ── Set invite context cookie ─────────────────────────────────────────────
    const signed = await signInviteCookie({ tokenHash, eventPath })
    const response = NextResponse.json({
        ok:        true,
        eventPath,
        eventType: invite.event.eventType,
        title:     invite.event.title,
        role:      invite.role,
        status:    invite.event.status,
    })
    response.cookies.set(COOKIE_NAME, signed, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   COOKIE_MAX_AGE,
        path:     '/',
    })
    return response
}

// ── POST — mark accepted ───────────────────────────────────────────────────

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token: rawToken } = await params
    const tokenHash = hashToken(rawToken)

    const invite = await prisma.eventInvite.findUnique({
        where: { tokenHash },
        select: {
            id:             true,
            eventId:        true,
            status:         true,
            expiresAt:      true,
            recipientUserId: true,
            recipientEmail: true,
            event: { select: { id: true, roomName: true, eventType: true } },
        },
    })

    if (!invite)                      return NextResponse.json({ error: 'invalid' }, { status: 404 })
    if (invite.status === 'revoked')  return NextResponse.json({ error: 'revoked' }, { status: 410 })
    if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'expired' }, { status: 410 })

    // Validate recipient match (if invite was scoped to a specific user)
    if (invite.recipientUserId && invite.recipientUserId !== session.userId) {
        return NextResponse.json({ error: 'This invite was issued to a different user' }, { status: 403 })
    }

    // Mark as accepted
    await prisma.eventInvite.update({
        where: { id: invite.id },
        data:  { status: 'accepted', acceptedAt: new Date() },
    })

    await logLiveEventAnalytic(invite.eventId, session.userId, 'invite_accepted')

    // Clear the invite cookie
    const response = NextResponse.json({ ok: true })
    response.cookies.delete(COOKIE_NAME)
    return response
}
