'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ScriptCall {
    id: string
    title: string
    description: string
    genre: string | null
    targetLength: string | null
    status: string
    isPublic: boolean
    deadline: string | null
    maxSubmissions: number
    toneKeywords: string | null
    projectId: string | null
    project: { title: string } | null
    _count: { submissions: number }
    createdAt: string
}

interface Project { id: string; title: string }

const STATUS_META: Record<string, { color: string; bg: string; icon: string }> = {
    draft: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: '📝' },
    open: { color: '#34d399', bg: 'rgba(52,211,153,0.08)', icon: '📖' },
    closed: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '🔒' },
    archived: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: '📦' },
}

const NAV = [
    { href: '/admin/analytics', label: '📊 Analytics' },
    { href: '/admin/projects', label: '🎬 Projects' },
    { href: '/admin/casting', label: '🎭 Casting' },
    { href: '/admin/applications', label: '📋 Applications' },
    { href: '/admin/media', label: '🖼️ Page Media' },
    { href: '/admin/sponsors', label: '🤝 Sponsors' },
    { href: '/admin/donations', label: '💰 Donations' },
    { href: '/admin/users', label: '👥 Users' },
    { href: '/admin/scripts', label: '✍️ Scripts' },
    { href: '/admin/training', label: '🎓 Training' },
    { href: '/admin/settings', label: '⚙️ Settings' },
]

export default function AdminScriptsPage() {
    const [calls, setCalls] = useState<ScriptCall[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState({
        title: '', description: '', genre: '', toneKeywords: '',
        targetLength: '', projectId: '', deadline: '',
        maxSubmissions: 100, isPublic: false, status: 'draft',
    })
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState<string>('all')
    const [scriptsEnabled, setScriptsEnabled] = useState(false)
    const [togglingScripts, setTogglingScripts] = useState(false)

    const fetchCalls = useCallback(async () => {
        const res = await fetch('/api/script-calls')
        if (res.ok) setCalls(await res.json())
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchCalls()
        fetch('/api/admin/projects').then(r => r.json()).then(p => setProjects(Array.isArray(p) ? p : [])).catch(() => {})
        // Fetch scripts toggle
        fetch('/api/admin/toggles').then(r => r.json()).then(s => {
            if (typeof s.scriptCallsEnabled === 'boolean') setScriptsEnabled(s.scriptCallsEnabled)
        }).catch(() => {})
    }, [fetchCalls])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true)
        const res = await fetch('/api/script-calls', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, projectId: form.projectId || null, maxSubmissions: Number(form.maxSubmissions) }),
        })
        if (res.ok) {
            setShowCreate(false)
            setForm({ title: '', description: '', genre: '', toneKeywords: '', targetLength: '', projectId: '', deadline: '', maxSubmissions: 100, isPublic: false, status: 'draft' })
            fetchCalls()
        }
        setSaving(false)
    }

    const togglePublic = async (call: ScriptCall) => {
        await fetch(`/api/script-calls/${call.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: !call.isPublic }) })
        fetchCalls()
    }

    const updateStatus = async (call: ScriptCall, status: string) => {
        await fetch(`/api/script-calls/${call.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
        fetchCalls()
    }

    const deleteCall = async (id: string) => {
        if (!confirm('Delete this script call and all its submissions?')) return
        await fetch(`/api/script-calls/${id}`, { method: 'DELETE' })
        fetchCalls()
    }

    const filtered = filter === 'all' ? calls : calls.filter(c => c.status === filter)
    const totalSubs = calls.reduce((s, c) => s + c._count.submissions, 0)
    const openCount = calls.filter(c => c.status === 'open').length
    const now = Date.now()

    const inp: React.CSSProperties = {
        width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
        color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit',
    }
    const lbl: React.CSSProperties = {
        display: 'block', fontSize: '0.6rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-tertiary)', marginBottom: '4px',
    }

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="admin-sidebar-logo">
                    <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--accent-gold)' }}>AIM</span> Studio
                    </Link>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>Admin Panel</div>
                </div>
                <ul className="admin-sidebar-nav">
                    {NAV.map(n => (
                        <li key={n.href}><Link href={n.href} className={n.href === '/admin/scripts' ? 'active' : ''}>{n.label}</Link></li>
                    ))}
                </ul>
            </aside>

            <main className="admin-main">
                {/* ─── HEADER ─── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>✍️ Script Calls</h1>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                            Manage screenplay submission calls · AI-powered script analysis
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={async () => {
                                setTogglingScripts(true)
                                try {
                                    const nv = !scriptsEnabled
                                    const res = await fetch('/api/admin/toggles', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ scriptCallsEnabled: nv }),
                                    })
                                    if (res.ok) setScriptsEnabled(nv)
                                    else alert('Failed to toggle')
                                } catch { alert('Failed to toggle') }
                                setTogglingScripts(false)
                            }}
                            disabled={togglingScripts}
                            style={{
                                padding: '6px 16px', fontSize: '0.78rem', fontWeight: 700,
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: scriptsEnabled ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                                color: scriptsEnabled ? '#34d399' : '#ef4444',
                                transition: 'all 0.2s',
                            }}
                        >
                            {togglingScripts ? '...' : scriptsEnabled ? '🟢 Scripts Live' : '🔴 Scripts Hidden'}
                        </button>
                        <button onClick={() => setShowCreate(!showCreate)} style={{
                            padding: '8px 18px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px',
                            border: showCreate ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(212,168,83,0.3)',
                            background: showCreate ? 'rgba(239,68,68,0.08)' : 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))',
                            color: showCreate ? '#ef4444' : 'var(--accent-gold)', cursor: 'pointer',
                        }}>
                            {showCreate ? '✕ Cancel' : '+ New Script Call'}
                        </button>
                    </div>
                </div>

                {/* ─── STATS BAR ─── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                    {[
                        { label: 'Total Calls', value: calls.length, icon: '📜', color: 'var(--accent-gold)' },
                        { label: 'Open', value: openCount, icon: '📖', color: '#34d399' },
                        { label: 'Submissions', value: totalSubs, icon: '📄', color: '#60a5fa' },
                        { label: 'Projects Linked', value: calls.filter(c => c.projectId).length, icon: '🎬', color: '#a78bfa' },
                    ].map(s => (
                        <div key={s.label} style={{
                            padding: '12px', borderRadius: '10px', textAlign: 'center',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <div style={{ fontSize: '0.9rem', marginBottom: '2px' }}>{s.icon}</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* ─── FILTER TABS ─── */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', overflowX: 'auto' }}>
                    {['all', 'draft', 'open', 'closed', 'archived'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            padding: '5px 14px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px',
                            border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                            background: filter === f ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)',
                            color: filter === f ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            borderBottom: filter === f ? '2px solid var(--accent-gold)' : '2px solid transparent',
                        }}>
                            {f === 'all' ? `All (${calls.length})` : `${f} (${calls.filter(c => c.status === f).length})`}
                        </button>
                    ))}
                </div>

                {/* ─── CREATE FORM ─── */}
                {showCreate && (
                    <form onSubmit={handleCreate} style={{
                        padding: '16px', marginBottom: '16px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(212,168,83,0.04), rgba(139,92,246,0.03))',
                        border: '1px solid rgba(212,168,83,0.12)',
                    }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '12px' }}>
                            📝 New Script Call
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={lbl}>Title *</label>
                                <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. Original Sci-Fi Short Film Screenplay" />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={lbl}>Description *</label>
                                <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="Describe what you're looking for..." />
                            </div>
                            <div>
                                <label style={lbl}>Genre</label>
                                <input style={inp} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="e.g. Sci-Fi Thriller" />
                            </div>
                            <div>
                                <label style={lbl}>Target Length</label>
                                <input style={inp} value={form.targetLength} onChange={e => setForm(f => ({ ...f, targetLength: e.target.value }))} placeholder="e.g. Short Film 10-15 min" />
                            </div>
                            <div>
                                <label style={lbl}>Tone Keywords</label>
                                <input style={inp} value={form.toneKeywords} onChange={e => setForm(f => ({ ...f, toneKeywords: e.target.value }))} placeholder="dark, suspenseful, poetic" />
                            </div>
                            <div>
                                <label style={lbl}>Deadline</label>
                                <input style={inp} type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
                            </div>
                            <div>
                                <label style={lbl}>Linked Project</label>
                                <select style={inp} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                                    <option value="">None (general call)</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Max Submissions</label>
                                <input style={inp} type="number" value={form.maxSubmissions} onChange={e => setForm(f => ({ ...f, maxSubmissions: Number(e.target.value) }))} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} />
                                    Make Public
                                </label>
                                <select style={{ ...inp, width: 'auto', padding: '6px 12px' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                    <option value="draft">Draft</option>
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                </select>
                                <div style={{ flex: 1 }} />
                                <button type="submit" disabled={saving} style={{
                                    padding: '8px 20px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px',
                                    border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))',
                                    color: 'var(--accent-gold)', opacity: saving ? 0.6 : 1,
                                }}>
                                    {saving ? 'Creating...' : '✨ Create'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {/* ─── CALLS LIST ─── */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '40px 20px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <div style={{ fontSize: '2rem', opacity: 0.3, marginBottom: '8px' }}>✍️</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            {filter === 'all' ? 'No script calls yet' : `No ${filter} script calls`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            {filter === 'all' ? 'Create your first script call to start receiving screenplay submissions.' : 'Try a different filter.'}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filtered.map(call => {
                            const meta = STATUS_META[call.status] || STATUS_META.draft
                            const daysLeft = call.deadline ? Math.ceil((new Date(call.deadline).getTime() - now) / 86400000) : null

                            return (
                                <div key={call.id} style={{
                                    padding: '14px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                    transition: 'all 0.2s',
                                }}>
                                    {/* Top Row: Title + Badges */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                        <Link href={`/admin/scripts/${call.id}`} style={{
                                            fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)',
                                            textDecoration: 'none', flex: 1, minWidth: 0,
                                        }}>
                                            {call.title}
                                        </Link>
                                        <span style={{
                                            fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                                            padding: '2px 8px', borderRadius: '4px',
                                            color: meta.color, background: meta.bg, border: `1px solid ${meta.color}25`,
                                        }}>
                                            {meta.icon} {call.status}
                                        </span>
                                        {call.isPublic && (
                                            <span style={{ fontSize: '0.52rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
                                                🌐 Public
                                            </span>
                                        )}
                                    </div>

                                    {/* Meta Row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        {call.genre && <span>🎬 {call.genre}</span>}
                                        <span>📄 {call._count.submissions} submission{call._count.submissions !== 1 ? 's' : ''}</span>
                                        {call.project && <span>🎯 {call.project.title}</span>}
                                        {call.targetLength && <span>⏱️ {call.targetLength}</span>}
                                        {daysLeft !== null && (
                                            <span style={{ color: daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : 'var(--text-tertiary)' }}>
                                                ⏰ {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                                            </span>
                                        )}
                                        {call.toneKeywords && (
                                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                                {call.toneKeywords.split(',').slice(0, 3).map((t, i) => (
                                                    <span key={i} style={{
                                                        fontSize: '0.58rem', padding: '1px 6px', borderRadius: '3px',
                                                        background: 'rgba(139,92,246,0.08)', color: '#a78bfa',
                                                    }}>{t.trim()}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Description preview */}
                                    {call.description && (
                                        <div style={{
                                            fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                                            maxHeight: '36px', overflow: 'hidden', marginBottom: '10px',
                                        }}>
                                            {call.description}
                                        </div>
                                    )}

                                    {/* Actions Row */}
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <Link href={`/admin/scripts/${call.id}`} style={{
                                            padding: '4px 12px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px',
                                            background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.15)',
                                            color: 'var(--accent-gold)', textDecoration: 'none',
                                        }}>
                                            View Submissions ({call._count.submissions})
                                        </Link>
                                        <button onClick={() => togglePublic(call)} style={{
                                            padding: '4px 10px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px',
                                            background: call.isPublic ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${call.isPublic ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)'}`,
                                            color: call.isPublic ? '#34d399' : 'var(--text-tertiary)', cursor: 'pointer',
                                        }}>
                                            {call.isPublic ? '🌐 Public' : '🔒 Private'}
                                        </button>
                                        <select value={call.status} onChange={e => updateStatus(call, e.target.value)}
                                            style={{
                                                padding: '4px 8px', fontSize: '0.68rem', borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                                color: 'var(--text-secondary)', cursor: 'pointer',
                                            }}>
                                            <option value="draft">Draft</option>
                                            <option value="open">Open</option>
                                            <option value="closed">Closed</option>
                                            <option value="archived">Archived</option>
                                        </select>
                                        <div style={{ flex: 1 }} />
                                        <button onClick={() => deleteCall(call.id)} style={{
                                            padding: '4px 8px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px',
                                            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)',
                                            color: '#ef4444', cursor: 'pointer',
                                        }}>✕</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}
