import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET(req: Request) {
    // Get Google OAuth credentials from env or DB settings
    const settings = await prisma.siteSettings.findFirst()
    const clientId = process.env.GOOGLE_CLIENT_ID || (settings as Record<string, string> | null)?.googleClientId || ''

    if (!clientId) {
        return NextResponse.json({ error: 'Google sign-in not configured' }, { status: 503 })
    }

    // Generate a secure random CSRF state token
    const state = crypto.randomBytes(16).toString('hex')
    const cookieStore = await cookies()
    cookieStore.set('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 5 * 60, // 5 minutes — long enough to complete OAuth flow
        path: '/',
    })

    // Save the return-to URL so we can redirect there after OAuth completes.
    // Only allow same-origin paths (must start with /) to prevent open redirects.
    const rawReturnTo = new URL(req.url).searchParams.get('returnTo') || ''
    const returnTo = rawReturnTo.startsWith('/') ? rawReturnTo : '/dashboard'
    cookieStore.set('oauth_return_to', returnTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 5 * 60,
        path: '/',
    })

    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(req.url).origin
    const redirectUri = `${origin}/api/auth/google/callback`

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
        state, // CSRF protection
    })

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
