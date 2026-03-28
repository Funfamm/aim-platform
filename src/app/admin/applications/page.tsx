'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'

// Custom dark dropdown to avoid native white popups
function DarkDropdown({ value, onChange, options, style }: {
    value: string
    onChange: (val: string) => void
    options: { value: string; label: string }[]
    style?: React.CSSProperties
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const selected = options.find(o => o.value === value)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative', ...style }}>
            <button type="button" onClick={() => setOpen(!open)} style={{
                padding: '7px 28px 7px 12px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
                cursor: 'pointer', width: '100%', textAlign: 'left', whiteSpace: 'nowrap',
            }}>
                {selected?.label || value}
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.5rem', color: 'var(--text-tertiary)' }}>▼</span>
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    marginTop: '2px', background: '#1a1d26', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    minWidth: '160px',
                }}>
                    {options.map(opt => (
                        <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }} style={{
                            display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left',
                            background: value === opt.value ? 'rgba(212,168,83,0.12)' : 'transparent',
                            border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
                            color: value === opt.value ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            transition: 'background 0.1s',
                        }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = value === opt.value ? 'rgba(212,168,83,0.12)' : 'transparent')}
                        >{opt.label}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

const NAV = [
    { href: '/admin/analytics', label: '📊 Analytics' },{ href: '/admin/projects', label: '🎬 Projects' },
    { href: '/admin/casting', label: '🎭 Casting' },{ href: '/admin/applications', label: '📋 Applications' },
    { href: '/admin/media', label: '🖼️ Page Media' },{ href: '/admin/sponsors', label: '🤝 Sponsors' },
    { href: '/admin/donations', label: '💰 Donations' },{ href: '/admin/users', label: '👥 Users' },
    { href: '/admin/scripts', label: '✍️ Scripts' },
    { href: '/admin/training', label: '🎓 Training' },
    { href: '/admin/settings', label: '⚙️ Settings' },
]

interface Application {
    id: string; fullName: string; email: string; phone: string | null
    age: string | null; gender: string | null; status: string
    aiScore: number | null; aiFitLevel: string | null
    headshotPath: string | null; selfTapePath: string | null; createdAt: string
    castingCall: { roleName: string; roleType: string; project: { title: string } }
}
interface Pagination { page: number; limit: number; total: number; totalPages: number }

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
    pending:      { label: 'Pending',      bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
    submitted:    { label: 'Submitted',    bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
    under_review: { label: 'Under Review', bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
    shortlisted:  { label: 'Shortlisted',  bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    contacted:    { label: 'Contacted',    bg: 'rgba(212,168,83,0.12)',  color: '#d4a853' },
    audition:     { label: 'Audition',     bg: 'rgba(168,85,247,0.12)',  color: '#a855f7' },
    selected:     { label: 'Selected',     bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
    rejected:     { label: 'Rejected',     bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
    approved:     { label: 'Approved',     bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
    withdrawn:    { label: 'Withdrawn',    bg: 'rgba(239,68,68,0.10)',   color: '#f87171' },
}


export default function AdminApplicationsPage() {
    const [apps, setApps] = useState<Application[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 })
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')
    const [sort, setSort] = useState('newest')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [bulkAction, setBulkAction] = useState('')
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
    // Batch audit state
    const [batchRunning, setBatchRunning] = useState(false)
    const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; results: Array<{ id: string; fullName: string; status: string; aiScore?: number; recommendation?: string; error?: string }> } | null>(null)

    const fetchApps = useCallback(async (page = 1) => {
        setLoading(true)
        const params = new URLSearchParams({ page: String(page), limit: '25', sort })
        if (search) params.set('search', search)
        if (status !== 'all') params.set('status', status)
        const res = await fetch(`/api/admin/applications?${params}`)
        if (res.ok) {
            const data = await res.json()
            setApps(data.applications); setPagination(data.pagination); setStatusCounts(data.statusCounts)
        }
        setLoading(false)
    }, [search, status, sort])

    useEffect(() => { fetchApps(1) }, [fetchApps])

    const handleSearch = (val: string) => {
        setSearch(val)
        if (searchTimeout) clearTimeout(searchTimeout)
        setSearchTimeout(setTimeout(() => fetchApps(1), 300))
    }

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const selectAll = () => {
        if (selected.size === apps.length) setSelected(new Set())
        else setSelected(new Set(apps.map(a => a.id)))
    }

    const handleBulkAction = async () => {
        if (!bulkAction || selected.size === 0) return
        if (bulkAction === 'batch_audit') {
            setBatchRunning(true)
            setBatchProgress({ total: selected.size, done: 0, results: [] })
            try {
                const res = await fetch('/api/admin/applications/batch-audit', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ applicationIds: [...selected], delaySeconds: 8 }),
                })
                if (res.ok) {
                    const data = await res.json()
                    setBatchProgress({ total: data.summary.total, done: data.summary.total, results: data.results })
                    fetchApps(pagination.page)
                } else {
                    const err = await res.json()
                    setBatchProgress(prev => prev ? { ...prev, results: [{ id: '', fullName: 'Error', status: 'error', error: err.error }] } : null)
                }
            } catch { setBatchProgress(prev => prev ? { ...prev, results: [{ id: '', fullName: 'Error', status: 'error', error: 'Network error' }] } : null) }
            finally { setBatchRunning(false); setSelected(new Set()); setBulkAction('') }
            return
        }
        if (bulkAction === 'download') {
            try {
                const res = await fetch('/api/admin/applications/download', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ applicationIds: [...selected] }),
                })
                if (!res.ok) throw new Error('Download failed')
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `AIM_Applications_${new Date().toISOString().slice(0, 10)}.zip`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            } catch (err) {
                console.error('Download error:', err)
            }
            setBulkAction('')
            return
        }
        if (bulkAction === 'delete') {
            await fetch('/api/admin/applications/bulk-delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationIds: [...selected] }),
            })
        } else {
            await fetch('/api/admin/applications/bulk-status', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationIds: [...selected], status: bulkAction }),
            })
        }
        setSelected(new Set()); setBulkAction(''); fetchApps(pagination.page)
    }

    const totalApps = Object.values(statusCounts).reduce((s, c) => s + c, 0)

    const getPhoto = (app: Application) => {
        if (!app.headshotPath) return null
        try { const photos = JSON.parse(app.headshotPath); return Array.isArray(photos) ? photos[0] : app.headshotPath } catch { return app.headshotPath }
    }

    const inp: React.CSSProperties = {
        padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
        color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
        colorScheme: 'dark',
    }

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="admin-sidebar-logo">
                    <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--accent-gold)' }}>AIM</span> Studio
                    </Link>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>Admin Panel</div>
                </div>
                <ul className="admin-sidebar-nav">
                    {NAV.map(n => <li key={n.href}><Link href={n.href} className={n.href === '/admin/applications' ? 'active' : ''}>{n.label}</Link></li>)}
                </ul>
            </aside>

            <main className="admin-main">
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 16px' }}>📋 Applications</h1>

                {/* Status Pills */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => setStatus('all')} style={{
                        padding: '5px 14px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: status === 'all' ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)',
                        color: status === 'all' ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                    }}>All ({totalApps})</button>
                    {Object.entries(statusCounts).map(([s, c]) => {
                        const st = STATUS_STYLES[s] || STATUS_STYLES.pending
                        return (
                            <button key={s} onClick={() => setStatus(s)} style={{
                                padding: '5px 14px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                                background: status === s ? st.bg : 'rgba(255,255,255,0.03)',
                                color: status === s ? st.color : 'var(--text-tertiary)',
                            }}>{st.label} ({c})</button>
                        )
                    })}
                </div>

                {/* Search + Controls */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <input style={{ ...inp, flex: 1, minWidth: '180px' }} placeholder="🔍 Search by name or email..." value={search} onChange={e => handleSearch(e.target.value)} />
                    <DarkDropdown value={sort} onChange={setSort} options={[
                        { value: 'newest', label: 'Newest First' },
                        { value: 'oldest', label: 'Oldest First' },
                        { value: 'score_high', label: 'Highest AI Score' },
                        { value: 'score_low', label: 'Lowest AI Score' },
                    ]} />
                    {selected.size > 0 && (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 700 }}>{selected.size} selected</span>
                            <DarkDropdown value={bulkAction} onChange={setBulkAction} options={[
                                { value: '', label: 'Bulk Action...' },
                                { value: 'batch_audit', label: '🤖 Batch AI Audit' },
                                { value: 'download', label: '📥 Download ZIP' },
                                { value: 'shortlisted', label: '→ Shortlist' },
                                { value: 'contacted', label: '→ Contacted' },
                                { value: 'rejected', label: '→ Reject' },
                                { value: 'delete', label: '🗑️ Delete' },
                            ]} />
                            <button onClick={handleBulkAction} disabled={!bulkAction} style={{
                                ...inp, cursor: bulkAction ? 'pointer' : 'not-allowed',
                                background: 'rgba(212,168,83,0.1)', color: 'var(--accent-gold)', fontWeight: 700,
                            }}>Apply</button>
                        </div>
                    )}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{pagination.total.toLocaleString()} result{pagination.total !== 1 ? 's' : ''}</span>
                </div>

                {/* Batch Audit Progress */}
                {batchProgress && (
                    <div style={{
                        padding: '14px', marginBottom: '12px', borderRadius: '10px',
                        background: batchRunning
                            ? 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(212,168,83,0.04))'
                            : 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))',
                        border: `1px solid ${batchRunning ? 'rgba(139,92,246,0.2)' : 'rgba(34,197,94,0.2)'}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: batchRunning ? '#a78bfa' : '#22c55e' }}>
                                {batchRunning ? '⏳ AI Batch Audit Running...' : '✓ Batch Audit Complete'}
                            </div>
                            {!batchRunning && (
                                <button onClick={() => setBatchProgress(null)} style={{
                                    background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.8rem',
                                }}>✕</button>
                            )}
                        </div>

                        {batchRunning && (
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{
                                    height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%', borderRadius: '2px',
                                        background: 'linear-gradient(90deg, #a78bfa, #d4a853)',
                                        width: '30%',
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                    }} />
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    Processing {batchProgress.total} applications with rate-limited pacing (~8s between each)...
                                </div>
                            </div>
                        )}

                        {!batchRunning && batchProgress.results.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', fontSize: '0.72rem' }}>
                                    <span style={{ color: '#22c55e', fontWeight: 700 }}>
                                        ✓ {batchProgress.results.filter(r => r.status === 'success').length} audited
                                    </span>
                                    {batchProgress.results.filter(r => r.status === 'skipped').length > 0 && (
                                        <span style={{ color: '#60a5fa' }}>
                                            ⏭ {batchProgress.results.filter(r => r.status === 'skipped').length} skipped (already audited)
                                        </span>
                                    )}
                                    {batchProgress.results.filter(r => r.status === 'error').length > 0 && (
                                        <span style={{ color: '#ef4444' }}>
                                            ✗ {batchProgress.results.filter(r => r.status === 'error').length} errors
                                        </span>
                                    )}
                                </div>

                                {/* Results List */}
                                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {batchProgress.results.map((r, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '5px 8px', borderRadius: '4px', fontSize: '0.72rem',
                                            background: r.status === 'success' ? 'rgba(34,197,94,0.04)' : r.status === 'skipped' ? 'rgba(59,130,246,0.04)' : 'rgba(239,68,68,0.04)',
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{r.fullName}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {r.status === 'success' && (
                                                    <>
                                                        <span style={{
                                                            fontWeight: 700, fontSize: '0.7rem',
                                                            color: (r.aiScore || 0) >= 75 ? '#22c55e' : (r.aiScore || 0) >= 50 ? '#f59e0b' : '#ef4444',
                                                        }}>{r.aiScore}/100</span>
                                                        <span style={{
                                                            padding: '1px 6px', fontSize: '0.58rem', fontWeight: 700, borderRadius: '3px',
                                                            background: r.recommendation === 'STRONG_FIT' ? 'rgba(34,197,94,0.12)' : r.recommendation === 'GOOD_FIT' ? 'rgba(59,130,246,0.12)' : r.recommendation === 'MODERATE' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                                                            color: r.recommendation === 'STRONG_FIT' ? '#22c55e' : r.recommendation === 'GOOD_FIT' ? '#60a5fa' : r.recommendation === 'MODERATE' ? '#f59e0b' : '#ef4444',
                                                        }}>{(r.recommendation || '').replace(/_/g, ' ')}</span>
                                                    </>
                                                )}
                                                {r.status === 'skipped' && <span style={{ fontSize: '0.65rem', color: '#60a5fa' }}>Already audited</span>}
                                                {r.status === 'error' && <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>{r.error?.slice(0, 50)}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Applications Grid */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
                ) : apps.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '2rem', opacity: 0.3, marginBottom: '8px' }}>📋</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {search ? 'No applications match your search' : 'No applications yet'}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {apps.map(app => {
                            const st = STATUS_STYLES[app.status] || STATUS_STYLES.pending
                            const photo = getPhoto(app)
                            const isWithdrawn = app.status === 'withdrawn'
                            return (
                                <div key={app.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: isWithdrawn
                                        ? 'rgba(239,68,68,0.02)'
                                        : selected.has(app.id) ? 'rgba(212,168,83,0.04)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isWithdrawn ? 'rgba(239,68,68,0.1)' : selected.has(app.id) ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.05)'}`,
                                    borderLeft: isWithdrawn ? '3px solid rgba(239,68,68,0.35)' : undefined,
                                    transition: 'all 0.15s',
                                    opacity: isWithdrawn ? 0.65 : 1,
                                }}>
                                    <input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleSelect(app.id)}
                                        style={{ cursor: 'pointer', accentColor: 'var(--accent-gold)' }} />
                                    {photo && (
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '6px', flexShrink: 0,
                                            backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            filter: isWithdrawn ? 'grayscale(0.6)' : undefined,
                                        }} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Link href={`/admin/applications/${app.id}`} style={{
                                                fontSize: '0.85rem', fontWeight: 700, textDecoration: isWithdrawn ? 'line-through' : 'none',
                                                color: isWithdrawn ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                            }}>
                                                {app.fullName}
                                            </Link>
                                            <span style={{ fontSize: '0.52rem', padding: '1px 6px', borderRadius: '3px', fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                                            {app.aiScore !== null && (
                                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: app.aiScore >= 75 ? '#22c55e' : app.aiScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                                                    AI: {app.aiScore}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', gap: '8px', marginTop: '1px' }}>
                                            <span>🎬 {app.castingCall.project.title}</span>
                                            <span>🎭 {app.castingCall.roleName}</span>
                                            <span>📧 {app.email}</span>
                                            {isWithdrawn && <span style={{ color: '#f87171', fontWeight: 600 }}>⤺ Withdrawn by user</span>}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                        {new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Select All + Pagination */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    {apps.length > 0 && (
                        <button onClick={selectAll} style={{
                            ...inp, cursor: 'pointer', fontSize: '0.7rem',
                            color: selected.size === apps.length ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                        }}>
                            {selected.size === apps.length ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                    {pagination.totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button disabled={pagination.page <= 1} onClick={() => fetchApps(pagination.page - 1)} style={{ ...inp, cursor: pagination.page > 1 ? 'pointer' : 'not-allowed', opacity: pagination.page <= 1 ? 0.3 : 1 }}>← Prev</button>
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
                                const p = start + i
                                if (p > pagination.totalPages) return null
                                return (
                                    <button key={p} onClick={() => fetchApps(p)} style={{
                                        ...inp, minWidth: '34px', textAlign: 'center', cursor: 'pointer',
                                        fontWeight: p === pagination.page ? 800 : 400,
                                        background: p === pagination.page ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)',
                                        color: p === pagination.page ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                    }}>{p}</button>
                                )
                            })}
                            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchApps(pagination.page + 1)} style={{ ...inp, cursor: pagination.page < pagination.totalPages ? 'pointer' : 'not-allowed', opacity: pagination.page >= pagination.totalPages ? 0.3 : 1 }}>Next →</button>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Page {pagination.page} of {pagination.totalPages}</span>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
