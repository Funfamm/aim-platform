import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET — list all sponsors
export async function GET() {
    try {
        try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

        const sponsors = await prisma.sponsor.findMany({
            orderBy: { sortOrder: 'asc' },
            take: 200,
        })
        return NextResponse.json(sponsors)
    } catch (err) {
        console.error('GET /api/admin/sponsors error:', err)
        return NextResponse.json({ error: 'Failed to load sponsors' }, { status: 500 })
    }
}

// POST — create a new sponsor
export async function POST(request: NextRequest) {
    try {
        try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

        const data = await request.json()

        // Validate required fields
        if (!data.name || !data.name.trim()) {
            return NextResponse.json({ error: 'Sponsor name is required' }, { status: 400 })
        }

        // Validate dates
        // Get today as YYYY-MM-DD string (timezone-safe)
        const todayStr = new Date().toISOString().split('T')[0]
        if (data.startDate) {
            const start = new Date(data.startDate)
            if (isNaN(start.getTime())) {
                return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
            }
            if (data.startDate < todayStr) {
                return NextResponse.json({ error: 'Start date cannot be in the past' }, { status: 400 })
            }
        }
        if (data.endDate) {
            const end = new Date(data.endDate)
            if (isNaN(end.getTime())) {
                return NextResponse.json({ error: 'Invalid end date' }, { status: 400 })
            }
            if (data.endDate < todayStr) {
                return NextResponse.json({ error: 'End date cannot be in the past' }, { status: 400 })
            }
        }
        if (data.startDate && data.endDate) {
            if (new Date(data.endDate) < new Date(data.startDate)) {
                return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
            }
        }

        const sponsor = await prisma.sponsor.create({
            data: {
                name: data.name.trim(),
                description: data.description?.trim() || null,
                descriptionI18n: data.descriptionI18n || null,
                logoUrl: data.logoUrl || null,
                bannerUrl: data.bannerUrl || null,
                website: data.website?.trim() || null,
                tier: data.tier || 'bronze',
                active: data.active ?? true,
                featured: data.featured ?? false,
                displayOn: data.displayOn || 'sponsors',
                contactEmail: data.contactEmail?.trim() || null,
                startDate: data.startDate ? new Date(data.startDate) : null,
                endDate: data.endDate ? new Date(data.endDate) : null,
                sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
                bannerDurationHours: typeof data.bannerDurationHours === 'number' ? data.bannerDurationHours : 24,
            },
        })
        return NextResponse.json(sponsor)
    } catch (err) {
        console.error('POST /api/admin/sponsors error:', err)
        return NextResponse.json({ error: 'Failed to create sponsor' }, { status: 500 })
    }
}
