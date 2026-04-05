import { NextResponse } from 'next/server'
import { getSessionAndRefresh } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { locales } from '@/i18n/routing'
import { logger } from '@/lib/logger'

/**
 * PATCH /api/user/language
 * Updates the authenticated user's preferredLanguage in the DB.
 * Called fire-and-forget from the Navbar language switcher.
 */
export async function PATCH(req: Request) {
    try {
        const session = await getSessionAndRefresh()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { locale } = body as { locale?: string }

        // Validate that the locale is one we actually support
        if (!locale || !(locales as readonly string[]).includes(locale)) {
            return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).user.update({
            where: { id: session.userId },
            data: { preferredLanguage: locale },
        })

        logger.info('user/language', `User ${session.userId} set preferredLanguage to "${locale}"`)

        return NextResponse.json({ ok: true, locale })
    } catch (err) {
        logger.error('user/language', 'Failed to update preferredLanguage', { error: err })
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
