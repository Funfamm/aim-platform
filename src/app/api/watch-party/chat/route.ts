/**
 * GET  /api/watch-party/chat?roomName=X&after=ISO_TS     — fetch messages
 * POST /api/watch-party/chat                              — send a message
 * --------------------------------------------------------------------------
 * Chat for Watch Party events. Messages are stored in WatchPartyMessage.
 * New messages are also published via Redis Pub/Sub so connected SSE
 * subscribers receive them immediately.
 *
 * GET returns the most recent 50 non-hidden messages, ordered oldest-first.
 * Optional `after` param returns only messages newer than that timestamp
 * (efficient incremental polling fallback if SSE is not used).
 *
 * Auth: requires authenticated session for POST; GET is also auth-gated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { publishPlaybackEvent } from '@/lib/watchParty/pubsub'

// ── GET — fetch messages ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const roomName = searchParams.get('roomName')
    const after    = searchParams.get('after')

    if (!roomName) {
        return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
    }

    try {
        const event = await prisma.liveEvent.findUnique({
            where:  { roomName },
            select: { id: true },
        })
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        const messages = await prisma.watchPartyMessage.findMany({
            where: {
                eventId: event.id,
                hidden:  false,
                ...(after ? { createdAt: { gt: new Date(after) } } : {}),
            },
            orderBy: { createdAt: 'asc' },
            take:    50,
            select: {
                id:         true,
                userId:     true,
                senderName: true,
                content:    true,
                createdAt:  true,
            },
        })

        return NextResponse.json({ messages })
    } catch (err) {
        console.error('[watch-party/chat] GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── POST — send a message ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json() as { roomName: string; content: string }
        const { roomName, content } = body

        if (!roomName || !content?.trim()) {
            return NextResponse.json({ error: 'roomName and content are required' }, { status: 400 })
        }
        if (content.length > 500) {
            return NextResponse.json({ error: 'Message too long (max 500 chars)' }, { status: 400 })
        }

        const event = await prisma.liveEvent.findUnique({
            where:  { roomName },
            select: { id: true, status: true },
        })
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }
        if (event.status === 'ended') {
            return NextResponse.json({ error: 'Event has ended' }, { status: 400 })
        }

        const message = await prisma.watchPartyMessage.create({
            data: {
                eventId:    event.id,
                userId:     session.userId,
                senderName: (session.name as string | undefined) ?? 'Anonymous',
                content:    content.trim(),
            },
            select: {
                id:         true,
                userId:     true,
                senderName: true,
                content:    true,
                createdAt:  true,
            },
        })

        // Publish to SSE subscribers via Pub/Sub
        await publishPlaybackEvent(roomName, {
            event:   'chat',
            payload: message,
        }).catch(() => {}) // Non-critical

        return NextResponse.json({ message }, { status: 201 })
    } catch (err) {
        console.error('[watch-party/chat] POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
