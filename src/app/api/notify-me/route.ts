import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

// ── Rate-limit store (in-memory, per-instance) ──────────────────────────────
// Resets on cold start — DB unique constraint is the ultimate dedup gate.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isRateLimited(ipHash: string): boolean {
    const now = Date.now()
    if (now - lastCleanup > 60_000) {
        lastCleanup = now
        for (const [key, entry] of rateLimitMap) {
            if (now > entry.resetAt) rateLimitMap.delete(key)
        }
    }
    const entry = rateLimitMap.get(ipHash)
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ipHash, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
        return false
    }
    entry.count++
    return entry.count > RATE_LIMIT_MAX
}
let lastCleanup = Date.now()

// ── Turnstile server-side verification ──────────────────────────────────────
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || ''

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
    if (!TURNSTILE_SECRET) {
        console.error('[notify-me] TURNSTILE_SECRET_KEY is not set — rejecting request')
        return false
    }
    const body = new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
    })
    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        })
        const data = await res.json() as { success: boolean; 'error-codes'?: string[] }
        if (!data.success) {
            // Log error codes for diagnostics — never log the raw token
            console.warn('[notify-me] Turnstile rejected — codes:', data['error-codes'] ?? [])
        }
        return data.success === true
    } catch (err) {
        console.error('[notify-me] Turnstile request failed:', err)
        return false
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex')
}

function normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateUnsubscribeToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

// ── POST /api/notify-me ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { signupTag, language, country, turnstileToken, website } = body
        const email = normalizeEmail(body.email || '')

        // ── Honeypot ────────────────────────────────────────────────────
        if (website) {
            return NextResponse.json({ success: true })
        }

        // ── Validate ────────────────────────────────────────────────────
        if (!email || !isValidEmail(email)) {
            return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
        }
        if (!signupTag || typeof signupTag !== 'string') {
            return NextResponse.json({ error: 'Missing signup tag.' }, { status: 400 })
        }

        // ── Rate limit ──────────────────────────────────────────────────
        const forwarded = req.headers.get('x-forwarded-for')
        const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
        const ipHash = hashIp(ip)

        if (isRateLimited(ipHash)) {
            return NextResponse.json(
                { error: 'Too many signups from this location. Please try again later.' },
                { status: 429 }
            )
        }

        // ── Turnstile verification ──────────────────────────────────────
        if (!turnstileToken || typeof turnstileToken !== 'string') {
            return NextResponse.json(
                { error: 'Human verification could not be completed. Please try again. If it continues, allow verification scripts for this site or use another browser.' },
                { status: 400 }
            )
        }
        const turnstileOk = await verifyTurnstile(turnstileToken, ip)
        if (!turnstileOk) {
            return NextResponse.json(
                { error: 'Human verification could not be completed. Please try again. If it continues, allow verification scripts for this site or use another browser.' },
                { status: 403 }
            )
        }

        // ── Validate CTA is active ──────────────────────────────────────
        const cta = await prisma.ctaConfiguration.findUnique({
            where: { signupTag },
        })

        if (!cta || cta.status !== 'active') {
            return NextResponse.json(
                { error: 'This notification is no longer active.' },
                { status: 410 }
            )
        }

        // ── Create signup (dedup on email + signupTag) ──────────────────
        const userAgent = req.headers.get('user-agent') || undefined

        try {
            await prisma.notificationSignup.create({
                data: {
                    email,
                    signupTag,
                    notificationType: cta.notificationType,
                    sourceVideoId: cta.videoId,
                    language: language || 'en',
                    country: country || null,
                    ipHash,
                    userAgent,
                    unsubscribeToken: generateUnsubscribeToken(),
                },
            })
            return NextResponse.json({ success: true, alreadySubscribed: false })
        } catch (err: unknown) {
            // Prisma unique constraint violation = duplicate signup
            const prismaError = err as { code?: string }
            if (prismaError.code === 'P2002') {
                return NextResponse.json({ success: true, alreadySubscribed: true })
            }
            throw err
        }
    } catch (error) {
        console.error('[notify-me] POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
