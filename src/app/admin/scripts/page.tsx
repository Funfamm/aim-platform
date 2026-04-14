'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import TranslationBadge, { getTranslationCoverage } from '@/components/TranslationBadge'

interface Project {
    id: string
    title: string
}

interface ScriptCall {
    id: string
    title: string
    description: string
    genre: string | null
    status: string
    isPublic: boolean
    projectId: string | null
    deadline: string | null
    targetLength: string | null
    toneKeywords: string | null
    maxSubmissions: number
    project: { title: string } | null
    _count: { submissions: number }
    contentTranslations: string | null
}

const STATUS_META: Record<string, { color: string; bg: string; icon: string }> = {
    draft:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: '📝' },
    open:     { color: '#34d399', bg: 'rgba(52,211,153,0.08)',  icon: '📖' },
    closed:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '🔒' },
    archived: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: '🗃️' },
}


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
    const [showTranslations, setShowTranslations] = useState(false)
    const [retranslating, setRetranslating] = useState(false)

    // ── Bulk selection ──
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
    const [bulkDeleting, setBulkDeleting] = useState(false)

    const fetchCalls = useCallback(async () => {
        const res = await fetch('/api/script-calls')
        if (res.ok) setCalls(await res.json())
        setLoading(false)
        setSelectedIds(new Set())
    }, [])

    // ── Edit state ──
    const [editTarget, setEditTarget] = useState<ScriptCall | null>(null)
    const [editForm, setEditForm] = useState({
        title: '', description: '', genre: '', toneKeywords: '',
        targetLength: '', projectId: '', deadline: '',
        maxSubmissions: 100, isPublic: false, status: 'draft',
    })
    const [editSaving, setEditSaving] = useState(false)

    const openEdit = (call: ScriptCall) => {
        setEditTarget(call)
        setEditForm({
            title: call.title,
            description: call.description,
            genre: call.genre || '',
            toneKeywords: call.toneKeywords || '',
            targetLength: call.targetLength || '',
            projectId: call.projectId || '',
            deadline: call.deadline || '',
            maxSubmissions: call.maxSubmissions ?? 100,
            isPublic: call.isPublic,
            status: call.status,
        })
        setShowTranslations(false)
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editTarget) return
        setEditSaving(true)
        const res = await fetch(`/api/script-calls/${editTarget.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...editForm, projectId: editForm.projectId || null, maxSubmissions: Number(editForm.maxSubmissions) }),
        })
        if (res.ok) {
            setEditTarget(null)
            fetchCalls()
        }
        setEditSaving(false)
    }


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
        const making = !call.isPublic
        if (making) {
            const { isComplete, count, total } = getTranslationCoverage(call.contentTranslations)
            if (!isComplete) {
                const ok = confirm(
                    `⚠️ Translation Warning\n\nOnly ${count}/${total} languages have been translated for "${call.title}".\n\nPublishing now means international users will see untranslated content.\n\nContinue anyway?`
                )
                if (!ok) return
            }
        }
        await fetch(`/api/script-calls/${call.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: making }) })
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
    const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()

    const toggleSelect = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })
    const toggleSelectAll = () => setSelectedIds(
        allSelected ? new Set() : new Set(filtered.map(c => c.id))
    )

    const handleBulkDelete = async () => {
        setBulkDeleting(true)
        const ids = [...selectedIds]
        await fetch('/api/admin/script-calls/bulk-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
        })
        setConfirmBulkDelete(false)
        setBulkDeleting(false)
        fetchCalls()
    }

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
            <AdminSidebar />

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px', marginBottom: '16px' }}>
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
                        <button key={f} onClick={() => { setFilter(f); setSelectedIds(new Set()) }} style={{
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

                {/* ─── BULK ACTION BAR ─── */}
                {selectedIds.size > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 16px', marginBottom: '12px',
                        background: 'rgba(239,68,68,0.07)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '10px',
                    }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>
                            {selectedIds.size} selected
                        </span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setSelectedIds(new Set())} style={{
                            padding: '5px 12px', fontSize: '0.7rem', fontWeight: 600, borderRadius: '7px',
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                            color: 'var(--text-tertiary)', cursor: 'pointer',
                        }}>Clear</button>
                        <button onClick={() => setConfirmBulkDelete(true)} style={{
                            padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '7px',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444', cursor: 'pointer',
                        }}>🗑 Delete {selectedIds.size} Call{selectedIds.size !== 1 ? 's' : ''}</button>
                    </div>
                )}

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

                {/* ─── EDIT SLIDE-IN PANEL ─── */}
                {editTarget && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 9000,
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }}
                        onClick={() => !editSaving && setEditTarget(null)}
                    >
                        <form
                            onSubmit={handleEdit}
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: '560px',
                                background: 'var(--bg-card, #1a1d23)',
                                border: '1px solid rgba(212,168,83,0.18)',
                                borderRadius: '16px', padding: '24px',
                                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                                maxHeight: '90vh', overflowY: 'auto',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)' }}>
                                    ✏️ Edit Script Call
                                </div>
                                <button type="button" onClick={() => setEditTarget(null)} style={{
                                    background: 'none', border: 'none', color: 'var(--text-tertiary)',
                                    cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
                                }}>✕</button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={lbl}>Title *</label>
                                    <input style={inp} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} required />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={lbl}>Description *</label>
                                    <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} required />
                                </div>
                                <div>
                                    <label style={lbl}>Genre</label>
                                    <input style={inp} value={editForm.genre} onChange={e => setEditForm(f => ({ ...f, genre: e.target.value }))} placeholder="e.g. Sci-Fi Thriller" />
                                </div>
                                <div>
                                    <label style={lbl}>Target Length</label>
                                    <input style={inp} value={editForm.targetLength} onChange={e => setEditForm(f => ({ ...f, targetLength: e.target.value }))} placeholder="e.g. Short Film 10-15 min" />
                                </div>
                                <div>
                                    <label style={lbl}>Tone Keywords</label>
                                    <input style={inp} value={editForm.toneKeywords} onChange={e => setEditForm(f => ({ ...f, toneKeywords: e.target.value }))} placeholder="dark, suspenseful, poetic" />
                                </div>
                                <div>
                                    <label style={lbl}>Deadline</label>
                                    <input style={inp} type="date" value={editForm.deadline} onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={lbl}>Linked Project</label>
                                    <select style={inp} value={editForm.projectId} onChange={e => setEditForm(f => ({ ...f, projectId: e.target.value }))}>
                                        <option value="">None (general call)</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={lbl}>Max Submissions</label>
                                    <input style={inp} type="number" value={editForm.maxSubmissions} onChange={e => setEditForm(f => ({ ...f, maxSubmissions: Number(e.target.value) }))} />
                                </div>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '4px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={editForm.isPublic} onChange={e => setEditForm(f => ({ ...f, isPublic: e.target.checked }))} />
                                        Make Public
                                    </label>
                                    <select style={{ ...inp, width: 'auto', padding: '6px 12px' }} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                                        <option value="draft">Draft</option>
                                        <option value="open">Open</option>
                                        <option value="closed">Closed</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                    <div style={{ flex: 1 }} />
                                    <button type="submit" disabled={editSaving} style={{
                                        padding: '8px 20px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px',
                                        border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))',
                                        color: 'var(--accent-gold)', opacity: editSaving ? 0.6 : 1,
                                    }}>
                                        {editSaving ? 'Saving...' : '💾 Save Changes'}
                                    </button>
                                </div>

                                {/* ─── Translations Preview Panel ─── */}
                                {(() => {
                                    let translations: Record<string, Record<string, string>> | null = null
                                    try { translations = editTarget?.contentTranslations ? JSON.parse(editTarget.contentTranslations) : null } catch { /* ignore */ }
                                    const LANG_LABELS: Record<string, string> = {
                                        ar: 'AR 🇸🇦', de: 'DE 🇩🇪', es: 'ES 🇪🇸', fr: 'FR 🇫🇷',
                                        hi: 'HI 🇮🇳', ja: 'JA 🇯🇵', ko: 'KO 🇰🇷', pt: 'PT 🇵🇹',
                                        ru: 'RU 🇷🇺', zh: 'ZH 🇨🇳',
                                    }
                                    const coverage = translations ? Object.keys(LANG_LABELS).filter(l => translations![l]?.title).length : 0
                                    const total = Object.keys(LANG_LABELS).length
                                    return (
                                        <div style={{
                                            gridColumn: '1 / -1', borderRadius: '10px', overflow: 'hidden',
                                            border: '1px solid rgba(255,255,255,0.07)',
                                            background: 'rgba(255,255,255,0.02)', marginTop: '4px',
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setShowTranslations(t => !t)}
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '10px 14px', background: 'none', border: 'none',
                                                    cursor: 'pointer', color: 'var(--text-secondary)',
                                                }}
                                            >
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    🌐 Translations
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                                                        background: coverage === total ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)',
                                                        color: coverage === total ? '#34d399' : '#f59e0b',
                                                        border: `1px solid ${coverage === total ? 'rgba(52,211,153,0.2)' : 'rgba(245,158,11,0.2)'}`,
                                                    }}>{coverage}/{total} langs</span>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{showTranslations ? '▲' : '▼'}</span>
                                                </span>
                                            </button>
                                            {showTranslations && (
                                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px' }}>
                                                    {translations ? (
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                                                            {Object.entries(LANG_LABELS).map(([locale, label]) => {
                                                                const tr = translations![locale]
                                                                const hasData = tr?.title
                                                                return (
                                                                    <div key={locale} style={{
                                                                        padding: '6px 10px', borderRadius: '6px',
                                                                        background: hasData ? 'rgba(52,211,153,0.04)' : 'rgba(239,68,68,0.04)',
                                                                        border: `1px solid ${hasData ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.1)'}`,
                                                                        fontSize: '0.65rem',
                                                                    }}>
                                                                        <div style={{ fontWeight: 700, color: hasData ? '#34d399' : '#ef4444', marginBottom: '2px' }}>{label}</div>
                                                                        {hasData && <div style={{ color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.title}</div>}
                                                                        {!hasData && <div style={{ color: 'rgba(239,68,68,0.5)' }}>Not translated</div>}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '10px' }}>No translations yet.</p>
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={retranslating}
                                                        onClick={async () => {
                                                            if (!editTarget) return
                                                            setRetranslating(true)
                                                            try {
                                                                await fetch(`/api/script-calls/${editTarget.id}/translate`, { method: 'POST' })
                                                                fetchCalls()
                                                            } catch { /* silent */ }
                                                            setRetranslating(false)
                                                        }}
                                                        style={{
                                                            padding: '5px 14px', fontSize: '0.68rem', fontWeight: 700,
                                                            borderRadius: '6px', border: '1px solid rgba(212,168,83,0.25)',
                                                            background: 'rgba(212,168,83,0.07)', color: 'var(--accent-gold)',
                                                            cursor: retranslating ? 'not-allowed' : 'pointer',
                                                            opacity: retranslating ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {retranslating ? '⏳ Translating...' : '🌐 Re-translate'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                        </form>
                    </div>
                )}

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Select all row */}
                        {filtered.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleSelectAll}
                                    style={{ width: '15px', height: '15px', accentColor: '#ef4444', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={toggleSelectAll}>
                                    {allSelected ? 'Deselect all' : `Select all ${filtered.length}`}
                                </span>
                            </div>
                        )}
                        {filtered.map(call => {
                            const meta = STATUS_META[call.status] || STATUS_META.draft
                            const daysLeft = call.deadline ? Math.ceil((new Date(call.deadline).getTime() - now) / 86400000) : null
                            const isSelected = selectedIds.has(call.id)

                            return (
                                <div key={call.id} style={{
                                    borderRadius: '14px',
                                    background: isSelected
                                        ? 'linear-gradient(145deg, rgba(239,68,68,0.06), rgba(12,14,20,0.9))'
                                        : 'linear-gradient(145deg, rgba(18,20,28,0.95), rgba(12,14,20,0.9))',
                                    border: isSelected ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(255,255,255,0.07)',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {/* ── Card Banner / Header ── */}
                                    <div style={{
                                        padding: '20px 22px 16px',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        background: call.status === 'open'
                                            ? 'linear-gradient(135deg, rgba(52,211,153,0.05), rgba(52,211,153,0.01))'
                                            : call.status === 'draft'
                                            ? 'linear-gradient(135deg, rgba(148,163,184,0.04), transparent)'
                                            : 'linear-gradient(135deg, rgba(245,158,11,0.04), transparent)',
                                    }}>
                                        {/* Checkbox + Project badge row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(call.id)}
                                                style={{ width: '15px', height: '15px', accentColor: '#ef4444', cursor: 'pointer', flexShrink: 0 }}
                                            />
                                            {call.project && (
                                                <div style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                    padding: '4px 12px', borderRadius: '6px',
                                                    background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)',
                                                    fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-gold)',
                                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                                }}>
                                                    🎬 {call.project.title}
                                                </div>
                                            )}
                                        </div>

                                        {/* Title + Status row */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                                            <Link href={`/admin/scripts/${call.id}`} style={{
                                                fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)',
                                                textDecoration: 'none', flex: 1, minWidth: 0, lineHeight: 1.2,
                                                letterSpacing: '-0.01em',
                                            }}>
                                                {call.title}
                                            </Link>
                                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center', paddingTop: '2px' }}>
                                                <span style={{
                                                    fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                    padding: '3px 10px', borderRadius: '6px',
                                                    color: meta.color, background: meta.bg, border: `1px solid ${meta.color}30`,
                                                }}>
                                                    {meta.icon} {call.status}
                                                </span>
                                                {call.isPublic && (
                                                    <span style={{
                                                        fontSize: '0.6rem', fontWeight: 700, padding: '3px 10px', borderRadius: '6px',
                                                        color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                                                    }}>
                                                        🌐 Public
                                                    </span>
                                                )}
                                                <TranslationBadge translationsJson={call.contentTranslations} retry={{ type: 'script', id: call.id }} />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {call.description && (
                                            <div style={{
                                                fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                                                marginTop: '8px', display: '-webkit-box',
                                                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                            }}>
                                                {call.description}
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Meta + Actions Footer ── */}
                                    <div style={{ padding: '12px 22px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        {/* Meta pills */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-tertiary)', flex: 1, flexWrap: 'wrap' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ color: '#60a5fa', fontWeight: 700 }}>{call._count.submissions}</span>
                                                {' '}submission{call._count.submissions !== 1 ? 's' : ''}
                                            </span>
                                            {call.genre && <span style={{ color: 'var(--text-tertiary)' }}>· 🎭 {call.genre}</span>}
                                            {call.targetLength && <span>· ⏱ {call.targetLength}</span>}
                                            {daysLeft !== null && (
                                                <span style={{ color: daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : 'var(--text-tertiary)' }}>
                                                    · ⏰ {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                                                </span>
                                            )}
                                            {call.toneKeywords && call.toneKeywords.split(',').slice(0, 3).map((t, i) => (
                                                <span key={i} style={{
                                                    fontSize: '0.6rem', padding: '1px 7px', borderRadius: '4px',
                                                    background: 'rgba(139,92,246,0.08)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.12)',
                                                }}>{t.trim()}</span>
                                            ))}
                                        </div>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                            <Link href={`/admin/scripts/${call.id}`} style={{
                                                padding: '5px 14px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '7px',
                                                background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)',
                                                color: 'var(--accent-gold)', textDecoration: 'none', whiteSpace: 'nowrap',
                                            }}>
                                                📋 Submissions
                                            </Link>
                                            <button onClick={() => togglePublic(call)} style={{
                                                padding: '5px 11px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '7px',
                                                background: call.isPublic ? 'rgba(52,211,153,0.07)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${call.isPublic ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.07)'}`,
                                                color: call.isPublic ? '#34d399' : 'var(--text-tertiary)', cursor: 'pointer',
                                            }}>
                                                {call.isPublic ? '🌐' : '🔒'}
                                            </button>
                                            <select value={call.status} onChange={e => updateStatus(call, e.target.value)}
                                                style={{
                                                    padding: '5px 8px', fontSize: '0.68rem', borderRadius: '7px',
                                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                                }}>
                                                <option value="draft">Draft</option>
                                                <option value="open">Open</option>
                                                <option value="closed">Closed</option>
                                                <option value="archived">Archived</option>
                                            </select>
                                            <button onClick={() => openEdit(call)} style={{
                                                padding: '5px 11px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '7px',
                                                background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)',
                                                color: '#60a5fa', cursor: 'pointer',
                                            }}>✏️</button>
                                            <button onClick={() => deleteCall(call.id)} style={{
                                                padding: '5px 9px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '7px',
                                                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                                                color: '#ef4444', cursor: 'pointer',
                                            }}>✕</button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {/* ─── PERMANENT DELETE CONFIRM MODAL ─── */}
            {confirmBulkDelete && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                }} onClick={() => !bulkDeleting && setConfirmBulkDelete(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: 'var(--bg-card, #1a1d23)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '16px', padding: '28px',
                        maxWidth: '440px', width: '100%',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                    }}>
                        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '12px' }}>🗑️</div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 800, textAlign: 'center', marginBottom: '8px', color: '#ef4444' }}>
                            Permanently Delete {selectedIds.size} Script Call{selectedIds.size !== 1 ? 's' : ''}?
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: '6px', lineHeight: 1.6 }}>
                            This will permanently delete the selected script call{selectedIds.size !== 1 ? 's' : ''} and
                            <strong style={{ color: 'var(--text-secondary)' }}> all associated submissions</strong>.
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, textAlign: 'center', marginBottom: '20px' }}>
                            ⚠️ This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setConfirmBulkDelete(false)}
                                disabled={bulkDeleting}
                                style={{
                                    padding: '8px 22px', fontSize: '0.78rem', fontWeight: 700,
                                    borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'transparent', color: 'var(--text-secondary)',
                                    cursor: 'pointer', opacity: bulkDeleting ? 0.5 : 1,
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting}
                                style={{
                                    padding: '8px 22px', fontSize: '0.78rem', fontWeight: 700,
                                    borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                                    background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                                    cursor: 'pointer', opacity: bulkDeleting ? 0.6 : 1,
                                }}
                            >{bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Call${selectedIds.size !== 1 ? 's' : ''}`}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
