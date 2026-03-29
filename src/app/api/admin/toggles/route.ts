import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET — read current toggle values
export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const settings = await prisma.siteSettings.upsert({
        where: { id: 'default' },
        create: { id: 'default' },
        update: {},
    })

    return NextResponse.json({
        castingCallsEnabled: settings.castingCallsEnabled,
        scriptCallsEnabled: settings.scriptCallsEnabled,
        searchBetaEnabled: settings.searchBetaEnabled,
    })
}

// PUT — toggle a specific field
export async function PUT(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const updateData: Record<string, boolean> = {}

        if (typeof body.castingCallsEnabled === 'boolean') {
            updateData.castingCallsEnabled = body.castingCallsEnabled
        }
        if (typeof body.scriptCallsEnabled === 'boolean') {
            updateData.scriptCallsEnabled = body.scriptCallsEnabled
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
        }

        const settings = await prisma.siteSettings.upsert({
            where: { id: 'default' },
            create: { id: 'default', ...updateData },
            update: updateData,
        })

        return NextResponse.json({
            castingCallsEnabled: settings.castingCallsEnabled,
            scriptCallsEnabled: settings.scriptCallsEnabled,
            searchBetaEnabled: settings.searchBetaEnabled,
        })
    } catch (err) {
        console.error('Toggle error:', err)
        return NextResponse.json({ error: 'Failed to toggle' }, { status: 500 })
    }
}
