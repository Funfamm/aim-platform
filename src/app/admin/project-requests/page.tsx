'use client'

import { useState, useEffect, useCallback } from 'react'

interface ProjectRequest {
    id: string; projectType: string; status: string; clientName: string; email: string; phone: string | null
    projectTitle: string; description: string; deadline: string | null; urgent: boolean; adminNotes: string | null
    createdAt: string; updatedAt: string; uploads: Array<{ name: string; url: string }> | null
    budgetRange: string | null; language: string; tone: string[] | null; addOns: string[] | null
    customFields: Record<string, string> | null; companyName: string | null
}

const STATUSES = ['received', 'reviewing', 'scope_confirmed', 'in_production', 'awaiting_client', 'delivered', 'completed', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
    received: '#3b82f6', reviewing: '#8b5cf6', scope_confirmed: '#06b6d4', in_production: '#f59e0b',
    awaiting_client: '#f97316', delivered: '#10b981', completed: '#34d399', cancelled: '#ef4444',
}
const TYPE_ICONS: Record<string, string> = {
    birthday: '🎉', brand: '🏢', commercial: '📺', music: '🎵', film: '🎬', event: '📣', custom: '✨',
}

export default function ProjectRequestsPage() {
    const [requests, setRequests] = useState<ProjectRequest[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterUrgent, setFilterUrgent] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [editNotes, setEditNotes] = useState('')

    const fetchRequests = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (filterStatus) params.set('status', filterStatus)
        if (filterType) params.set('type', filterType)
        if (filterUrgent) params.set('urgent', 'true')
        try {
            const res = await fetch(`/api/project-requests?${params}`)
            const data = await res.json()
            setRequests(data.requests || [])
            setTotal(data.total || 0)
        } catch { /* ignore */ }
        setLoading(false)
    }, [filterStatus, filterType, filterUrgent])

    useEffect(() => { fetchRequests() }, [fetchRequests])

    const updateRequest = async (id: string, patch: Record<string, unknown>) => {
        await fetch(`/api/project-requests/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
        })
        fetchRequests()
    }

    const deleteRequest = async (id: string) => {
        if (!confirm('Delete this request permanently?')) return
        await fetch(`/api/project-requests/${id}`, { method: 'DELETE' })
        setSelectedId(null)
        fetchRequests()
    }

    const selected = requests.find(r => r.id === selectedId)

    return (
        <div style={{ padding: 'var(--space-lg)' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: 'var(--space-lg)' }}>
                📋 Project Requests <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>({total})</span>
            </h1>

            {/* ── Filters ── */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                    <option value="">All statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                    <option value="">All types</option>
                    {Object.keys(TYPE_ICONS).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={filterUrgent} onChange={e => setFilterUrgent(e.target.checked)} /> Urgent only
                </label>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
            ) : requests.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)' }}>No project requests found.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {requests.map(r => (
                        <button key={r.id} type="button" onClick={() => { setSelectedId(r.id); setEditNotes(r.adminNotes || '') }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                                borderRadius: 'var(--radius-md)', background: selectedId === r.id ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${selectedId === r.id ? 'rgba(212,168,83,0.3)' : 'var(--border-subtle)'}`,
                                cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
                            }}>
                            <span style={{ fontSize: '1.3rem' }}>{TYPE_ICONS[r.projectType] || '✨'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{r.projectTitle}</span>
                                    {r.urgent && <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 700 }}>URGENT</span>}
                                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: `${STATUS_COLORS[r.status] || '#666'}22`, color: STATUS_COLORS[r.status] || '#666', fontWeight: 700 }}>
                                        {r.status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                                    {r.id} · {r.clientName} · {new Date(r.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Detail panel ── */}
            {selected && (
                <div style={{
                    marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{selected.projectTitle}</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{selected.id}</p>
                        </div>
                        <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                    </div>

                    {/* Info rows */}
                    {[
                        ['Client', selected.clientName], ['Email', selected.email], ['Phone', selected.phone],
                        ['Company', selected.companyName], ['Type', selected.projectType], ['Budget', selected.budgetRange],
                        ['Deadline', selected.deadline ? new Date(selected.deadline).toLocaleDateString() : null],
                        ['Language', selected.language], ['Created', new Date(selected.createdAt).toLocaleString()],
                    ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k as string} style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' }}>
                            <span style={{ width: '100px', flexShrink: 0, color: 'var(--text-tertiary)', fontWeight: 600 }}>{k}</span>
                            <span style={{ color: 'var(--text-primary)' }}>{v}</span>
                        </div>
                    ))}

                    <div style={{ marginTop: 'var(--space-md)', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                        <strong>Description:</strong><br />{selected.description}
                    </div>

                    {/* Status selector */}
                    <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Status:</span>
                        {STATUSES.map(s => (
                            <button key={s} type="button" onClick={() => updateRequest(selected.id, { status: s })}
                                style={{
                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                                    background: selected.status === s ? `${STATUS_COLORS[s]}22` : 'transparent',
                                    border: `1px solid ${selected.status === s ? STATUS_COLORS[s] : 'var(--border-subtle)'}`,
                                    color: selected.status === s ? STATUS_COLORS[s] : 'var(--text-tertiary)',
                                }}>
                                {s.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>

                    {/* Urgent toggle */}
                    <div style={{ marginTop: 'var(--space-md)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selected.urgent} onChange={e => updateRequest(selected.id, { urgent: e.target.checked })} />
                            Mark as urgent
                        </label>
                    </div>

                    {/* Admin notes */}
                    <div style={{ marginTop: 'var(--space-md)' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                            Admin Notes
                        </label>
                        <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                            style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical' }} />
                        <button onClick={() => updateRequest(selected.id, { adminNotes: editNotes })}
                            style={{ marginTop: '6px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--accent-gold)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                            Save Notes
                        </button>
                    </div>

                    {/* Uploads */}
                    {Array.isArray(selected.uploads) && selected.uploads.length > 0 && (
                        <div style={{ marginTop: 'var(--space-lg)' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                Uploaded Files ({selected.uploads.length})
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                                {selected.uploads.map((f, i) => (
                                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                                        style={{ fontSize: '0.8rem', color: '#60a5fa', textDecoration: 'underline' }}>
                                        {f.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Delete */}
                    <div style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
                        <button onClick={() => deleteRequest(selected.id)}
                            style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                            Delete Request
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
