'use client'
import { useState, useEffect, useCallback } from 'react'

interface LogRecord {
    id: string; to: string; subject: string; type: string; transport: string
    success: boolean; error: string | null; bounceCategory: string | null
    sentAt: string; openedAt: string | null
}

const statusBadge = (success: boolean) => ({
    display: 'inline-block', fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
    background: success ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
    color: success ? '#34d399' : '#ef4444', textTransform: 'uppercase' as const
})

const bounceBadge = (cat: string) => {
    const c: Record<string, string> = { hard_bounce: '#dc2626', soft_bounce: '#f59e0b', complaint: '#dc2626', throttle: '#60a5fa' }
    return { display: 'inline-block', fontSize: '0.58rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: `${c[cat] || '#666'}15`, color: c[cat] || '#666', textTransform: 'uppercase' as const, marginLeft: '4px' }
}

export default function EmailLogTab() {
    const [records, setRecords] = useState<LogRecord[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusF, setStatusF] = useState('all')
    const [typeF, setTypeF] = useState('')
    const [transportF, setTransportF] = useState('')
    const [bounceF, setBounceF] = useState('')

    const load = useCallback(() => {
        setLoading(true)
        const p = new URLSearchParams({ logPage: String(page), logLimit: '30', tz: String(new Date().getTimezoneOffset()) })
        if (search) p.set('logSearch', search)
        if (statusF !== 'all') p.set('logStatus', statusF)
        if (typeF) p.set('logFilter', typeF)
        if (transportF) p.set('logTransport', transportF)
        if (bounceF) p.set('logBounce', bounceF)
        fetch(`/api/admin/email-analytics?${p}`)
            .then(r => r.json())
            .then(d => {
                const log = d.emailLog
                setRecords(log.records); setTotal(log.total); setTotalPages(log.totalPages)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [page, search, statusF, typeF, transportF, bounceF])

    useEffect(() => { load() }, [load])

    const sel = { padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.78rem' }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input placeholder="Search recipient..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                    style={{ ...sel, flex: 1, minWidth: '160px' }} />
                <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={sel}>
                    <option value="all">All Status</option>
                    <option value="success">✅ Delivered</option>
                    <option value="failed">❌ Failed</option>
                </select>
                <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1) }} style={sel}>
                    <option value="">All Types</option>
                    {['authentication','application','notification','subscribe','general'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={transportF} onChange={e => { setTransportF(e.target.value); setPage(1) }} style={sel}>
                    <option value="">All Transports</option>
                    {['graph','smtp','acs','unknown'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={bounceF} onChange={e => { setBounceF(e.target.value); setPage(1) }} style={sel}>
                    <option value="">All Bounces</option>
                    {['hard_bounce','soft_bounce','complaint','throttle'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Showing {records.length} of {total} logs</div>

            {loading && <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>Loading…</div>}

            {!loading && records.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>No email logs match your filters.</div>}

            {!loading && records.map(r => (
                <div key={r.id} style={{ padding: '10px 14px', borderRadius: '10px', background: r.success ? 'var(--bg-secondary)' : 'rgba(239,68,68,0.03)', border: `1px solid ${r.success ? 'var(--border-subtle)' : 'rgba(239,68,68,0.1)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{r.to}</span>
                            <span style={statusBadge(r.success)}>{r.success ? 'delivered' : 'failed'}</span>
                            {r.bounceCategory && <span style={bounceBadge(r.bounceCategory)}>{r.bounceCategory}</span>}
                            {r.openedAt && <span style={{ fontSize: '0.6rem', color: '#c084fc' }}>👁 opened</span>}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{new Date(r.sentAt).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.subject}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '3px', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                        <span>{r.type}</span>
                        <span>via {r.transport}</span>
                    </div>
                    {r.error && <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: '4px', wordBreak: 'break-all' }}>{r.error.slice(0, 300)}</div>}
                </div>
            ))}

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>← Prev</button>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>{page}/{totalPages} ({total})</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>Next →</button>
                </div>
            )}
        </div>
    )
}
