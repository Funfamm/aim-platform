'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'

interface CommentInputProps {
    projectId: string
    episodeId?: string | null
    parentId?: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubmit: (comment: any) => void
    onCancel?: () => void
    placeholder?: string
    autoFocus?: boolean
}

export default function CommentInput({
    projectId, episodeId, parentId, onSubmit, onCancel,
    placeholder, autoFocus = false,
}: CommentInputProps) {
    const t = useTranslations('comments')
    const resolvedPlaceholder = placeholder || t('placeholder')
    const [content, setContent] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [autoFocus])

    // Auto-expand textarea
    useEffect(() => {
        const ta = textareaRef.current
        if (!ta) return
        ta.style.height = 'auto'
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
    }, [content])

    const handleSubmit = useCallback(async () => {
        const trimmed = content.trim()
        if (!trimmed || submitting) return
        setSubmitting(true)
        setError('')

        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    episodeId: episodeId || null,
                    parentId: parentId || null,
                    content: trimmed,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || t('failedPost'))
            setContent('')
            onSubmit(data.comment)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('failedPost'))
        } finally {
            setSubmitting(false)
        }
    }, [content, submitting, projectId, episodeId, parentId, onSubmit, t])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSubmit()
        }
        if (e.key === 'Escape' && onCancel) {
            onCancel()
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={resolvedPlaceholder}
                maxLength={2000}
                rows={parentId ? 2 : 3}
                style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    color: 'var(--text-primary)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    resize: 'none',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(212,168,83,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: content.length > 1800 ? 'var(--error)' : 'var(--text-tertiary)' }}>
                    {content.length}/2000
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {onCancel && (
                        <button onClick={onCancel} type="button" style={{
                            background: 'none', border: 'none', color: 'var(--text-tertiary)',
                            fontSize: '0.82rem', cursor: 'pointer', padding: '6px 12px',
                        }}>
                            {t('cancel')}
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!content.trim() || submitting}
                        type="button"
                        style={{
                            padding: '6px 18px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: content.trim() && !submitting ? 'pointer' : 'default',
                            background: content.trim() ? 'var(--accent-gold)' : 'rgba(255,255,255,0.08)',
                            color: content.trim() ? '#000' : 'var(--text-tertiary)',
                            transition: 'all 0.2s',
                            opacity: submitting ? 0.6 : 1,
                        }}
                    >
                        {submitting ? '...' : parentId ? t('reply') : t('post')}
                    </button>
                </div>
            </div>

            {error && (
                <p style={{ fontSize: '0.78rem', color: 'var(--error)', margin: 0 }}>
                    ✗ {error}
                </p>
            )}
        </div>
    )
}
