import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAdminAction } from '@/lib/audit-log'

// GET — list all API keys (mask the actual key value)
export async function GET() {
    try {
        try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                label: true,
                provider: true,
                key: true,
                isActive: true,
                assignedAgent: true,
                usageCount: true,
                lastUsed: true,
                lastError: true,
                cooledDownUntil: true,
                createdAt: true,
            },
        })

        // Mask keys for security — show only last 8 chars
        const masked = keys.map(k => ({
            ...k,
            key: `...${k.key.slice(-8)}`,
        }))

        return NextResponse.json(masked)
    } catch (err) {
        console.error('[API-KEYS GET] Error:', err)
        return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
    }
}

// POST — add a new API key
export async function POST(req: Request) {
    try {
        let session
        try { session = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

        const { label, key, provider, assignedAgent } = await req.json()
        if (!key) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

        const apiKey = await prisma.apiKey.create({
            data: {
                label: label || 'API Key',
                key,
                provider: provider || 'gemini',
                assignedAgent: assignedAgent || 'all',
            },
        })

        logAdminAction({
            actor: session.userId,
            action: 'ROTATE_API_KEY',
            target: apiKey.id,
            details: { operation: 'create', label: apiKey.label, provider: apiKey.provider },
        })

        return NextResponse.json({
            ...apiKey,
            key: `...${apiKey.key.slice(-8)}`,
        })
    } catch (err) {
        console.error('[API-KEYS POST] Error:', err)
        return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
    }
}

// PUT — toggle active status or update label
export async function PUT(req: Request) {
    try {
        let session
        try { session = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

        const { id, isActive, label, assignedAgent, clearError } = await req.json()
        if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

        const data: Record<string, unknown> = {}
        if (typeof isActive === 'boolean') data.isActive = isActive
        if (label) data.label = label
        if (assignedAgent) data.assignedAgent = assignedAgent
        if (clearError) data.lastError = null

        const updated = await prisma.apiKey.update({
            where: { id },
            data,
        })

        logAdminAction({
            actor: session.userId,
            action: 'ROTATE_API_KEY',
            target: id,
            details: { operation: 'update', changes: data },
        })

        return NextResponse.json({
            ...updated,
            key: `...${updated.key.slice(-8)}`,
        })
    } catch (err) {
        console.error('[API-KEYS PUT] Error:', err)
        return NextResponse.json({ error: 'Failed to update key' }, { status: 500 })
    }
}

// DELETE — remove an API key
export async function DELETE(req: Request) {
    try {
        let session
        try { session = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

        await prisma.apiKey.delete({ where: { id } })

        logAdminAction({
            actor: session.userId,
            action: 'ROTATE_API_KEY',
            target: id,
            details: { operation: 'delete' },
        })

        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('[API-KEYS DELETE] Error:', err)
        return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 })
    }
}

