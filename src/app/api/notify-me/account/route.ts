import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionAndRefresh } from '@/lib/auth'
import crypto from 'crypto'

// ── POST /api/notify-me/account ─────────────────────────────────────────────
// Authenticated endpoint: logged-in users sign up for a Notify Me CTA
// using their account email. No Turnstile required — session is auth.

function generateUnsubscribeToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

export async function POST(req: NextRequest) {
    try {
        // ── Require authenticated session ────────────────────────────────
        const session = await getSessionAndRefresh()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { signupTag } = await req.json()
        if (!signupTag || typeof signupTag !== 'string') {
            return NextResponse.json({ error: 'Missing signup tag.' }, { status: 400 })
        }

        // ── Fetch the user's email and preferred language ────────────────
        const user = await prisma.user.findUnique({
            where: { id: session.userId as string },
            select: { email: true, preferredLanguage: true, name: true },
        })
        if (!user?.email) {
            return NextResponse.json({ error: 'User account not found.' }, { status: 404 })
        }

        // ── Validate CTA is active ───────────────────────────────────────
        const cta = await prisma.ctaConfiguration.findUnique({
            where: { signupTag },
        })
        if (!cta || cta.status !== 'active') {
            return NextResponse.json(
                { error: 'This notification is no longer active.' },
                { status: 410 }
            )
        }

        // ── Create signup (dedup on email + signupTag unique constraint) ─
        const email         = user.email.trim().toLowerCase()
        const language      = user.preferredLanguage || 'en'
        const sourcePageUrl = req.headers.get('referer') || null

        try {
            await prisma.notificationSignup.create({
                data: {
                    email,
                    signupTag,
                    notificationType:   cta.notificationType,
                    sourceVideoId:      cta.videoId,
                    language,
                    userAgent:          req.headers.get('user-agent') || undefined,
                    unsubscribeToken:   generateUnsubscribeToken(),
                    // Phase 1 fields
                    userId:             session.userId as string,
                    requestedBy:        'member',
                    requestSource:      'player_end_card',
                    sourceType:         'work',
                    sourceEntityId:     cta.videoId,
                    sourcePageUrl,
                    status:             'active',
                    confirmationInAppAt: new Date(),
                },
            })

            // ── In-app confirmation for logged-in users ───────────────────
            void prisma.userNotification.create({
                data: {
                    userId:  session.userId as string,
                    type:    'notify_me',
                    title:   "You’re on the list!",
                    message: `We’ll notify you about ${cta.headlineRegular || 'the upcoming release'}.`,
                    link:    null,
                },
            }).catch(err => console.error('[notify-me/account] In-app notification failed:', err.message))

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
        console.error('[notify-me/account] POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
