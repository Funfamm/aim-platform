import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// Seed existing hardcoded page media into the database
export async function POST() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const existing = await prisma.pageMedia.count()
    if (existing > 0) {
        return NextResponse.json({ message: 'Media already seeded', count: existing })
    }

    const items = [
        // Donate page background
        { page: 'donate', type: 'background', url: '/images/donate-bg.png', title: 'Studio Scene', sortOrder: 0 },
        // Subscribe/notification page backgrounds (rotating)
        { page: 'subscribe', type: 'background', url: '/images/notify-bg-1.png', title: 'No One', sortOrder: 0 },
        { page: 'subscribe', type: 'background', url: '/images/notify-bg-2.png', title: 'Home', sortOrder: 1 },
        { page: 'subscribe', type: 'background', url: '/images/notify-bg-3.png', title: 'Run', sortOrder: 2 },
    ]

    for (const item of items) {
        await prisma.pageMedia.create({ data: { ...item, active: true } })
    }

    return NextResponse.json({ success: true, seeded: items.length })
}
