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
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const fetchComments = useCallback(async () => {
        const params = new URLSearchParams({ page: String(page), limit: '50', status: filterStatus })
        if (filterProject) params.set('projectId', filterProject)

        try {
            const res = await fetch(`/api/admin/comments?${params}`)
            if (res.status === 401) { window.location.href = '/admin/login'; return }
            const data = await res.json()
            setComments(data.comments || [])
            setTotalPages(data.totalPages || 1)
        } catch { /* ignore */ }
    }, [page, filterProject, filterStatus])

    useEffect(() => { fetchComments().finally(() => setLoading(false)) }, [fetchComments])

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
            alert(data.error || 'Delete failed')
            return
        }
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

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <AdminSidebar />
            <main style={{ flex: 1, padding: 'var(--space-xl)', marginLeft: 'var(--sidebar-w, 260px)', maxWidth: '100%' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 'var(--space-lg)' }}>
                    💬 Comment Moderation
                </h1>

                {/* Filters */}
                <div style={{
                    display: 'flex', gap: '12px', marginBottom: 'var(--space-lg)',
                    flexWrap: 'wrap', alignItems: 'center',
                }}>
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
                    <select
                        value={filterStatus}
                        onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                        style={selectStyle}
                    >
                        <option value="all">All Status</option>
                        <option value="hidden">Hidden</option>
                        <option value="pinned">Pinned</option>
                        <option value="flagged">Flagged</option>
                    </select>

                    {selected.size > 0 && (
                        <button
                            onClick={bulkDelete}
                            style={{
                                padding: '6px 16px', fontSize: '0.78rem', fontWeight: 600,
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                            }}
                        >
                            🗑 Delete {selected.size} selected
                        </button>
                    )}
                </div>

                {/* Table */}
                {loading ? (
                    <p style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
                ) : comments.length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)' }}>No comments found</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <th style={thStyle}>
                                        <input
                                            type="checkbox"
                                            checked={selected.size === comments.length && comments.length > 0}
                                            onChange={() => {
                                                if (selected.size === comments.length) setSelected(new Set())
                                                else setSelected(new Set(comments.map(c => c.id)))
                                            }}
                                        />
                                    </th>
                                    <th style={thStyle}>Comment</th>
                                    <th style={thStyle}>Author</th>
                                    <th style={thStyle}>Project</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={thStyle}>Stats</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comments.map(c => (
                                    <tr key={c.id} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        background: c.flagged ? 'rgba(234,179,8,0.04)' : undefined,
                                    }}>
                                        <td style={tdStyle}>
                                            <input
                                                type="checkbox"
                                                checked={selected.has(c.id)}
                                                onChange={() => toggleSelect(c.id)}
                                            />
                                        </td>
                                        <td style={{ ...tdStyle, maxWidth: '300px' }}>
                                            <span style={{
                                                overflow: 'hidden', textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap', display: 'block',
                                            }}>
                                                {c.content.slice(0, 80)}{c.content.length > 80 ? '…' : ''}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: '0.78rem' }}>{c.user.name}</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{c.user.email}</div>
                                        </td>
                                        <td style={tdStyle}>{c.project.title}</td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {c.hidden && <Badge color="#ef4444">Hidden</Badge>}
                                                {c.pinned && <Badge color="#d4a853">Pinned</Badge>}
                                                {c.flagged && <Badge color="#eab308">🚩 Flagged</Badge>}
                                                {!c.hidden && !c.pinned && !c.flagged && <Badge color="#6b7280">Visible</Badge>}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                ❤️ {c._count.likes} · 💬 {c._count.replies}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                {new Date(c.createdAt).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <ActionBtn
                                                    onClick={() => moderate(c.id, c.hidden ? 'unhide' : 'hide')}
                                                    label={c.hidden ? 'Show' : 'Hide'}
                                                />
                                                <ActionBtn
                                                    onClick={() => moderate(c.id, c.pinned ? 'unpin' : 'pin')}
                                                    label={c.pinned ? 'Unpin' : 'Pin'}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: 'var(--space-lg)' }}>
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pageBtnStyle}>← Prev</button>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', padding: '6px' }}>
                            Page {page} of {totalPages}
                        </span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={pageBtnStyle}>Next →</button>
                    </div>
                )}
            </main>
        </div>
    )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
    return (
        <span style={{
            fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px',
            borderRadius: '4px', background: `${color}15`, color,
            border: `1px solid ${color}30`,
        }}>
            {children}
        </span>
    )
}

function ActionBtn({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button onClick={onClick} style={{
            padding: '3px 8px', fontSize: '0.7rem', fontWeight: 500,
            borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
            cursor: 'pointer', transition: 'all 0.15s',
        }}>
            {label}
        </button>
    )
}

const selectStyle: React.CSSProperties = {
    padding: '6px 12px', fontSize: '0.82rem', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)', cursor: 'pointer',
}

const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: '0.72rem',
    fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase',
    letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
    padding: '8px 10px', verticalAlign: 'middle',
}

const pageBtnStyle: React.CSSProperties = {
    padding: '6px 14px', fontSize: '0.78rem', fontWeight: 500,
    borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
    cursor: 'pointer',
}
