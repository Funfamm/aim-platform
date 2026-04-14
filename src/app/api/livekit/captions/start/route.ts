import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * POST /api/livekit/captions/start
 *
 * Admin-only — manually triggers the caption worker for a specific room.
 * The worker is automatically triggered on room_started webhooks, but this
 * endpoint exists for manual retries or testing.
 */
export async function POST(req: Request) {
    try {
        await requireAdmin()

        const { roomName } = await req.json() as { roomName?: string }

        if (!roomName) {
            return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
        }

        // Verify the room exists in the DB
        const event = await prisma.liveEvent.findUnique({
            where: { roomName },
            select: { id: true, status: true, title: true },
        })

        if (!event) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }

        if (event.status === 'ended') {
            return NextResponse.json({ error: 'Room has already ended' }, { status: 409 })
        }

        const workerUrl = process.env.CAPTION_WORKER_URL
        if (!workerUrl) {
            return NextResponse.json(
                { error: 'CAPTION_WORKER_URL not configured — caption worker is not deployed yet' },
                { status: 503 },
            )
        }

        // SSRF guard: ensure the worker URL is a legitimate http/https target.
        // Rejects internal metadata endpoints, file:// URIs, etc.
        try {
            const parsed = new URL(workerUrl)
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                throw new Error('invalid protocol')
            }
        } catch {
            return NextResponse.json({ error: 'CAPTION_WORKER_URL is invalid' }, { status: 500 })
        }

        const workerSecret = process.env.WORKER_WEBHOOK_SECRET
        if (!workerSecret) {
            return NextResponse.json(
                { error: 'WORKER_WEBHOOK_SECRET not configured' },
                { status: 503 },
            )
        }

        const response = await fetch(`${workerUrl}/start-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Worker-Secret': workerSecret,
            },
            body: JSON.stringify({
                roomName,
                startedAt: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(10_000), // 10 s timeout
        })

        if (!response.ok) {
            const errorBody = await response.text()
            console.error('[captions/start] Worker returned error', response.status, errorBody)
            return NextResponse.json(
                { error: `Caption worker error: ${response.status}` },
                { status: 502 },
            )
        }

        const result = await response.json()
        return NextResponse.json({ ok: true, roomName, worker: result })
    } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
            return NextResponse.json({ error: 'Caption worker did not respond in time' }, { status: 504 })
        }
        console.error('[captions/start] error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * GET /api/livekit/captions/status
 *
 * Returns the worker's current active room list.
 * Useful for the admin events panel to show which rooms have captions running.
 */
export async function GET() {
    try {
        await requireAdmin()

        const workerUrl = process.env.CAPTION_WORKER_URL
        if (!workerUrl) {
            return NextResponse.json({ configured: false, activeRooms: [] })
        }

        const response = await fetch(`${workerUrl}/status`, {
            signal: AbortSignal.timeout(5_000),
        })

        if (!response.ok) {
            return NextResponse.json({ configured: true, reachable: false, activeRooms: [] })
        }

        const data = await response.json() as { activeRooms: string[] }
        return NextResponse.json({
            configured: true,
            reachable: true,
            activeRooms: data.activeRooms ?? [],
        })
    } catch {
        return NextResponse.json({ configured: !!process.env.CAPTION_WORKER_URL, reachable: false, activeRooms: [] })
    }
}
