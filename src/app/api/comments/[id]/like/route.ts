import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { rateLimitLikes } from '@/middleware/rateLimitComments'

// ── POST: Toggle like on a comment ──────────────────────────────────────────
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    // Rate limit
    const blocked = await rateLimitLikes(session.userId)
    if (blocked) return blocked

    const { id: commentId } = await params

    // Verify comment exists and is visible
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true, hidden: true },
    })
    if (!comment || comment.hidden) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    try {
        // Check if already liked
        const existing = await prisma.commentLike.findUnique({
            where: { commentId_userId: { commentId, userId: session.userId } },
        })

        if (existing) {
            // Unlike
            await prisma.commentLike.delete({
                where: { id: existing.id },
            })
            const count = await prisma.commentLike.count({ where: { commentId } })
            return NextResponse.json({ liked: false, likesCount: count })
        } else {
            // Like
            await prisma.commentLike.create({
                data: { commentId, userId: session.userId },
            })
            const count = await prisma.commentLike.count({ where: { commentId } })
            return NextResponse.json({ liked: true, likesCount: count })
        }
    } catch (err) {
        console.error('[comments/like] error:', err)
        return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 })
    }
}
