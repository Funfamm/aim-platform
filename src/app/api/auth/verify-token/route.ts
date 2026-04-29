import { NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token'

/**
 * GET /api/auth/verify-token?token=XYZ
 * Verifies a signed token and returns the decoded email.
 * Used by the register page to pre-fill the email field securely.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
        return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const result = verifyUnsubscribeToken(token)
    if (!result) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    return NextResponse.json({ email: result.email })
}
