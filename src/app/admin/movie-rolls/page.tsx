'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Roll {
    id: string
    title: string
    icon: string
    slug: string
    displayOn: string
    visible: boolean
    sortOrder: number
    _count: { projects: number }
    projects: { id: string; projectId: string; sortOrder: number }[]
}

interface Project {
    id: string
    title: string
    slug: string
    coverImage: string | null
    status: string
}

type ModalMode = 'create' | 'edit'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    completed:       { bg: 'rgba(52,211,153,0.1)',  color: '#34d399' },
    'in-production': { bg: 'rgba(212,168,83,0.1)',  color: '#d4a853' },
    upcoming:        { bg: 'rgba(96,165,250,0.1)',   color: '#60a5fa' },
}

const DISPLAY_LABELS: Record<string, string> = {
    both: 'Both Pages', homepage: 'Homepage', works: 'Works Page',
}

const ICON_PRESETS = ['🎬', '⭐', '🔥', '🆕', '🏆', '🎞️', '✅', '🎭', '🌟', '🎪', '🎥', '💎']

export default function MovieRollsAdmin() {
    const [rolls, setRolls]         = useState<Roll[]>([])
    const [projects, setProjects]   = useState<Project[]>([])
    const [loading, setLoading]     = useState(true)
    const [saving, setSaving]       = useState(false)
    const [expandedRoll, setExpandedRoll] = useState<string | null>(null)
    const [projectSearch, setProjectSearch] = useState('')
    const [notification, setNotification] = useState<{ msg: string; type: 'ok'|'err' } | null>(null)

    // Modal state
    const [modal, setModal] = useState<{ mode: ModalMode; roll?: Roll } | null>(null)
    const [formTitle, setFormTitle]     = useState('')
    const [formIcon, setFormIcon]       = useState('🎬')
    const [formDisplayOn, setFormDisplayOn] = useState('both')
    const [formVisible, setFormVisible] = useState(true)
    const [formSlug, setFormSlug]       = useState('')
    const titleInputRef = useRef<HTMLInputElement>(null)

    // ── Data fetch ─────────────────────────────────────────────────────────────
    const fetchRolls = useCallback(async () => {
        const res = await fetch('/api/admin/movie-rolls')
        if (res.ok) setRolls(await res.json())
    }, [])

    const fetchProjects = useCallback(async () => {
        const res = await fetch('/api/admin/projects')
        if (res.ok) {
            const data = await res.json()
            setProjects(data.map((p: Project & Record<string, unknown>) => ({
                id: p.id, title: p.title, slug: p.slug,
                coverImage: p.coverImage, status: p.status,
            })))
        }
    }, [])

    useEffect(() => {
        Promise.all([fetchRolls(), fetchProjects()]).then(() => setLoading(false))
    }, [fetchRolls, fetchProjects])

    // ── Notification helper ─────────────────────────────────────────────────
    const notify = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setNotification({ msg, type })
        setTimeout(() => setNotification(null), 3000)
    }

    // ── Modal helpers ───────────────────────────────────────────────────────
    const openCreate = () => {
        setFormTitle(''); setFormIcon('🎬'); setFormDisplayOn('both')
        setFormVisible(true); setFormSlug('')
        setModal({ mode: 'create' })
        setTimeout(() => titleInputRef.current?.focus(), 80)
    }

    const openEdit = (roll: Roll) => {
        setFormTitle(roll.title); setFormIcon(roll.icon)
        setFormDisplayOn(roll.displayOn); setFormVisible(roll.visible)
        setFormSlug(roll.slug)
        setModal({ mode: 'edit', roll })
        setTimeout(() => titleInputRef.current?.focus(), 80)
    }

    const closeModal = () => setModal(null)

    // ── CRUD ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formTitle.trim()) return
        setSaving(true)
        try {
            if (modal?.mode === 'create') {
                const res = await fetch('/api/admin/movie-rolls', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: formTitle.trim(),
                        icon: formIcon,
                        displayOn: formDisplayOn,
                        visible: formVisible,
                        slug: formSlug.trim() || undefined,
                    }),
                })
                if (!res.ok) {
                    const d = await res.json()
                    notify(d.error || 'Failed to create roll', 'err')
                    return
                }
                notify('Roll created ✓')
            } else if (modal?.mode === 'edit' && modal.roll) {
                const res = await fetch('/api/admin/movie-rolls', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: modal.roll.id,
                        title: formTitle.trim(),
                        icon: formIcon,
                        displayOn: formDisplayOn,
                        visible: formVisible,
                        slug: formSlug.trim() || undefined,
                    }),
                })
                if (!res.ok) {
                    const d = await res.json()
                    notify(d.error || 'Failed to update roll', 'err')
                    return
                }
                notify('Roll updated ✓')
            }
            closeModal()
            await fetchRolls()
        } finally {
            setSaving(false)
        }
    }

    const deleteRoll = async (roll: Roll) => {
        if (!confirm(`Delete "${roll.title}"? This cannot be undone.`)) return
        const res = await fetch(`/api/admin/movie-rolls?id=${roll.id}`, { method: 'DELETE' })
        if (res.ok) { notify('Roll deleted'); await fetchRolls() }
        else notify('Delete failed', 'err')
    }

    const toggleVisibility = async (roll: Roll) => {
        await fetch('/api/admin/movie-rolls', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: roll.id, visible: !roll.visible }),
        })
        await fetchRolls()
    }

    const addProject = async (rollId: string, projectId: string) => {
        await fetch('/api/admin/movie-rolls/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rollId, projectId }),
        })
        await fetchRolls()
    }

    const removeProject = async (rollId: string, projectId: string) => {
        await fetch(`/api/admin/movie-rolls/projects?rollId=${rollId}&projectId=${projectId}`, { method: 'DELETE' })
        await fetchRolls()
    }

    // ── Filtered projects (search) ───────────────────────────────────────────
    const filteredProjects = (available: Project[]) => {
        const q = projectSearch.toLowerCase().trim()
        if (!q) return available
        return available.filter(p => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
    }

    // ── CSS in JS (scoped to this page) ─────────────────────────────────────
    const css = `
.mr-page { padding: 2rem 2.5rem; max-width: 1100px; margin: 0 auto; }
@media(max-width:900px){ .mr-page { padding: 1.25rem 1rem; } }

/* ── Header ── */
.mr-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:2rem; flex-wrap:wrap; }
.mr-header-text h1 { font-size:1.75rem; font-weight:800; letter-spacing:-0.02em; margin:0; color:#fff; }
.mr-header-text p { font-size:0.8rem; color:rgba(255,255,255,0.45); margin:4px 0 0; }
.mr-btn-primary {
    display:inline-flex; align-items:center; gap:6px;
    padding:0.6rem 1.25rem; border-radius:10px;
    background:linear-gradient(135deg,#d4a853,#b8903f);
    color:#000; font-weight:700; font-size:0.85rem;
    border:none; cursor:pointer; transition:opacity 0.15s, transform 0.12s;
    white-space:nowrap; flex-shrink:0;
}
.mr-btn-primary:hover { opacity:0.88; }
.mr-btn-primary:active { transform:scale(0.97); }
.mr-btn-ghost {
    display:inline-flex; align-items:center; gap:6px;
    padding:0.5rem 0.9rem; border-radius:8px;
    background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
    color:rgba(255,255,255,0.7); font-size:0.78rem; font-weight:600;
    cursor:pointer; transition:all 0.15s;
}
.mr-btn-ghost:hover { background:rgba(255,255,255,0.09); color:#fff; }
.mr-btn-danger {
    display:inline-flex; align-items:center; gap:4px;
    padding:0.4rem 0.7rem; border-radius:7px;
    background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2);
    color:#f87171; font-size:0.75rem; font-weight:600;
    cursor:pointer; transition:all 0.15s;
}
.mr-btn-danger:hover { background:rgba(239,68,68,0.15); }

/* ── Empty state ── */
.mr-empty {
    text-align:center; padding:5rem 2rem;
    background:rgba(255,255,255,0.015); border:1px dashed rgba(255,255,255,0.08);
    border-radius:16px; color:rgba(255,255,255,0.35);
}
.mr-empty-icon { font-size:3rem; margin-bottom:1rem; opacity:0.5; }
.mr-empty h3 { font-size:1.1rem; font-weight:700; color:rgba(255,255,255,0.5); margin:0 0 0.5rem; }
.mr-empty p { font-size:0.82rem; margin:0; }

/* ── Roll cards ── */
.mr-rolls { display:flex; flex-direction:column; gap:0.75rem; }
.mr-roll {
    border-radius:14px;
    border:1px solid rgba(255,255,255,0.07);
    background:rgba(255,255,255,0.02);
    overflow:hidden;
    transition:border-color 0.2s;
}
.mr-roll.visible { border-color:rgba(212,168,83,0.2); }
.mr-roll-header {
    display:flex; align-items:center; gap:0.75rem;
    padding:0.85rem 1rem; cursor:pointer;
    transition:background 0.15s;
}
.mr-roll-header:hover { background:rgba(255,255,255,0.03); }
.mr-roll-icon { font-size:1.4rem; width:2rem; text-align:center; flex-shrink:0; }
.mr-roll-meta { flex:1; min-width:0; }
.mr-roll-title {
    font-size:0.95rem; font-weight:700; color:#fff;
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
}
.mr-badge {
    font-size:0.58rem; font-weight:700; letter-spacing:0.05em;
    padding:2px 7px; border-radius:5px; text-transform:uppercase;
}
.mr-badge-live  { background:rgba(52,211,153,0.12); color:#34d399; }
.mr-badge-hidden{ background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.35); }
.mr-badge-blue  { background:rgba(96,165,250,0.1); color:#60a5fa; }
.mr-roll-sub { font-size:0.7rem; color:rgba(255,255,255,0.35); margin-top:3px; }
.mr-roll-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.mr-roll-chevron {
    font-size:0.7rem; color:rgba(255,255,255,0.3);
    transition:transform 0.22s ease; flex-shrink:0; margin-left:4px;
}
.mr-roll-chevron.open { transform:rotate(180deg); }

/* ── Expanded panel ── */
.mr-expand {
    border-top:1px solid rgba(255,255,255,0.06);
    padding:1rem 1.25rem 1.25rem;
    animation:expandIn 0.18s ease-out;
}
@keyframes expandIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }

/* ── Two-column layout (desktop) ── */
.mr-expand-grid {
    display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;
}
@media(max-width:700px){ .mr-expand-grid { grid-template-columns:1fr; } }

.mr-expand-section-label {
    font-size:0.65rem; font-weight:700; letter-spacing:0.08em;
    color:rgba(255,255,255,0.35); text-transform:uppercase;
    margin-bottom:0.5rem; display:block;
}

/* ── Project pills in roll ── */
.mr-project-item {
    display:flex; align-items:center; gap:8px;
    padding:7px 8px; border-radius:8px;
    background:rgba(255,255,255,0.035);
    margin-bottom:4px;
    transition:background 0.15s;
}
.mr-project-item:hover { background:rgba(255,255,255,0.06); }
.mr-project-thumb {
    width:36px; height:26px; object-fit:cover;
    border-radius:5px; flex-shrink:0;
}
.mr-project-thumb-placeholder {
    width:36px; height:26px; border-radius:5px;
    flex-shrink:0; background:rgba(255,255,255,0.05);
    display:flex; align-items:center; justify-content:center;
    font-size:0.9rem;
}
.mr-project-name { flex:1; font-size:0.78rem; font-weight:600; color:#fff; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mr-project-status {
    font-size:0.6rem; font-weight:600; padding:2px 6px; border-radius:4px; flex-shrink:0;
}

/* ── Add project panel ── */
.mr-add-search {
    width:100%; padding:0.5rem 0.75rem; border-radius:8px;
    border:1px solid rgba(255,255,255,0.1);
    background:rgba(255,255,255,0.04); color:#fff; font-size:0.82rem;
    margin-bottom:0.5rem; outline:none; transition:border-color 0.15s;
}
.mr-add-search:focus { border-color:rgba(212,168,83,0.4); }
.mr-add-search::placeholder { color:rgba(255,255,255,0.25); }
.mr-add-grid { display:flex; flex-direction:column; gap:4px; max-height:280px; overflow-y:auto; }
.mr-add-grid::-webkit-scrollbar { width:4px; }
.mr-add-grid::-webkit-scrollbar-track { background:transparent; }
.mr-add-grid::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
.mr-add-item {
    display:flex; align-items:center; gap:8px;
    width:100%; padding:7px 10px; border-radius:8px;
    background:rgba(212,168,83,0.04); border:1px solid rgba(212,168,83,0.1);
    color:#d4a853; font-size:0.78rem; font-weight:600;
    cursor:pointer; text-align:left; transition:all 0.15s;
}
.mr-add-item:hover { background:rgba(212,168,83,0.1); border-color:rgba(212,168,83,0.25); }

/* ── Modal overlay ── */
.mr-overlay {
    position:fixed; inset:0; z-index:1000;
    background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);
    display:flex; align-items:center; justify-content:center; padding:1.5rem;
    animation:fadeIn 0.15s ease;
}
.mr-modal {
    background:#0d0f1a; border:1px solid rgba(255,255,255,0.1);
    border-radius:18px; padding:1.75rem; width:100%; max-width:480px;
    box-shadow:0 24px 64px rgba(0,0,0,0.7);
    animation:modalIn 0.22s cubic-bezier(0.22,1,0.36,1);
}
@keyframes modalIn { from{opacity:0;transform:translateY(12px)scale(0.97)} to{opacity:1;transform:none} }
.mr-modal h2 { font-size:1.2rem; font-weight:800; color:#fff; margin:0 0 1.25rem; }
.mr-field { margin-bottom:1rem; }
.mr-label { font-size:0.72rem; font-weight:700; color:rgba(255,255,255,0.5); letter-spacing:0.06em; text-transform:uppercase; display:block; margin-bottom:6px; }
.mr-input, .mr-select {
    width:100%; padding:0.6rem 0.85rem; border-radius:9px;
    border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04);
    color:#fff; font-size:0.85rem; outline:none; transition:border-color 0.15s;
    box-sizing:border-box;
}
.mr-input:focus, .mr-select:focus { border-color:rgba(212,168,83,0.5); }
.mr-input::placeholder { color:rgba(255,255,255,0.25); }
.mr-select option { background:#1a1a2e; }
.mr-icon-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
.mr-icon-btn {
    width:36px; height:36px; border-radius:8px; font-size:1.1rem;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; border:1px solid rgba(255,255,255,0.08);
    background:rgba(255,255,255,0.03); transition:all 0.12s;
}
.mr-icon-btn.selected { border-color:rgba(212,168,83,0.6); background:rgba(212,168,83,0.12); }
.mr-icon-btn:hover { background:rgba(255,255,255,0.07); }
.mr-modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:1.5rem; }
.mr-toggle-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
.mr-toggle-row label { font-size:0.82rem; color:rgba(255,255,255,0.7); font-weight:500; }
.mr-toggle { position:relative; width:44px; height:24px; flex-shrink:0; }
.mr-toggle input { display:none; }
.mr-toggle-track {
    position:absolute; inset:0; border-radius:12px;
    background:rgba(255,255,255,0.1); transition:background 0.2s; cursor:pointer;
}
.mr-toggle input:checked ~ .mr-toggle-track { background:rgba(212,168,83,0.8); }
.mr-toggle-thumb {
    position:absolute; top:3px; left:3px;
    width:18px; height:18px; border-radius:50%;
    background:#fff; transition:transform 0.2s; pointer-events:none;
}
.mr-toggle input:checked ~ .mr-toggle-thumb { transform:translateX(20px); }

/* ── Notification toast ── */
.mr-toast {
    position:fixed; top:1.25rem; right:1.25rem; z-index:2000;
    padding:0.65rem 1rem; border-radius:10px;
    font-size:0.82rem; font-weight:600;
    animation:slideInRight 0.28s cubic-bezier(0.22,1,0.36,1);
    box-shadow:0 8px 24px rgba(0,0,0,0.5);
}
.mr-toast.ok { background:rgba(52,211,153,0.2); border:1px solid rgba(52,211,153,0.4); color:#34d399; }
.mr-toast.err { background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#f87171; }
`

    if (loading) return (
        <>
            <style>{css}</style>
            <div className="mr-page" style={{ textAlign: 'center', paddingTop: '5rem', color: 'rgba(255,255,255,0.35)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎞️</div>
                <p style={{ fontSize: '0.85rem' }}>Loading rolls…</p>
            </div>
        </>
    )

    return (
        <>
            <style>{css}</style>

            {/* Toast notification */}
            {notification && (
                <div className={`mr-toast ${notification.type}`}>{notification.msg}</div>
            )}

            {/* ── Create / Edit Modal ── */}
            {modal && (
                <div className="mr-overlay" onClick={closeModal}>
                    <div className="mr-modal" onClick={e => e.stopPropagation()}>
                        <h2>{modal.mode === 'create' ? '✦ New Movie Roll' : '✦ Edit Roll'}</h2>
                        <form onSubmit={handleSubmit} autoComplete="off">
                            {/* Title */}
                            <div className="mr-field">
                                <label className="mr-label">Title *</label>
                                <input
                                    ref={titleInputRef}
                                    className="mr-input"
                                    type="text"
                                    placeholder="e.g. Award Winners"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Icon picker */}
                            <div className="mr-field">
                                <label className="mr-label">Icon</label>
                                <div className="mr-icon-row">
                                    {ICON_PRESETS.map(ic => (
                                        <button
                                            key={ic} type="button"
                                            className={`mr-icon-btn ${formIcon === ic ? 'selected' : ''}`}
                                            onClick={() => setFormIcon(ic)}
                                        >{ic}</button>
                                    ))}
                                    <input
                                        className="mr-input"
                                        type="text"
                                        value={formIcon}
                                        onChange={e => setFormIcon(e.target.value)}
                                        maxLength={4}
                                        style={{ width: '50px', textAlign: 'center', fontSize: '1.1rem', marginLeft: '2px' }}
                                        placeholder="…"
                                    />
                                </div>
                            </div>

                            {/* Display target */}
                            <div className="mr-field">
                                <label className="mr-label">Display On</label>
                                <select className="mr-select" value={formDisplayOn} onChange={e => setFormDisplayOn(e.target.value)}>
                                    <option value="both">Both Pages (Homepage + Works)</option>
                                    <option value="homepage">Homepage Only</option>
                                    <option value="works">Works Page Only</option>
                                </select>
                            </div>

                            {/* Slug (optional) */}
                            <div className="mr-field">
                                <label className="mr-label">Custom Slug <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
                                <input
                                    className="mr-input"
                                    type="text"
                                    placeholder="auto-generated from title"
                                    value={formSlug}
                                    onChange={e => setFormSlug(e.target.value)}
                                />
                            </div>

                            {/* Visibility toggle */}
                            <div className="mr-toggle-row">
                                <label>Visible to public</label>
                                <label className="mr-toggle">
                                    <input type="checkbox" checked={formVisible} onChange={e => setFormVisible(e.target.checked)} />
                                    <div className="mr-toggle-track" />
                                    <div className="mr-toggle-thumb" />
                                </label>
                            </div>

                            <div className="mr-modal-actions">
                                <button type="button" className="mr-btn-ghost" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="mr-btn-primary" disabled={saving || !formTitle.trim()}>
                                    {saving ? 'Saving…' : modal.mode === 'create' ? '+ Create Roll' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="mr-page">
                {/* ── Page Header ── */}
                <div className="mr-header">
                    <div className="mr-header-text">
                        <h1>🎞️ Movie Rolls</h1>
                        <p>Curated collections displayed as scrollable rows on the homepage and works page.</p>
                    </div>
                    <button className="mr-btn-primary" onClick={openCreate}>
                        + New Roll
                    </button>
                </div>

                {/* ── Empty State ── */}
                {rolls.length === 0 ? (
                    <div className="mr-empty">
                        <div className="mr-empty-icon">🎞️</div>
                        <h3>No rolls yet</h3>
                        <p>Create your first curated collection to get started.</p>
                        <button className="mr-btn-primary" onClick={openCreate} style={{ marginTop: '1.25rem' }}>
                            + Create First Roll
                        </button>
                    </div>
                ) : (
                    <div className="mr-rolls">
                        {rolls.map(roll => {
                            const isExpanded = expandedRoll === roll.id
                            const rollProjectIds = new Set(roll.projects.map(p => p.projectId))
                            const available = projects.filter(p => !rollProjectIds.has(p.id))
                            const filtered = filteredProjects(available)
                            const inRoll = roll.projects
                                .sort((a, b) => a.sortOrder - b.sortOrder)
                                .map(rp => ({ rp, proj: projects.find(p => p.id === rp.projectId) }))
                                .filter(x => x.proj)

                            return (
                                <div key={roll.id} className={`mr-roll ${roll.visible ? 'visible' : ''}`}>
                                    {/* Roll header row */}
                                    <div
                                        className="mr-roll-header"
                                        onClick={() => setExpandedRoll(isExpanded ? null : roll.id)}
                                    >
                                        <span className="mr-roll-icon">{roll.icon}</span>

                                        <div className="mr-roll-meta">
                                            <div className="mr-roll-title">
                                                {roll.title}
                                                <span className={`mr-badge ${roll.visible ? 'mr-badge-live' : 'mr-badge-hidden'}`}>
                                                    {roll.visible ? 'Live' : 'Hidden'}
                                                </span>
                                                <span className="mr-badge mr-badge-blue">
                                                    {DISPLAY_LABELS[roll.displayOn] ?? roll.displayOn}
                                                </span>
                                            </div>
                                            <div className="mr-roll-sub">
                                                {roll._count.projects} project{roll._count.projects !== 1 ? 's' : ''} · /{roll.slug}
                                            </div>
                                        </div>

                                        <div className="mr-roll-actions" onClick={e => e.stopPropagation()}>
                                            {/* Visibility toggle */}
                                            <button
                                                className="mr-btn-ghost"
                                                onClick={() => toggleVisibility(roll)}
                                                title={roll.visible ? 'Hide from public' : 'Make public'}
                                            >
                                                {roll.visible ? '👁 Hide' : '🚫 Show'}
                                            </button>
                                            {/* Edit */}
                                            <button className="mr-btn-ghost" onClick={() => openEdit(roll)}>✏️ Edit</button>
                                            {/* Delete */}
                                            <button className="mr-btn-danger" onClick={() => deleteRoll(roll)}>🗑️</button>
                                        </div>

                                        <span className={`mr-roll-chevron ${isExpanded ? 'open' : ''}`}>▼</span>
                                    </div>

                                    {/* Expanded: project management */}
                                    {isExpanded && (
                                        <div className="mr-expand">
                                            <div className="mr-expand-grid">
                                                {/* LEFT — projects in roll */}
                                                <div>
                                                    <span className="mr-expand-section-label">
                                                        Projects in this roll ({inRoll.length})
                                                    </span>
                                                    {inRoll.length === 0 ? (
                                                        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                                                            No projects yet — add some from the right.
                                                        </p>
                                                    ) : (
                                                        inRoll.map(({ rp, proj }) => {
                                                            if (!proj) return null
                                                            const sc = STATUS_COLORS[proj.status] ?? { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }
                                                            return (
                                                                <div key={rp.id} className="mr-project-item">
                                                                    {proj.coverImage
                                                                        ? <img src={proj.coverImage} alt="" className="mr-project-thumb" />
                                                                        : <span className="mr-project-thumb-placeholder">🎬</span>
                                                                    }
                                                                    <span className="mr-project-name" title={proj.title}>{proj.title}</span>
                                                                    <span className="mr-project-status" style={{ background: sc.bg, color: sc.color }}>
                                                                        {proj.status}
                                                                    </span>
                                                                    <button
                                                                        className="mr-btn-danger"
                                                                        style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                                                        onClick={() => removeProject(roll.id, rp.projectId)}
                                                                        title="Remove from roll"
                                                                    >✕</button>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>

                                                {/* RIGHT — add projects */}
                                                <div>
                                                    <span className="mr-expand-section-label">
                                                        Add projects ({available.length} available)
                                                    </span>
                                                    {available.length === 0 ? (
                                                        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                                                            All projects are already in this roll.
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <input
                                                                className="mr-add-search"
                                                                type="text"
                                                                placeholder="Search projects…"
                                                                value={projectSearch}
                                                                onChange={e => setProjectSearch(e.target.value)}
                                                            />
                                                            <div className="mr-add-grid">
                                                                {filtered.length === 0 ? (
                                                                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', padding: '0.25rem 0' }}>
                                                                        No matches for "{projectSearch}"
                                                                    </p>
                                                                ) : filtered.map(proj => {
                                                                    const sc = STATUS_COLORS[proj.status] ?? { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }
                                                                    return (
                                                                        <button
                                                                            key={proj.id}
                                                                            className="mr-add-item"
                                                                            onClick={() => addProject(roll.id, proj.id)}
                                                                        >
                                                                            {proj.coverImage
                                                                                ? <img src={proj.coverImage} alt="" className="mr-project-thumb" />
                                                                                : <span className="mr-project-thumb-placeholder">🎬</span>
                                                                            }
                                                                            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                {proj.title}
                                                                            </span>
                                                                            <span className="mr-project-status" style={{ background: sc.bg, color: sc.color }}>
                                                                                {proj.status}
                                                                            </span>
                                                                            <span style={{ fontSize: '1rem', opacity: 0.7 }}>+</span>
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )
}
