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

// ── Status Transition Rules ──────────────────────────────────────────────────
// Defines which statuses can transition to which. Prevents accidental
// skipping of workflow steps or illogical state changes.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    received:        ['reviewing', 'cancelled'],
    reviewing:       ['scope_confirmed', 'awaiting_client', 'cancelled'],
    scope_confirmed: ['in_production', 'awaiting_client', 'cancelled'],
    in_production:   ['awaiting_client', 'delivered', 'cancelled'],
    awaiting_client: ['reviewing', 'scope_confirmed', 'in_production', 'cancelled'],
    delivered:       ['completed', 'in_production'],   // reopen or complete
    completed:       [],                                 // terminal — no changes
    cancelled:       ['received'],                       // reopen only
}
const DESTRUCTIVE_STATUSES = new Set(['cancelled', 'completed'])

const inp: React.CSSProperties = {
    padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
    color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
    colorScheme: 'dark',
}

// ── Toast helper ─────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warn'; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
    const colors = { success: '#34d399', error: '#f87171', warn: '#f59e0b' }
    const bgs = { success: 'rgba(52,211,153,0.12)', error: 'rgba(239,68,68,0.12)', warn: 'rgba(245,158,11,0.12)' }
    return (
        <div style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
            padding: '12px 20px', borderRadius: '10px',
            background: bgs[type], border: `1px solid ${colors[type]}40`,
            color: colors[type], fontSize: '0.82rem', fontWeight: 700,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'spFadeIn 0.3s ease-out',
            display: 'flex', alignItems: 'center', gap: '8px',
        }}>
            <span>{type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠'}</span>
            {message}
        </div>
    )
}

// ── Confirmation Modal ───────────────────────────────────────────────────────
function ConfirmModal({ title, message, detail, confirmLabel, confirmColor, onConfirm, onCancel, danger }: {
    title: string; message: string; detail?: string; confirmLabel: string
    confirmColor: string; onConfirm: () => void; onCancel: () => void; danger?: boolean
}) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={onCancel}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-primary, #0d0d12)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90vw',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
                {danger && (
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.3rem', margin: '0 auto 16px',
                    }}>⚠️</div>
                )}
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 8px', textAlign: 'center' }}>{title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, margin: '0 0 6px' }}>{message}</p>
                {detail && (
                    <p style={{
                        fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center',
                        lineHeight: 1.5, margin: '0 0 20px', padding: '8px 12px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>{detail}</p>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={onCancel} style={{
                        flex: 1, padding: '10px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={onConfirm} style={{
                        flex: 1, padding: '10px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
                        background: `${confirmColor}18`, border: `1px solid ${confirmColor}40`,
                        color: confirmColor, cursor: 'pointer',
                    }}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    )
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

    // ── Safety: Confirmation & Toast state ──
    const [pendingStatus, setPendingStatus] = useState<{ id: string; from: string; to: string } | null>(null)
    const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; client: string } | null>(null)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warn' } | null>(null)

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

    // ── Safe status change: requires confirmation ──
    const requestStatusChange = (id: string, fromStatus: string, toStatus: string) => {
        if (fromStatus === toStatus) return
        const allowed = ALLOWED_TRANSITIONS[fromStatus] || []
        if (!allowed.includes(toStatus)) {
            setToast({ message: `Cannot change from "${STATUS_STYLES[fromStatus]?.label}" to "${STATUS_STYLES[toStatus]?.label}". Not a valid transition.`, type: 'error' })
            return
        }
        setPendingStatus({ id, from: fromStatus, to: toStatus })
    }

    const confirmStatusChange = async () => {
        if (!pendingStatus) return
        await updateRequest(pendingStatus.id, { status: pendingStatus.to })
        const fromLabel = STATUS_STYLES[pendingStatus.from]?.label || pendingStatus.from
        const toLabel = STATUS_STYLES[pendingStatus.to]?.label || pendingStatus.to
        setToast({ message: `Status changed: ${fromLabel} → ${toLabel}`, type: 'success' })
        setPendingStatus(null)
    }

    // ── Safe delete: requires confirmation with details ──
    const requestDelete = (id: string, title: string, client: string) => {
        setPendingDelete({ id, title, client })
    }

    const confirmDelete = async () => {
        if (!pendingDelete) return
        await fetch(`/api/project-requests/${pendingDelete.id}`, { method: 'DELETE' })
        setToast({ message: `Deleted: "${pendingDelete.title}"`, type: 'warn' })
        setPendingDelete(null)
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

                            {/* ── Status selector (with transition rules) ── */}
                            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Status</span>
                                    <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                        Only valid transitions are clickable
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {STATUSES.map(s => {
                                        const st = STATUS_STYLES[s]
                                        const isCurrent = selected.status === s
                                        const allowed = ALLOWED_TRANSITIONS[selected.status] || []
                                        const isAllowed = allowed.includes(s)
                                        const isDestructive = DESTRUCTIVE_STATUSES.has(s)
                                        const isDisabled = !isCurrent && !isAllowed

                                        return (
                                            <button key={s} type="button"
                                                onClick={() => {
                                                    if (!isCurrent && isAllowed) {
                                                        requestStatusChange(selected.id, selected.status, s)
                                                    }
                                                }}
                                                disabled={isDisabled}
                                                title={
                                                    isCurrent ? 'Current status'
                                                    : isAllowed ? `Change to ${st.label}`
                                                    : `Cannot transition from ${STATUS_STYLES[selected.status]?.label} to ${st.label}`
                                                }
                                                style={{
                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                                    cursor: isDisabled ? 'not-allowed' : isCurrent ? 'default' : 'pointer',
                                                    background: isCurrent ? st.bg : isAllowed && isDestructive ? 'rgba(239,68,68,0.04)' : isAllowed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                                                    border: `1px solid ${isCurrent ? st.color + '44' : isAllowed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`,
                                                    color: isCurrent ? st.color : isAllowed ? (isDestructive ? '#f87171' : 'var(--text-secondary)') : 'rgba(255,255,255,0.15)',
                                                    opacity: isDisabled ? 0.4 : 1,
                                                    transition: 'all 0.15s',
                                                    position: 'relative',
                                                }}>
                                                {isCurrent && <span style={{ marginRight: '4px' }}>●</span>}
                                                {st.label}
                                                {isAllowed && !isCurrent && <span style={{ marginLeft: '4px', fontSize: '0.55rem' }}>→</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                                {/* Flow hint */}
                                {(ALLOWED_TRANSITIONS[selected.status] || []).length > 0 && (
                                    <div style={{ marginTop: '6px', fontSize: '0.62rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>Next steps:</span>
                                        {(ALLOWED_TRANSITIONS[selected.status] || []).map(s => (
                                            <span key={s} style={{ padding: '1px 6px', borderRadius: '3px', background: STATUS_STYLES[s]?.bg, color: STATUS_STYLES[s]?.color, fontWeight: 600 }}>
                                                {STATUS_STYLES[s]?.label}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {(ALLOWED_TRANSITIONS[selected.status] || []).length === 0 && (
                                    <div style={{ marginTop: '6px', fontSize: '0.62rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                        This is a terminal status. No further transitions allowed.
                                    </div>
                                )}
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
                                <button onClick={() => { updateRequest(selected.id, { adminNotes: editNotes }); setToast({ message: 'Notes saved', type: 'success' }) }}
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

                            {/* ── Danger Zone ── */}
                            <div style={{
                                marginTop: '24px', paddingTop: '16px',
                                borderTop: '1px solid rgba(239,68,68,0.15)',
                            }}>
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f87171', marginBottom: '8px' }}>
                                    ⚠ Danger Zone
                                </div>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '10px', lineHeight: 1.5 }}>
                                    Deleting a request is permanent. The client will lose access to their progress tracker.
                                </p>
                                <button onClick={() => requestDelete(selected.id, selected.projectTitle, selected.clientName)}
                                    style={{
                                        padding: '8px 18px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171',
                                    }}>
                                    🗑️ Delete Request
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Status Change Confirmation Modal ── */}
                {pendingStatus && (() => {
                    const fromSt = STATUS_STYLES[pendingStatus.from]
                    const toSt = STATUS_STYLES[pendingStatus.to]
                    const isDanger = DESTRUCTIVE_STATUSES.has(pendingStatus.to)
                    const proj = requests.find(r => r.id === pendingStatus.id)
                    return (
                        <ConfirmModal
                            danger={isDanger}
                            title={isDanger ? `${toSt.label} this project?` : 'Confirm Status Change'}
                            message={`Change status from "${fromSt.label}" to "${toSt.label}"?`}
                            detail={proj ? `Project: "${proj.projectTitle}" by ${proj.clientName}` : undefined}
                            confirmLabel={`Yes, ${toSt.label}`}
                            confirmColor={toSt.color}
                            onConfirm={confirmStatusChange}
                            onCancel={() => setPendingStatus(null)}
                        />
                    )
                })()}

                {/* ── Delete Confirmation Modal ── */}
                {pendingDelete && (
                    <ConfirmModal
                        danger
                        title="Delete Project Request?"
                        message="This action cannot be undone. The request and all associated data will be permanently removed."
                        detail={`"${pendingDelete.title}" by ${pendingDelete.client}`}
                        confirmLabel="Delete Permanently"
                        confirmColor="#ef4444"
                        onConfirm={confirmDelete}
                        onCancel={() => setPendingDelete(null)}
                    />
                )}

                {/* ── Toast ── */}
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </main>
        </div>
    )
}
