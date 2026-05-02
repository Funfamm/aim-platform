'use client'
import { useState, useEffect, useCallback } from 'react'

type HistoryItem = {
    id: string; title: string; message: string; type?: string; ctaText?: string | null
    ctaUrl?: string | null; ctaColor?: string | null; bodyHtml?: string | null
    imageUrl?: string | null; link?: string | null; translations?: string | null
    sentAt: string; recipientCount: number; audienceGroups: string | null; status: string
}

export default function HistoryTab() {
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [typeFilter, setTypeFilter] = useState<string | null>(null)
    const [fetchError, setFetchError] = useState<string | null>(null)

    const fetchHistory = useCallback((p: number, type: string | null) => {
        setLoading(true)
        setHistory([])
        setFetchError(null)
        const params = new URLSearchParams({ page: String(p) })
        if (type) params.set('type', type)
        fetch(`/api/admin/announcements?${params}`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                return r.json()
            })
            .then(data => {
                setHistory(data.announcements ?? [])
                setTotal(data.total ?? 0)
                setTotalPages(data.totalPages ?? 1)
            })
            .catch((err) => {
                setFetchError(`Failed to load history: ${err.message || 'Network error'}`)
            })
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { fetchHistory(page, typeFilter) }, [fetchHistory, page, typeFilter])

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><div className="loading-spinner" style={{ margin: '0 auto', width: 28, height: 28 }} /></div>

    if (fetchError) return (
        <div className="outreachErrorBlock">
            <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>⚠️ {fetchError}</div>
            <button onClick={() => fetchHistory(page, typeFilter)} className="outreachRetryBtn">🔄 Retry</button>
        </div>
    )

    const typeBadge = (type?: string) => {
        const t = type || 'announcement'
        const colors: Record<string, { bg: string; fg: string; icon: string }> = {
            announcement: { bg: 'rgba(212,168,83,0.1)', fg: '#d4a853', icon: '📣' },
            survey: { bg: 'rgba(59,130,246,0.1)', fg: '#60a5fa', icon: '📊' },
            campaign: { bg: 'rgba(139,92,246,0.1)', fg: '#8b5cf6', icon: '📧' },
        }
        const c = colors[t] || colors.announcement
        return (
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px', background: c.bg, color: c.fg, fontWeight: 700, textTransform: 'capitalize' }}>
                {c.icon} {t}
            </span>
        )
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>📜 Outreach History</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{total} total</span>
            </div>

            {/* Type Filter */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {([null, 'announcement', 'survey', 'campaign'] as const).map(t => (
                    <button key={t ?? 'all'} onClick={() => { setTypeFilter(t); setPage(1) }} aria-pressed={typeFilter === t}
                        className="outreachFilterPill" data-active={typeFilter === t}>
                        {t === null ? 'All' : t === 'announcement' ? '📣 Announcements' : t === 'survey' ? '📊 Surveys' : '📧 Campaigns'}
                    </button>
                ))}
            </div>

            {history.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No outreach sent yet.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {history.map(a => {
                        let groups: Record<string, boolean> = {}
                        try { groups = a.audienceGroups ? JSON.parse(a.audienceGroups) : {} } catch {}
                        const isExpanded = expandedId === a.id

                        return (
                            <div key={a.id} style={{
                                borderRadius: '10px', overflow: 'hidden',
                                background: 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isExpanded ? 'rgba(212,168,83,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                transition: 'all 0.2s',
                            }}>
                                <div
                                    style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', cursor: 'pointer' }}
                                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                                >
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {a.title} {typeBadge(a.type)}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                            {new Date(a.sentAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            {' · '}{a.recipientCount} recipients
                                            {groups.members && <span style={{ marginLeft: '6px' }}>👥</span>}
                                            {groups.subscribers && <span style={{ marginLeft: '4px' }}>📬</span>}
                                            {groups.cast && <span style={{ marginLeft: '4px' }}>🎭</span>}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px',
                                        background: a.status === 'sent' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: a.status === 'sent' ? '#34d399' : '#ef4444',
                                    }}>{a.status}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                                </div>

                                {isExpanded && (
                                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Message</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.message || '—'}</div>
                                        </div>
                                        {a.link && <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)' }}>→ {a.link}</div>}
                                        {a.ctaText && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ display: 'inline-block', padding: '8px 20px', borderRadius: '6px', background: a.ctaColor || '#c9a84c', color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
                                                    {a.ctaText}
                                                </span>
                                                {a.ctaUrl && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>→ {a.ctaUrl}</span>}
                                            </div>
                                        )}
                                        {a.bodyHtml && <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>📝 Includes rich body</div>}
                                        {a.imageUrl && <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>🖼️ Banner attached</div>}
                                        {a.translations && (() => {
                                            try { const t = JSON.parse(a.translations); const c = Object.keys(t).length; return c > 0 ? <div style={{ fontSize: '0.72rem', color: '#34d399' }}>🌐 {c} translation{c !== 1 ? 's' : ''}</div> : null } catch { return null }
                                        })()}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="outreachPagination">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="outreachPaginationBtn">← Prev</button>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="outreachPaginationBtn">Next →</button>
                </div>
            )}
        </div>
    )
}
