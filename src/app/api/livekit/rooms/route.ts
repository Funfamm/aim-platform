import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/livekit/rooms — list all live events (admin only)
export async function GET(req: Request) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status') // optional filter
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

        const events = await prisma.liveEvent.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                title: true,
                roomName: true,
                status: true,
                eventType: true,
                hostUserId: true,
                projectId: true,
                castingCallId: true,
                recordingUrl: true,
                egressId: true,
                captionsActive: true,
                startedAt: true,
                endedAt: true,
                createdAt: true,
            },
        })

        return NextResponse.json({ events })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Internal server error'
        const status = msg === 'Unauthorized' ? 401 : msg.startsWith('Forbidden') ? 403 : 500
        return NextResponse.json({ error: msg }, { status })
    }
}
