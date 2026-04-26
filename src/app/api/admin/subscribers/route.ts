import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const page    = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit   = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const search  = searchParams.get('search')?.trim() || ''
    const status  = searchParams.get('status') || 'all'   // 'all' | 'active' | 'inactive'
    const sort    = searchParams.get('sort')   || 'newest' // 'newest' | 'oldest' | 'name'
    const format  = searchParams.get('format') || 'json'  // 'json' | 'csv'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const where: Record<string, unknown> = {}
    if (search) {
        where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { name:  { contains: search, mode: 'insensitive' } },
        ]
    }
    if (status === 'active')   where.active = true
    if (status === 'inactive') where.active = false

    const orderBy = sort === 'oldest' ? { subscribedAt: 'asc' }
                  : sort === 'name'   ? { email: 'asc' }
                  : { subscribedAt: 'desc' }

    // Count failed sends per subscriber email (from EmailLog)
    const failedEmailCounts = await db.emailLog.groupBy({
        by: ['to'],
        where: { success: false },
        _count: { id: true },
    }) as { to: string; _count: { id: number } }[]
    const failedMap = new Map(failedEmailCounts.map((f: { to: string; _count: { id: number } }) => [f.to, f._count.id]))

    // Collect emails with failures for the 'failed' filter
    const failedEmails = failedEmailCounts.map((f: { to: string }) => f.to)

    // Apply 'failed' status filter — subscribers whose email appears in failed EmailLog entries
    if (status === 'failed' && failedEmails.length > 0) {
        where.email = { in: failedEmails }
    } else if (status === 'failed') {
        // No failed emails at all — return empty
        where.email = { in: [] }
    }

    const [total, active, inactive] = await Promise.all([
        db.subscriber.count(),
        db.subscriber.count({ where: { active: true } }),
        db.subscriber.count({ where: { active: false } }),
    ])
    const failedCount = await db.subscriber.count({
        where: { email: { in: failedEmails.length > 0 ? failedEmails : ['__none__'] } },
    })

    // CSV export — return all matching rows, no pagination
    if (format === 'csv') {
        const all = await db.subscriber.findMany({
            where,
            orderBy,
            select: { email: true, name: true, active: true, subscribedAt: true },
        })
        const header = 'Email,Name,Status,Failed Sends,Subscribed At'
        const rows = all.map((s: { email: string; name: string | null; active: boolean; subscribedAt: Date }) =>
            `"${s.email}","${s.name || ''}","${s.active ? 'active' : 'inactive'}","${failedMap.get(s.email) || 0}","${new Date(s.subscribedAt).toISOString()}"`
        )
        const csv = [header, ...rows].join('\n')
        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="subscribers-${new Date().toISOString().slice(0,10)}.csv"`,
            },
        })
    }

    const subscribers = await db.subscriber.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, email: true, name: true, active: true, subscribedAt: true },
    })

    // Look up matching Users by email for conversion tracking
    const subEmails = subscribers.map((s: { email: string }) => s.email)
    const matchedUsers = subEmails.length > 0
        ? await db.user.findMany({
            where: { email: { in: subEmails, mode: 'insensitive' } },
            select: { id: true, email: true, preferredLanguage: true, emailVerified: true, createdAt: true },
        }) as { id: string; email: string; preferredLanguage: string | null; emailVerified: boolean; createdAt: Date }[]
        : []
    const userMap = new Map(matchedUsers.map((u: { id: string; email: string; preferredLanguage: string | null; emailVerified: boolean; createdAt: Date }) =>
        [u.email.toLowerCase(), u]
    ))

    // Enrich each subscriber with conversion data
    const enriched = subscribers.map((s: { id: string; email: string; name: string | null; active: boolean; subscribedAt: Date }) => {
        const matchedUser = userMap.get(s.email.toLowerCase()) || null
        return {
            ...s,
            failedSends: failedMap.get(s.email) || 0,
            // Conversion fields
            converted: !!matchedUser,
            userId: matchedUser?.id || null,
            convertedAt: matchedUser?.createdAt || null,
            emailVerified: matchedUser?.emailVerified ?? null,
            language: matchedUser?.preferredLanguage || (matchedUser ? 'en' : null),
        }
    })

    // ── Conversion reporting stats ────────────────────────────────────────
    const totalUsers = await db.user.count()
    const allSubEmails = await db.subscriber.findMany({ select: { email: true } }) as { email: string }[]
    const allUserEmails = await db.user.findMany({ select: { email: true } }) as { email: string }[]
    const subEmailSet = new Set(allSubEmails.map((s: { email: string }) => s.email.toLowerCase()))
    const userEmailSet = new Set(allUserEmails.map((u: { email: string }) => u.email.toLowerCase()))
    const overlap = [...subEmailSet].filter(e => userEmailSet.has(e)).length
    const subscriberOnly = subEmailSet.size - overlap
    const userOnly = userEmailSet.size - overlap
    // New conversions this month: users created this month whose email is also a subscriber
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const recentUsers = await db.user.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { email: true },
    }) as { email: string }[]
    const newConversions = recentUsers.filter((u: { email: string }) => subEmailSet.has(u.email.toLowerCase())).length
    const conversionRate = subEmailSet.size > 0 ? Math.round((overlap / subEmailSet.size) * 100) : 0

    return NextResponse.json({
        subscribers: enriched,
        stats: { total, active, inactive, failed: failedCount },
        conversion: {
            totalSubscribers: total,
            totalUsers,
            converted: overlap,
            conversionRate,
            subscriberOnly,
            userOnly,
            overlap,
            newConversionsThisMonth: newConversions,
        },
        pagination: {
            page, limit, total: (await db.subscriber.count({ where })),
            totalPages: Math.ceil((await db.subscriber.count({ where })) / limit),
        },
    })
}

export async function PATCH(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { ids, active }: { ids: string[]; active: boolean } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).subscriber.updateMany({ where: { id: { in: ids } }, data: { active } })
    return NextResponse.json({ updated: result.count })
}

export async function DELETE(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { ids }: { ids: string[] } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).subscriber.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: result.count })
}
