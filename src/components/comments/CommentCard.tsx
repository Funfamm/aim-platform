'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import CommentInput from './CommentInput'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function timeAgo(dateStr: string, t: (key: string) => string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return t('justNow')
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return t('mAgo').replace('{n}', String(mins))
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('hAgo').replace('{n}', String(hours))
    const days = Math.floor(hours / 24)
    if (days < 30) return t('dAgo').replace('{n}', String(days))
    return new Date(dateStr).toLocaleDateString()
}

interface CommentUser {
    id: string
    name: string
    avatar: string | null
    accentColor?: string | null
}

export interface CommentData {
    id: string
    content: string
    hidden: boolean
    pinned: boolean
    flagged: boolean
    editedAt: string | null
    createdAt: string
    user: CommentUser
    likedByMe: boolean
    likesCount: number
    parentId: string | null
    replies: CommentData[]
}

interface CommentCardProps {
    comment: CommentData
    currentUserId: string | null
    currentUserRole: string | null
    projectSlug: string
    episodeId?: string | null
    projectId: string
    onUpdate: (comment: CommentData) => void
    onDelete: (id: string) => void
    isReply?: boolean
}

// Map user accentColor names → hex for avatar rendering
const ACCENT_COLORS: Record<string, string> = {
    gold: '#d4a853', blue: '#60a5fa', purple: '#a78bfa',
    green: '#34d399', red: '#f87171', orange: '#fb923c',
    pink: '#f472b6', teal: '#2dd4bf', cyan: '#22d3ee',
}

function Avatar({ user }: { user: CommentUser }) {
    if (user.avatar) {
        return (
            <img
                src={user.avatar}
                alt=""
                style={{
                    width: 32, height: 32, borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0,
                }}
            />
        )
    }
    const initial = user.name?.charAt(0)?.toUpperCase() || '?'
    const hex = ACCENT_COLORS[user.accentColor || 'gold'] || ACCENT_COLORS.gold
    return (
        <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${hex}44, ${hex}22)`,
            border: `1.5px solid ${hex}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.78rem', fontWeight: 700, color: hex,
        }}>
            {initial}
        </div>
    )
}

export default function CommentCard({
    comment, currentUserId, currentUserRole, projectSlug,
    episodeId, projectId, onUpdate, onDelete, isReply = false,
}: CommentCardProps) {
    const t = useTranslations('comments')
    const [showReplyInput, setShowReplyInput] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editContent, setEditContent] = useState(comment.content)
    const [editSubmitting, setEditSubmitting] = useState(false)
    const [likedByMe, setLikedByMe] = useState(comment.likedByMe)
    const [likesCount, setLikesCount] = useState(comment.likesCount)
    const [liking, setLiking] = useState(false)

    const isOwner = currentUserId === comment.user.id
    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin'

    // Edit window — minutes remaining (updated every 60s)
    const createdAtMs = new Date(comment.createdAt).getTime()
    const [editMinsLeft, setEditMinsLeft] = useState(() => {
        const elapsed = Date.now() - new Date(comment.createdAt).getTime()
        return Math.max(0, 15 - Math.floor(elapsed / 60000))
    })

    // Re-render every 60s to update the countdown
    useEffect(() => {
        if (!isOwner || editMinsLeft <= 0) return
        const timer = setInterval(() => {
            const elapsed = Date.now() - createdAtMs
            setEditMinsLeft(Math.max(0, 15 - Math.floor(elapsed / 60000)))
        }, 60000)
        return () => clearInterval(timer)
    }, [isOwner, editMinsLeft, createdAtMs])

    const canEdit = isOwner && editMinsLeft > 0 && !comment.hidden

    // Hidden / deleted comment
    if (comment.hidden) {
        return (
            <div style={{
                padding: '8px 12px', fontSize: '0.8rem', fontStyle: 'italic',
                color: 'var(--text-tertiary)', opacity: 0.6,
            }}>
                {comment.content === '[deleted]'
                    ? t('deletedComment')
                    : t('removedByMod')}
            </div>
        )
    }

    const handleLike = async () => {
        if (!currentUserId || liking) return
        setLiking(true)
        try {
            const res = await fetch(`/api/comments/${comment.id}/like`, { method: 'POST' })
            const data = await res.json()
            if (res.ok) {
                setLikedByMe(data.liked)
                setLikesCount(data.likesCount)
            }
        } catch { /* ignore */ }
        setLiking(false)
    }

    const handleEdit = async () => {
        if (!editContent.trim() || editSubmitting) return
        setEditSubmitting(true)
        try {
            const res = await fetch(`/api/comments/${comment.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editContent }),
            })
            const data = await res.json()
            if (res.ok) {
                onUpdate({ ...comment, content: data.comment.content, editedAt: data.comment.editedAt })
                setEditing(false)
            }
        } catch { /* ignore */ }
        setEditSubmitting(false)
    }

    const handleDelete = async () => {
        if (!confirm(t('deleteConfirm'))) return
        try {
            const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
            if (res.ok) onDelete(comment.id)
        } catch { /* ignore */ }
    }

    const handleModerate = async (action: string) => {
        try {
            const res = await fetch('/api/admin/comments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: comment.id, action }),
            })
            if (res.ok) {
                const data = await res.json()
                onUpdate({ ...comment, hidden: data.comment.hidden, pinned: data.comment.pinned })
            }
        } catch { /* ignore */ }
    }

    const handleReplySubmit = (newReply: CommentData) => {
        setShowReplyInput(false)
        onUpdate({ ...comment, replies: [...(comment.replies || []), newReply] })
    }

    return (
        <div
            id={`comment-${comment.id}`}
            style={{
                display: 'flex', gap: '10px', padding: isReply ? '8px 0 8px 16px' : '12px 0',
                borderLeft: isReply ? '2px solid rgba(255,255,255,0.06)' : undefined,
                ...(comment.flagged && isAdmin ? { borderLeft: '3px solid rgba(234,179,8,0.5)' } : {}),
            }}
        >
            <Avatar user={comment.user} />

            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {comment.user.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        {timeAgo(comment.createdAt, t)}
                    </span>
                    {comment.editedAt && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                            {t('edited')}
                        </span>
                    )}
                    {comment.pinned && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                            📌 {t('pinned')}
                        </span>
                    )}
                    {comment.flagged && isAdmin && (
                        <span style={{ fontSize: '0.68rem', color: '#eab308', fontWeight: 600 }}>
                            🚩 {t('flagged')}
                        </span>
                    )}
                </div>

                {/* Content */}
                {editing ? (
                    <div style={{ marginBottom: '8px' }}>
                        <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            maxLength={2000}
                            rows={3}
                            style={{
                                width: '100%', padding: '8px 10px', fontSize: '0.85rem',
                                color: 'var(--text-primary)', background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(212,168,83,0.3)', borderRadius: '8px',
                                resize: 'none', outline: 'none', fontFamily: 'inherit',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <button onClick={handleEdit} disabled={editSubmitting} style={{
                                ...actionBtnStyle, background: 'var(--accent-gold)', color: '#000', fontWeight: 600,
                            }}>
                                {editSubmitting ? '...' : t('save')}
                            </button>
                            <button onClick={() => { setEditing(false); setEditContent(comment.content) }} style={actionBtnStyle}>
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <p style={{
                        fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--text-secondary)',
                        margin: '0 0 6px', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                    }}>
                        {comment.content}
                    </p>
                )}

                {/* Actions */}
                {!editing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Like */}
                        <button onClick={handleLike} disabled={!currentUserId} style={{
                            ...actionBtnStyle,
                            color: likedByMe ? '#ef4444' : 'var(--text-tertiary)',
                        }}>
                            {likedByMe ? '❤️' : '🤍'} {likesCount > 0 ? likesCount : ''}
                        </button>

                        {/* Reply (only on top-level) */}
                        {!isReply && currentUserId && (
                            <button onClick={() => setShowReplyInput(!showReplyInput)} style={actionBtnStyle}>
                                {t('reply')}
                            </button>
                        )}

                        {/* Edit (owner, within window) */}
                        {canEdit && (
                            <button onClick={() => { setEditing(true); setEditContent(comment.content) }} style={actionBtnStyle}>
                                {t('editMinsLeft').replace('{n}', String(editMinsLeft))}
                            </button>
                        )}
                        {isOwner && editMinsLeft <= 0 && !comment.hidden && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                {t('editWindowClosed')}
                            </span>
                        )}

                        {/* Delete (owner) */}
                        {isOwner && (
                            <button onClick={handleDelete} style={{ ...actionBtnStyle, color: 'var(--error)' }}>
                                {t('delete')}
                            </button>
                        )}

                        {/* Admin actions */}
                        {isAdmin && !isOwner && (
                            <>
                                <button onClick={() => handleModerate(comment.hidden ? 'unhide' : 'hide')} style={actionBtnStyle}>
                                    {comment.hidden ? t('unhide') : t('hide')}
                                </button>
                                <button onClick={() => handleModerate(comment.pinned ? 'unpin' : 'pin')} style={actionBtnStyle}>
                                    {comment.pinned ? t('unpin') : t('pin')}
                                </button>
                                <button onClick={handleDelete} style={{ ...actionBtnStyle, color: 'var(--error)' }}>
                                    {t('delete')}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Reply input */}
                {showReplyInput && (
                    <div style={{ marginTop: '8px' }}>
                        <CommentInput
                            projectId={projectId}
                            episodeId={episodeId}
                            parentId={comment.id}
                            onSubmit={handleReplySubmit}
                            onCancel={() => setShowReplyInput(false)}
                            placeholder={t('replyTo').replace('{name}', comment.user.name)}
                            autoFocus
                        />
                    </div>
                )}

                {/* Replies */}
                {comment.replies?.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                        {comment.replies.map(reply => (
                            <CommentCard
                                key={reply.id}
                                comment={reply}
                                currentUserId={currentUserId}
                                currentUserRole={currentUserRole}
                                projectSlug={projectSlug}
                                episodeId={episodeId}
                                projectId={projectId}
                                onUpdate={(updated) => {
                                    onUpdate({
                                        ...comment,
                                        replies: comment.replies.map(r => r.id === updated.id ? updated : r),
                                    })
                                }}
                                onDelete={(id) => {
                                    onUpdate({
                                        ...comment,
                                        replies: comment.replies.map(r =>
                                            r.id === id ? { ...r, hidden: true, content: '[deleted]' } : r
                                        ),
                                    })
                                }}
                                isReply
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

const actionBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    fontSize: '0.76rem',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'color 0.15s',
}
