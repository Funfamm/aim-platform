'use client'
import { useState, useEffect, useCallback } from 'react'

interface SuppressionRecord {
    id: string; email: string; reason: string; bounceType: string | null
    source: string; detail: string | null; createdAt: string
    expiresAt: string | null; removedAt: string | null; removedBy: string | null
}

const badge = (reason: string) => {
    const colors: Record<string, string> = { hard_bounce: '#ef4444', soft_bounce: '#f59e0b', complaint: '#dc2626', manual: '#8b5cf6', unsubscribe: '#6b7280', bot: '#f59e0b' }
    return { display: 'inline-block', fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: `${colors[reason] || '#666'}22`, color: colors[reason] || '#666', textTransform: 'uppercase' as const }
}

export default function SuppressionTab() {
    const [records, setRecords] = useState<SuppressionRecord[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [stats, setStats] = useState<Record<string, number>>({})
    const [search, setSearch] = useState('')
    const [reasonFilter, setReasonFilter] = useState('')
    const [loading, setLoading] = useState(true)
    const [addEmail, setAddEmail] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [toast, setToast] = useState('')

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

    const load = useCallback(() => {
        setLoading(true)
        const params = new URLSearchParams({ page: String(page), limit: '30' })
        if (search) params.set('search', search)
        if (reasonFilter) params.set('reason', reasonFilter)
        fetch(`/api/admin/email-suppression?${params}`)
            .then(r => r.json())
            .then(d => { setRecords(d.records); setTotal(d.total); setTotalPages(d.totalPages); setStats(d.stats) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [page, search, reasonFilter])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { load() }, [load])

    const doAction = async (action: string, email?: string) => {
        if (action === 'purge_subscribers') {
            if (!confirm('Delete all suppressed subscribers and clean up orphaned suppression records?\n\nThis permanently removes subscribers with suppressed emails and deletes suppression entries for emails that were never subscribers.')) return
        }
        setActionLoading(email || action)
        try {
            const res = await fetch('/api/admin/email-suppression', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, email }),
            })
            const data = await res.json()
            if (action === 'purge_subscribers') {
                showToast(data.purged > 0 ? `🗑️ Purged ${data.purged} record${data.purged !== 1 ? 's' : ''}` : '✅ Nothing to purge')
            } else if (action === 'remove') {
                showToast(`✅ Lifted suppression for ${email}`)
            } else if (action === 'add') {
                showToast(`⛔ Suppressed ${email}`)
            } else if (action === 'delete') {
                showToast(`🗑️ Deleted suppression record for ${email}`)
            }
        } catch {
            showToast('❌ Action failed')
        }
        setActionLoading(null)
        load()
    }

    const totalActive = Object.values(stats).reduce((a, b) => a + b, 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    padding: '10px 16px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                    background: toast.startsWith('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)',
                    border: `1px solid ${toast.startsWith('❌') ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`,
                    color: toast.startsWith('❌') ? '#ef4444' : '#34d399',
                }}>{toast}</div>
            )}
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                {[
                    { label: 'Total Suppressed', value: totalActive, color: '#ef4444' },
                    { label: 'Hard Bounces', value: stats.hard_bounce || 0, color: '#dc2626' },
                    { label: 'Soft Bounces', value: stats.soft_bounce || 0, color: '#f59e0b' },
                    { label: 'Complaints', value: stats.complaint || 0, color: '#dc2626' },
                    { label: 'Manual', value: stats.manual || 0, color: '#8b5cf6' },
                    { label: 'Bots', value: stats.bot || 0, color: '#f59e0b' },
                ].map(s => (
                    <div key={s.label} style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input placeholder="Search email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                    style={{ flex: 1, minWidth: '180px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                <select value={reasonFilter} onChange={e => { setReasonFilter(e.target.value); setPage(1) }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                    <option value="">All reasons</option>
                    <option value="hard_bounce">Hard Bounce</option>
                    <option value="soft_bounce">Soft Bounce</option>
                    <option value="complaint">Complaint</option>
                    <option value="manual">Manual</option>
                    <option value="bot">🤖 Bot</option>
                </select>
                <button onClick={() => doAction('purge_subscribers')} disabled={actionLoading === 'purge_subscribers'}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                    🗑️ Purge Suppressed
                </button>
            </div>

            {/* Manual Add */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <input placeholder="email@example.com" value={addEmail} onChange={e => setAddEmail(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                <button onClick={() => { if (addEmail) { doAction('add', addEmail); setAddEmail('') } }}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
                    ⛔ Suppress
                </button>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>Loading…</div>}

            {/* Table */}
            {!loading && records.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>✅ No suppressed emails — all clear!</div>}
            {!loading && records.map(r => (
                <div key={r.id} style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.email}</span>
                            <span style={badge(r.reason)}>{r.reason}</span>
                            {r.removedAt && <span style={{ ...badge('manual'), background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>LIFTED</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {!r.removedAt && (
                                <button onClick={() => doAction('remove', r.email)} disabled={actionLoading === r.email}
                                    style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer' }}>
                                    ✅ Lift
                                </button>
                            )}
                            <button onClick={() => doAction('delete', r.email)} disabled={actionLoading === r.email}
                                style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer' }}>
                                🗑️
                            </button>
                        </div>
                    </div>
                    {r.detail && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px', wordBreak: 'break-all' }}>{r.detail.slice(0, 200)}</div>}
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        {new Date(r.createdAt).toLocaleString()} · {r.source}
                        {r.expiresAt && ` · expires ${new Date(r.expiresAt).toLocaleDateString()}`}
                    </div>
                </div>
            ))}

            {/* Pagination */}
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
