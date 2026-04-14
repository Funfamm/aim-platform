import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getRoomServiceClient } from '@/lib/livekit/server'

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

        // For live rooms — fetch real-time participant count from LiveKit in parallel.
        // Each call is raced against a 4 s timeout so a slow/unreachable LiveKit server
        // can never hang the entire admin page response.
        const liveRoomNames = events
            .filter(e => e.status === 'live')
            .map(e => e.roomName)

        const participantCounts: Record<string, number> = {}

        if (liveRoomNames.length > 0) {
            const roomSvc = getRoomServiceClient()

            // Helper: race a promise against a timeout, resolving to a fallback on expiry
            const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
                Promise.race([
                    promise,
                    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
                ])

            await Promise.allSettled(
                liveRoomNames.map(async (roomName) => {
                    try {
                        const participants = await withTimeout(
                            roomSvc.listParticipants(roomName),
                            4_000,   // 4 s per room — keeps total well under Vercel's limit
                            [],      // fallback: treat as 0 participants on timeout
                        )
                        participantCounts[roomName] = participants.length
                    } catch {
                        participantCounts[roomName] = 0
                    }
                })
            )
        }

        const eventsWithCounts = events.map(e => ({
            ...e,
            participantCount: participantCounts[e.roomName] ?? 0,
        }))

        return NextResponse.json({ events: eventsWithCounts })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Internal server error'
        const status = msg === 'Unauthorized' ? 401 : msg.startsWith('Forbidden') ? 403 : 500
        return NextResponse.json({ error: msg }, { status })
    }
}
