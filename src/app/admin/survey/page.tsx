'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { SurveyData, FreeTextItem, timeAgo, countryFlag } from './types'
import { MetricCards, CategoryBreakdownChart, ConversionFunnel, GenreConversion, GeographicStats, ResponseTimeline, PeakHoursChart, ModerationSummary, DeliveryTracker } from './sections'

export default function AdminSurveyPage() {
    const [data, setData] = useState<SurveyData | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const [ftPage, setFtPage] = useState(1)
    const [ftFilter, setFtFilter] = useState<'all' | 'flagged' | 'clean' | 'converted'>('all')
    const [ftItems, setFtItems] = useState<FreeTextItem[]>([])
    const [ftTotal, setFtTotal] = useState(0)
    const [ftFlaggedCount, setFtFlaggedCount] = useState(0)
    const [ftConvertedCount, setFtConvertedCount] = useState(0)
    const [ftLoading, setFtLoading] = useState(false)
    const [rrPage, setRrPage] = useState(1)

    const [sending, setSending] = useState(false)
    const [sendProgress, setSendProgress] = useState<{ queued: number; total: number } | null>(null)
    const [sendResult, setSendResult] = useState<string | null>(null)
    const [testEmail, setTestEmail] = useState('')
    const abortRef = useRef<AbortController | null>(null)
    const ftRef = useRef<HTMLDivElement | null>(null)

    const fetchData = useCallback(async (rrP = 1) => {
        try {
            const res = await fetch(`/api/admin/survey?rrPage=${rrP}`)
            if (res.ok) {
                const json = await res.json()
                if (json.empty) { setData(null); return }
                setData(json)
                setFtItems(json.freeTextResponses)
                setFtTotal(json.freeTextTotal)
                setFtFlaggedCount(json.freeTextFlaggedCount)
                setFtConvertedCount(json.freeTextConvertedCount || 0)
            }
        } catch { /* */ }
        finally { setLoading(false); setRefreshing(false) }
    }, [])

    const fetchFreeText = useCallback(async (page: number, filter: string) => {
        setFtLoading(true)
        try {
            const res = await fetch(`/api/admin/survey?ftPage=${page}&ftFilter=${filter}`)
            if (res.ok) {
                const json = await res.json()
                if (page === 1) setFtItems(json.freeTextResponses)
                else setFtItems(prev => [...prev, ...json.freeTextResponses])
                setFtTotal(json.freeTextTotal)
                setFtFlaggedCount(json.freeTextFlaggedCount)
                setFtConvertedCount(json.freeTextConvertedCount || 0)
            }
        } catch { /* */ }
        finally { setFtLoading(false) }
    }, [])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchData() }, [fetchData])

    // Auto-refresh every 60s + delivery poll every 10s when active
    useEffect(() => {
        const interval = setInterval(() => { fetchData(rrPage) }, 60000)
        return () => clearInterval(interval)
    }, [fetchData, rrPage])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        const d = data?.delivery
        if (!d || d.total === 0) return
        if (d.pending <= 0 && d.processing <= 0) return
        const interval = setInterval(() => { fetchData(rrPage) }, 10000)
        return () => clearInterval(interval)
    }, [data?.delivery, fetchData, rrPage])

    const handleRefresh = () => { setRefreshing(true); fetchData(rrPage) }
    const handleFtFilter = (f: 'all' | 'flagged' | 'clean' | 'converted') => { setFtFilter(f); setFtPage(1); fetchFreeText(1, f) }
    const handleLoadMoreFt = () => { const n = ftPage + 1; setFtPage(n); fetchFreeText(n, ftFilter) }
    const handleRrPage = (p: number) => { setRrPage(p); fetchData(p) }

    const handleDeleteFt = async (id: string) => {
        const res = await fetch('/api/admin/survey', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
        if (res.ok) { setFtItems(p => p.filter(i => i.id !== id)); setFtTotal(p => p - 1) }
    }
    const handleToggleFlag = async (id: string, flagged: boolean) => {
        const res = await fetch('/api/admin/survey', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, flagged }) })
        if (res.ok) {
            setFtItems(p => p.map(i => i.id === id ? { ...i, flagged } : i))
            setFtFlaggedCount(p => flagged ? p + 1 : p - 1)
        }
    }

    const handleSend = async (test?: boolean) => {
        setSending(true); setSendResult(null); setSendProgress(null)
        try {
            if (test && testEmail) {
                const res = await fetch('/api/admin/survey/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testEmail }) })
                const json = await res.json()
                setSendResult(res.ok ? `✅ Test email queued to ${testEmail}` : `❌ ${json.error}`)
                setSending(false); return
            }
            const abort = new AbortController(); abortRef.current = abort
            const res = await fetch('/api/admin/survey/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), signal: abort.signal })
            if (!res.ok) {
                const json = await res.json().catch(() => ({ error: 'Send failed' }))
                setSendResult(`❌ ${json.error}${json.lastSentAt ? ` (last sent: ${new Date(json.lastSentAt).toLocaleDateString()})` : ''}`)
                setSending(false); return
            }
            const reader = res.body?.getReader(); const decoder = new TextDecoder()
            if (!reader) { setSendResult('❌ No stream'); setSending(false); return }
            let buffer = ''
            while (true) {
                const { done, value } = await reader.read(); if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n'); buffer = lines.pop() || ''
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const ev = JSON.parse(line.slice(6))
                            if (ev.type === 'progress') setSendProgress({ queued: ev.queued, total: ev.total })
                            else if (ev.type === 'done') { setSendResult(`✅ Survey sent to ${ev.queued} subscribers`); setSendProgress(null); fetchData() }
                            else if (ev.type === 'error') { setSendResult(`❌ Error: ${ev.error}`); setSendProgress(null) }
                        } catch { /* */ }
                    }
                }
            }
        } catch (err) { if (err instanceof Error && err.name !== 'AbortError') setSendResult('❌ Network error') }
        finally { setSending(false); abortRef.current = null }
    }

    if (loading) return (
        <div className="admin-layout"><AdminSidebar /><main className="admin-main">
            <div style={{ padding: '24px 32px' }}><div className="loading-spinner" style={{ margin: '60px auto', width: 28, height: 28 }} /></div>
        </main></div>
    )

    if (!data) return (
        <div className="admin-layout"><AdminSidebar /><main className="admin-main">
            <div style={{ padding: '24px 32px' }}><p style={{ color: 'var(--text-secondary)' }}>No active survey found.</p></div>
        </main></div>
    )

    const rrPerPage = 50
    const rrTotalPages = Math.ceil((data.recentTotal ?? 0) / rrPerPage)
    const ftHasMore = ftItems.length < ftTotal
    const ftCleanCount = ftTotal - ftFlaggedCount
    const campaignActive = data.delivery && (data.delivery.pending > 0 || data.delivery.processing > 0)

    return (
        <div className="admin-layout"><AdminSidebar /><main className="admin-main"><div style={{ padding: '24px 32px', maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 className="admin-page-title" style={{ margin: 0 }}>📊 Audience Survey</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleRefresh} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
                        {refreshing ? '⏳' : '🔄'} Refresh
                    </button>
                    <button onClick={() => window.open('/api/admin/survey/export', '_blank')} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>⬇️ Export CSV</button>
                </div>
            </div>

            {/* S12: Delivery Tracker — at top when campaign is active */}
            <DeliveryTracker d={data} />

            {/* S1: Metrics */}
            <MetricCards d={data} />
            {/* S2: Categories */}
            <CategoryBreakdownChart d={data} />
            {/* S3: Funnel */}
            <ConversionFunnel d={data} />
            {/* S4: Genre Conversion */}
            <GenreConversion d={data} />
            {/* S5: Geographic */}
            <GeographicStats d={data} />
            {/* S6: Timeline */}
            <ResponseTimeline d={data} />
            {/* S7: Peak Hours */}
            <PeakHoursChart d={data} />

            {/* S10: Moderation */}
            <ModerationSummary d={data} onFilter={() => { handleFtFilter('flagged'); ftRef.current?.scrollIntoView({ behavior: 'smooth' }) }} />

            {/* S8: Written Comments */}
            <div ref={ftRef} className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>✍️ Written Comments</h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>Only responses that included a written comment appear here</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                    {([
                        ['all', `All (${ftTotal})`],
                        ['clean', `Clean (${ftCleanCount})`],
                        ['flagged', `Flagged 🚩 (${ftFlaggedCount})`],
                        ['converted', `Converted ✅ (${ftConvertedCount})`],
                    ] as const).map(([key, label]) => (
                        <button key={key} onClick={() => handleFtFilter(key)} style={{
                            padding: '5px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                            background: ftFilter === key ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${ftFilter === key ? 'rgba(201,168,76,0.4)' : 'var(--border-subtle)'}`,
                            color: ftFilter === key ? '#d4a853' : 'var(--text-secondary)',
                        }}>{label}</button>
                    ))}
                </div>
                {ftItems.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>No responses in this filter.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ftItems.map(item => (
                            <div key={item.id} style={{
                                padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                                borderLeft: `3px solid ${item.flagged ? '#f59e0b' : item.converted ? '#10b981' : 'transparent'}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                            }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.4 }}>
                                        &ldquo;{item.text}&rdquo;
                                    </p>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {item.country && <span>{countryFlag(item.country)} {item.country}</span>}
                                        <span>{timeAgo(item.createdAt)}</span>
                                        {item.flagged && <span style={{ color: '#f59e0b' }}>🚩 Flagged</span>}
                                        {item.converted && <span style={{ color: '#10b981' }}>✅ Converted</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button onClick={() => handleToggleFlag(item.id, !item.flagged)} title={item.flagged ? 'Unflag' : 'Flag'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 4, opacity: 0.6 }}>
                                        {item.flagged ? '✓' : '🚩'}
                                    </button>
                                    <button onClick={() => handleDeleteFt(item.id)} title="Remove text" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 4, color: '#ef4444', opacity: 0.6 }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {ftHasMore && (
                    <button onClick={handleLoadMoreFt} disabled={ftLoading} style={{
                        display: 'block', margin: '14px auto 0', padding: '7px 24px', borderRadius: 8,
                        fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                    }}>{ftLoading ? 'Loading...' : `Load more (${ftItems.length} of ${ftTotal})`}</button>
                )}
            </div>

            {/* S9: Recent Responses Table */}
            <div className="admin-card" style={{ overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Recent Responses <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>{data.recentTotal} total</span>
                    </h2>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Time', 'Email', 'Selections', 'Country', 'Conv.', ''].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                        {data.recentResponses.map((r) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: r.flagged ? 'rgba(234,179,8,0.03)' : undefined }}>
                                <td style={{ padding: '7px 12px' }}>{timeAgo(r.createdAt)}</td>
                                <td style={{ padding: '7px 12px' }}>{r.email || '—'}</td>
                                <td style={{ padding: '7px 12px' }}>{r.selections.slice(0, 3).join(', ')}{r.selections.length > 3 ? ` +${r.selections.length - 3}` : ''}</td>
                                <td style={{ padding: '7px 12px' }}>{countryFlag(r.country)}</td>
                                <td style={{ padding: '7px 12px' }}>{r.converted ? '✅' : '—'}</td>
                                <td style={{ padding: '7px 12px' }}>{r.flagged ? '🚩' : ''}</td>
                            </tr>
                        ))}
                        {data.recentResponses.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>No responses yet</td></tr>}
                    </tbody>
                </table>
                {rrTotalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, padding: 10 }}>
                        <button disabled={rrPage <= 1} onClick={() => handleRrPage(rrPage - 1)} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '5px 12px' }}>← Prev</button>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Page {rrPage} of {rrTotalPages}</span>
                        <button disabled={rrPage >= rrTotalPages} onClick={() => handleRrPage(rrPage + 1)} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '5px 12px' }}>Next →</button>
                    </div>
                )}
            </div>

            {/* S11: Export */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                {[
                    { label: '📥 Export All as CSV', filter: 'all' },
                    { label: '📥 Export Flagged Only', filter: 'flagged' },
                    { label: '📥 Export Converted Only', filter: 'converted' },
                ].map(e => (
                    <button key={e.filter} onClick={() => window.open(`/api/admin/survey/export?filter=${e.filter}`, '_blank')} className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '8px 16px' }}>{e.label}</button>
                ))}
            </div>

            {/* S12: Delivery Tracker already at top */}

            {/* Send Survey — hidden when campaign is active */}
            {campaignActive ? (
                <div className="admin-card" style={{ padding: '18px 24px', marginBottom: 24, textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#10b981', marginBottom: 4 }}>
                        🔄 Campaign in progress — {data.delivery!.pending + data.delivery!.processing} remaining
                    </div>
                    <button onClick={() => document.querySelector('.admin-main')?.scrollTo({ top: 0, behavior: 'smooth' })} className="btn btn-ghost" style={{ fontSize: '0.78rem', marginTop: 6 }}>View Progress ↑</button>
                </div>
            ) : (
            <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24, border: '1px solid rgba(212,168,83,0.15)' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 10px', color: 'var(--text-primary)' }}>📬 Send Survey Email</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0 0 4px' }}>Send to all active, non-suppressed subscribers.</p>
                <p style={{ color: '#f59e0b', fontSize: '0.78rem', margin: '0 0 14px' }}>⚠️ Send the survey BEFORE the conversion campaign email.</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input type="email" placeholder="Test email address" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                    <button onClick={() => handleSend(true)} disabled={sending || !testEmail}
                        className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '8px 18px' }}>Preview Email</button>
                </div>
                <button onClick={() => handleSend(false)} disabled={sending} style={{
                    width: '100%', padding: '11px 20px', background: sending ? 'rgba(212,168,83,0.3)' : 'var(--accent-gold, #c9a84c)',
                    color: '#0f1115', border: 'none', borderRadius: 8, fontSize: '0.92rem', fontWeight: 700,
                    cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, transition: 'all 0.15s',
                }}>{sending ? 'Sending...' : 'Send Survey Email to All Subscribers'}</button>
                {sendProgress && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 }}>
                            <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #c9a84c, #e8c36a)', width: `${sendProgress.total > 0 ? (sendProgress.queued / sendProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Sending... {sendProgress.queued.toLocaleString()} / {sendProgress.total.toLocaleString()}</div>
                    </div>
                )}
                {sendResult && <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{sendResult}</p>}
            </div>
            )}
        </div></main></div>
    )
}
