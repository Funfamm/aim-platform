import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// ── Readable labels for known non-CTA signupTags ─────────────────────────────
const TAG_LABELS: Record<string, string> = {
    footer_cta: 'Footer Newsletter',
    subscribe_general: 'Subscribe Page',
    casting_general: 'Casting Updates',
    training_general: 'Training Updates',
}

function getReadableLabel(tag: string): string {
    if (TAG_LABELS[tag]) return TAG_LABELS[tag]
    if (tag.startsWith('scripts_')) return 'Script Call'
    return tag // fallback: raw tag, safe to display
}

// ── GET /api/admin/notify-sources ────────────────────────────────────────────
// Returns grouped summary of all signupTags NOT associated with a CtaConfiguration.
// Read-only. Admin-only.
export async function GET() {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get all configured CTA signupTags
    const ctaConfigs = await prisma.ctaConfiguration.findMany({
        select: { signupTag: true },
    })
    const ctaTags = new Set(ctaConfigs.map(c => c.signupTag))

    // Get all signupTag groups from NotificationSignup
    const allTagGroups = await prisma.notificationSignup.groupBy({
        by: ['signupTag'],
        _count: true,
        orderBy: { _count: { signupTag: 'desc' } },
    })

    // Filter to only non-CTA tags
    const nonCtaTags = allTagGroups.filter(g => !ctaTags.has(g.signupTag))

    if (nonCtaTags.length === 0) {
        return NextResponse.json({ sources: [] })
    }

    // Get last-7-days counts for non-CTA tags
    const tagNames = nonCtaTags.map(t => t.signupTag)
    const recentGroups = await prisma.notificationSignup.groupBy({
        by: ['signupTag'],
        where: {
            signupTag: { in: tagNames },
            createdAt: { gte: sevenDaysAgo },
        },
        _count: true,
    })
    const recentMap = new Map(recentGroups.map(g => [g.signupTag, g._count]))

    // Get requestedBy breakdown for each non-CTA tag
    const requestedByGroups = await prisma.notificationSignup.groupBy({
        by: ['signupTag', 'requestedBy'],
        where: { signupTag: { in: tagNames } },
        _count: true,
    })
    const requestedByMap = new Map<string, Record<string, number>>()
    for (const g of requestedByGroups) {
        const key = g.signupTag
        if (!requestedByMap.has(key)) requestedByMap.set(key, {})
        const rb = g.requestedBy || 'unknown'
        requestedByMap.get(key)![rb] = g._count
    }

    // Get status breakdown for each non-CTA tag
    const statusGroups = await prisma.notificationSignup.groupBy({
        by: ['signupTag', 'status'],
        where: { signupTag: { in: tagNames } },
        _count: true,
    })
    const statusMap = new Map<string, Record<string, number>>()
    for (const g of statusGroups) {
        const key = g.signupTag
        if (!statusMap.has(key)) statusMap.set(key, {})
        statusMap.get(key)![g.status] = g._count
    }

    const sources = nonCtaTags.map(t => ({
        signupTag: t.signupTag,
        label: getReadableLabel(t.signupTag),
        total: t._count,
        last7Days: recentMap.get(t.signupTag) || 0,
        requestedBy: requestedByMap.get(t.signupTag) || {},
        status: statusMap.get(t.signupTag) || {},
    }))

    return NextResponse.json({ sources })
}
