'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'

interface Application {
    id: string
    fullName: string
    email: string
    phone: string | null
    age: string | null
    gender: string | null
    status: string
    aiScore: number | null
    aiFitLevel: string | null
    headshotPath: string | null
    selfTapePath: string | null
    createdAt: string
    castingCall: {
        roleName: string
        roleType: string
        project: { title: string }
    }
}

const FILTERS = [
    { key: 'all', label: 'All', icon: '📋' },
    { key: 'pending', label: 'Pending', icon: '📥' },
    { key: 'shortlisted', label: 'Shortlisted', icon: '⭐' },
    { key: 'approved', label: 'Approved', icon: '✅' },
    { key: 'rejected', label: 'Denied', icon: '❌' },
]

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: 'Pending', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    submitted: { label: 'Pending', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    shortlisted: { label: 'Shortlisted', bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
    approved: { label: 'Approved', bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
    rejected: { label: 'Denied', bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
    reviewed: { label: 'Reviewed', bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
    under_review: { label: 'Reviewed', bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
}

export default function AdminApplicationsClient({ applications: initialApps }: { applications: Application[] }) {
    const [applications, setApplications] = useState(initialApps)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState<string | null>(null)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')

    const filtered = useMemo(() => {
        let list = applications
        if (filter !== 'all') list = list.filter(a => a.status === filter)
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(a =>
                a.fullName.toLowerCase().includes(q) ||
                a.email.toLowerCase().includes(q) ||
                a.castingCall.roleName.toLowerCase().includes(q) ||
                a.castingCall.project.title.toLowerCase().includes(q)
            )
        }
        return list
    }, [applications, filter, search])

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: applications.length }
        for (const app of applications) c[app.status] = (c[app.status] || 0) + 1
        return c
    }, [applications])

    const allFilteredSelected = filtered.length > 0 && filtered.every(a => selected.has(a.id))

    const toggleAll = () => {
        if (allFilteredSelected) {
            setSelected(prev => { const n = new Set(prev); filtered.forEach(a => n.delete(a.id)); return n })
        } else {
            setSelected(prev => { const n = new Set(prev); filtered.forEach(a => n.add(a.id)); return n })
        }
    }

    const toggleOne = (id: string) => {
        setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }

    const handleDownload = async () => {
        if (selected.size === 0) return
        setLoading('download')
        try {
            const res = await fetch('/api/admin/applications/download', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationIds: Array.from(selected) }),
            })
            if (!res.ok) throw new Error('Download failed')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `AIM_Applications_${new Date().toISOString().slice(0, 10)}.zip`
            a.click()
            URL.revokeObjectURL(url)
        } catch { alert('Download failed.') } finally { setLoading(null) }
    }

    const handleBulkStatus = async (status: string) => {
        if (selected.size === 0) return
        const labels: Record<string, string> = { approved: 'approve', rejected: 'deny', shortlisted: 'shortlist', pending: 'reset' }
        if (!confirm(`${labels[status] || status} ${selected.size} application(s)?`)) return
        setLoading(status)
        try {
            const res = await fetch('/api/admin/applications/bulk-status', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationIds: Array.from(selected), status }),
            })
            if (!res.ok) throw new Error('Failed')
            setApplications(prev => prev.map(app => selected.has(app.id) ? { ...app, status } : app))
            setSelected(new Set())
        } catch { alert('Failed to update.') } finally { setLoading(null) }
    }

    const handleBulkDelete = async () => {
        if (selected.size === 0) return
        if (!confirm(`⚠️ PERMANENTLY delete ${selected.size} application(s)?`)) return
        if (!confirm(`Are you absolutely sure?`)) return
        setLoading('delete')
        try {
            const res = await fetch('/api/admin/applications/bulk-delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationIds: Array.from(selected) }),
            })
            if (!res.ok) throw new Error('Failed')
            setApplications(prev => prev.filter(app => !selected.has(app.id)))
            setSelected(new Set())
        } catch { alert('Failed to delete.') } finally { setLoading(null) }
    }

    const handleBulkAI = async () => {
        if (selected.size === 0) return
        if (!confirm(`Run AI analysis on ${selected.size} application(s)?`)) return
        setLoading('ai')
        let success = 0, failed = 0
        for (const appId of Array.from(selected)) {
            try {
                const res = await fetch(`/api/admin/applications/${appId}/audit`, { method: 'POST' })
                if (res.ok) {
                    const data = await res.json()
                    setApplications(prev => prev.map(app => app.id === appId ? {
                        ...app, aiScore: data.report?.overallScore ?? app.aiScore,
                        aiFitLevel: data.report?.recommendation ?? app.aiFitLevel,
                    } : app))
                    success++
                } else { failed++ }
            } catch { failed++ }
        }
        setSelected(new Set()); setLoading(null)
        alert(`AI Analysis: ${success} done, ${failed} failed`)
    }

    const getPhotoCount = (p: string | null) => {
        if (!p) return 0; try { return JSON.parse(p).length } catch { return 1 }
    }

    return (
        <>
            {/* ═══ FILTER TABS + SEARCH ═══ */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {FILTERS.map(f => (
                        <button key={f.key}
                            onClick={() => { setFilter(f.key); setSelected(new Set()) }}
                            style={{
                                padding: '7px 16px', fontSize: '0.8rem', fontWeight: 600,
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: filter === f.key ? 'var(--accent-gold)' : 'rgba(255,255,255,0.04)',
                                color: filter === f.key ? '#000' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                            }}>
                            {f.icon} {f.label}
                            <span style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.6 }}>
                                {counts[f.key] || 0}
                            </span>
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {filtered.length > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll}
                                style={{ accentColor: 'var(--accent-gold)', width: '14px', height: '14px', cursor: 'pointer' }} />
                            Select all
                        </label>
                    )}
                    <input type="text" placeholder="Search..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '200px', padding: '7px 14px', fontSize: '0.82rem',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px', color: 'var(--text-primary)', outline: 'none',
                        }} />
                </div>
            </div>

            {/* ═══ FLOATING ACTION BAR ═══ */}
            {selected.size > 0 && (
                <div className="bulk-action-bar">
                    <span className="bulk-count">{selected.size} selected</span>
                    <div className="bulk-divider" />
                    <button onClick={handleDownload} disabled={loading === 'download'} className="bulk-btn">
                        {loading === 'download' ? '⏳' : '📦'} Download
                    </button>
                    <button onClick={handleBulkAI} disabled={loading === 'ai'} className="bulk-btn">
                        {loading === 'ai' ? '⏳' : '🧠'} AI Analysis
                    </button>
                    <div className="bulk-divider" />
                    <button onClick={() => handleBulkStatus('approved')} disabled={!!loading} className="bulk-btn bulk-approve">✓ Approve</button>
                    <button onClick={() => handleBulkStatus('shortlisted')} disabled={!!loading} className="bulk-btn bulk-shortlist">⭐ Shortlist</button>
                    <button onClick={() => handleBulkStatus('rejected')} disabled={!!loading} className="bulk-btn bulk-deny">✗ Deny</button>
                    <button onClick={() => handleBulkStatus('pending')} disabled={!!loading} className="bulk-btn">🔄 Reset</button>
                    <div className="bulk-divider" />
                    <button onClick={handleBulkDelete} disabled={loading === 'delete'} className="bulk-btn bulk-delete">
                        {loading === 'delete' ? '⏳' : '🗑️'} Delete
                    </button>
                    <button onClick={() => setSelected(new Set())} className="bulk-btn" style={{ opacity: 0.5 }}>Clear</button>
                </div>
            )}

            {/* ═══ APPLICATION CARDS ═══ */}
            {filtered.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
                        {filter === 'all' ? '📋' : FILTERS.find(f => f.key === filter)?.icon || '📋'}
                    </div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '6px' }}>{filter === 'all' ? 'No applications yet' : `No ${filter} applications`}</h3>
                    <p style={{ fontSize: '0.85rem' }}>
                        {filter === 'all' ? 'Applications will appear once candidates apply.' : 'Try a different filter.'}
                    </p>
                    {filter !== 'all' && (
                        <button onClick={() => setFilter('all')} className="bulk-btn" style={{ marginTop: '12px' }}>Show all</button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filtered.map((app) => {
                        const photoCount = getPhotoCount(app.headshotPath)
                        const isSelected = selected.has(app.id)
                        const statusStyle = STATUS_STYLES[app.status] || STATUS_STYLES.pending
                        const scoreColor = (app.aiScore ?? 0) >= 70 ? '#22c55e' : (app.aiScore ?? 0) >= 40 ? '#f59e0b' : '#ef4444'

                        return (
                            <div key={app.id}
                                className={`app-card ${isSelected ? 'app-card-selected' : ''}`}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('a, button, input')) return
                                    toggleOne(app.id)
                                }}
                            >
                                {/* Checkbox */}
                                <div className="app-checkbox">
                                    <input type="checkbox" checked={isSelected}
                                        onChange={() => toggleOne(app.id)}
                                        style={{ accentColor: 'var(--accent-gold)', width: '16px', height: '16px', cursor: 'pointer' }} />
                                </div>

                                {/* Main Info */}
                                <div className="app-info">
                                    <div className="app-name">{app.fullName}</div>
                                    <div className="app-meta">
                                        <span>{app.email}</span>
                                        {app.phone && <><span className="app-dot">·</span><span>{app.phone}</span></>}
                                    </div>
                                </div>

                                {/* Role & Project */}
                                <div className="app-role">
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{app.castingCall.roleName}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{app.castingCall.project.title}</div>
                                </div>

                                {/* Attachments */}
                                <div className="app-attachments">
                                    <span className={`app-tag ${photoCount >= 4 ? 'tag-good' : 'tag-warn'}`}>
                                        📷 {photoCount}
                                    </span>
                                    <span className={`app-tag ${app.selfTapePath ? 'tag-good' : 'tag-bad'}`}>
                                        🎤 {app.selfTapePath ? '✓' : '✗'}
                                    </span>
                                </div>

                                {/* AI Score */}
                                <div className="app-score">
                                    {app.aiScore !== null ? (
                                        <>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                                                {app.aiScore}
                                            </div>
                                            {app.aiFitLevel && (
                                                <div style={{
                                                    fontSize: '0.58rem', fontWeight: 700,
                                                    textTransform: 'uppercase', letterSpacing: '0.03em',
                                                    color: scoreColor, opacity: 0.8,
                                                }}>
                                                    {app.aiFitLevel.replace('_', ' ')}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>—</div>
                                    )}
                                </div>

                                {/* Status */}
                                <div className="app-status">
                                    <span style={{
                                        padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700,
                                        borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.04em',
                                        background: statusStyle.bg, color: statusStyle.color,
                                        border: `1px solid ${statusStyle.color}20`,
                                    }}>
                                        {statusStyle.label}
                                    </span>
                                </div>

                                {/* Actions */}
                                <Link href={`/admin/applications/${app.id}`} className="app-view-btn">
                                    View
                                </Link>
                            </div>
                        )
                    })}
                </div>
            )}

            <style jsx>{`
                .app-card {
                    display: grid;
                    grid-template-columns: 36px 1fr 140px 80px 60px 100px 50px;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 16px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .app-card:hover {
                    background: rgba(255,255,255,0.04);
                    border-color: rgba(255,255,255,0.1);
                }
                .app-card-selected {
                    background: rgba(228,185,90,0.06) !important;
                    border-color: rgba(228,185,90,0.2) !important;
                }
                .app-checkbox { display: flex; align-items: center; justify-content: center; }
                .app-info { min-width: 0; }
                .app-name { font-weight: 700; font-size: 0.9rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .app-meta { display: flex; gap: 4px; align-items: center; font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px; flex-wrap: wrap; }
                .app-dot { opacity: 0.4; }
                .app-role { min-width: 0; }
                .app-attachments { display: flex; gap: 4px; }
                .app-tag { padding: 2px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 6px; }
                .tag-good { background: rgba(34,197,94,0.1); color: #22c55e; }
                .tag-warn { background: rgba(245,158,11,0.1); color: #f59e0b; }
                .tag-bad { background: rgba(239,68,68,0.1); color: #ef4444; }
                .app-score { text-align: center; }
                .app-status { text-align: center; }
                .app-view-btn {
                    font-size: 0.78rem; color: var(--text-secondary); text-decoration: none;
                    padding: 4px 10px; border-radius: 6px; font-weight: 600;
                    transition: all 0.15s;
                }
                .app-view-btn:hover { color: var(--accent-gold); background: rgba(228,185,90,0.08); }

                /* Bulk Action Bar */
                .bulk-action-bar {
                    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                    background: rgba(10,12,16,0.96); backdrop-filter: blur(24px);
                    border: 1px solid rgba(228,185,90,0.3); border-radius: 14px;
                    padding: 8px 16px; display: flex; align-items: center; gap: 6px;
                    z-index: 1000; box-shadow: 0 16px 48px rgba(0,0,0,0.6);
                    animation: barSlideUp 0.25s ease;
                }
                .bulk-count { font-size: 0.78rem; font-weight: 700; color: var(--accent-gold); white-space: nowrap; padding: 0 4px; }
                .bulk-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.08); }
                .bulk-btn {
                    font-size: 0.75rem; font-weight: 600; padding: 5px 12px;
                    border-radius: 7px; border: none; cursor: pointer;
                    background: rgba(255,255,255,0.05); color: var(--text-secondary);
                    white-space: nowrap; transition: all 0.15s;
                }
                .bulk-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }
                .bulk-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .bulk-approve { background: rgba(34,197,94,0.15); color: #22c55e; }
                .bulk-approve:hover { background: rgba(34,197,94,0.25); }
                .bulk-shortlist { background: rgba(59,130,246,0.15); color: #60a5fa; }
                .bulk-shortlist:hover { background: rgba(59,130,246,0.25); }
                .bulk-deny { background: rgba(239,68,68,0.15); color: #ef4444; }
                .bulk-deny:hover { background: rgba(239,68,68,0.25); }
                .bulk-delete { color: #ef4444; }

                @keyframes barSlideUp {
                    from { transform: translateX(-50%) translateY(16px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }

                @media (max-width: 900px) {
                    .app-card {
                        grid-template-columns: 32px 1fr auto;
                        gap: 8px;
                    }
                    .app-role, .app-attachments, .app-score { display: none; }
                    .app-status { grid-column: 2; }
                    .app-view-btn { grid-column: 3; }
                }
            `}</style>
        </>
    )
}
