import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token'

const VALID_CATEGORIES = ['action', 'drama', 'documentary', 'horror', 'romance', 'shorts', 'all']

// Simple in-memory rate limit: 3 submissions per IP per hour
const ipSubmitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
    const now = Date.now()
    const entry = ipSubmitMap.get(ip)
    if (!entry || now > entry.resetAt) {
        ipSubmitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
        return false
    }
    if (entry.count >= 3) return true
    entry.count++
    return false
}

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || 'unknown'

        if (checkRateLimit(ip)) {
            return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
        }

        const body = await req.json()
        const { surveyId, selections, freeText, token } = body
        const locale = body.locale || 'en'
        const country = req.headers.get('x-vercel-ip-country') || body.country || null

        // Decode email from signed token (if present)
        let email: string | null = null
        if (token && typeof token === 'string') {
            const decoded = verifyUnsubscribeToken(token)
            if (decoded) email = decoded.email.toLowerCase()
        }

        // Validate surveyId
        if (!surveyId || typeof surveyId !== 'string') {
            return NextResponse.json({ error: 'Missing surveyId' }, { status: 400 })
        }

        const survey = await prisma.survey.findUnique({ where: { id: surveyId } })
        if (!survey || !survey.active) {
            return NextResponse.json({ error: 'Survey not found or inactive' }, { status: 404 })
        }

        // Validate selections
        if (!Array.isArray(selections) || selections.length === 0) {
            return NextResponse.json({ error: 'At least one selection is required' }, { status: 400 })
        }
        const invalidKeys = selections.filter((s: string) => !VALID_CATEGORIES.includes(s))
        if (invalidKeys.length > 0) {
            return NextResponse.json({ error: `Invalid categories: ${invalidKeys.join(', ')}` }, { status: 400 })
        }

        // Validate freeText length
        if (freeText && typeof freeText === 'string' && freeText.length > 500) {
            return NextResponse.json({ error: 'Free text must be 500 characters or fewer' }, { status: 400 })
        }

        // Check for duplicate response by email
        if (email && typeof email === 'string') {
            const existing = await prisma.surveyResponse.findFirst({
                where: { surveyId, email: email.toLowerCase() },
            })
            if (existing) {
                return NextResponse.json({ error: 'already_responded' }, { status: 409 })
            }
        }

        // Look up subscriberId if email is available
        let subscriberId: string | null = null
        if (email && typeof email === 'string') {
            const subscriber = await prisma.subscriber.findUnique({
                where: { email: email.toLowerCase() },
                select: { id: true },
            })
            if (subscriber) subscriberId = subscriber.id
        }

        // Create response
        await prisma.surveyResponse.create({
            data: {
                surveyId,
                subscriberId,
                email: email ? email.toLowerCase() : null,
                selections,
                freeText: freeText || null,
                locale,
                country,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Survey Respond] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
