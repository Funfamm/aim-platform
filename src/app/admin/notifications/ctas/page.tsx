'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface CtaProject {
    id: string; title: string; slug: string; status: string; coverImage: string | null
}

interface CtaItem {
    id: string; videoId: string; notificationType: string
    signupTag: string; status: string
    eyebrow: string; headlineRegular: string; headlineItalic: string
    buttonLabel: string; triggerSecondsFromEnd: number
    createdAt: string; updatedAt: string; createdBy: string | null
    project: CtaProject | null; signupCount: number; signupsLast7Days: number
}

export default function AdminNotificationCtas() {
    const [ctas, setCtas] = useState<CtaItem[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [error, setError] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // ── Create CTA state ──
    const [showCreate, setShowCreate] = useState(false)
    const [projects, setProjects] = useState<{ id: string; title: string; slug: string }[]>([])
    const [newVideoId, setNewVideoId] = useState('')
    const [newType, setNewType] = useState<'release' | 'more'>('release')
    const [createLoading, setCreateLoading] = useState(false)

    const fetchCtas = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/cta-configurations?status=${statusFilter}`)
            const data = await res.json()
            setCtas(data.ctas || [])
        } catch {
            setError('Failed to load CTAs')
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => { fetchCtas() }, [fetchCtas])

    // Fetch projects for the create form
    useEffect(() => {
        if (!showCreate) return
        fetch('/api/admin/projects?limit=200')
            .then(r => r.json())
            .then(data => {
                const list = (data.projects || data)
                if (Array.isArray(list)) setProjects(list.map((p: Record<string, string>) => ({ id: p.id, title: p.title, slug: p.slug })))
            })
            .catch(() => {})
    }, [showCreate])

    const toggleStatus = async (id: string, newStatus: string) => {
        setActionLoading(id)
        try {
            await fetch('/api/admin/cta-configurations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus }),
            })
            await fetchCtas()
        } catch {
            setError('Failed to update CTA')
        } finally {
            setActionLoading(null)
        }
    }

    const createCta = async () => {
        if (!newVideoId) return
        setCreateLoading(true)
        try {
            const res = await fetch('/api/admin/cta-configurations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: newVideoId, notificationType: newType }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Failed to create CTA')
                return
            }
            setShowCreate(false)
            setNewVideoId('')
            await fetchCtas()
        } catch {
            setError('Failed to create CTA')
        } finally {
            setCreateLoading(false)
        }
    }

    const statusBadge = (status: string) => {
        const colors: Record<string, { bg: string; text: string }> = {
            active: { bg: 'rgba(72,187,120,0.15)', text: '#48bb78' },
            disabled: { bg: 'rgba(160,174,192,0.15)', text: '#a0aec0' },
            auto_disabled_post_release: { bg: 'rgba(99,179,237,0.15)', text: '#63b3ed' },
        }
        const c = colors[status] || colors.disabled
        return (
            <span style={{
                padding: '3px 10px', borderRadius: '12px', fontSize: '0.7rem',
                fontWeight: 700, background: c.bg, color: c.text, whiteSpace: 'nowrap',
            }}>
                {status === 'auto_disabled_post_release' ? 'Post-Release' : status}
            </span>
        )
    }

    const typeBadge = (type: string) => (
        <span style={{
            padding: '3px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700,
            background: type === 'release'
                ? 'rgba(212,168,83,0.15)' : 'rgba(159,122,234,0.15)',
            color: type === 'release' ? '#d4a853' : '#9f7aea',
            whiteSpace: 'nowrap',
        }}>
            {type === 'release' ? '🔔 Release' : '🔁 More'}
        </span>
    )

    return (
        <div style={{ padding: 'var(--space-lg)', maxWidth: '1200px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--space-xl)' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        🔔 Notify Me CTAs
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                        Manage end-card notification CTAs across all videos
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Link href="/admin/notifications/analytics" style={{
                        padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)', textDecoration: 'none', transition: 'all 0.15s',
                    }}>
                        📊 Analytics
                    </Link>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700,
                            background: 'var(--accent-gold)', border: 'none', color: '#000', cursor: 'pointer',
                            transition: 'transform 0.15s',
                        }}
                    >
                        + New CTA
                    </button>
                </div>
            </div>

            {error && (
                <div style={{
                    padding: '10px 16px', borderRadius: '8px', marginBottom: '16px',
                    background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)',
                    color: 'rgba(255,80,80,0.9)', fontSize: '0.85rem',
                }}>
                    {error}
                    <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* Create CTA Panel */}
            {showCreate && (
                <div style={{
                    padding: '20px', borderRadius: '12px', marginBottom: '20px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
                }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
                        Create New CTA
                    </h3>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Video</label>
                            <select
                                value={newVideoId}
                                onChange={e => setNewVideoId(e.target.value)}
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)', fontSize: '0.85rem',
                                }}
                            >
                                <option value="">Select a video...</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Type</label>
                            <select
                                value={newType}
                                onChange={e => setNewType(e.target.value as 'release' | 'more')}
                                style={{
                                    padding: '8px 12px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)', fontSize: '0.85rem',
                                }}
                            >
                                <option value="release">🔔 Release (Pre-release)</option>
                                <option value="more">🔁 More (Continuation)</option>
                            </select>
                        </div>
                        <button
                            onClick={createCta}
                            disabled={createLoading || !newVideoId}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700,
                                background: newVideoId ? 'var(--accent-gold)' : 'rgba(255,255,255,0.06)',
                                border: 'none', color: newVideoId ? '#000' : 'var(--text-tertiary)',
                                cursor: newVideoId ? 'pointer' : 'not-allowed',
                            }}
                        >
                            {createLoading ? '...' : 'Create'}
                        </button>
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                {['all', 'active', 'disabled', 'auto_disabled_post_release'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        style={{
                            padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                            border: '1px solid',
                            borderColor: statusFilter === s ? 'rgba(212,168,83,0.4)' : 'var(--border-subtle)',
                            background: statusFilter === s ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.03)',
                            color: statusFilter === s ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        {s === 'all' ? 'All' : s === 'auto_disabled_post_release' ? 'Post-Release' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                ))}
            </div>

            {/* CTA Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                    Loading...
                </div>
            ) : ctas.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)',
                    background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.3 }}>🔔</div>
                    <p>No CTAs found. Create one to start collecting email signups.</p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.75rem' }}>Video</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.75rem' }}>Type</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.75rem' }}>Status</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.75rem' }}>Signups</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.75rem' }}>Last 7d</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.75rem' }}>Tag</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.75rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ctas.map(cta => (
                                <tr key={cta.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                                >
                                    <td style={{ padding: '12px', maxWidth: '200px' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cta.project?.title || 'Unknown'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px' }}>{typeBadge(cta.notificationType)}</td>
                                    <td style={{ padding: '12px' }}>{statusBadge(cta.status)}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-gold)' }}>
                                        {cta.signupCount.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', color: cta.signupsLast7Days > 0 ? '#48bb78' : 'var(--text-tertiary)' }}>
                                        {cta.signupsLast7Days > 0 ? `+${cta.signupsLast7Days}` : '—'}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <code style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                                            {cta.signupTag}
                                        </code>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                            <Link
                                                href={`/admin/notifications/ctas/${cta.id}`}
                                                style={{
                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-secondary)', textDecoration: 'none',
                                                }}
                                            >
                                                Edit
                                            </Link>
                                            <button
                                                onClick={() => toggleStatus(cta.id, cta.status === 'active' ? 'disabled' : 'active')}
                                                disabled={actionLoading === cta.id}
                                                style={{
                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                                                    background: cta.status === 'active' ? 'rgba(255,80,80,0.08)' : 'rgba(72,187,120,0.08)',
                                                    border: '1px solid',
                                                    borderColor: cta.status === 'active' ? 'rgba(255,80,80,0.2)' : 'rgba(72,187,120,0.2)',
                                                    color: cta.status === 'active' ? 'rgba(255,80,80,0.9)' : '#48bb78',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {actionLoading === cta.id ? '...' : cta.status === 'active' ? 'Disable' : 'Enable'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
