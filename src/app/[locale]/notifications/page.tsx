'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import ToggleSwitch from '@/components/ToggleSwitch'
import Toast from '@/components/Toast'

interface Prefs {
    newRole: boolean
    announcement: boolean
    contentPublish: boolean
    statusChange: boolean
    email: boolean
    inApp: boolean
    sms: boolean
    phoneNumber?: string
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
    new_role:       { emoji: '🎭', label: 'New Casting Role',      desc: 'When a new audition opens up on the platform' },
    announcement:   { emoji: '📣', label: 'Announcements',         desc: 'Platform news and updates from the AIM Studio team' },
    content_publish:{ emoji: '✨', label: 'New Content',           desc: 'When new films, training or blog content is published' },
    status_change:  { emoji: '📋', label: 'Application Updates',   desc: 'When your casting application status changes' },
    system:         { emoji: '⚙️', label: 'System',                desc: 'Account security and system alerts' },
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

function groupNotifications(list: Notification[]): Record<string, Notification[]> {
    const groups: Record<string, Notification[]> = {}
    list.forEach(n => {
        const date = new Date(n.createdAt).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
        })
        if (!groups[date]) groups[date] = []
        groups[date].push(n)
    })
    return groups
}

export default function NotificationsPage() {
    const router = useRouter()
    const t = useTranslations('NotificationsPage')

    const [prefs, setPrefs] = useState<Prefs | null>(null)
    const [phoneNumber, setPhoneNumber] = useState('')
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
            const p = prefData.preferences ?? {
                newRole: true, announcement: true, contentPublish: false,
                statusChange: true, email: true, inApp: true, sms: false,
            }
            setPrefs(p)
            if (p.phoneNumber) setPhoneNumber(p.phoneNumber)
        }).finally(() => setLoading(false))
    }, [])

    async function markAllRead() {
        const unread = notifications.filter(n => !n.read)
        if (!unread.length) return
        await Promise.all(unread.map(n =>
            fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => null)
        ))
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    function handleNotifClick(n: Notification) {
        if (!n.read) {
            fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => null)
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
        }
        if (n.link) router.push(n.link as never)
    }

    async function savePrefs() {
        if (!prefs) return
        setSaving(true)
        try {
            const res = await fetch('/api/notifications/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...prefs, phoneNumber: phoneNumber.trim() || null }),
            })
            if (!res.ok) throw new Error('Save failed')
            const data = await res.json()
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

    const grouped = groupNotifications(notifications)

    return (
        <>
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .notif-group { animation: fadeInUp 0.35s ease both; }
                .notif-row:hover { background: rgba(212,168,83,0.06) !important; }
                .tab-btn:hover { color: var(--accent-gold) !important; }
            `}</style>

            <div
                id="notifications-page"
                style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px 80px' }}
            >
                {/* ── Header ── */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, marginBottom: '8px' }}>
                        <span style={{ color: 'var(--accent-gold)' }}>🔔</span> {t('title')}
                    </h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        {t('subtitle')}
                    </p>
                </div>

                {/* ── Tab bar ── */}
                <div style={{
                    display: 'flex', gap: '4px', marginBottom: '24px',
                    background: 'var(--bg-secondary)', borderRadius: '10px', padding: '4px',
                }}>
                    {(['feed', 'preferences'] as const).map(tab => (
                        <button
                            key={tab}
                            className="tab-btn"
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, padding: '8px 16px', borderRadius: '8px',
                                border: 'none', cursor: 'pointer', fontWeight: 600,
                                fontSize: '0.85rem', transition: 'all 0.2s',
                                background: activeTab === tab ? 'var(--bg-primary)' : 'transparent',
                                color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                            }}
                        >
                            {tab === 'feed' ? t('feedTab') : t('preferencesTab')}
                        </button>
                    ))}
                </div>

                {/* ── Content ── */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
                        {t('loading')}
                    </div>
                ) : activeTab === 'feed' ? (

                    /* ─── FEED ─── */
                    <div style={{
                        background: 'var(--bg-secondary)', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)', overflow: 'hidden',
                    }}>
                        {/* Feed header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {t('recentNotifications')}
                            </span>
                            {notifications.some(n => !n.read) && (
                                <button
                                    onClick={markAllRead}
                                    style={{
                                        fontSize: '0.8rem', color: 'var(--accent-gold)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                    }}
                                >
                                    {t('markAllRead')}
                                </button>
                            )}
                        </div>

                        {/* Empty state */}
                        {notifications.length === 0 ? (
                            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t('allCaughtUp')}</div>
                                <div style={{ fontSize: '0.85rem' }}>{t('noNotifications')}</div>
                            </div>
                        ) : (
                            /* Grouped notification rows */
                            Object.entries(grouped).map(([date, items], gi) => (
                                <div
                                    key={date}
                                    className="notif-group"
                                    style={{ animationDelay: `${gi * 60}ms` }}
                                >
                                    <div style={{
                                        padding: '8px 20px', fontSize: '0.75rem', fontWeight: 600,
                                        color: 'var(--text-tertiary)', letterSpacing: '0.06em',
                                        textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)',
                                        background: 'rgba(255,255,255,0.02)',
                                    }}>
                                        {date}
                                    </div>
                                    {items.map(n => (
                                        <button
                                            key={n.id}
                                            className="notif-row"
                                            onClick={() => handleNotifClick(n)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'flex-start',
                                                gap: '14px', padding: '16px 20px',
                                                background: n.read ? 'transparent' : 'rgba(212,168,83,0.04)',
                                                border: 'none', borderBottom: '1px solid var(--border-subtle)',
                                                cursor: 'pointer', textAlign: 'left',
                                                transition: 'background 0.15s, opacity 0.3s',
                                                opacity: n.read ? 0.6 : 1,
                                            }}
                                        >
                                            <span style={{ fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>
                                                {TYPE_LABELS[n.type]?.emoji ?? '🔔'}
                                            </span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{
                                                    display: 'block', fontWeight: 600, fontSize: '0.9rem',
                                                    color: 'var(--text-primary)', marginBottom: '2px',
                                                }}>
                                                    {n.title}
                                                </span>
                                                <span style={{
                                                    display: 'block', fontSize: '0.82rem',
                                                    color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: 1.4,
                                                }}>
                                                    {n.message}
                                                </span>
                                                <span style={{ fontSize: '0.73rem', color: '#6b7280' }}>
                                                    {timeAgo(n.createdAt)}
                                                </span>
                                            </span>
                                            {!n.read && (
                                                <span style={{
                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                    background: 'var(--accent-gold)', flexShrink: 0, marginTop: '5px',
                                                }} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>

                ) : (

                    /* ─── PREFERENCES ─── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Notification Types */}
                        <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '16px',
                            border: '1px solid var(--border-subtle)', overflow: 'hidden',
                        }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontWeight: 700, marginBottom: '2px' }}>{t('whatToNotify')}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{t('chooseEvents')}</div>
                            </div>
                            {prefs && ([
                                { key: 'newRole',       ...TYPE_LABELS.new_role },
                                { key: 'announcement',  ...TYPE_LABELS.announcement },
                                { key: 'contentPublish',...TYPE_LABELS.content_publish },
                                { key: 'statusChange',  ...TYPE_LABELS.status_change },
                            ] as Array<{ key: keyof Prefs; emoji: string; label: string; desc: string }>).map(item => (
                                <div
                                    key={item.key}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '16px',
                                        padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
                                    }}
                                >
                                    <span style={{ fontSize: '24px', flexShrink: 0 }}>{item.emoji}</span>
                                    <span style={{ flex: 1 }}>
                                        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>{item.label}</span>
                                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{item.desc}</span>
                                    </span>
                                    <ToggleSwitch checked={prefs[item.key]} onChange={() => toggle(item.key)} />
                                </div>
                            ))}
                        </div>

                        {/* Delivery Channels */}
                        <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '16px',
                            border: '1px solid var(--border-subtle)', overflow: 'hidden',
                        }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontWeight: 700, marginBottom: '2px' }}>{t('howToNotify')}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{t('controlChannels')}</div>
                            </div>
                            {prefs && ([
                                { key: 'inApp'  as keyof Prefs, emoji: '🔔', label: t('inApp'),  desc: t('inAppDesc'),  disabled: false },
                                { key: 'email'  as keyof Prefs, emoji: '📧', label: t('email'),  desc: t('emailDesc'),  disabled: false },
                                { key: 'sms'    as keyof Prefs, emoji: '💬', label: t('sms'),    desc: t('smsDesc'),    disabled: false },
                            ]).map(ch => (
                                <div key={ch.key}>
                                    <div
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '16px',
                                            padding: '14px 20px', borderBottom: ch.key === 'sms' && prefs.sms ? 'none' : '1px solid var(--border-subtle)',
                                        }}
                                    >
                                        <span style={{ fontSize: '24px', flexShrink: 0 }}>{ch.emoji}</span>
                                        <span style={{ flex: 1 }}>
                                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>{ch.label}</span>
                                            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{ch.desc}</span>
                                        </span>
                                        <ToggleSwitch
                                            checked={prefs[ch.key] as boolean}
                                            disabled={ch.disabled}
                                            onChange={() => { if (!ch.disabled) toggle(ch.key) }}
                                        />
                                    </div>
                                    {/* Phone number input – shown when SMS is enabled */}
                                    {ch.key === 'sms' && prefs.sms && (
                                        <div style={{
                                            padding: '12px 20px 16px', borderBottom: '1px solid var(--border-subtle)',
                                            background: 'rgba(212,168,83,0.03)',
                                        }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                                                📱 Phone number (E.164 format, e.g. +15551234567)
                                            </label>
                                            <input
                                                type="tel"
                                                value={phoneNumber}
                                                onChange={e => setPhoneNumber(e.target.value)}
                                                placeholder="+1 555 000 0000"
                                                style={{
                                                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                                                    border: '1px solid var(--border-subtle)',
                                                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                                    fontSize: '0.9rem', outline: 'none',
                                                    boxSizing: 'border-box',
                                                }}
                                            />
                                            <span style={{ fontSize: '0.73rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                                                Mock mode: SMS will be logged to the server console. No messages are sent.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Save */}
                        <button
                            onClick={savePrefs}
                            disabled={saving}
                            style={{
                                padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.3s',
                                background: saved
                                    ? 'rgba(16,185,129,0.15)'
                                    : 'linear-gradient(135deg, var(--accent-gold), #c49b3a)',
                                color: saved ? '#10b981' : '#0f1115',
                            }}
                        >
                            {saving ? t('saving') : saved ? t('saved') : t('savePreferences')}
                        </button>

                        <Toast visible={saved} message={t('preferencesSaved')} onClose={() => setSaved(false)} />
                    </div>
                )}
            </div>
        </>
    )
}
