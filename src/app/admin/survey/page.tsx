'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

interface CategoryBreakdown {
    key: string
    label: string
    count: number
    percentage: number
}

interface FreeTextItem {
    id: string
    text: string
    createdAt: string
    country: string | null
    flagged: boolean
}

interface RecentResponse {
    email: string | null
    selections: string[]
    country: string | null
    createdAt: string
    flagged: boolean
}

interface SurveyData {
    totalResponses: number
    responsesLast24h: number
    conversionRate: number
    convertedCount: number
    categoryBreakdown: CategoryBreakdown[]
    freeTextResponses: FreeTextItem[]
    freeTextTotal: number
    freeTextFlaggedCount: number
    recentResponses: RecentResponse[]
    recentTotal: number
    surveyId: string | null
}

function countryFlag(code: string | null): string {
    if (!code || code.length !== 2) return '🌍'
    const offset = 0x1F1E6
    return String.fromCodePoint(
        code.charCodeAt(0) - 65 + offset,
        code.charCodeAt(1) - 65 + offset
    )
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export default function AdminSurveyPage() {
    const [data, setData] = useState<SurveyData | null>(null)
    const [loading, setLoading] = useState(true)

    // Free text pagination + filter
    const [ftPage, setFtPage] = useState(1)
    const [ftFilter, setFtFilter] = useState<'all' | 'flagged' | 'clean'>('all')
    const [ftItems, setFtItems] = useState<FreeTextItem[]>([])
    const [ftTotal, setFtTotal] = useState(0)
    const [ftFlaggedCount, setFtFlaggedCount] = useState(0)
    const [ftLoading, setFtLoading] = useState(false)

    // Recent responses pagination
    const [rrPage, setRrPage] = useState(1)

    // Send state
    const [sending, setSending] = useState(false)
    const [sendProgress, setSendProgress] = useState<{ queued: number; total: number } | null>(null)
    const [sendResult, setSendResult] = useState<string | null>(null)
    const [testEmail, setTestEmail] = useState('')

    const abortRef = useRef<AbortController | null>(null)

    const fetchData = useCallback(async (rrP = 1) => {
        try {
            const params = new URLSearchParams({ rrPage: String(rrP) })
            const res = await fetch(`/api/admin/survey?${params}`)
            if (res.ok) {
                const json = await res.json()
                setData(json)
                setFtItems(json.freeTextResponses)
                setFtTotal(json.freeTextTotal)
                setFtFlaggedCount(json.freeTextFlaggedCount)
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [])

    const fetchFreeText = useCallback(async (page: number, filter: string) => {
        setFtLoading(true)
        try {
            const params = new URLSearchParams({ ftPage: String(page), ftFilter: filter })
            const res = await fetch(`/api/admin/survey?${params}`)
            if (res.ok) {
                const json = await res.json()
                if (page === 1) {
                    setFtItems(json.freeTextResponses)
                } else {
                    setFtItems(prev => [...prev, ...json.freeTextResponses])
                }
                setFtTotal(json.freeTextTotal)
                setFtFlaggedCount(json.freeTextFlaggedCount)
            }
        } catch { /* ignore */ }
        finally { setFtLoading(false) }
    }, [])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchData() }, [fetchData])

    const handleFtFilterChange = (filter: 'all' | 'flagged' | 'clean') => {
        setFtFilter(filter)
        setFtPage(1)
        fetchFreeText(1, filter)
    }

    const handleLoadMoreFt = () => {
        const next = ftPage + 1
        setFtPage(next)
        fetchFreeText(next, ftFilter)
    }

    const handleRrPageChange = (page: number) => {
        setRrPage(page)
        fetchData(page)
    }

    // ── Delete flagged free text ──
    const handleDeleteFreeText = async (id: string) => {
        try {
            const res = await fetch('/api/admin/survey', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            if (res.ok) {
                setFtItems(prev => prev.filter(item => item.id !== id))
                setFtTotal(prev => prev - 1)
            }
        } catch { /* ignore */ }
    }

    // ── Toggle flag ──
    const handleToggleFlag = async (id: string, flagged: boolean) => {
        try {
            const res = await fetch('/api/admin/survey', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, flagged }),
            })
            if (res.ok) {
                setFtItems(prev => prev.map(item => item.id === id ? { ...item, flagged } : item))
                setFtFlaggedCount(prev => flagged ? prev + 1 : prev - 1)
            }
        } catch { /* ignore */ }
    }

    // ── Send survey with SSE progress ──
    const handleSendSurvey = async (test?: boolean) => {
        setSending(true)
        setSendResult(null)
        setSendProgress(null)

        try {
            if (test && testEmail) {
                const res = await fetch('/api/admin/survey/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ testEmail }),
                })
                const json = await res.json()
                setSendResult(res.ok ? `✅ Test email queued to ${testEmail}` : `❌ ${json.error}`)
                setSending(false)
                return
            }

            // Full send — use SSE
            const abort = new AbortController()
            abortRef.current = abort

            const res = await fetch('/api/admin/survey/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
                signal: abort.signal,
            })

            if (!res.ok) {
                const json = await res.json().catch(() => ({ error: 'Send failed' }))
                setSendResult(`❌ ${json.error}${json.lastSentAt ? ` (last sent: ${new Date(json.lastSentAt).toLocaleDateString()})` : ''}`)
                setSending(false)
                return
            }

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            if (!reader) {
                setSendResult('❌ No response stream')
                setSending(false)
                return
            }

            let buffer = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6))
                            if (event.type === 'progress') {
                                setSendProgress({ queued: event.queued, total: event.total })
                            } else if (event.type === 'done') {
                                setSendResult(`✅ Survey sent to ${event.queued} subscribers`)
                                setSendProgress(null)
                                fetchData()
                            } else if (event.type === 'error') {
                                setSendResult(`❌ Error after ${event.queued} queued: ${event.error}`)
                                setSendProgress(null)
                            }
                        } catch { /* ignore parse errors */ }
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                setSendResult('❌ Network error')
            }
        } finally {
            setSending(false)
            abortRef.current = null
        }
    }

    const handleExport = () => {
        window.open('/api/admin/survey/export', '_blank')
    }

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-main">
                    <div style={styles.page}>
                        <div className="loading-spinner" style={{ margin: '60px auto', width: 28, height: 28 }} />
                    </div>
                </main>
            </div>
        )
    }

    const rrPerPage = 50
    const rrTotalPages = Math.ceil((data?.recentTotal ?? 0) / rrPerPage)
    const maxBar = Math.max(...(data?.categoryBreakdown.map(c => c.percentage) || [1]))
    const ftHasMore = ftItems.length < ftTotal

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                <div style={styles.page}>
                    {/* ── Header ── */}
                    <div className="admin-header">
                        <h1 className="admin-page-title">📊 Audience Survey</h1>
                        <button onClick={handleExport} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
                            ⬇️ Export CSV
                        </button>
                    </div>

                    {/* ── Metric Cards ── */}
                    <div style={styles.metricsRow}>
                        {[
                            { value: data?.totalResponses ?? 0, label: 'Total Responses', color: '#d4a853' },
                            { value: data?.responsesLast24h ?? 0, label: 'Last 24 Hours', color: '#10b981' },
                            { value: `${data?.convertedCount ?? 0}`, label: 'Converted to Users', color: '#8b5cf6', suffix: ` (${data?.conversionRate ?? 0}%)` },
                        ].map(m => (
                            <div key={m.label} className="admin-card" style={{ padding: '20px 24px', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: m.color }}>
                                    {m.value}
                                    {m.suffix && <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{m.suffix}</span>}
                                </div>
                                <div style={styles.metricLabel}>{m.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Category Breakdown ── */}
                    <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                        <h2 style={styles.sectionTitle}>Category Breakdown</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data?.categoryBreakdown.map(cat => (
                                <div key={cat.key} style={styles.barRow}>
                                    <div style={styles.barLabel}>{cat.label}</div>
                                    <div style={styles.barTrack}>
                                        <div style={{
                                            ...styles.barFill,
                                            width: `${maxBar > 0 ? (cat.percentage / maxBar) * 100 : 0}%`,
                                        }} />
                                    </div>
                                    <div style={styles.barValue}>{cat.count} ({cat.percentage}%)</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Open Responses ── */}
                    <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>
                                Open Responses
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 8 }}>
                                    {ftTotal} total{ftFlaggedCount > 0 && ` · ${ftFlaggedCount} flagged`}
                                </span>
                            </h2>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {(['all', 'flagged', 'clean'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => handleFtFilterChange(f)}
                                        style={{
                                            padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            background: ftFilter === f ? (f === 'flagged' ? 'rgba(234,179,8,0.12)' : 'rgba(212,168,83,0.1)') : 'transparent',
                                            border: `1px solid ${ftFilter === f ? (f === 'flagged' ? 'rgba(234,179,8,0.3)' : 'rgba(212,168,83,0.2)') : 'var(--border-subtle)'}`,
                                            color: ftFilter === f ? (f === 'flagged' ? '#eab308' : 'var(--accent-gold)') : 'var(--text-tertiary)',
                                        }}
                                    >
                                        {f === 'flagged' ? `🚩 Flagged (${ftFlaggedCount})` : f === 'clean' ? '✓ Clean' : 'All'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {ftItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                                {ftFilter === 'flagged' ? 'No flagged responses' : 'No open responses yet'}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {ftItems.map(item => (
                                    <div key={item.id} style={{
                                        padding: '12px 16px', borderRadius: 10,
                                        background: item.flagged ? 'rgba(234,179,8,0.04)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${item.flagged ? 'rgba(234,179,8,0.15)' : 'var(--border-subtle)'}`,
                                        display: 'flex', gap: 12, alignItems: 'flex-start',
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                                                {item.flagged && <span style={{ marginRight: 6 }}>🚩</span>}
                                                &ldquo;{item.text}&rdquo;
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                                {countryFlag(item.country)} {item.country || '??'} &bull; {timeAgo(item.createdAt)}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                            <button
                                                onClick={() => handleToggleFlag(item.id, !item.flagged)}
                                                title={item.flagged ? 'Unflag' : 'Flag'}
                                                style={styles.iconBtn}
                                            >
                                                {item.flagged ? '✓' : '🚩'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFreeText(item.id)}
                                                title="Remove text"
                                                style={{ ...styles.iconBtn, color: '#ef4444' }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {ftHasMore && (
                            <button
                                onClick={handleLoadMoreFt}
                                disabled={ftLoading}
                                style={{
                                    display: 'block', margin: '16px auto 0', padding: '8px 28px',
                                    borderRadius: 8, fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)', transition: 'all 0.15s',
                                }}
                            >
                                {ftLoading ? 'Loading...' : `Load more (${ftItems.length} of ${ftTotal})`}
                            </button>
                        )}
                    </div>

                    {/* ── Recent Responses Table ── */}
                    <div className="admin-card" style={{ overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>
                                Recent Responses
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 8 }}>
                                    {data?.recentTotal ?? 0} total
                                </span>
                            </h2>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    {['Time', 'Email', 'Selections', 'Country', ''].map(h => (
                                        <th key={h} style={styles.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data?.recentResponses.map((r, i) => (
                                    <tr key={i} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        background: r.flagged ? 'rgba(234,179,8,0.03)' : undefined,
                                    }}>
                                        <td style={styles.td}>{timeAgo(r.createdAt)}</td>
                                        <td style={styles.td}>{r.email || '—'}</td>
                                        <td style={styles.td}>{r.selections.join(', ')}</td>
                                        <td style={styles.td}>{countryFlag(r.country)} {r.country || '—'}</td>
                                        <td style={styles.td}>{r.flagged && <span title="Flagged">🚩</span>}</td>
                                    </tr>
                                ))}
                                {(!data?.recentResponses || data.recentResponses.length === 0) && (
                                    <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center' }}>No responses yet</td></tr>
                                )}
                            </tbody>
                        </table>
                        {rrTotalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '12px' }}>
                                <button
                                    disabled={rrPage <= 1}
                                    onClick={() => handleRrPageChange(rrPage - 1)}
                                    className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                                >← Prev</button>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                    Page {rrPage} of {rrTotalPages}
                                </span>
                                <button
                                    disabled={rrPage >= rrTotalPages}
                                    onClick={() => handleRrPageChange(rrPage + 1)}
                                    className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                                >Next →</button>
                            </div>
                        )}
                    </div>

                    {/* ── Send Survey Email ── */}
                    <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)', border: '1px solid rgba(212,168,83,0.15)' }}>
                        <h2 style={{ ...styles.sectionTitle, margin: '0 0 12px' }}>📬 Send Survey Email</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 6px' }}>
                            Send to all active, non-suppressed subscribers.
                        </p>
                        <p style={{ color: '#f59e0b', fontSize: '0.82rem', margin: '0 0 18px' }}>
                            ⚠️ Send the survey BEFORE the conversion campaign email.
                        </p>

                        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                            <input
                                type="email"
                                placeholder="Test email address"
                                value={testEmail}
                                onChange={e => setTestEmail(e.target.value)}
                                style={styles.testInput}
                            />
                            <button
                                onClick={() => handleSendSurvey(true)}
                                disabled={sending || !testEmail}
                                style={styles.testBtn}
                            >
                                Preview Email
                            </button>
                        </div>

                        <button
                            onClick={() => handleSendSurvey(false)}
                            disabled={sending}
                            style={{
                                width: '100%', padding: '12px 24px',
                                background: sending ? 'rgba(212,168,83,0.3)' : 'var(--accent-gold, #c9a84c)',
                                color: '#0f1115', border: 'none', borderRadius: 8,
                                fontSize: '0.95rem', fontWeight: 700,
                                cursor: sending ? 'not-allowed' : 'pointer',
                                opacity: sending ? 0.7 : 1, transition: 'all 0.15s',
                            }}
                        >
                            {sending ? 'Sending...' : 'Send Survey Email to All Subscribers'}
                        </button>

                        {/* ── Progress bar ── */}
                        {sendProgress && (
                            <div style={{ marginTop: 14 }}>
                                <div style={{
                                    height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)',
                                    overflow: 'hidden', marginBottom: 6,
                                }}>
                                    <div style={{
                                        height: '100%', borderRadius: 4,
                                        background: 'linear-gradient(90deg, #c9a84c, #e8c36a)',
                                        width: `${sendProgress.total > 0 ? (sendProgress.queued / sendProgress.total) * 100 : 0}%`,
                                        transition: 'width 0.3s ease',
                                    }} />
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                    Sending... {sendProgress.queued.toLocaleString()} / {sendProgress.total.toLocaleString()}
                                </div>
                            </div>
                        )}

                        {sendResult && (
                            <p style={{ marginTop: 12, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                {sendResult}
                            </p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        padding: '24px 32px',
        maxWidth: 1100,
    },
    metricsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-lg)',
    },
    metricLabel: {
        fontSize: '0.72rem',
        color: 'var(--text-tertiary)',
        marginTop: 4,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        margin: '0 0 16px',
    },
    barRow: {
        display: 'grid',
        gridTemplateColumns: '160px 1fr 100px',
        alignItems: 'center',
        gap: 12,
    },
    barLabel: {
        fontSize: '0.82rem',
        color: 'var(--text-primary)',
        fontWeight: 500,
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    barTrack: {
        height: 18,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 6,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #c9a84c, #e8c36a)',
        borderRadius: 6,
        transition: 'width 0.5s ease',
        minWidth: 2,
    },
    barValue: {
        fontSize: '0.78rem',
        color: 'var(--text-secondary)',
        textAlign: 'right' as const,
        whiteSpace: 'nowrap' as const,
    },
    th: {
        textAlign: 'left' as const,
        padding: '10px 14px',
        color: 'var(--text-tertiary)',
        fontWeight: 700,
        fontSize: '0.65rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
    },
    td: {
        padding: '10px 14px',
        color: 'var(--text-primary)',
        fontSize: '0.82rem',
    },
    iconBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.78rem',
        padding: '4px 6px',
        borderRadius: 4,
        color: 'var(--text-tertiary)',
        transition: 'opacity 0.15s',
    },
    testInput: {
        flex: 1,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        color: 'var(--text-primary)',
        fontSize: '0.88rem',
        outline: 'none',
    },
    testBtn: {
        padding: '10px 20px',
        background: 'transparent',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        color: 'var(--accent-gold)',
        fontSize: '0.82rem',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
    },
}
