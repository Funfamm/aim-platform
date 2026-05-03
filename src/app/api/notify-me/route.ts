import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

// ── Rate-limit store (in-memory, per-instance) ──────────────────────────────
// Tracks signup attempts per hashed IP. Resets naturally as entries expire.
// For serverless (Vercel), each cold start gets a fresh map — acceptable
// because the DB unique constraint is the ultimate dedup gate.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isRateLimited(ipHash: string): boolean {
    const now = Date.now()
    // Periodic cleanup: evict expired entries (at most once per minute)
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex')
}

function normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase()
}

/** Lenient email validation — accepts anything that looks roughly like an email */
function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateUnsubscribeToken(): string {
    return crypto.randomBytes(32).toString('hex') // 64-char hex
}

// ── POST /api/notify-me ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { signupTag, language, country } = body
        const email = normalizeEmail(body.email || '')

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

        // ── Upsert signup (dedup on email + signupTag) ──────────────────
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
