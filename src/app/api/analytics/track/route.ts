import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Simple in-memory rate limiter (per-IP, 120 req/min)
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 120
const RATE_WINDOW = 60_000

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const entry = rateMap.get(ip)
    if (!entry || now > entry.resetAt) {
        rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
        return false
    }
    entry.count++
    return entry.count > RATE_LIMIT
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of rateMap) {
        if (now > entry.resetAt) rateMap.delete(ip)
    }
}, 5 * 60_000)

export async function POST(req: Request) {
    try {
        // Rate limit check
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        if (isRateLimited(ip)) {
            return NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429 })
        }

        const { path, referrer } = await req.json()
        if (!path) return NextResponse.json({ ok: false }, { status: 400 })

        const userAgent = req.headers.get('user-agent') || ''

        // Detect device type from user agent
        let device = 'desktop'
        if (/mobile|android|iphone|ipad/i.test(userAgent)) {
            device = /ipad|tablet/i.test(userAgent) ? 'tablet' : 'mobile'
        }

        // Try to get userId from session cookie (lightweight check)
        let userId: string | null = null
        try {
            const cookieHeader = req.headers.get('cookie') || ''
            const sessionMatch = cookieHeader.match(/session=([^;]+)/)
            if (sessionMatch) {
                const { getSession } = await import('@/lib/auth')
                const session = await getSession() as { id: string } | null
                userId = session?.id || null
            }
        } catch {
            // Ignore — not critical
        }

        await prisma.pageView.create({
            data: {
                path,
                userId,
                userAgent: userAgent.slice(0, 500), // Truncate to save space
                referrer: referrer?.slice(0, 500) || null,
                device,
            },
        })

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
