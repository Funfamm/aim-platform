'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { SurveyData, FreeTextItem, timeAgo, countryFlag } from '../survey/types'
import { MetricCards, CategoryBreakdownChart, ConversionFunnel, GenreConversion, GeographicStats, ResponseTimeline, PeakHoursChart, ModerationSummary, DeliveryTracker } from '../survey/sections'

export default function SurveyResultsTab() {
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
        } catch {}
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
        } catch {}
        finally { setFtLoading(false) }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => {
        const interval = setInterval(() => { fetchData(rrPage) }, 60000)
        return () => clearInterval(interval)
    }, [fetchData, rrPage])

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

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><div className="loading-spinner" style={{ margin: '0 auto', width: 28, height: 28 }} /></div>
    if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No active survey found.</div>

    const rrPerPage = 50
    const rrTotalPages = Math.ceil((data.recentTotal ?? 0) / rrPerPage)
    const ftHasMore = ftItems.length < ftTotal
    const ftCleanCount = ftTotal - ftFlaggedCount

    return (
        <div style={{ maxWidth: 1100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>📊 Survey Results</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleRefresh} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>{refreshing ? '⏳' : '🔄'} Refresh</button>
                    <button onClick={() => window.open('/api/admin/survey/export', '_blank')} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>⬇️ Export</button>
                </div>
            </div>

            <DeliveryTracker d={data} />
            <MetricCards d={data} />
            <CategoryBreakdownChart d={data} />
            <ConversionFunnel d={data} />
            <GenreConversion d={data} />
            <GeographicStats d={data} />
            <ResponseTimeline d={data} />
            <PeakHoursChart d={data} />
            <ModerationSummary d={data} onFilter={() => { handleFtFilter('flagged'); ftRef.current?.scrollIntoView({ behavior: 'smooth' }) }} />

            {/* Written Comments */}
            <div ref={ftRef} className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px' }}>✍️ Written Comments</h2>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                    {([['all', `All (${ftTotal})`], ['clean', `Clean (${ftCleanCount})`], ['flagged', `Flagged 🚩 (${ftFlaggedCount})`], ['converted', `Converted ✅ (${ftConvertedCount})`]] as const).map(([key, label]) => (
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
                            <div key={item.id} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${item.flagged ? '#f59e0b' : item.converted ? '#10b981' : 'transparent'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.4 }}>&ldquo;{item.text}&rdquo;</p>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', gap: 8 }}>
                                        {item.country && <span>{countryFlag(item.country)} {item.country}</span>}
                                        <span>{timeAgo(item.createdAt)}</span>
                                        {item.flagged && <span style={{ color: '#f59e0b' }}>🚩 Flagged</span>}
                                        {item.converted && <span style={{ color: '#10b981' }}>✅ Converted</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => handleToggleFlag(item.id, !item.flagged)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 4, opacity: 0.6 }}>{item.flagged ? '✓' : '🚩'}</button>
                                    <button onClick={() => handleDeleteFt(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 4, color: '#ef4444', opacity: 0.6 }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {ftHasMore && (
                    <button onClick={handleLoadMoreFt} disabled={ftLoading} style={{ display: 'block', margin: '14px auto 0', padding: '7px 24px', borderRadius: 8, fontSize: '0.78rem', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        {ftLoading ? 'Loading...' : `Load more (${ftItems.length} of ${ftTotal})`}
                    </button>
                )}
            </div>

            {/* Recent Responses */}
            <div className="admin-card" style={{ overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recent Responses <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>{data.recentTotal} total</span></h2>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Time', 'Email', 'Selections', 'Country', 'Conv.', ''].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                        {data.recentResponses.map(r => (
                            <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
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
        </div>
    )
}
