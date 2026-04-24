'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

interface ProjectRequest {
    id: string; projectType: string; status: string; clientName: string; email: string; phone: string | null
    projectTitle: string; description: string; deadline: string | null; urgent: boolean; adminNotes: string | null
    createdAt: string; updatedAt: string; uploads: Array<{ name: string; url: string; size: number }> | null
    budgetRange: string | null; language: string; tone: string[] | null; addOns: string[] | null
    customFields: Record<string, string> | null; companyName: string | null; aspectRatio: string | null
    deliveryPlatform: string | null; duration: string | null; audience: string | null; projectGoal: string | null
    visualStyle: string | null; avoidNotes: string | null; emotionalFeeling: string | null
    inspirationLinks: string[] | null; rushDelivery: boolean
}

const STATUSES = ['received', 'reviewing', 'scope_confirmed', 'in_production', 'awaiting_client', 'delivered', 'completed', 'cancelled']
const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
    received:        { label: 'Received',        bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    reviewing:       { label: 'Reviewing',       bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
    scope_confirmed: { label: 'Scope Confirmed', bg: 'rgba(6,182,212,0.12)',  color: '#22d3ee' },
    in_production:   { label: 'In Production',   bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    awaiting_client: { label: 'Awaiting Client', bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
    delivered:       { label: 'Delivered',        bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    completed:       { label: 'Completed',        bg: 'rgba(52,211,153,0.12)', color: '#34d399' },
    cancelled:       { label: 'Cancelled',        bg: 'rgba(239,68,68,0.10)', color: '#f87171' },
}
const TYPE_ICONS: Record<string, string> = {
    birthday: '🎉', brand: '🏢', commercial: '📺', music: '🎵', film: '🎬', event: '📣', custom: '✨',
}

const inp: React.CSSProperties = {
    padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
    color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
    colorScheme: 'dark',
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
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})

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
            // Build status counts from full list
            const counts: Record<string, number> = {}
            for (const r of (data.requests || [])) {
                counts[r.status] = (counts[r.status] || 0) + 1
            }
            setStatusCounts(counts)
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

    // Info row helper
    function infoRow(label: string, value: string | null | undefined) {
        if (!value) return null
        return (
            <div key={label} style={{ display: 'flex', gap: '8px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' }}>
                <span style={{ width: '120px', flexShrink: 0, color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</span>
            </div>
        )
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                {/* ── Header ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>📋 Project Requests</h1>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{total} total</span>
                </div>

                {/* ── Status Pills ── */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => setFilterStatus('')} style={{
                        padding: '5px 14px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: !filterStatus ? 'var(--accent-gold-glow, rgba(212,168,83,0.12))' : 'rgba(255,255,255,0.03)',
                        color: !filterStatus ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                    }}>All ({total})</button>
                    {STATUSES.filter(s => statusCounts[s]).map(s => {
                        const st = STATUS_STYLES[s]
                        return (
                            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)} style={{
                                padding: '5px 14px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer',
                                background: filterStatus === s ? st.bg : 'rgba(255,255,255,0.03)',
                                color: filterStatus === s ? st.color : 'var(--text-tertiary)',
                            }}>{st.label} ({statusCounts[s]})</button>
                        )
                    })}
                </div>

                {/* ── Filters row ── */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        style={{ ...inp, appearance: 'auto' }}>
                        <option value="">All types</option>
                        {Object.entries(TYPE_ICONS).map(([t, icon]) => <option key={t} value={t}>{icon} {t}</option>)}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                        <input type="checkbox" checked={filterUrgent} onChange={e => setFilterUrgent(e.target.checked)}
                            style={{ accentColor: '#f87171', cursor: 'pointer' }} /> 🔥 Urgent only
                    </label>
                </div>

                {/* ── List ── */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
                ) : requests.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '2rem', opacity: 0.3, marginBottom: '8px' }}>📋</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No project requests yet</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>When clients submit projects via /start-project, they will appear here.</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {requests.map(r => {
                            const st = STATUS_STYLES[r.status] || STATUS_STYLES.received
                            return (
                                <button key={r.id} type="button"
                                    onClick={() => { setSelectedId(r.id); setEditNotes(r.adminNotes || '') }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                                        borderRadius: '8px', width: '100%', textAlign: 'left',
                                        background: selectedId === r.id ? 'rgba(212,168,83,0.04)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${selectedId === r.id ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.05)'}`,
                                        borderLeft: r.urgent ? '3px solid rgba(239,68,68,0.5)' : undefined,
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}>
                                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{TYPE_ICONS[r.projectType] || '✨'}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.projectTitle}</span>
                                            {r.urgent && <span style={{ fontSize: '0.52rem', padding: '1px 6px', borderRadius: '3px', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>URGENT</span>}
                                            <span style={{ fontSize: '0.52rem', padding: '1px 6px', borderRadius: '3px', fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                                            {r.rushDelivery && <span style={{ fontSize: '0.52rem', padding: '1px 6px', borderRadius: '3px', fontWeight: 700, background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>RUSH</span>}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.62rem' }}>{r.id}</span>
                                            <span>👤 {r.clientName}</span>
                                            <span>📧 {r.email}</span>
                                            {r.budgetRange && <span>💰 {r.budgetRange}</span>}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', flexShrink: 0, textAlign: 'right', lineHeight: 1.4 }}
                                        title={new Date(r.createdAt).toLocaleString()}>
                                        <div>{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                        <div style={{ fontSize: '0.58rem', opacity: 0.7 }}>{new Date(r.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* ── Detail Panel ── */}
                {selected && (
                    <div style={{
                        marginTop: '16px', borderRadius: '12px', overflow: 'hidden',
                        border: '1px solid rgba(212,168,83,0.15)', background: 'rgba(212,168,83,0.02)',
                    }}>
                        {/* Header */}
                        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '1.3rem' }}>{TYPE_ICONS[selected.projectType] || '✨'}</span>
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{selected.projectTitle}</h2>
                                </div>
                                <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontFamily: 'monospace', margin: 0 }}>{selected.id} · {selected.projectType} · {selected.language.toUpperCase()}</p>
                            </div>
                            <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}>✕</button>
                        </div>

                        <div style={{ padding: '16px 18px' }}>
                            {/* Client info */}
                            {infoRow('Client', selected.clientName)}
                            {infoRow('Email', selected.email)}
                            {infoRow('Phone', selected.phone)}
                            {infoRow('Company', selected.companyName)}
                            {infoRow('Budget', selected.budgetRange)}
                            {infoRow('Deadline', selected.deadline ? new Date(selected.deadline).toLocaleDateString() : null)}
                            {infoRow('Audience', selected.audience)}
                            {infoRow('Goal', selected.projectGoal)}
                            {infoRow('Duration', selected.duration)}
                            {infoRow('Aspect Ratio', selected.aspectRatio)}
                            {infoRow('Platform', selected.deliveryPlatform)}
                            {infoRow('Visual Style', selected.visualStyle)}
                            {infoRow('Feeling', selected.emotionalFeeling)}
                            {infoRow('Created', new Date(selected.createdAt).toLocaleString())}

                            {/* Description */}
                            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Description</div>
                                {selected.description}
                            </div>

                            {/* Tone pills */}
                            {Array.isArray(selected.tone) && selected.tone.length > 0 && (
                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Tone</div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {selected.tone.map(t => <span key={t} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(212,168,83,0.08)', color: 'var(--accent-gold)', border: '1px solid rgba(212,168,83,0.15)' }}>{t}</span>)}
                                    </div>
                                </div>
                            )}

                            {/* Add-ons */}
                            {Array.isArray(selected.addOns) && selected.addOns.length > 0 && (
                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Add-ons</div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {selected.addOns.map(a => <span key={a} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>{a}</span>)}
                                    </div>
                                </div>
                            )}

                            {/* Custom fields */}
                            {selected.customFields && Object.keys(selected.customFields).length > 0 && (
                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Type-Specific Fields</div>
                                    {Object.entries(selected.customFields).filter(([, v]) => v).map(([k, v]) => infoRow(k.replace(/([A-Z])/g, ' $1').trim(), v))}
                                </div>
                            )}

                            {/* ── Status selector ── */}
                            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Status</div>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {STATUSES.map(s => {
                                        const st = STATUS_STYLES[s]
                                        return (
                                            <button key={s} type="button" onClick={() => updateRequest(selected.id, { status: s })}
                                                style={{
                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
                                                    background: selected.status === s ? st.bg : 'rgba(255,255,255,0.03)',
                                                    border: `1px solid ${selected.status === s ? st.color + '44' : 'rgba(255,255,255,0.06)'}`,
                                                    color: selected.status === s ? st.color : 'var(--text-tertiary)',
                                                    transition: 'all 0.15s',
                                                }}>
                                                {st.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Urgent toggle */}
                            <div style={{ marginTop: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <input type="checkbox" checked={selected.urgent} onChange={e => updateRequest(selected.id, { urgent: e.target.checked })}
                                        style={{ accentColor: '#f87171' }} />
                                    🔥 Mark as urgent
                                </label>
                            </div>

                            {/* Admin notes */}
                            <div style={{ marginTop: '14px' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Admin Notes</div>
                                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                                    placeholder="Internal notes about this project request..."
                                    style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical', colorScheme: 'dark', boxSizing: 'border-box' }} />
                                <button onClick={() => updateRequest(selected.id, { adminNotes: editNotes })}
                                    style={{ marginTop: '6px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)', color: 'var(--accent-gold)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                                    Save Notes
                                </button>
                            </div>

                            {/* Uploads */}
                            {Array.isArray(selected.uploads) && selected.uploads.length > 0 && (
                                <div style={{ marginTop: '14px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                        Uploaded Files ({selected.uploads.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {selected.uploads.map((f, i) => (
                                            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.78rem', color: '#60a5fa', textDecoration: 'none' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {f.name}</span>
                                                {f.size > 0 && <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: '8px' }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Delete */}
                            <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <button onClick={() => deleteRequest(selected.id)}
                                    style={{ padding: '7px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                                    🗑️ Delete Request
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
