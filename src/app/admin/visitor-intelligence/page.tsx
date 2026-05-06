'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

// ── Types ──────────────────────────────────────────────────────────────────
interface FeedItem {
    id: string
    path: string
    device: string | null
    country: string | null
    sessionId: string | null
    referrer: string | null
    event: string | null
    durationMs: number | null
    createdAt: string
    identity: {
        name: string
        email: string
        role: string
        loginMethod: string | null
        avatar: string | null
        initials: string
    } | null
}

interface ViData {
    feed: FeedItem[]
    realTime: { onlineNow: number; loggedInNow: number; guestsNow: number }
    geo: { country: string; count: number }[]
    topPages: { path: string; views: number; avgDurationMs: number | null }[]
    authMethods: { method: string; count: number }[]
    recentLogins: {
        id: string
        method: string
        country: string | null
        createdAt: string
        user: { name: string; email: string; role: string } | null
    }[]
    funnel: { step: string; count: number; pct: number }[]
    hourlyViews: number[]
    retentionWarning: number
    retention: { days: number }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getRelativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
}

function formatDuration(ms: number | null) {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

const COUNTRY_FLAGS: Record<string, string> = {
    US:'🇺🇸', GB:'🇬🇧', CA:'🇨🇦', AU:'🇦🇺', NG:'🇳🇬', GH:'🇬🇭', ZA:'🇿🇦',
    IN:'🇮🇳', DE:'🇩🇪', FR:'🇫🇷', BR:'🇧🇷', MX:'🇲🇽', JP:'🇯🇵', CN:'🇨🇳',
    KE:'🇰🇪', EG:'🇪🇬', RU:'🇷🇺', PK:'🇵🇰', ID:'🇮🇩', TR:'🇹🇷',
}
const flag = (c: string | null) => (c && COUNTRY_FLAGS[c]) ? COUNTRY_FLAGS[c] : (c || '🌐')

const METHOD_ICONS: Record<string, string> = {
    google: '🔵', credentials: '🔑', apple: '🍎',
}

const DEVICE_ICONS: Record<string, string> = {
    mobile: '📱', tablet: '📟', desktop: '🖥️',
}

const ROLE_COLORS: Record<string, string> = {
    admin: '#f59e0b', superadmin: '#ef4444', member: '#22c55e', guest: '#6b7280',
}

// ── Styles ─────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
    background: 'var(--bg-card, #1a1d23)',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.07))',
    borderRadius: '16px',
    padding: '20px',
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function VisitorIntelligencePage() {
    const [data, setData]       = useState<ViData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState('')
    const [mounted, setMounted] = useState(false)
    const [feedOpen, setFeedOpen] = useState(true)
    useEffect(() => { setMounted(true) }, [])

    // Session explorer modal
    const [sessionModal, setSessionModal] = useState<null | { sid: string; data: any }>(null)
    const [sessionLoading, setSessionLoading] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/visitor-intelligence')
            if (res.status === 401) { window.location.href = '/admin/login'; return }
            if (!res.ok) { setError('Failed to load data'); return }
            setData(await res.json())
            setError('')
        } catch { setError('Network error') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])
    // Auto-refresh every 15s (more frequent than analytics page — this is live)
    useEffect(() => {
        const t = setInterval(fetchData, 15000)
        return () => clearInterval(t)
    }, [fetchData])

    const openSession = async (sid: string | null) => {
        if (!sid) return
        setSessionLoading(true)
        setSessionModal({ sid, data: null })
        try {
            const res = await fetch(`/api/admin/visitor-intelligence/session/${sid}`)
            if (res.ok) setSessionModal({ sid, data: await res.json() })
        } catch { /* silent */ }
        setSessionLoading(false)
    }

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="admin-layout">
            <AdminSidebar />

            <style>{`
                @keyframes viPulse {
                    0%,100% { opacity:1; transform:scale(1); }
                    50%      { opacity:.6; transform:scale(1.3); }
                }
                @keyframes viSlideIn {
                    from { opacity:0; transform:translateY(8px); }
                    to   { opacity:1; transform:translateY(0); }
                }
                .vi-feed-row:hover { background: rgba(255,255,255,0.03) !important; }
                .vi-session-btn:hover { color: var(--accent-gold) !important; text-decoration: underline; }
                .vi-card-hover:hover { border-color: rgba(212,168,83,0.25) !important; }
            `}</style>

            <main className="admin-main">

                {/* ══════════════════════════════════════════════
                    HEADER
                ══════════════════════════════════════════════ */}
                <div style={{
                    position: 'relative',
                    marginBottom: '28px',
                    padding: '28px 32px 24px',
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(139,92,246,0.05) 50%, rgba(212,168,83,0.04) 100%)',
                    border: '1px solid rgba(59,130,246,0.14)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                }}>
                    {/* Top accent bar */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                        background: 'linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, #d4a853, transparent)',
                        opacity: 0.7,
                    }} />

                    {/* Background orb */}
                    <div style={{
                        position: 'absolute', top: '-60px', right: '-30px',
                        width: '220px', height: '220px', borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: '16px' }}>

                        {/* Title block */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.15))',
                                    border: '1px solid rgba(59,130,246,0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.1rem',
                                }}>🔍</div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                        Admin Intelligence
                                    </div>
                                    <h1 style={{
                                        fontSize: '1.55rem', fontWeight: 900, margin: 0,
                                        background: 'linear-gradient(135deg, var(--text-primary, #f1f5f9) 40%, #3b82f6 100%)',
                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                        letterSpacing: '-0.02em', lineHeight: 1.1,
                                    }}>Visitor Intelligence</h1>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
                                Identity-enriched live feed · Session journeys · Conversion funnel · Geo insights · Auth tracking
                            </p>
                        </div>

                        {/* Real-time stat pills */}
                        {data && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

                                {/* Online Now */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 16px', borderRadius: '99px',
                                    background: 'rgba(34,197,94,0.08)',
                                    border: '1px solid rgba(34,197,94,0.2)',
                                }}>
                                    <span style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: '#22c55e',
                                        animation: 'viPulse 2s ease-in-out infinite',
                                        boxShadow: '0 0 8px rgba(34,197,94,0.6)',
                                        flexShrink: 0,
                                    }} />
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22c55e' }}>
                                        {data.realTime.onlineNow} online
                                    </span>
                                </div>

                                {/* Logged In */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 16px', borderRadius: '99px',
                                    background: 'rgba(59,130,246,0.08)',
                                    border: '1px solid rgba(59,130,246,0.2)',
                                }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }}>
                                        👤 {data.realTime.loggedInNow} members
                                    </span>
                                </div>

                                {/* Guests */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 16px', borderRadius: '99px',
                                    background: 'rgba(107,114,128,0.08)',
                                    border: '1px solid rgba(107,114,128,0.2)',
                                }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9ca3af' }}>
                                        👻 {data.realTime.guestsNow} guests
                                    </span>
                                </div>

                                {/* Refresh */}
                                <button onClick={fetchData} style={{
                                    padding: '8px 14px', borderRadius: '99px', border: '1px solid var(--border-subtle)',
                                    background: 'rgba(255,255,255,0.03)', color: 'var(--text-tertiary)',
                                    fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600,
                                    transition: 'all 0.2s',
                                }}>↻ Refresh</button>

                                {/* Retention warning */}
                                {data.retentionWarning > 0 && (
                                    <div style={{
                                        padding: '8px 14px', borderRadius: '99px',
                                        background: 'rgba(245,158,11,0.08)',
                                        border: '1px solid rgba(245,158,11,0.25)',
                                        fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600,
                                    }}>
                                        ⚠️ {data.retentionWarning.toLocaleString()} rows past {data.retention.days}d retention
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Back link */}
                    <div style={{ position: 'relative', zIndex: 1, marginTop: '14px' }}>
                        <Link href="/admin/analytics" style={{
                            fontSize: '0.7rem', color: 'var(--text-tertiary)',
                            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}>← Back to Analytics</Link>
                    </div>
                </div>

                {/* Loading / error states */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-tertiary)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                        Loading visitor intelligence...
                    </div>
                )}
                {error && (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚠️</div>
                        <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '12px' }}>{error}</div>
                        <button onClick={fetchData} style={{
                            padding: '8px 20px', borderRadius: '8px', border: 'none',
                            background: 'var(--accent-gold)', color: '#000', fontWeight: 700,
                            cursor: 'pointer', fontSize: '0.82rem',
                        }}>Retry</button>
                    </div>
                )}

                {/* ══════════════════════════════════════════════
                    PART 2 — LIVE ACTIVITY FEED
                ══════════════════════════════════════════════ */}
                {!loading && !error && data && (<>
                <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: '24px' }}>

                    {/* Feed header — clickable to collapse */}
                    <div
                        onClick={() => setFeedOpen(p => !p)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 20px',
                            borderBottom: feedOpen ? '1px solid var(--border-subtle)' : 'none',
                            background: 'rgba(59,130,246,0.03)',
                            cursor: 'pointer', userSelect: 'none',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: '#22c55e', flexShrink: 0,
                                animation: 'viPulse 2s ease-in-out infinite',
                                boxShadow: '0 0 8px rgba(34,197,94,0.6)',
                            }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Live Activity Feed
                            </span>
                            <span style={{
                                fontSize: '0.62rem', padding: '2px 8px', borderRadius: '99px',
                                background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 700,
                            }}>
                                last {data.feed.length} events · 15s refresh
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: feedOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                            {feedOpen ? 'Click session ID to explore full journey' : `${data.feed.length} events — click to expand`}
                        </div>
                    </div>

                    {/* Column headers + feed rows — collapseable */}
                    {feedOpen && (<>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 160px 80px 1fr 80px 90px 80px 90px 120px',
                        gap: '8px', padding: '8px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '0.6rem', color: 'var(--text-tertiary)',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                        <span></span>
                        <span>Identity</span>
                        <span>Auth</span>
                        <span>Page</span>
                        <span>Device</span>
                        <span>Country</span>
                        <span>Duration</span>
                        <span>Event</span>
                        <span>Time · Session</span>
                    </div>

                    {/* Feed rows */}
                    {data.feed.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                            No activity recorded yet. Visits will appear here in real-time.
                        </div>
                    ) : (
                        data.feed.map((row, i) => {
                            const isLoggedIn = !!row.identity
                            const roleColor = row.identity ? (ROLE_COLORS[row.identity.role] || '#6b7280') : '#6b7280'
                            return (
                                <div
                                    key={row.id}
                                    className="vi-feed-row"
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '28px 160px 80px 1fr 80px 90px 80px 90px 120px',
                                        gap: '8px', padding: '10px 20px',
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        alignItems: 'center',
                                        animation: `viSlideIn 0.3s ease ${Math.min(i * 30, 300)}ms both`,
                                        cursor: 'default',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {/* Online dot */}
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                        background: isLoggedIn ? '#22c55e' : '#60a5fa',
                                        boxShadow: isLoggedIn ? '0 0 6px rgba(34,197,94,0.5)' : '0 0 6px rgba(96,165,250,0.4)',
                                    }} />

                                    {/* Identity */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                        {/* Avatar / initials */}
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                                            background: isLoggedIn
                                                ? `linear-gradient(135deg, ${roleColor}33, ${roleColor}22)`
                                                : 'rgba(96,165,250,0.1)',
                                            border: `1px solid ${isLoggedIn ? roleColor + '44' : 'rgba(96,165,250,0.2)'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.62rem', fontWeight: 800,
                                            color: isLoggedIn ? roleColor : '#60a5fa',
                                        }}>
                                            {row.identity ? row.identity.initials : '?'}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{
                                                fontSize: '0.75rem', fontWeight: 700,
                                                color: isLoggedIn ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            }}>
                                                {row.identity ? row.identity.name : 'Anonymous'}
                                            </div>
                                            {row.identity && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                                    <span style={{
                                                        fontSize: '0.55rem', padding: '1px 5px', borderRadius: '4px',
                                                        background: roleColor + '22', color: roleColor,
                                                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                    }}>{row.identity.role}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Auth method column */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {row.identity?.loginMethod ? (
                                            <span style={{
                                                fontSize: '0.58rem', padding: '2px 7px', borderRadius: '4px',
                                                fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px',
                                                background: row.identity.loginMethod === 'google' ? 'rgba(66,133,244,0.12)'
                                                    : row.identity.loginMethod === 'apple' ? 'rgba(255,255,255,0.08)'
                                                    : 'rgba(234,179,8,0.12)',
                                                color: row.identity.loginMethod === 'google' ? '#60a5fa'
                                                    : row.identity.loginMethod === 'apple' ? '#e2e8f0'
                                                    : '#eab308',
                                            }}>
                                                {METHOD_ICONS[row.identity.loginMethod] || '🔑'}
                                                {row.identity.loginMethod === 'google' ? 'Google'
                                                    : row.identity.loginMethod === 'apple' ? 'Apple'
                                                    : row.identity.loginMethod === 'credentials' ? 'Email'
                                                    : row.identity.loginMethod}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Guest</span>
                                        )}
                                    </div>

                                    {/* Page path */}
                                    <div style={{
                                        fontSize: '0.72rem', color: 'var(--text-secondary)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        fontFamily: 'monospace',
                                    }} title={row.path}>
                                        {row.path}
                                    </div>

                                    {/* Device */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                        <span title={row.device || 'unknown'}>
                                            {DEVICE_ICONS[row.device || ''] || '🖥️'}
                                        </span>
                                    </div>

                                    {/* Country */}
                                    <div style={{ fontSize: '0.78rem', textAlign: 'center' }}>
                                        <span title={row.country || 'Unknown'}>
                                            {flag(row.country)} {row.country || '—'}
                                        </span>
                                    </div>

                                    {/* Duration */}
                                    <div style={{
                                        fontSize: '0.7rem', color: row.durationMs ? '#60a5fa' : 'var(--text-tertiary)',
                                        fontFamily: 'monospace', textAlign: 'center',
                                    }}>
                                        {formatDuration(row.durationMs)}
                                    </div>

                                    {/* Event tag */}
                                    <div>
                                        {row.event ? (
                                            <span style={{
                                                fontSize: '0.58rem', padding: '2px 6px', borderRadius: '4px',
                                                background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
                                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                                            }}>{row.event}</span>
                                        ) : (
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>—</span>
                                        )}
                                    </div>

                                    {/* Time + Session */}
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                            {mounted ? getRelativeTime(row.createdAt) : '—'}
                                        </div>
                                        {row.sessionId && (
                                            <button
                                                className="vi-session-btn"
                                                onClick={() => openSession(row.sessionId)}
                                                style={{
                                                    background: 'none', border: 'none', padding: 0,
                                                    fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)',
                                                    cursor: 'pointer', fontFamily: 'monospace',
                                                    whiteSpace: 'nowrap', transition: 'color 0.15s',
                                                }}
                                                title="Click to explore full session journey"
                                            >
                                                {row.sessionId.slice(0, 8)}…
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                    </>)}
                </div>

                {/* ══════════════════════════════════════════════
                    PART 3 — GEO BREAKDOWN + AUTH METHODS
                ══════════════════════════════════════════════ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

                    {/* Geo Breakdown */}
                    <div style={{ ...card }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', marginBottom: '16px' }}>
                            🌍 Traffic by Country <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(last 30d)</span>
                        </div>
                        {data.geo.length === 0 ? (
                            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', textAlign: 'center', padding: '20px' }}>No geo data yet</div>
                        ) : (() => {
                            const max = data.geo[0]?.count || 1
                            return data.geo.map((g, i) => (
                                <div key={g.country} style={{ marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '1rem' }}>{flag(g.country)}</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{g.country}</span>
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>{g.count.toLocaleString()}</span>
                                    </div>
                                    <div style={{ height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: '99px',
                                            width: `${(g.count / max) * 100}%`,
                                            background: `hsl(${210 + i * 15}, 80%, 60%)`,
                                            transition: 'width 0.8s ease',
                                        }} />
                                    </div>
                                </div>
                            ))
                        })()}
                    </div>

                    {/* Auth Method Distribution */}
                    <div style={{ ...card }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', marginBottom: '16px' }}>
                            🔐 Auth Method Distribution <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(last 30d)</span>
                        </div>
                        {data.authMethods.length === 0 ? (
                            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', textAlign: 'center', padding: '20px' }}>
                                No login events yet — data populates as users sign in
                            </div>
                        ) : (() => {
                            const total = data.authMethods.reduce((s, m) => s + m.count, 0)
                            const METHOD_COLORS: Record<string, string> = {
                                google: '#4285f4', credentials: '#f59e0b', apple: '#e5e7eb',
                            }
                            return (
                                <>
                                    {/* Big donut-style summary */}
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                        {data.authMethods.map(m => {
                                            const pct = total > 0 ? Math.round((m.count / total) * 100) : 0
                                            const color = METHOD_COLORS[m.method] || '#6b7280'
                                            return (
                                                <div key={m.method} style={{
                                                    flex: 1, minWidth: '80px',
                                                    padding: '14px 12px',
                                                    borderRadius: '12px',
                                                    background: color + '10',
                                                    border: `1px solid ${color}30`,
                                                    textAlign: 'center',
                                                }}>
                                                    <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>
                                                        {METHOD_ICONS[m.method] || '🔑'}
                                                    </div>
                                                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color, lineHeight: 1 }}>{pct}%</div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '3px', textTransform: 'capitalize' }}>{m.method}</div>
                                                    <div style={{ fontSize: '0.65rem', color, fontWeight: 600, marginTop: '2px' }}>{m.count.toLocaleString()} logins</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* Bar breakdown */}
                                    {data.authMethods.map(m => {
                                        const pct = total > 0 ? Math.round((m.count / total) * 100) : 0
                                        const color = METHOD_COLORS[m.method] || '#6b7280'
                                        return (
                                            <div key={m.method} style={{ marginBottom: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                                        {METHOD_ICONS[m.method]} {m.method}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color, fontWeight: 700 }}>{pct}%</span>
                                                </div>
                                                <div style={{ height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)' }}>
                                                    <div style={{ height: '100%', borderRadius: '99px', width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div style={{ marginTop: '12px', fontSize: '0.65rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                                        {total.toLocaleString()} total login events tracked
                                    </div>
                                </>
                            )
                        })()}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════
                    PART 4 — FUNNEL + TOP PAGES
                ══════════════════════════════════════════════ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

                    {/* Conversion Funnel */}
                    <div style={{ ...card }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', marginBottom: '20px' }}>
                            🎯 Conversion Funnel <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(last 30d · unique sessions)</span>
                        </div>
                        {data.funnel.map((step, i) => {
                            const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444']
                            const color = colors[i] || '#6b7280'
                            const dropOff = i > 0 ? data.funnel[i - 1].pct - step.pct : 0
                            return (
                                <div key={step.step} style={{ marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                                                background: color + '20', border: `1px solid ${color}40`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.6rem', fontWeight: 800, color,
                                            }}>{i + 1}</div>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{step.step}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '1rem', fontWeight: 900, color }}>{step.pct}%</span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                                                {step.count.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Funnel bar */}
                                    <div style={{ height: '8px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: '99px',
                                            width: `${step.pct}%`,
                                            background: `linear-gradient(90deg, ${color}, ${color}88)`,
                                            transition: 'width 1s ease',
                                        }} />
                                    </div>
                                    {/* Drop-off indicator */}
                                    {dropOff > 0 && (
                                        <div style={{ fontSize: '0.6rem', color: '#ef4444', marginTop: '3px', textAlign: 'right' }}>
                                            ↓ {dropOff}% drop-off from previous step
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Top Pages with Avg Duration */}
                    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                        <div style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid var(--border-subtle)',
                            fontSize: '0.68rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            color: 'var(--accent-gold)',
                        }}>
                            📄 Top Pages <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(last 7d · with avg time-on-page)</span>
                        </div>
                        {/* Table header */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 60px 90px',
                            gap: '8px', padding: '8px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            fontSize: '0.6rem', color: 'var(--text-tertiary)',
                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>
                            <span>Path</span>
                            <span style={{ textAlign: 'center' }}>Views</span>
                            <span style={{ textAlign: 'right' }}>Avg Time</span>
                        </div>
                        {data.topPages.map((page, i) => (
                            <div key={page.path} style={{
                                display: 'grid', gridTemplateColumns: '1fr 60px 90px',
                                gap: '8px', padding: '9px 20px',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                alignItems: 'center',
                                background: i === 0 ? 'rgba(212,168,83,0.03)' : 'transparent',
                            }}>
                                <div style={{
                                    fontSize: '0.72rem', color: i === 0 ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                    fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    fontWeight: i === 0 ? 700 : 400,
                                }} title={page.path}>
                                    {i === 0 ? '🏆 ' : ''}{page.path}
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
                                    {page.views.toLocaleString()}
                                </div>
                                <div style={{
                                    fontSize: '0.72rem', textAlign: 'right',
                                    color: page.avgDurationMs ? '#60a5fa' : 'var(--text-tertiary)',
                                    fontFamily: 'monospace', fontWeight: page.avgDurationMs ? 600 : 400,
                                }}>
                                    {formatDuration(page.avgDurationMs)}
                                </div>
                            </div>
                        ))}
                        {data.topPages.length === 0 && (
                            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                No page data yet
                            </div>
                        )}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════
                    PART 5 — LOGIN AUDIT + HOURLY HEATMAP
                ══════════════════════════════════════════════ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>

                    {/* Login Audit */}
                    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                        <div style={{
                            padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
                            fontSize: '0.68rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)',
                        }}>
                            🔒 Recent Login Events
                        </div>
                        {data.recentLogins.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                No login events yet — populates as users sign in
                            </div>
                        ) : data.recentLogins.map((login) => {
                            const METHOD_COLORS: Record<string, string> = { google: '#4285f4', credentials: '#f59e0b', apple: '#e5e7eb' }
                            const color = METHOD_COLORS[login.method] || '#6b7280'
                            const roleColor = login.user ? (ROLE_COLORS[login.user.role] || '#6b7280') : '#6b7280'
                            return (
                                <div key={login.id} style={{
                                    display: 'grid', gridTemplateColumns: '32px 1fr 60px 80px',
                                    alignItems: 'center', gap: '10px',
                                    padding: '9px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                                }}>
                                    {/* Auth method icon */}
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                                        background: color + '15', border: `1px solid ${color}30`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
                                    }}>
                                        {METHOD_ICONS[login.method] || '🔑'}
                                    </div>
                                    {/* User info */}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {login.user?.name || 'Unknown'}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                            {login.user && (
                                                <span style={{
                                                    fontSize: '0.52rem', padding: '1px 5px', borderRadius: '4px',
                                                    background: roleColor + '22', color: roleColor,
                                                    fontWeight: 700, textTransform: 'uppercase',
                                                }}>{login.user.role}</span>
                                            )}
                                            <span style={{ fontSize: '0.62rem', color, fontWeight: 600, textTransform: 'capitalize' }}>
                                                via {login.method}
                                            </span>
                                            {login.country && (
                                                <span style={{ fontSize: '0.68rem' }}>{flag(login.country)}</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Country */}
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                        {login.country || '—'}
                                    </div>
                                    {/* Time */}
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                                        {mounted ? getRelativeTime(login.createdAt) : '—'}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Hourly Heatmap */}
                    <div style={{ ...card }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', marginBottom: '20px' }}>
                            🕐 Hourly Activity Today
                        </div>
                        {(() => {
                            const max = Math.max(...data.hourlyViews, 1)
                            return (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px', marginBottom: '8px' }}>
                                        {data.hourlyViews.map((count, h) => {
                                            const pct = (count / max) * 100
                                            const now = new Date().getHours()
                                            const isNow = h === now
                                            return (
                                                <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                                                    title={`${h}:00 — ${count} views`}>
                                                    <div style={{
                                                        width: '100%',
                                                        height: `${Math.max(pct, count > 0 ? 4 : 1)}%`,
                                                        borderRadius: '3px 3px 0 0',
                                                        background: isNow
                                                            ? 'linear-gradient(180deg, #22c55e, #16a34a)'
                                                            : pct > 60
                                                                ? 'linear-gradient(180deg, #3b82f6, #2563eb)'
                                                                : 'rgba(59,130,246,0.35)',
                                                        transition: 'height 0.6s ease',
                                                        boxShadow: isNow ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
                                                    }} />
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* Hour labels (every 4h) */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>
                                        {[0, 4, 8, 12, 16, 20, 23].map(h => (
                                            <span key={h}>{h}:00</span>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: '14px', fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', gap: '16px' }}>
                                        <span>📊 Total today: <strong style={{ color: 'var(--text-primary)' }}>{data.hourlyViews.reduce((a, b) => a + b, 0).toLocaleString()}</strong> views</span>
                                        <span>🟢 Now: <strong style={{ color: '#22c55e' }}>{data.hourlyViews[new Date().getHours()] || 0}</strong></span>
                                    </div>
                                </>
                            )
                        })()}
                    </div>
                </div>

                {/* close data guard */}
                </>) }

                {/* ══════════════════════════════════════════════
                    SESSION EXPLORER MODAL (full journey)
                ══════════════════════════════════════════════ */}
                {sessionModal && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }} onClick={() => setSessionModal(null)}>
                        <div style={{
                            ...card,
                            maxWidth: '680px', width: '100%', maxHeight: '85vh',
                            overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
                            animation: 'viSlideIn 0.2s ease',
                        }} onClick={e => e.stopPropagation()}>

                            {/* Modal header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '0.62rem', color: '#60a5fa', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
                                        Session Explorer
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                                        {sessionModal.sid}
                                    </div>
                                </div>
                                <button onClick={() => setSessionModal(null)} style={{
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-tertiary)', cursor: 'pointer', borderRadius: '8px',
                                    width: '32px', height: '32px', fontSize: '1rem', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                }}>✕</button>
                            </div>

                            {sessionLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                                    <div className="loading-spinner" style={{ margin: '0 auto 10px' }} />
                                    Loading session journey...
                                </div>
                            ) : sessionModal.data ? (() => {
                                const s = sessionModal.data
                                const summary = s.summary
                                const user = s.user
                                const pages = s.pageViews || []

                                return (
                                    <>
                                        {/* Identity block */}
                                        <div style={{
                                            padding: '14px', borderRadius: '12px',
                                            background: user ? 'rgba(34,197,94,0.06)' : 'rgba(96,165,250,0.06)',
                                            border: `1px solid ${user ? 'rgba(34,197,94,0.2)' : 'rgba(96,165,250,0.2)'}`,
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                        }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                                                background: user ? 'rgba(34,197,94,0.15)' : 'rgba(96,165,250,0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1rem',
                                            }}>
                                                {user ? user.name?.charAt(0)?.toUpperCase() || '?' : '👻'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                                    {user ? user.name : 'Anonymous Session'}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                                    {user ? `${user.email} · ${user.role}` : 'Not logged in during this session'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Summary stats */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                            {[
                                                { label: 'Pages', value: summary.totalPages, color: '#3b82f6' },
                                                { label: 'Duration', value: formatDuration(summary.totalDurationMs), color: '#8b5cf6' },
                                                { label: 'Entry', value: summary.entryPage || '—', color: '#f59e0b', small: true },
                                                { label: 'Exit', value: summary.exitPage || '—', color: '#ef4444', small: true },
                                            ].map(stat => (
                                                <div key={stat.label} style={{
                                                    padding: '10px 12px', borderRadius: '10px',
                                                    background: stat.color + '10', border: `1px solid ${stat.color}25`,
                                                    textAlign: 'center',
                                                }}>
                                                    <div style={{
                                                        fontSize: stat.small ? '0.6rem' : '1.1rem',
                                                        fontWeight: 800, color: stat.color,
                                                        fontFamily: stat.small ? 'monospace' : undefined,
                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                    }} title={String(stat.value)}>{stat.value}</div>
                                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Journey timeline */}
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                            Journey ({pages.length} steps)
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {pages.map((pv: any, i: number) => (
                                                <div key={pv.id} style={{
                                                    display: 'grid', gridTemplateColumns: '20px 1fr 80px 70px',
                                                    alignItems: 'center', gap: '10px',
                                                    padding: '8px 12px', borderRadius: '8px',
                                                    background: i === 0 ? 'rgba(34,197,94,0.06)' : i === pages.length - 1 ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.15)' : i === pages.length - 1 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)'}`,
                                                }}>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', fontWeight: 700, textAlign: 'center' }}>
                                                        {i === 0 ? '🟢' : i === pages.length - 1 ? '🔴' : <span style={{ color: 'rgba(255,255,255,0.3)' }}>{i + 1}</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {pv.path}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: '#60a5fa', textAlign: 'center', fontFamily: 'monospace' }}>
                                                        {formatDuration(pv.durationMs)}
                                                    </div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                                                        {mounted ? getRelativeTime(pv.createdAt) : '—'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* GDPR Delete */}
                                        <div style={{
                                            padding: '12px 14px', borderRadius: '10px',
                                            background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>GDPR — Erase Session Data</div>
                                                <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                                    Permanently deletes all {pages.length} PageView records for this session
                                                </div>
                                            </div>
                                            <button onClick={async () => {
                                                if (!confirm('Delete all analytics data for this session? This cannot be undone.')) return
                                                const res = await fetch('/api/admin/visitor-intelligence', {
                                                    method: 'DELETE',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ sessionId: sessionModal.sid }),
                                                })
                                                if (res.ok) { setSessionModal(null); fetchData() }
                                            }} style={{
                                                padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                                                background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                            }}>🗑 Erase</button>
                                        </div>
                                    </>
                                )
                            })() : (
                                <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>No session data found</div>
                            )}
                        </div>
                    </div>
                )}

            </main>
        </div>
    )
}
