import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

/**
 * GET /api/admin/analytics/voices
 * Returns the list of available ElevenLabs voices for the configured key.
 */
export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const elKey = await prisma.apiKey.findFirst({
        where: { isActive: true, provider: 'elevenlabs' },
        orderBy: { lastUsed: 'asc' },
    })

    const apiKey = elKey?.key || process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
        return NextResponse.json({ voices: [], error: 'No ElevenLabs key configured' })
    }

    try {
        const client = new ElevenLabsClient({ apiKey })
        const res = await client.voices.getAll()
        const voices = (res.voices ?? []).map(v => ({
            voiceId: v.voiceId,
            name: v.name ?? v.voiceId,
            category: v.category ?? 'premade',
            description: v.description ?? '',
            labels: v.labels ?? {},
        }))
        // Sort: premade first, then cloned/generated
        voices.sort((a, b) => {
            if (a.category === 'premade' && b.category !== 'premade') return -1
            if (a.category !== 'premade' && b.category === 'premade') return 1
            return a.name.localeCompare(b.name)
        })
        return NextResponse.json({ voices })
    } catch (err) {
        console.error('[Voices] ElevenLabs error:', err)
        return NextResponse.json({ voices: [], error: 'Failed to fetch voices' })
    }
}
