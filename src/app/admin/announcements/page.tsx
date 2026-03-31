'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function AnnouncementsAdminPage() {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [link, setLink] = useState('')
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

    async function handleSend(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !message.trim()) return
        setSending(true)
        setResult(null)
        try {
            const res = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim(), message: message.trim(), link: link.trim() || undefined }),
            })
            const data = await res.json()
            if (res.ok) {
                setResult({ success: true })
                setTitle('')
                setMessage('')
                setLink('')
            } else {
                setResult({ error: data.error || 'Failed to send' })
            }
        } catch {
            setResult({ error: 'Network error' })
        } finally {
            setSending(false)
        }
    }

    return (
        <div id="admin-announcements-page" style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 20px 80px' }}>
            {/* Back */}
            <Link href="/admin" style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '28px' }}>
                ← Admin Dashboard
            </Link>

            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, marginBottom: '8px' }}>
                    📣 Send Announcement
                </h1>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                    Broadcast a message to all users who have opted in to announcements.
                    Delivered via <strong>email</strong> and <strong>in-app notification</strong> simultaneously.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                    {/* Title */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Announcement Title <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            id="announcement-title"
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            maxLength={100}
                            placeholder="e.g. Season 2 Casting Now Open"
                            required
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: '10px',
                                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)', fontSize: '0.92rem', outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>{title.length}/100</div>
                    </div>

                    {/* Message */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Message <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea
                            id="announcement-message"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            maxLength={500}
                            rows={5}
                            placeholder="What would you like to tell your community?"
                            required
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: '10px',
                                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none',
                                resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>{message.length}/500</div>
                    </div>

                    {/* CTA Link (optional) */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Link <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none' }}>(optional — e.g. /casting)</span>
                        </label>
                        <input
                            id="announcement-link"
                            type="text"
                            value={link}
                            onChange={e => setLink(e.target.value)}
                            placeholder="/casting or https://..."
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: '10px',
                                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {/* Preview card */}
                {(title || message) && (
                    <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: '12px', padding: '16px 20px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '8px' }}>Preview</div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '22px' }}>📣</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '3px' }}>{title || '—'}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message || '—'}</div>
                                {link && <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginTop: '6px' }}>→ {link}</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Status */}
                {result?.success && (
                    <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 600, fontSize: '0.88rem' }}>
                        ✅ Announcement queued — users will receive it shortly via email and in-app notification.
                    </div>
                )}
                {result?.error && (
                    <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600, fontSize: '0.88rem' }}>
                        ❌ {result.error}
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    id="send-announcement-btn"
                    disabled={sending || !title.trim() || !message.trim()}
                    style={{
                        padding: '15px', borderRadius: '12px', border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
                        fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.02em',
                        background: sending || !title.trim() || !message.trim()
                            ? 'rgba(212,168,83,0.3)'
                            : 'linear-gradient(135deg, var(--accent-gold), #c49b3a)',
                        color: '#0f1115',
                        transition: 'all 0.25s',
                    }}
                >
                    {sending ? '⏳ Sending…' : '📣 Broadcast Announcement'}
                </button>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                    Only users who have opted in to announcements will be notified.
                    Delivery is asynchronous — emails may take a few seconds.
                </p>
            </form>
        </div>
    )
}
