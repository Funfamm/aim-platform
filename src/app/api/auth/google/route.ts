import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
    // Get Google OAuth credentials from settings or env
    const settings = await prisma.siteSettings.findFirst()
    const clientId = process.env.GOOGLE_CLIENT_ID || (settings as Record<string, string> | null)?.googleClientId || ''

    if (!clientId) {
        return NextResponse.json({ error: 'Google sign-in not configured' }, { status: 503 })
    }

    const origin = new URL(req.url).origin
    const redirectUri = `${origin}/api/auth/google/callback`

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
    })

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
