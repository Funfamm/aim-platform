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
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'feed' | 'preferences'>('feed')
    const [unreadCount, setUnreadCount] = useState(0)

    const [selectMode, setSelectMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        // Fetch independently — a preferences error must NOT blank the feed
        const fetchNotifs = fetch('/api/notifications?limit=50')
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .catch(() => ({ notifications: [], unreadCount: 0 }))

        const fetchPrefs = fetch('/api/notifications/preferences')
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .catch(() => ({ preferences: null }))

        Promise.all([fetchNotifs, fetchPrefs]).then(([notifData, prefData]) => {
            const notifs = notifData.notifications ?? []
            setNotifications(notifs)
            setUnreadCount(notifData.unreadCount ?? notifs.filter((n: Notification) => !n.read).length)
            const p = prefData.preferences ?? {
                newRole: true, announcement: true, contentPublish: false,
                statusChange: true, email: true, inApp: true,
            }
            setPrefs(p)
        }).finally(() => setLoading(false))
    }, [])


    async function markAllRead() {
        const unread = notifications.filter(n => !n.read)
        if (!unread.length) return
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),  // empty ids = mark ALL as read
            })
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            setUnreadCount(0)
        } catch { /* ignore */ }
    }

    function handleNotifClick(n: Notification) {
        if (!n.read) {
            fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [n.id] }),
            }).catch(() => null)
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
            setUnreadCount(prev => Math.max(0, prev - 1))
        }
        if (n.link) router.push(n.link as never)
    }

    async function deleteSelected() {
        if (selectedIds.size === 0) return
        if (!confirm('Delete selected notifications?')) return
        setDeleting(true)
        try {
            await fetch('/api/notifications', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            })
            setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)))
            setUnreadCount(notifications.filter(n => !n.read && !selectedIds.has(n.id)).length)
            setSelectedIds(new Set())
            setSelectMode(false)
        } catch { /* ignore */ } finally { setDeleting(false) }
    }

    async function deleteAll() {
        if (!confirm(t('confirmDeleteAll'))) return
        setDeleting(true)
        try {
            await fetch('/api/notifications', { method: 'DELETE' })
            setNotifications([])
            setUnreadCount(0)
            setSelectedIds(new Set())
            setSelectMode(false)
        } catch { /* ignore */ } finally { setDeleting(false) }
    }

    async function savePrefs() {
        if (!prefs) return
        setSaving(true)
        try {
            const res = await fetch('/api/notifications/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prefs),
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
    // Show a badge on the page title when there are unread notifications
    const titleBadge = unreadCount > 0 ? ` (${unreadCount} new)` : ''

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
                @media (max-width: 768px) {
                    #notifications-page { padding-top: 100px !important; }
                }
            `}</style>

            <div
                id="notifications-page"
                style={{ maxWidth: '720px', margin: '0 auto', padding: '88px 16px 80px' }}
            >
                {/* ── Header ── */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, marginBottom: '8px' }}>
                        <span style={{ color: 'var(--accent-gold)' }}>🔔</span> {t('title')}{titleBadge}
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
                                {selectMode ? t('bulkEdit') : t('recentNotifications')}
                            </span>
                            
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                {selectMode ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                if (selectedIds.size === notifications.length) {
                                                    setSelectedIds(new Set())
                                                } else {
                                                    setSelectedIds(new Set(notifications.map(n => n.id)))
                                                }
                                            }}
                                            style={{
                                                fontSize: '0.8rem', color: 'var(--text-secondary)',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                            }}
                                        >
                                            {selectedIds.size === notifications.length ? t('deselectAll') : t('selectAll')}
                                        </button>
                                        <button
                                            onClick={deleteSelected}
                                            disabled={selectedIds.size === 0 || deleting}
                                            style={{
                                                fontSize: '0.8rem', color: selectedIds.size > 0 ? '#ef4444' : 'var(--text-tertiary)',
                                                background: 'none', border: 'none', cursor: selectedIds.size > 0 ? 'pointer' : 'default',
                                            }}
                                        >
                                            {t('deleteSelected')}
                                        </button>
                                        <button
                                            onClick={deleteAll}
                                            disabled={deleting}
                                            style={{
                                                fontSize: '0.8rem', color: '#ef4444',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                            }}
                                        >
                                            {t('deleteAll')}
                                        </button>
                                        <button
                                            onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                                            style={{
                                                fontSize: '0.8rem', color: 'var(--text-primary)',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                            }}
                                        >
                                            {t('cancel')}
                                        </button>
                                    </>
                                ) : (
                                    <>
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
                                        {notifications.length > 0 && (
                                            <button
                                                onClick={() => setSelectMode(true)}
                                                style={{
                                                    fontSize: '0.8rem', color: 'var(--text-secondary)',
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                }}
                                            >
                                                {t('edit')}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
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
                                            onClick={() => {
                                                if (selectMode) {
                                                    const next = new Set(selectedIds)
                                                    if (next.has(n.id)) next.delete(n.id)
                                                    else next.add(n.id)
                                                    setSelectedIds(next)
                                                } else {
                                                    handleNotifClick(n)
                                                }
                                            }}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'flex-start',
                                                gap: '14px', padding: '16px 20px',
                                                background: selectMode && selectedIds.has(n.id) ? 'rgba(212,168,83,0.1)' : (n.read ? 'transparent' : 'rgba(212,168,83,0.04)'),
                                                border: 'none', borderBottom: '1px solid var(--border-subtle)',
                                                cursor: 'pointer', textAlign: 'left',
                                                transition: 'background 0.15s, opacity 0.3s',
                                                opacity: n.read && !selectMode ? 0.6 : 1,
                                            }}
                                        >
                                            {selectMode && (
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.has(n.id)} 
                                                    readOnly 
                                                    style={{ width: '18px', height: '18px', flexShrink: 0, accentColor: 'var(--accent-gold)', marginTop: '4px' }}
                                                />
                                            )}
                                            <span style={{ fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>
                                                {({'new_role':'🎭','announcement':'📣','content_publish':'✨','status_change':'📋','system':'⚙️'} as Record<string,string>)[n.type] ?? '🔔'}
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
                                            {!n.read && !selectMode && (
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
                                { key: 'newRole',        emoji: '🎭', label: t('newRole'),       desc: t('newRoleDesc') },
                                { key: 'announcement',   emoji: '📣', label: t('announcement'),  desc: t('announcementDesc') },
                                { key: 'contentPublish', emoji: '✨', label: t('newContent'),    desc: t('newContentDesc') },
                                { key: 'statusChange',   emoji: '📋', label: t('appUpdates'),   desc: t('appUpdatesDesc') },
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
                                    <ToggleSwitch checked={!!prefs[item.key]} onChange={() => toggle(item.key)} />
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
                                { key: 'inApp' as keyof Prefs, emoji: '🔔', label: t('inApp'), desc: t('inAppDesc') },
                                { key: 'email' as keyof Prefs, emoji: '📧', label: t('email'), desc: t('emailDesc') },
                            ]).map(ch => (
                                <div key={ch.key}>
                                    <div
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '16px',
                                            padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
                                        }}
                                    >
                                        <span style={{ fontSize: '24px', flexShrink: 0 }}>{ch.emoji}</span>
                                        <span style={{ flex: 1 }}>
                                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>{ch.label}</span>
                                            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{ch.desc}</span>
                                        </span>
                                        <ToggleSwitch
                                            checked={!!prefs[ch.key]}
                                            onChange={() => toggle(ch.key)}
                                        />
                                    </div>
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
