'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

interface Prefs {
    newRole: boolean
    announcement: boolean
    contentPublish: boolean
    statusChange: boolean
    email: boolean
    inApp: boolean
    sms: boolean
}

interface Notification {
    id: string
    type: string
    title: string
    message: string
    link?: string
    read: boolean
    createdAt: string
}

const TYPE_LABELS: Record<string, { emoji: string; label: string; desc: string }> = {
    new_role: { emoji: '🎭', label: 'New Casting Role', desc: 'When a new audition opens up on the platform' },
    announcement: { emoji: '📣', label: 'Announcements', desc: 'Platform news and updates from the AIM Studio team' },
    content_publish: { emoji: '✨', label: 'New Content', desc: 'When new films, training or blog content is published' },
    status_change: { emoji: '📋', label: 'Application Updates', desc: 'When your casting application status changes' },
    system: { emoji: '⚙️', label: 'System', desc: 'Account security and system alerts' },
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsPage() {
    const router = useRouter()
    const [prefs, setPrefs] = useState<Prefs | null>(null)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'feed' | 'preferences'>('feed')

    useEffect(() => {
        Promise.all([
            fetch('/api/notifications?limit=50').then(r => r.json()),
            fetch('/api/notifications/preferences').then(r => r.json()),
        ]).then(([notifData, prefData]) => {
            setNotifications(notifData.notifications ?? [])
            setPrefs(prefData.preferences ?? {
                newRole: true, announcement: true, contentPublish: false,
                statusChange: true, email: true, inApp: true, sms: false
            })
        }).finally(() => setLoading(false))
    }, [])

    async function markAllRead() {
        await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
        setNotifications(n => n.map(x => ({ ...x, read: true })))
    }

    async function handleNotifClick(n: Notification) {
        if (!n.read) {
            await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [n.id] }) })
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
        }
        if (n.link) router.push(n.link)
    }

    async function savePrefs() {
        if (!prefs) return
        setSaving(true)
        try {
            const res = await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prefs),
            })
            if (!res.ok) throw new Error('Save failed')
            const data = await res.json()
            // Update local state from what the server actually saved
            if (data.preferences) setPrefs(data.preferences)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch {
            alert('Failed to save notification preferences. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    function toggle(key: keyof Prefs) {
        setPrefs(p => p ? { ...p, [key]: !p[key] } : p)
    }

    return (
        <div id="notifications-page" style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px 80px' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, marginBottom: '8px' }}>
                    <span style={{ color: 'var(--accent-gold)' }}>🔔</span> Notifications
                </h1>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                    Manage your notification feed and delivery preferences.
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '4px' }}>
                {(['feed', 'preferences'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        flex: 1, padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
                        background: activeTab === tab ? 'var(--bg-primary)' : 'transparent',
                        color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                    }}>
                        {tab === 'feed' ? '📨 Feed' : '⚙️ Preferences'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>Loading…</div>
            ) : activeTab === 'feed' ? (
                /* ── Notification Feed ── */
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Recent Notifications</span>
                        {notifications.some(n => !n.read) && (
                            <button onClick={markAllRead} style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                Mark all read
                            </button>
                        )}
                    </div>
                    {notifications.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>You&apos;re all caught up!</div>
                            <div style={{ fontSize: '0.85rem' }}>No notifications yet.</div>
                        </div>
                    ) : notifications.map(n => (
                        <button key={n.id} onClick={() => handleNotifClick(n)} style={{
                            width: '100%', display: 'flex', alignItems: 'flex-start', gap: '14px',
                            padding: '16px 20px', background: n.read ? 'transparent' : 'rgba(212,168,83,0.03)',
                            border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                            textAlign: 'left', transition: 'background 0.15s',
                        }}>
                            <span style={{ fontSize: '24px', flexShrink: 0 }}>{TYPE_LABELS[n.type]?.emoji ?? '🔔'}</span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '2px' }}>{n.title}</span>
                                <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: 1.4 }}>{n.message}</span>
                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{timeAgo(n.createdAt)}</span>
                            </span>
                            {!n.read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0, marginTop: '4px' }} />}
                        </button>
                    ))}
                </div>
            ) : (
                /* ── Preferences ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Notification Types */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontWeight: 700, marginBottom: '2px' }}>What to notify me about</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Choose which types of events you want to hear about.</div>
                        </div>
                        {prefs && ([
                            { key: 'newRole', ...TYPE_LABELS.new_role },
                            { key: 'announcement', ...TYPE_LABELS.announcement },
                            { key: 'contentPublish', ...TYPE_LABELS.content_publish },
                            { key: 'statusChange', ...TYPE_LABELS.status_change },
                        ] as Array<{ key: keyof Prefs; emoji: string; label: string; desc: string }>).map(item => (
                            <label key={item.key} style={{
                                display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px',
                                borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                            }}>
                                <span style={{ fontSize: '24px', flexShrink: 0 }}>{item.emoji}</span>
                                <span style={{ flex: 1 }}>
                                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>{item.label}</span>
                                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{item.desc}</span>
                                </span>
                                <input type="checkbox" checked={prefs[item.key] as boolean} onChange={() => toggle(item.key)}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)', cursor: 'pointer', flexShrink: 0 }} />
                            </label>
                        ))}
                    </div>

                    {/* Delivery Channels */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontWeight: 700, marginBottom: '2px' }}>How to notify me</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Control which delivery channels are active.</div>
                        </div>
                        {prefs && ([
                            { key: 'inApp' as keyof Prefs, emoji: '🔔', label: 'In-App (bell icon)', desc: 'Notifications shown inside the platform' },
                            { key: 'email' as keyof Prefs, emoji: '📧', label: 'Email', desc: 'Delivered to your registered email address' },
                            { key: 'sms' as keyof Prefs, emoji: '💬', label: 'SMS (coming soon)', desc: 'Text message notifications — not yet available', disabled: true },
                        ]).map(ch => (
                            <label key={ch.key} style={{
                                display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px',
                                borderBottom: '1px solid var(--border-subtle)', cursor: ch.disabled ? 'not-allowed' : 'pointer',
                                opacity: ch.disabled ? 0.5 : 1,
                            }}>
                                <span style={{ fontSize: '24px', flexShrink: 0 }}>{ch.emoji}</span>
                                <span style={{ flex: 1 }}>
                                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>{ch.label}</span>
                                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{ch.desc}</span>
                                </span>
                                <input type="checkbox" checked={prefs[ch.key] as boolean} disabled={ch.disabled}
                                    onChange={() => !ch.disabled && toggle(ch.key)}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)', cursor: ch.disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }} />
                            </label>
                        ))}
                    </div>

                    {/* Save button */}
                    <button onClick={savePrefs} disabled={saving} style={{
                        padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
                        background: saved ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, var(--accent-gold), #c49b3a)',
                        color: saved ? '#10b981' : '#0f1115',
                        transition: 'all 0.3s',
                    }}>
                        {saving ? 'Saving…' : saved ? '✅ Preferences Saved' : 'Save Preferences'}
                    </button>
                </div>
            )}
        </div>
    )
}
