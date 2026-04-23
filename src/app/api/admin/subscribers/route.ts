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

    const [total, active, inactive] = await Promise.all([
        db.subscriber.count(),
        db.subscriber.count({ where: { active: true } }),
        db.subscriber.count({ where: { active: false } }),
    ])

    // CSV export — return all matching rows, no pagination
    if (format === 'csv') {
        const all = await db.subscriber.findMany({
            where,
            orderBy,
            select: { email: true, name: true, active: true, subscribedAt: true },
        })
        const header = 'Email,Name,Status,Subscribed At'
        const rows = all.map((s: { email: string; name: string | null; active: boolean; subscribedAt: Date }) =>
            `"${s.email}","${s.name || ''}","${s.active ? 'active' : 'inactive'}","${new Date(s.subscribedAt).toISOString()}"`
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

    return NextResponse.json({
        subscribers,
        stats: { total, active, inactive },
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
