'use client'

import { useState, useEffect, useCallback } from 'react'
import CommentInput from './CommentInput'
import CommentCard, { type CommentData } from './CommentCard'

interface CommentSectionProps {
    projectId: string
    projectSlug: string
    episodeId?: string | null
    currentUserId?: string | null
    currentUserRole?: string | null
}

export default function CommentSection({
    projectId, projectSlug, episodeId,
    currentUserId = null, currentUserRole = null,
}: CommentSectionProps) {
    const [comments, setComments] = useState<CommentData[]>([])
    const [loading, setLoading] = useState(true)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [loadingMore, setLoadingMore] = useState(false)

    const fetchComments = useCallback(async (cursor?: string) => {
        const params = new URLSearchParams({ projectId })
        if (episodeId) params.set('episodeId', episodeId)
        if (cursor) params.set('cursor', cursor)

        try {
            const res = await fetch(`/api/comments?${params}`)
            const data = await res.json()
            if (cursor) {
                setComments(prev => [...prev, ...data.comments])
            } else {
                setComments(data.comments || [])
            }
            setNextCursor(data.nextCursor)
        } catch { /* ignore */ }
    }, [projectId, episodeId])

    useEffect(() => {
        const t = setTimeout(() => fetchComments().finally(() => setLoading(false)), 0)
        return () => clearTimeout(t)
    }, [fetchComments])

    // Deep link scroll — handle #comment-{id} hash
    useEffect(() => {
        if (loading || !comments.length) return
        const hash = window.location.hash
        if (!hash.startsWith('#comment-')) return
        const el = document.getElementById(hash.slice(1))
        if (el) {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.style.transition = 'box-shadow 0.3s'
                el.style.boxShadow = '0 0 0 2px rgba(212,168,83,0.5)'
                setTimeout(() => { el.style.boxShadow = 'none' }, 3000)
            }, 300)
        }
    }, [loading, comments])

    const handleLoadMore = async () => {
        if (!nextCursor || loadingMore) return
        setLoadingMore(true)
        await fetchComments(nextCursor)
        setLoadingMore(false)
    }

    const handleNewComment = (comment: CommentData) => {
        setComments(prev => [comment, ...prev])
    }

    const handleUpdate = (updated: CommentData) => {
        setComments(prev => prev.map(c => c.id === updated.id ? updated : c))
    }

    const handleDelete = (id: string) => {
        setComments(prev => prev.map(c =>
            c.id === id ? { ...c, hidden: true, content: '[deleted]' } : c
        ))
    }

    return (
        <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: 'var(--space-2xl) var(--space-lg)',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: 'var(--space-lg)',
                paddingBottom: 'var(--space-md)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <h2 style={{
                    fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)',
                    margin: 0,
                }}>
                    💬 Comments
                </h2>
                {!loading && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        {comments.filter(c => !c.hidden).length}
                    </span>
                )}
            </div>

            {/* Input or Sign-in CTA */}
            {currentUserId ? (
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <CommentInput
                        projectId={projectId}
                        episodeId={episodeId}
                        onSubmit={handleNewComment}
                    />
                </div>
            ) : (
                <div style={{
                    padding: '16px 20px',
                    marginBottom: 'var(--space-xl)',
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.08), rgba(212,168,83,0.03))',
                    border: '1px solid rgba(212,168,83,0.15)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                }}>
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        Sign in to join the conversation
                    </span>
                    <a
                        href={`/login?redirect=/works/${projectSlug}`}
                        style={{
                            padding: '8px 20px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            background: 'var(--accent-gold)',
                            color: '#000',
                            textDecoration: 'none',
                            transition: 'opacity 0.2s',
                        }}
                    >
                        Sign In
                    </a>
                </div>
            )}

            {/* Comment list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 8px', width: 24, height: 24 }} />
                    Loading comments...
                </div>
            ) : comments.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: 'var(--space-2xl)',
                    color: 'var(--text-tertiary)', fontSize: '0.88rem',
                }}>
                    Be the first to comment ✨
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {comments.map(comment => (
                        <CommentCard
                            key={comment.id}
                            comment={comment}
                            currentUserId={currentUserId}
                            currentUserRole={currentUserRole}
                            projectSlug={projectSlug}
                            episodeId={episodeId}
                            projectId={projectId}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                        />
                    ))}

                    {nextCursor && (
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            style={{
                                alignSelf: 'center',
                                marginTop: 'var(--space-md)',
                                padding: '8px 24px',
                                fontSize: '0.82rem',
                                fontWeight: 500,
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.04)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {loadingMore ? 'Loading...' : 'Load more comments'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
