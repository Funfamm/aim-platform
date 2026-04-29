import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

function isAdmin(role: string) {
    return role === 'admin' || role === 'superadmin'
}

// ── GET: Admin comment list with filters ────────────────────────────────────
export async function GET(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const status = searchParams.get('status') || 'all' // all|hidden|pinned|flagged
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    if (status === 'hidden') where.hidden = true
    if (status === 'pinned') where.pinned = true
    if (status === 'flagged') where.flagged = true

    try {
        const [comments, total] = await Promise.all([
            prisma.comment.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, avatar: true, email: true } },
                    project: { select: { id: true, title: true, slug: true } },
                    _count: { select: { replies: true, likes: true } },
                },
            }),
            prisma.comment.count({ where }),
        ])

        return NextResponse.json({
            comments,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        })
    } catch (err) {
        console.error('[admin/comments] GET error:', err)
        return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
    }
}

// ── PATCH: Moderate a comment (hide/unhide/pin/unpin) ───────────────────────
export async function PATCH(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id, action } = await req.json()
        if (!id || !action) {
            return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
        }

        const validActions = ['hide', 'unhide', 'pin', 'unpin']
        if (!validActions.includes(action)) {
            return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 })
        }

        const data: Record<string, unknown> = {}
        switch (action) {
            case 'hide':
                data.hidden = true
                data.hiddenAt = new Date()
                data.hiddenBy = session.userId
                break
            case 'unhide':
                data.hidden = false
                data.hiddenAt = null
                data.hiddenBy = null
                break
            case 'pin':
                data.pinned = true
                break
            case 'unpin':
                data.pinned = false
                break
        }

        const updated = await prisma.comment.update({
            where: { id },
            data,
            include: {
                user: { select: { id: true, name: true } },
            },
        })

        return NextResponse.json({ comment: updated })
    } catch (err) {
        console.error('[admin/comments] PATCH error:', err)
        return NextResponse.json({ error: 'Failed to moderate comment' }, { status: 500 })
    }
}

// ── DELETE: Bulk hard delete (admin only) ────────────────────────────────────
// Guarded: refuses to delete if any comment has visible replies
export async function DELETE(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { ids } = await req.json()
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
        }

        // Guard: check for visible replies
        const withVisibleReplies = await prisma.comment.findMany({
            where: {
                id: { in: ids },
                replies: { some: { hidden: false } },
            },
            select: { id: true },
        })

        if (withVisibleReplies.length > 0) {
            return NextResponse.json({
                error: `Cannot hard-delete ${withVisibleReplies.length} comment(s) that have visible replies. Hide or delete the replies first.`,
                blockedIds: withVisibleReplies.map(c => c.id),
            }, { status: 400 })
        }

        // Safe to hard delete — also delete orphaned likes
        const deleted = await prisma.comment.deleteMany({
            where: { id: { in: ids } },
        })

        return NextResponse.json({ deleted: deleted.count })
    } catch (err) {
        console.error('[admin/comments] DELETE error:', err)
        return NextResponse.json({ error: 'Failed to delete comments' }, { status: 500 })
    }
}
