import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { cookies } from 'next/headers'
import { handleDeviceFingerprint } from '@/lib/device-fingerprint'

interface GoogleTokenResponse {
    access_token: string
    id_token: string
    token_type: string
}

interface GoogleUserInfo {
    sub: string
    email: string
    name: string
    picture: string
}

export async function GET(req: Request) {
    // Use NEXT_PUBLIC_SITE_URL as the authoritative base for ALL redirects.
    // req.url contains the internal Render hostname (localhost:10000) behind
    // the proxy, NOT the public-facing domain — using it would send users to
    // localhost:10000/... which is unreachable from their browser.
    const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
        || new URL(req.url).origin

    const r = (path: string) => NextResponse.redirect(`${siteBase}${path}`)

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')
    const errorParam = searchParams.get('error')

    // Handle user cancellation / denied access
    if (errorParam === 'access_denied') return r('/login?error=google_cancelled')
    if (!code) return r('/login?error=no_code')

    // CSRF: verify state matches what we set in the initiation route
    const cookieStore = await cookies()
    const savedState = cookieStore.get('oauth_state')?.value
    if (!savedState || savedState !== stateParam) {
        console.error('[Google OAuth] State mismatch — possible CSRF. saved:', savedState, 'received:', stateParam)
        return r('/login?error=invalid_state')
    }
    // Clear the state cookie immediately after use
    cookieStore.set('oauth_state', '', { maxAge: 0, path: '/' })

    try {
        // Get Google OAuth credentials from env or DB settings
        const settings = await prisma.siteSettings.findFirst()
        const clientId = process.env.GOOGLE_CLIENT_ID || (settings as Record<string, string> | null)?.googleClientId || ''
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || (settings as Record<string, string> | null)?.googleClientSecret || ''

        // The redirect_uri MUST match what was sent during initiation
        const redirectUri = `${siteBase}/api/auth/google/callback`

        if (!clientId || !clientSecret) return r('/login?error=oauth_not_configured')

        // Exchange auth code for access + ID tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        })

        if (!tokenRes.ok) {
            const errorBody = await tokenRes.text()
            console.error('[Google OAuth] Token exchange failed:', tokenRes.status, errorBody)
            return r('/login?error=token_exchange_failed')
        }

        const tokens = await tokenRes.json() as GoogleTokenResponse

        // Fetch Google user profile
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        })

        if (!userRes.ok) {
            console.error('[Google OAuth] Failed to fetch user info:', userRes.status)
            return r('/login?error=user_info_failed')
        }

        const googleUser = await userRes.json() as GoogleUserInfo

        // Find or create user by Google ID or matching email
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { googleId: googleUser.sub },
                    { email: googleUser.email },
                ],
            },
        })

        if (user) {
            // Ensure Google ID is linked if user registered with email first
            if (!user.googleId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        googleId: googleUser.sub,
                        avatar: user.avatar || googleUser.picture,
                    },
                })
            }
        } else {
            // New user — register via Google
            user = await prisma.user.create({
                data: {
                    name: googleUser.name,
                    email: googleUser.email,
                    googleId: googleUser.sub,
                    avatar: googleUser.picture,
                    role: 'member',
                },
            })

            // Fire welcome email + in-app notification (fire-and-forget, never blocks login)
            const newUserId = user.id
            const newUserName = googleUser.name
            const newUserEmail = googleUser.email
            void (async () => {
                try {
                    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
                    const { welcomeEmailWithOverrides } = await import('@/lib/email-templates')
                    const { sendEmail } = await import('@/lib/mailer')
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const db = prisma as any

                    // Send welcome email
                    const html = await welcomeEmailWithOverrides(newUserName, siteUrl).catch(() => null)
                    if (html) {
                        await sendEmail({
                            to: newUserEmail,
                            subject: `Welcome to AIM Studio, ${newUserName}! 🎬`,
                            html,
                        }).catch(() => {})
                    }

                    // Write welcome in-app notification (localized if non-English)
                    const newUserLang = await db.user.findUnique({ where: { id: newUserId }, select: { preferredLanguage: true } }).catch(() => null)
                    const locale = newUserLang?.preferredLanguage || 'en'
                    let welcomeTitle = `Welcome to AIM Studio, ${newUserName}! 🎬`
                    let welcomeMsg = "You're now part of our AI-powered filmmaking community. Explore casting calls, track your applications, and more."
                    if (locale !== 'en') {
                        const { translateContent } = await import('@/lib/translate')
                        const tx = await translateContent({ title: welcomeTitle, message: welcomeMsg }, 'all').catch(() => null)
                        if (tx?.[locale]) {
                            welcomeTitle = tx[locale].title || welcomeTitle
                            welcomeMsg   = tx[locale].message || welcomeMsg
                        }
                    }
                    await db.userNotification.create({
                        data: {
                            userId: newUserId,
                            type: 'system',
                            title: welcomeTitle,
                            message: welcomeMsg,
                            link: '/casting',
                        },
                    }).catch(() => {})
                } catch { /* never crash the login */ }
            })()
        }


        // Never allow admins to bypass their password requirement via OAuth
        if (user.role === 'admin' || user.role === 'superadmin') {
            return r('/login?error=admin_oauth_disallowed')
        }

        // Fetch tokenVersion + preferredLanguage via Prisma
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userWithExtras = await (prisma as any).user.findUnique({
            where: { id: user.id },
            select: { tokenVersion: true, preferredLanguage: true },
        })
        const tokenVersion = userWithExtras?.tokenVersion ?? 0
        const preferredLanguage: string = userWithExtras?.preferredLanguage || 'en'

        const tokenPayload = {
            userId: user.id,
            role: user.role,
            email: user.email,
            tokenVersion,
        }
        const token = await createToken(tokenPayload)
        const refresh = await createRefreshToken(tokenPayload)
        await setUserCookie(token, refresh)

        // New device detection + branded email alert (fire-and-forget)
        void handleDeviceFingerprint(req, user.id, user.name, user.email, tokenVersion).catch(() => {})

        // Redirect to where the user was trying to go, or dashboard
        // Build a locale-aware path so the user lands in their preferred language.
        const returnTo = cookieStore.get('oauth_return_to')?.value || '/dashboard'
        cookieStore.set('oauth_return_to', '', { maxAge: 0, path: '/' })

        // Ensure returnTo is a relative path to prevent open redirect attacks
        const safePath = returnTo.startsWith('/') ? returnTo : '/dashboard'

        // Prepend preferred locale prefix (skip for English — it's the default)
        const localePath =
            preferredLanguage === 'en'
                ? safePath
                : safePath.startsWith(`/${preferredLanguage}/`) || safePath === `/${preferredLanguage}`
                ? safePath
                : `/${preferredLanguage}${safePath}`

        return r(localePath)
    } catch (err) {
        console.error('[Google OAuth] Unexpected error:', err)
        return r('/login?error=oauth_failed')
    }
}
