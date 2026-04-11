import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/media-profile
 * Returns the authenticated user's saved casting media URLs.
 */
export async function GET() {
    try {
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { mediaProfile: true },
        })

        return NextResponse.json({ mediaProfile: user?.mediaProfile ?? null })
    } catch (error) {
        console.error('[MediaProfile] GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch media profile' }, { status: 500 })
    }
}

/**
 * PATCH /api/user/media-profile
 * Merges the provided URLs into the user's saved media profile.
 * Called after a successful application submission.
 *
 * Body: Partial<MediaProfile>
 */
export async function PATCH(req: NextRequest) {
    try {
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const incoming = await req.json()

        // Fetch current profile first so we can merge
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { mediaProfile: true },
        })

        const existing = (user?.mediaProfile as Record<string, string | null>) ?? {}
        const merged   = { ...existing, ...incoming }

        await prisma.user.update({
            where: { id: session.userId },
            data:  { mediaProfile: merged },
        })

        return NextResponse.json({ ok: true, mediaProfile: merged })
    } catch (error) {
        console.error('[MediaProfile] PATCH error:', error)
        return NextResponse.json({ error: 'Failed to update media profile' }, { status: 500 })
    }
}
