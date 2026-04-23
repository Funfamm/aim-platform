'use client'

import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

interface AuditRow {
    id: string
    adminId: string
    adminEmail: string
    action: string
    targetType: string
    targetId: string
    targetEmail: string
    reason: string | null
    createdAt: string
}

const ACTION_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    suspend:   { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: '🚫 Suspend' },
    unsuspend: { bg: 'rgba(16,185,129,0.1)',   color: '#10b981', label: '✓ Unsuspend' },
    unlock:    { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24', label: '🔓 Unlock' },
    delete:    { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: '🗑 Delete' },
    purge:     { bg: 'rgba(239,68,68,0.18)',   color: '#ef4444', label: '☢️ Purge' },
}

const inp: React.CSSProperties = {
    padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
    color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
}

export default function AdminAuditPage() {
    const [logs, setLogs] = useState<AuditRow[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [loading, setLoading] = useState(true)
    const [action, setAction] = useState('')
    const [adminEmail, setAdminEmail] = useState('')
    const [targetEmail, setTargetEmail] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')

    // Re-fetch whenever filters change — resets page to 1.
    // This is a client-side data-fetching effect (standard admin dashboard pattern).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching effect: setState is intentional
    useEffect(() => {
        let cancelled = false
        const p = 1
        setPage(p)

        const params = new URLSearchParams({ page: String(p), limit: '50' })
        if (action) params.set('action', action)
        if (adminEmail) params.set('adminEmail', adminEmail)
        if (targetEmail) params.set('targetEmail', targetEmail)
        if (from) params.set('from', from)
        if (to) params.set('to', to)

        setLoading(true)
        fetch(`/api/admin/audit?${params}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (cancelled || !data) return
                setLogs(data.logs)
                setTotal(data.total)
                setTotalPages(data.pagination.totalPages)
                setLoading(false)
            })
            .catch(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action, adminEmail, targetEmail, from, to])

    // Pagination — fetch a specific page without resetting filters
    function goToPage(p: number) {
        setPage(p)
        setLoading(true)
        const params = new URLSearchParams({ page: String(p), limit: '50' })
        if (action) params.set('action', action)
        if (adminEmail) params.set('adminEmail', adminEmail)
        if (targetEmail) params.set('targetEmail', targetEmail)
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        fetch(`/api/admin/audit?${params}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data) return
                setLogs(data.logs)
                setTotal(data.total)
                setTotalPages(data.pagination.totalPages)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 16px' }}>🛡️ Admin Audit Log</h1>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
                    <select style={inp} value={action} onChange={e => setAction(e.target.value)}>
                        <option value="">All Actions</option>
                        <option value="suspend">Suspend</option>
                        <option value="unsuspend">Unsuspend</option>
                        <option value="unlock">Unlock</option>
                        <option value="delete">Delete</option>
                        <option value="purge">Purge</option>
                    </select>
                    <input style={{ ...inp, flex: 1, minWidth: '160px' }} placeholder="🔍 Admin email..." value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                    <input style={{ ...inp, flex: 1, minWidth: '160px' }} placeholder="🔍 Target email..." value={targetEmail} onChange={e => setTargetEmail(e.target.value)} />
                    <input type="date" style={inp} value={from} onChange={e => setFrom(e.target.value)} title="From date" />
                    <input type="date" style={inp} value={to} onChange={e => setTo(e.target.value)} title="To date" />
                    {(action || adminEmail || targetEmail || from || to) && (
                        <button
                            onClick={() => { setAction(''); setAdminEmail(''); setTargetEmail(''); setFrom(''); setTo('') }}
                            style={{ ...inp, cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}
                        >
                            Clear
                        </button>
                    )}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{total.toLocaleString()} event{total !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Loading…</div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                        🛡️ No audit events found.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Timestamp', 'Action', 'Target', 'Admin'].map(h => (
                                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => {
                                    const badge = ACTION_BADGE[log.action] ?? { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', label: log.action }
                                    return (
                                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                                {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: badge.bg, color: badge.color }}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <div style={{ fontWeight: 600 }}>{log.targetEmail}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{log.targetType} · {log.targetId.slice(0, 12)}…</div>
                                            </td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{log.adminEmail}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '16px' }}>
                        <button disabled={page <= 1} onClick={() => goToPage(page - 1)}
                            style={{ ...inp, cursor: page > 1 ? 'pointer' : 'not-allowed', opacity: page <= 1 ? 0.3 : 1 }}>Prev</button>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Page {page} of {totalPages.toLocaleString()}</span>
                        <button disabled={page >= totalPages} onClick={() => goToPage(page + 1)}
                            style={{ ...inp, cursor: page < totalPages ? 'pointer' : 'not-allowed', opacity: page >= totalPages ? 0.3 : 1 }}>Next</button>
                    </div>
                )}
            </main>
        </div>
    )
}
