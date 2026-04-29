'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

interface AdminComment {
    id: string
    content: string
    hidden: boolean
    pinned: boolean
    flagged: boolean
    createdAt: string
    user: { id: string; name: string; avatar: string | null; email: string }
    project: { id: string; title: string; slug: string }
    _count: { replies: number; likes: number }
}

export default function AdminCommentsPage() {
    const [comments, setComments] = useState<AdminComment[]>([])
    const [loading, setLoading] = useState(true)
    const [projects, setProjects] = useState<{ id: string; title: string }[]>([])
    const [filterProject, setFilterProject] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [toast, setToast] = useState('')

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

    const fetchComments = useCallback(async () => {
        const params = new URLSearchParams({ page: String(page), limit: '50', status: filterStatus })
        if (filterProject) params.set('projectId', filterProject)

        try {
            const res = await fetch(`/api/admin/comments?${params}`)
            if (res.status === 401) { window.location.href = '/admin/login'; return }
            const data = await res.json()
            setComments(data.comments || [])
            setTotalPages(data.totalPages || 1)
            setTotal(data.total || data.comments?.length || 0)
        } catch { /* ignore */ }
    }, [page, filterProject, filterStatus])

    useEffect(() => { const t = setTimeout(() => fetchComments().finally(() => setLoading(false)), 0); return () => clearTimeout(t) }, [fetchComments])

    // Load project list for filter
    useEffect(() => {
        fetch('/api/admin/projects')
            .then(r => { if (r.status === 401) { window.location.href = '/admin/login'; return [] } return r.json() })
            .then(data => {
                if (Array.isArray(data)) setProjects(data.map((p: any) => ({ id: p.id, title: p.title })))
            })
            .catch(() => {})
    }, [])

    const moderate = async (id: string, action: string) => {
        await fetch('/api/admin/comments', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action }),
        })
        const actionLabels: Record<string, string> = { hide: '🙈 Comment hidden', unhide: '👁 Comment shown', pin: '📌 Comment pinned', unpin: '📌 Comment unpinned' }
        showToast(actionLabels[action] || '✅ Updated')
        fetchComments()
    }

    const bulkDelete = async () => {
        if (selected.size === 0) return
        if (!confirm(`Hard delete ${selected.size} comment(s)? This cannot be undone.`)) return
        const res = await fetch('/api/admin/comments', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [...selected] }),
        })
        const data = await res.json()
        if (!res.ok) {
            showToast(`❌ ${data.error || 'Delete failed'}`)
            return
        }
        showToast(`🗑️ ${selected.size} comment(s) deleted`)
        setSelected(new Set())
        fetchComments()
    }

    const bulkHide = async () => {
        if (selected.size === 0) return
        for (const id of selected) {
            await fetch('/api/admin/comments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action: 'hide' }),
            })
        }
        showToast(`🙈 ${selected.size} comment(s) hidden`)
        setSelected(new Set())
        fetchComments()
    }

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (selected.size === comments.length) setSelected(new Set())
        else setSelected(new Set(comments.map(c => c.id)))
    }

    // Counts for stat cards
    const hiddenCount = comments.filter(c => c.hidden).length
    const flaggedCount = comments.filter(c => c.flagged).length
    const pinnedCount = comments.filter(c => c.pinned).length

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                {/* Header */}
                <div className="admin-header">
                    <h1 className="admin-page-title">💬 Comment Moderation</h1>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            {total} total
                        </span>
                    </div>
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

                {/* Stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                    {[
                        { label: 'Total', value: total, color: '#d4a853', filter: 'all' },
                        { label: 'Hidden', value: hiddenCount, color: '#ef4444', filter: 'hidden' },
                        { label: 'Pinned', value: pinnedCount, color: '#d4a853', filter: 'pinned' },
                        { label: 'Flagged', value: flaggedCount, color: '#eab308', filter: 'flagged' },
                    ].map(s => (
                        <div key={s.label} className="admin-card" style={{
                            padding: 'var(--space-lg)', textAlign: 'center', cursor: 'pointer',
                            border: filterStatus === s.filter ? `1px solid ${s.color}44` : undefined,
                            background: filterStatus === s.filter ? `${s.color}08` : undefined,
                            transition: 'all 0.15s',
                        }}
                            onClick={() => { setFilterStatus(s.filter); setPage(1) }}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="admin-card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ minWidth: '180px' }}>
                            <label style={labelStyle}>Project</label>
                            <select
                                value={filterProject}
                                onChange={e => { setFilterProject(e.target.value); setPage(1) }}
                                style={selectStyle}
                            >
                                <option value="">All Projects</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select
                                value={filterStatus}
                                onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                                style={selectStyle}
                            >
                                <option value="all">All Status</option>
                                <option value="hidden">🙈 Hidden</option>
                                <option value="pinned">📌 Pinned</option>
                                <option value="flagged">🚩 Flagged</option>
                            </select>
                        </div>
                        {filterStatus !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setFilterStatus('all')}
                                style={{
                                    padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem',
                                    fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                ✕ Clear filter
                            </button>
                        )}
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
                        <button type="button" onClick={bulkHide}
                            style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.3)', color: '#9ca3af' }}>
                            🙈 Hide
                        </button>
                        <button type="button" onClick={bulkDelete}
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
                            Loading comments…
                        </div>
                    ) : comments.length === 0 ? (
                        <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>💬</div>
                            <div style={{ fontSize: '0.9rem' }}>No comments found</div>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th style={{ ...thStyle, width: '36px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.size === comments.length && comments.length > 0}
                                            onChange={toggleAll}
                                            style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                                        />
                                    </th>
                                    {['Comment', 'Author', 'Project', 'Status', 'Stats', 'Date', 'Actions'].map(h => (
                                        <th key={h} style={thStyle}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {comments.map((c, i) => (
                                    <tr key={c.id}
                                        onClick={() => toggleSelect(c.id)}
                                        style={{
                                            borderBottom: i < comments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                            background: selected.has(c.id)
                                                ? 'rgba(212,168,83,0.04)'
                                                : c.flagged
                                                    ? 'rgba(234,179,8,0.03)'
                                                    : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'background 0.12s',
                                        }}
                                    >
                                        <td style={tdStyle}>
                                            <input
                                                type="checkbox"
                                                checked={selected.has(c.id)}
                                                onChange={() => toggleSelect(c.id)}
                                                onClick={e => e.stopPropagation()}
                                                style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ ...tdStyle, maxWidth: '280px' }}>
                                            <span style={{
                                                overflow: 'hidden', textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap', display: 'block',
                                                fontSize: '0.82rem', color: c.hidden ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                                fontStyle: c.hidden ? 'italic' : 'normal',
                                            }}>
                                                {c.content.slice(0, 80)}{c.content.length > 80 ? '…' : ''}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                    background: c.user.avatar ? `url(${c.user.avatar}) center/cover` : 'linear-gradient(135deg, rgba(212,168,83,0.3), rgba(212,168,83,0.1))',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-gold)',
                                                    flexShrink: 0,
                                                }}>
                                                    {!c.user.avatar && c.user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{c.user.name}</div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{c.user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.project.title}</span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {c.hidden && <Badge color="#ef4444">Hidden</Badge>}
                                                {c.pinned && <Badge color="#d4a853">📌 Pinned</Badge>}
                                                {c.flagged && <Badge color="#eab308">🚩 Flagged</Badge>}
                                                {!c.hidden && !c.pinned && !c.flagged && <Badge color="#10b981">Visible</Badge>}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '10px', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                <span style={{ color: '#ef4444' }}>♥ {c._count.likes}</span>
                                                <span>💬 {c._count.replies}</span>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                                {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        </td>
                                        <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <ActionBtn
                                                    onClick={() => moderate(c.id, c.hidden ? 'unhide' : 'hide')}
                                                    label={c.hidden ? 'Show' : 'Hide'}
                                                    variant={c.hidden ? 'success' : 'default'}
                                                />
                                                <ActionBtn
                                                    onClick={() => moderate(c.id, c.pinned ? 'unpin' : 'pin')}
                                                    label={c.pinned ? 'Unpin' : 'Pin'}
                                                    variant={c.pinned ? 'gold' : 'default'}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                        <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                            ← Prev
                        </button>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            Page {page} of {totalPages}
                        </span>
                        <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                            className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                            Next →
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
            borderRadius: '99px', background: `${color}15`, color,
            border: `1px solid ${color}30`,
        }}>
            {children}
        </span>
    )
}

function ActionBtn({ onClick, label, variant = 'default' }: { onClick: () => void; label: string; variant?: 'default' | 'success' | 'gold' }) {
    const colors = {
        default: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' },
        success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', color: '#10b981' },
        gold: { bg: 'rgba(212,168,83,0.08)', border: 'rgba(212,168,83,0.2)', color: 'var(--accent-gold)' },
    }
    const c = colors[variant]
    return (
        <button onClick={onClick} style={{
            padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600,
            borderRadius: 'var(--radius-md)', border: `1px solid ${c.border}`,
            background: c.bg, color: c.color,
            cursor: 'pointer', transition: 'all 0.15s',
        }}>
            {label}
        </button>
    )
}

const labelStyle: React.CSSProperties = {
    fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block',
}

const selectStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
}

const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: '0.65rem',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'var(--text-tertiary)',
}

const tdStyle: React.CSSProperties = {
    padding: '10px 14px', verticalAlign: 'middle',
}
