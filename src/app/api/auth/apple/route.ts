import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
    const settings = await prisma.siteSettings.findFirst()
    const clientId = (settings as Record<string, string> | null)?.appleClientId || ''

    if (!clientId) {
        return NextResponse.json({ error: 'Apple sign-in not configured' }, { status: 503 })
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/apple/callback`

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code id_token',
        scope: 'name email',
        response_mode: 'form_post',
    })

    return NextResponse.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`)
}
