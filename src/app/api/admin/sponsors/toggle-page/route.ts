import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { invalidateSettings } from '@/lib/cached-settings'

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } })
    return NextResponse.json({ enabled: settings?.sponsorsPageEnabled ?? true })
}

export async function PUT(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { enabled } = await req.json()
        const existing = await prisma.siteSettings.findUnique({ where: { id: 'default' } })
        if (existing) {
            await prisma.siteSettings.update({
                where: { id: 'default' },
                data: { sponsorsPageEnabled: !!enabled },
            })
        } else {
            await prisma.siteSettings.create({
                data: { id: 'default' },
            })
            await prisma.siteSettings.update({
                where: { id: 'default' },
                data: { sponsorsPageEnabled: !!enabled },
            })
        }
        invalidateSettings()
        return NextResponse.json({ enabled: !!enabled })
    } catch (err) {
        console.error('Toggle sponsors page error:', err)
        return NextResponse.json({ error: 'Failed to toggle' }, { status: 500 })
    }
}
