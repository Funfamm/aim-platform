import { NextResponse } from 'next/server'
import { clearUserCookie, getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * POST /api/auth/logout
 * Clears session cookies AND increments tokenVersion in the DB so the
 * refresh token is invalidated server-side. Without incrementing tokenVersion,
 * getSession() would silently re-authenticate from the refresh token on the
 * next request — even after the cookies are cleared on mobile/browser.
 */
export async function POST() {
    try {
        // Get session BEFORE clearing cookie so we know who is logging out
        const session = await getSession()

        // Increment tokenVersion to invalidate any existing refresh tokens
        if (session?.userId) {
            await prisma.user.update({
                where: { id: session.userId },
                data: { tokenVersion: { increment: 1 } },
            })
        }
    } catch {
        // Don't block logout even if DB update fails
    }

    await clearUserCookie()
    return NextResponse.json({ success: true })
}
