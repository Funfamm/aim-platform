import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/announcements/languages
 * Returns the unique non-English languages spoken by the selected audience.
 *
 * Query params:
 *   groups   — comma-separated: members,subscribers,cast
 *   userIds  — comma-separated user IDs
 *
 * Response: { languages: string[], counts: Record<string, number>, total: number }
 */
export async function GET(req: NextRequest) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const groupsParam = url.searchParams.get('groups') || ''
    const userIdsParam = url.searchParams.get('userIds') || ''

    const groups = groupsParam.split(',').filter(Boolean)
    const userIds = userIdsParam.split(',').filter(Boolean)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    // Collect all user IDs from each audience group
    const allUserIds = new Set<string>()

    // Members — all registered users with announcement notification enabled
    if (groups.includes('members')) {
        const members = await db.user.findMany({
            select: { id: true },
        })
        members.forEach((u: { id: string }) => allUserIds.add(u.id))
    }

    // Cast — users who have applied to casting calls
    if (groups.includes('cast')) {
        const castApplicants = await db.application.findMany({
            where: { userId: { not: null } },
            select: { userId: true },
            distinct: ['userId'],
        })
        castApplicants.forEach((a: { userId: string }) => allUserIds.add(a.userId))
    }

    // Specific user IDs
    userIds.forEach(id => allUserIds.add(id))

    if (allUserIds.size === 0) {
        // Subscribers only — no language data available (they aren't logged-in users)
        const hasSubscribers = groups.includes('subscribers')
        return NextResponse.json({
            languages: [],
            counts: {},
            total: 0,
            subscribersOnly: hasSubscribers,
        })
    }

    // Fetch preferred languages for all collected user IDs
    const users = await db.user.findMany({
        where: { id: { in: Array.from(allUserIds) } },
        select: { preferredLanguage: true },
    })

    // Count non-English languages
    const counts: Record<string, number> = {}
    let total = 0
    for (const u of users as { preferredLanguage: string }[]) {
        total++
        const lang = u.preferredLanguage || 'en'
        if (lang !== 'en') {
            counts[lang] = (counts[lang] || 0) + 1
        }
    }

    const languages = Object.keys(counts).sort()

    return NextResponse.json({ languages, counts, total })
}
