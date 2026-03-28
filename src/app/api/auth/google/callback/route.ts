import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { cookies } from 'next/headers'

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
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')
    const errorParam = searchParams.get('error')

    // Handle user cancellation / denied access
    if (errorParam === 'access_denied') {
        return NextResponse.redirect(new URL('/login?error=google_cancelled', req.url))
    }

    if (!code) {
        return NextResponse.redirect(new URL('/login?error=no_code', req.url))
    }

    // CSRF: verify state matches what we set in the initiation route
    const cookieStore = await cookies()
    const savedState = cookieStore.get('oauth_state')?.value
    if (!savedState || savedState !== stateParam) {
        console.error('[Google OAuth] State mismatch — possible CSRF. saved:', savedState, 'received:', stateParam)
        return NextResponse.redirect(new URL('/login?error=invalid_state', req.url))
    }
    // Clear the state cookie immediately after use
    cookieStore.set('oauth_state', '', { maxAge: 0, path: '/' })

    try {
        // Get Google OAuth credentials from env or DB settings
        const settings = await prisma.siteSettings.findFirst()
        const clientId = process.env.GOOGLE_CLIENT_ID || (settings as Record<string, string> | null)?.googleClientId || ''
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || (settings as Record<string, string> | null)?.googleClientSecret || ''
        const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(req.url).origin
        const redirectUri = `${origin}/api/auth/google/callback`

        if (!clientId || !clientSecret) {
            return NextResponse.redirect(new URL('/login?error=oauth_not_configured', req.url))
        }

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
            return NextResponse.redirect(new URL('/login?error=token_exchange_failed', req.url))
        }

        const tokens = await tokenRes.json() as GoogleTokenResponse

        // Fetch Google user profile
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        })

        if (!userRes.ok) {
            console.error('[Google OAuth] Failed to fetch user info:', userRes.status)
            return NextResponse.redirect(new URL('/login?error=user_info_failed', req.url))
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
        }

        // Never allow admins to bypass their password requirement via OAuth
        if (user.role === 'admin' || user.role === 'superadmin') {
            return NextResponse.redirect(new URL('/login?error=admin_oauth_disallowed', req.url))
        }

        // Fetch tokenVersion via Prisma (not raw SQL)
        const userWithVersion = await prisma.user.findUnique({
            where: { id: user.id },
            select: { tokenVersion: true },
        })
        const tokenVersion = userWithVersion?.tokenVersion ?? 0

        const tokenPayload = {
            userId: user.id,
            role: user.role,
            email: user.email,
            tokenVersion,
        }
        const token = await createToken(tokenPayload)
        const refresh = await createRefreshToken(tokenPayload)
        await setUserCookie(token, refresh)

        // Redirect to where the user was trying to go, or dashboard
        const returnTo = cookieStore.get('oauth_return_to')?.value || '/dashboard'
        cookieStore.set('oauth_return_to', '', { maxAge: 0, path: '/' })
        return NextResponse.redirect(new URL(returnTo, req.url))
    } catch (err) {
        console.error('[Google OAuth] Unexpected error:', err)
        return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url))
    }
}
