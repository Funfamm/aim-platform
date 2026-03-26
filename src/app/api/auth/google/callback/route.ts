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

    if (!code) {
        return NextResponse.redirect(new URL('/login?error=no_code', req.url))
    }

    try {
        // Get Google OAuth credentials
        const settings = await prisma.siteSettings.findFirst()
        const clientId = process.env.GOOGLE_CLIENT_ID || (settings as Record<string, string> | null)?.googleClientId || ''
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || (settings as Record<string, string> | null)?.googleClientSecret || ''
        const origin = new URL(req.url).origin
        const redirectUri = `${origin}/api/auth/google/callback`

        if (!clientId || !clientSecret) {
            return NextResponse.redirect(new URL('/login?error=oauth_not_configured', req.url))
        }

        // Exchange code for tokens
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

        // Get user info
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        })

        if (!userRes.ok) {
            return NextResponse.redirect(new URL('/login?error=user_info_failed', req.url))
        }

        const googleUser = await userRes.json() as GoogleUserInfo

        // Find or create user
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { googleId: googleUser.sub },
                    { email: googleUser.email },
                ],
            },
        })

        if (user) {
            // Link Google ID if not already linked
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
            // Create new user
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

        // Block admin/superadmin from using OAuth — they must log in with email + password
        if (user.role === 'admin' || user.role === 'superadmin') {
            return NextResponse.redirect(new URL('/login?error=admin_oauth_disallowed', req.url))
        }

        // Create session tokens — fetch tokenVersion via raw query (not yet in generated types)
        const tvRows = await prisma.$queryRaw<{ tokenVersion: number }[]>`SELECT "tokenVersion" FROM "User" WHERE "id" = ${user.id}`
        const tokenVersion = tvRows[0]?.tokenVersion ?? 0
        const tokenPayload = {
            userId: user.id,
            role: user.role,
            email: user.email,
            tokenVersion,
        }
        const token = await createToken(tokenPayload)
        const refresh = await createRefreshToken(tokenPayload)
        await setUserCookie(token, refresh)

        return NextResponse.redirect(new URL('/dashboard', req.url))
    } catch {
        return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url))
    }
}
