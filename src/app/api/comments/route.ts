import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { rateLimitComments } from '@/middleware/rateLimitComments'
/** Strip all HTML tags — lightweight replacement for isomorphic-dompurify
 *  (jsdom crashes Vercel serverless at import time, causing a 404) */
function stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, m => {
        const map: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
        return map[m] || m
    })
}
import { notifyUser } from '@/lib/notifications'

// Lightweight profanity check (bad-words@4 is broken on Node v24)
const PROFANITY_LIST = new Set([
    'fuck','shit','ass','bitch','dick','pussy','cunt','bastard',
    'damn','cock','whore','slut','nigger','nigga','faggot','retard',
])
function isProfane(text: string): boolean {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
    return words.some(w => PROFANITY_LIST.has(w))
}

// ── GET: Paginated comments (public, no auth required) ──────────────────────
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const episodeId = searchParams.get('episodeId') || undefined
    const cursor = searchParams.get('cursor') || undefined
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))

    if (!projectId) {
        return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Check if authenticated (for likedByMe)
    const session = await getUserSession().catch(() => null)
    const userId = session?.userId || null

    try {
        const comments = await prisma.comment.findMany({
            where: {
                projectId,
                ...(episodeId ? { episodeId } : { episodeId: null }),
                hidden: false,
                parentId: null, // top-level only
            },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            take: limit,
            orderBy: [
                { pinned: 'desc' },
                { createdAt: 'desc' },
            ],
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                replies: {
                    where: { hidden: false },
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: { select: { id: true, name: true, avatar: true } },
                        _count: { select: { likes: true } },
                        ...(userId ? {
                            likes: {
                                where: { userId },
                                select: { id: true },
                                take: 1,
                            },
                        } : {}),
                    },
                },
                _count: { select: { likes: true } },
                ...(userId ? {
                    likes: {
                        where: { userId },
                        select: { id: true },
                        take: 1,
                    },
                } : {}),
            },
        })

        // Transform to include likedByMe boolean
        const transformed = comments.map(c => ({
            ...c,
            likedByMe: !!(c as any).likes?.length,
            likesCount: (c as any)._count?.likes ?? 0,
            likes: undefined,
            _count: undefined,
            replies: ((c as any).replies || []).map((r: any) => ({
                ...r,
                likedByMe: !!r.likes?.length,
                likesCount: r._count?.likes ?? 0,
                likes: undefined,
                _count: undefined,
            })),
        }))

        return NextResponse.json({
            comments: transformed,
            nextCursor: comments.length === limit ? comments[comments.length - 1].id : null,
        })
    } catch (err) {
        console.error('[comments] GET error:', err)
        return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
    }
}

// ── POST: Create a comment (auth required) ──────────────────────────────────
export async function POST(req: Request) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    // Rate limit
    const blocked = await rateLimitComments(session.userId)
    if (blocked) return blocked

    try {
        const body = await req.json()
        const { projectId, episodeId, parentId, content: rawContent } = body

        if (!projectId || !rawContent) {
            return NextResponse.json({ error: 'projectId and content are required' }, { status: 400 })
        }

        // Sanitize — strip ALL HTML tags
        const clean = stripHtml(rawContent).trim()
        if (!clean || clean.length > 2000) {
            return NextResponse.json(
                { error: clean ? 'Comment too long (max 2000 characters)' : 'Comment cannot be empty' },
                { status: 400 }
            )
        }

        // Reply depth enforcement — max 1 level
        if (parentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: parentId },
                select: { parentId: true, userId: true, hidden: true },
            })
            if (!parent) {
                return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
            }
            if (parent.parentId !== null) {
                return NextResponse.json({ error: 'Replies to replies are not allowed' }, { status: 400 })
            }
            if (parent.hidden) {
                return NextResponse.json({ error: 'Cannot reply to a hidden comment' }, { status: 400 })
            }
        }

        // Profanity check
        let flagged = false
        try {
            flagged = isProfane(clean)
        } catch { /* non-critical — allow the comment through */ }

        // Create
        const comment = await prisma.comment.create({
            data: {
                projectId,
                episodeId: episodeId || null,
                userId: session.userId,
                parentId: parentId || null,
                content: clean,
                flagged,
            },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
            },
        })

        // Notify parent comment author on reply (if different user)
        if (parentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: parentId },
                select: { userId: true, project: { select: { slug: true } } },
            })
            if (parent && parent.userId !== session.userId) {
                const slug = parent.project.slug
                const link = episodeId
                    ? `/works/${slug}#comment-${comment.id}`
                    : `/works/${slug}#comment-${comment.id}`
                notifyUser({
                    userId: parent.userId,
                    type: 'system',
                    title: '💬 New reply to your comment',
                    message: `${comment.user.name} replied: "${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}"`,
                    link,
                }).catch(() => {}) // fire and forget
            }
        }

        return NextResponse.json({
            comment: {
                ...comment,
                likedByMe: false,
                likesCount: 0,
                replies: [],
            },
        }, { status: 201 })
    } catch (err) {
        console.error('[comments] POST error:', err)
        return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
    }
}
