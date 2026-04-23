'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

interface Subscriber {
    id: string
    email: string
    name: string | null
    active: boolean
    subscribedAt: string
}
interface Pagination { page: number; limit: number; total: number; totalPages: number }
interface Stats { total: number; active: number; inactive: number }

export default function AdminSubscribersPage() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([])
    const [pagination, setPagination]   = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
    const [stats, setStats]             = useState<Stats>({ total: 0, active: 0, inactive: 0 })
    const [loading, setLoading]         = useState(true)
    const [search, setSearch]           = useState('')
    const [status, setStatus]           = useState('all')
    const [sort, setSort]               = useState('newest')
    const [selected, setSelected]       = useState<Set<string>>(new Set())
    const [actionLoading, setActionLoading] = useState(false)
    const [toast, setToast]             = useState('')

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(''), 3500)
    }

    const fetchData = useCallback(async (page = 1) => {
        setLoading(true)
        setSelected(new Set())
        const params = new URLSearchParams({ page: String(page), limit: '50', sort, status })
        if (search) params.set('search', search)
        const res = await fetch(`/api/admin/subscribers?${params}`)
        if (res.ok) {
            const data = await res.json()
            setSubscribers(data.subscribers)
            setPagination(data.pagination)
            setStats(data.stats)
        }
        setLoading(false)
    }, [search, status, sort])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchData(1) }, [fetchData])

    // debounced search
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        const t = setTimeout(() => fetchData(1), 300)
        return () => clearTimeout(t)
    }, [search, fetchData])

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }
    const toggleAll = () => {
        if (selected.size === subscribers.length) setSelected(new Set())
        else setSelected(new Set(subscribers.map(s => s.id)))
    }

    const bulkSetActive = async (active: boolean) => {
        if (selected.size === 0) return
        setActionLoading(true)
        const res = await fetch('/api/admin/subscribers', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selected), active }),
        })
        if (res.ok) {
            const data = await res.json()
            showToast(`✅ ${data.updated} subscriber${data.updated !== 1 ? 's' : ''} ${active ? 'activated' : 'deactivated'}`)
            await fetchData(pagination.page)
        }
        setActionLoading(false)
    }

    const bulkDelete = async () => {
        if (selected.size === 0) return
        if (!confirm(`Permanently delete ${selected.size} subscriber${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
        setActionLoading(true)
        const res = await fetch('/api/admin/subscribers', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selected) }),
        })
        if (res.ok) {
            const data = await res.json()
            showToast(`🗑️ ${data.deleted} subscriber${data.deleted !== 1 ? 's' : ''} deleted`)
            await fetchData(1)
        }
        setActionLoading(false)
    }

    const exportCsv = () => {
        const params = new URLSearchParams({ format: 'csv', sort, status })
        if (search) params.set('search', search)
        window.open(`/api/admin/subscribers?${params}`, '_blank')
    }

    const labelStyle: React.CSSProperties = {
        fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block',
    }
    const inputStyle: React.CSSProperties = {
        padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)', outline: 'none', width: '100%',
    }
    const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', cursor: 'pointer' }

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                {/* Header */}
                <div className="admin-header">
                    <h1 className="admin-page-title">📬 Subscribers</h1>
                    <button
                        type="button"
                        onClick={exportCsv}
                        className="btn btn-ghost"
                        style={{ fontSize: '0.8rem' }}
                    >
                        ⬇️ Export CSV
                    </button>
                </div>

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)', padding: '12px 20px',
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease',
                    }}>
                        {toast}
                    </div>
                )}

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                    {[
                        { label: 'Total', value: stats.total, color: '#d4a853' },
                        { label: 'Active',   value: stats.active,   color: '#10b981' },
                        { label: 'Inactive', value: stats.inactive, color: '#6b7280' },
                    ].map(s => (
                        <div key={s.label} className="admin-card" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="admin-card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={labelStyle}>Search</label>
                            <input
                                style={inputStyle}
                                placeholder="Search by email or name…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select style={selectStyle} value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Sort</label>
                            <select style={selectStyle} value={sort} onChange={e => setSort(e.target.value)}>
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="name">By email</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Bulk actions bar */}
                {selected.size > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                        padding: '10px 16px', borderRadius: 'var(--radius-lg)',
                        background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)',
                        marginBottom: 'var(--space-md)',
                    }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                            {selected.size} selected
                        </span>
                        <button type="button" disabled={actionLoading} onClick={() => bulkSetActive(true)}
                            style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                            ✓ Activate
                        </button>
                        <button type="button" disabled={actionLoading} onClick={() => bulkSetActive(false)}
                            style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.3)', color: '#9ca3af' }}>
                            ✕ Deactivate
                        </button>
                        <button type="button" disabled={actionLoading} onClick={bulkDelete}
                            style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                            🗑️ Delete
                        </button>
                        <button type="button" onClick={() => setSelected(new Set())}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Clear
                        </button>
                    </div>
                )}

                {/* Table */}
                <div className="admin-card" style={{ overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                            Loading subscribers…
                        </div>
                    ) : subscribers.length === 0 ? (
                        <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>📭</div>
                            <div style={{ fontSize: '0.9rem' }}>No subscribers found</div>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', width: '36px' }}>
                                        <input type="checkbox"
                                            checked={selected.size === subscribers.length && subscribers.length > 0}
                                            onChange={toggleAll}
                                            style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                                        />
                                    </th>
                                    {['Email', 'Name', 'Status', 'Subscribed'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {subscribers.map((sub, i) => (
                                    <tr key={sub.id}
                                        onClick={() => toggleOne(sub.id)}
                                        style={{
                                            borderBottom: i < subscribers.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                            background: selected.has(sub.id) ? 'rgba(212,168,83,0.04)' : 'transparent',
                                            cursor: 'pointer', transition: 'background 0.12s',
                                        }}>
                                        <td style={{ padding: '10px 14px' }}>
                                            <input type="checkbox"
                                                checked={selected.has(sub.id)}
                                                onChange={() => toggleOne(sub.id)}
                                                onClick={e => e.stopPropagation()}
                                                style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{sub.email}</span>
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{sub.name || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>—</span>}</span>
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '2px 8px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700,
                                                background: sub.active ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                                                color: sub.active ? '#10b981' : '#9ca3af',
                                                border: `1px solid ${sub.active ? 'rgba(16,185,129,0.25)' : 'rgba(107,114,128,0.2)'}`,
                                            }}>
                                                {sub.active ? '● Active' : '○ Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                                {new Date(sub.subscribedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                        <button type="button" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}
                            className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                            ← Prev
                        </button>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            Page {pagination.page} of {pagination.totalPages} &nbsp;·&nbsp; {pagination.total.toLocaleString()} total
                        </span>
                        <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchData(pagination.page + 1)}
                            className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                            Next →
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}
