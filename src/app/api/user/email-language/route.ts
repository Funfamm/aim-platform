import { NextResponse } from 'next/server'
import { getSessionAndRefresh } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { verifyCsrfToken } from '@/lib/csrf'

/**
 * GET /api/user/email-language
 * Returns the current receiveLocalizedEmails preference for the logged-in user.
 */
export async function GET() {
    const session = await getSessionAndRefresh()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = await (prisma as any).user.findUnique({
            where: { id: session.userId },
            select: { receiveLocalizedEmails: true, preferredLanguage: true },
        })
        return NextResponse.json({
            receiveLocalizedEmails: user?.receiveLocalizedEmails ?? true,
            preferredLanguage: user?.preferredLanguage ?? 'en',
        })
    } catch (err) {
        console.error('[email-language] GET error:', err)
        return NextResponse.json({ receiveLocalizedEmails: true, preferredLanguage: 'en' })
    }
}

/**
 * PUT /api/user/email-language
 * Body: { receiveLocalizedEmails: boolean }
 * Updates whether the user receives emails in their preferred language.
 */
export async function PUT(req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csrfResp = verifyCsrfToken(req as any)
    if (csrfResp) return csrfResp

    const session = await getSessionAndRefresh()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const value = body?.receiveLocalizedEmails

        if (typeof value !== 'boolean') {
            return NextResponse.json({ error: 'receiveLocalizedEmails must be a boolean' }, { status: 400 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).user.update({
            where: { id: session.userId },
            data: { receiveLocalizedEmails: value },
        })

        return NextResponse.json({ success: true, receiveLocalizedEmails: value })
    } catch (err) {
        console.error('[email-language] PUT error:', err)
        return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 })
    }
}
