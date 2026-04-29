import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import DOMPurify from 'isomorphic-dompurify'

const EDIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

// ── PATCH: Edit own comment (15-min window) ─────────────────────────────────
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const { id } = await params
    const comment = await prisma.comment.findUnique({
        where: { id },
        select: { userId: true, createdAt: true, hidden: true },
    })

    if (!comment) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }
    if (comment.userId !== session.userId) {
        return NextResponse.json({ error: 'Not your comment' }, { status: 403 })
    }
    if (comment.hidden) {
        return NextResponse.json({ error: 'Cannot edit a deleted comment' }, { status: 400 })
    }

    // Edit window enforcement
    const elapsed = Date.now() - new Date(comment.createdAt).getTime()
    if (elapsed > EDIT_WINDOW_MS) {
        return NextResponse.json({ error: 'Edit window expired (15 minutes)' }, { status: 403 })
    }

    try {
        const { content: rawContent } = await req.json()
        const clean = DOMPurify.sanitize(rawContent || '', { ALLOWED_TAGS: [] }).trim()
        if (!clean || clean.length > 2000) {
            return NextResponse.json(
                { error: clean ? 'Comment too long (max 2000 characters)' : 'Comment cannot be empty' },
                { status: 400 }
            )
        }

        const updated = await prisma.comment.update({
            where: { id },
            data: { content: clean, editedAt: new Date() },
            include: { user: { select: { id: true, name: true, avatar: true } } },
        })

        return NextResponse.json({ comment: updated })
    } catch (err) {
        console.error('[comments] PATCH error:', err)
        return NextResponse.json({ error: 'Failed to edit comment' }, { status: 500 })
    }
}

// ── DELETE: Soft delete (owner or admin) ─────────────────────────────────────
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const { id } = await params
    const comment = await prisma.comment.findUnique({
        where: { id },
        select: { userId: true, hidden: true },
    })

    if (!comment) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Check permissions — owner or admin
    const isAdmin = session.role === 'admin' || session.role === 'superadmin'
    const isOwner = comment.userId === session.userId

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    try {
        // Soft delete — preserve thread structure
        await prisma.comment.update({
            where: { id },
            data: {
                hidden: true,
                content: '[deleted]',
                ...(isAdmin && !isOwner ? {
                    hiddenBy: session.userId,
                    hiddenAt: new Date(),
                } : {}),
            },
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[comments] DELETE error:', err)
        return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
    }
}
