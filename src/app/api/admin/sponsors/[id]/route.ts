import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PUT — update a sponsor
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

        const { id } = await params
        const data = await request.json()

        // Date validation for updates
        if (data.endDate !== undefined && data.endDate) {
            const todayStr = new Date().toISOString().split('T')[0]
            if (data.endDate < todayStr) {
                return NextResponse.json({ error: 'End date cannot be in the past' }, { status: 400 })
            }
        }

        const update: Record<string, unknown> = {}
        if (data.name !== undefined) update.name = data.name
        if (data.description !== undefined) update.description = data.description || null
        if (data.descriptionI18n !== undefined) update.descriptionI18n = data.descriptionI18n || null
        if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl || null
        if (data.bannerUrl !== undefined) update.bannerUrl = data.bannerUrl || null
        if (data.website !== undefined) update.website = data.website || null
        if (data.tier !== undefined) update.tier = data.tier
        if (data.active !== undefined) update.active = data.active
        if (data.featured !== undefined) update.featured = data.featured
        if (data.displayOn !== undefined) update.displayOn = data.displayOn
        if (data.contactEmail !== undefined) update.contactEmail = data.contactEmail || null
        if (data.startDate !== undefined) update.startDate = data.startDate ? new Date(data.startDate) : null
        if (data.endDate !== undefined) update.endDate = data.endDate ? new Date(data.endDate) : null
        if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder

        const sponsor = await prisma.sponsor.update({ where: { id }, data: update })
        return NextResponse.json(sponsor)
    } catch (err) {
        console.error('PUT /api/admin/sponsors error:', err)
        return NextResponse.json({ error: 'Failed to update sponsor' }, { status: 500 })
    }
}

// DELETE — remove a sponsor
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

        const { id } = await params
        await prisma.sponsor.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('DELETE /api/admin/sponsors error:', err)
        return NextResponse.json({ error: 'Failed to delete sponsor' }, { status: 500 })
    }
}
