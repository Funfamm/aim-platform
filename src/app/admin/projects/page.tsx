'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import FileUploader from '@/components/FileUploader'
import { transcribeVideo } from '@/lib/transcribe-client'
import { translateToAllLanguages, LANGUAGE_NAMES } from '@/lib/subtitle-translator'

/* ── Types ── */
type Project = {
    id: string; title: string; slug: string; tagline: string; description: string
    status: string; genre: string | null; year: string | null; duration: string | null
    featured: boolean; sortOrder: number; coverImage: string | null
    trailerUrl: string | null; filmUrl: string | null; projectType: string
    _count: { castingCalls: number }
}

type FormData = {
    title: string; slug: string; tagline: string; description: string
    status: string; genre: string; year: string; duration: string
    featured: boolean; coverImage: string
    trailerUrl: string; filmUrl: string; projectType: string
}

const EMPTY_FORM: FormData = {
    title: '', slug: '', tagline: '', description: '',
    status: 'upcoming', genre: '', year: '', duration: '',
    featured: false, coverImage: '',
    trailerUrl: '', filmUrl: '', projectType: 'movie',
}

const STATUSES = ['upcoming', 'in-production', 'completed']


const statusConfig: Record<string, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'badge-green' },
    'in-production': { label: 'In Production', className: 'badge-gold' },
    upcoming: { label: 'Upcoming', className: 'badge-blue' },
}

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<FormData>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [subtitleStatus, setSubtitleStatus] = useState<Record<string, string>>({})
    const [subtitleProgress, setSubtitleProgress] = useState<Record<string, number>>({})

    useEffect(() => {
        fetch('/api/admin/projects')
            .then(r => { if (r.status === 401) { window.location.href = '/admin/login'; return [] } return r.json() })
            .then((data: Project[]) => {
                setProjects(data)
                // Check which projects already have subtitles
                data.forEach((p: Project) => {
                    if (p.filmUrl) {
                        fetch(`/api/subtitles/${p.id}?lang=en`)
                            .then(r => r.json())
                            .then(sub => {
                                if (sub.available && sub.available.length > 0) {
                                    setSubtitleStatus(s => ({ ...s, [p.id]: `✓ ${sub.available.length} lang` }))
                                }
                            })
                            .catch(() => {})
                    }
                })
            })
            .catch(() => setError('Failed to load projects'))
            .finally(() => setLoading(false))
    }, [])

    const openCreate = () => {
        setEditingId(null)
        setForm(EMPTY_FORM)
        setShowModal(true)
        setError('')
    }

    const openEdit = (p: Project) => {
        setEditingId(p.id)
        setForm({
            title: p.title,
            slug: p.slug,
            tagline: p.tagline || '',
            description: p.description,
            status: p.status,
            genre: p.genre || '',
            year: p.year || '',
            duration: p.duration || '',
            featured: p.featured,
            coverImage: p.coverImage || '',
            trailerUrl: p.trailerUrl || '',
            filmUrl: p.filmUrl || '',
            projectType: p.projectType || 'movie',
        })
        setShowModal(true)
        setError('')
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.title || !form.description) {
            setError('Please fill in title and description')
            return
        }
        setSaving(true)
        setError('')
        try {
            const payload = {
                ...form,
                slug: form.slug || slugify(form.title),
            }
            const url = editingId ? `/api/admin/projects/${editingId}` : '/api/admin/projects'
            const method = editingId ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to save')
            }
            const saved = await res.json()
            if (editingId) {
                setProjects(prev => prev.map(p => p.id === editingId ? saved : p))
            } else {
                setProjects(prev => [...prev, saved])
            }
            setShowModal(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}"? This will also delete all its casting calls and applications.`)) return
        setDeleting(id)
        try {
            const res = await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            setProjects(prev => prev.filter(p => p.id !== id))
        } catch {
            alert('Failed to delete project')
        } finally {
            setDeleting(null)
        }
    }

    const updateField = (field: keyof FormData, value: string | boolean) =>
        setForm(f => ({ ...f, [field]: value }))

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                <div className="admin-header">
                    <h1 className="admin-page-title">Projects</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{projects.length} total</span>
                        <button onClick={openCreate} className="btn btn-primary btn-sm">+ New Project</button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid-4" style={{ marginBottom: 'var(--space-2xl)' }}>
                    <div className="stat-card">
                        <div className="stat-card-label">Total Projects</div>
                        <div className="stat-card-value">{projects.length}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Completed</div>
                        <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                            {projects.filter(p => p.status === 'completed').length}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">In Production</div>
                        <div className="stat-card-value" style={{ color: 'var(--accent-gold)' }}>
                            {projects.filter(p => p.status === 'in-production').length}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Upcoming</div>
                        <div className="stat-card-value" style={{ color: 'var(--accent-blue, #60a5fa)' }}>
                            {projects.filter(p => p.status === 'upcoming').length}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                        Loading projects...
                    </div>
                ) : projects.length === 0 ? (
                    <div style={{
                        padding: 'var(--space-4xl) var(--space-2xl)',
                        textAlign: 'center',
                        color: 'var(--text-tertiary)',
                        background: 'linear-gradient(180deg, var(--bg-secondary) 0%, rgba(13,15,20,0.6) 100%)',
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--border-subtle)',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {/* Decorative top gold line */}
                        <div style={{
                            position: 'absolute', top: 0, left: '25%', right: '25%', height: '2px',
                            background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)',
                        }} />
                        <div style={{
                            fontSize: '3.5rem', marginBottom: 'var(--space-lg)',
                            filter: 'drop-shadow(0 4px 12px rgba(212,168,83,0.2))',
                        }}>🎬</div>
                        <h3 style={{
                            fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)',
                            marginBottom: 'var(--space-xs)',
                        }}>
                            Your <span style={{
                                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                                background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>stage</span> awaits
                        </h3>
                        <p style={{
                            maxWidth: '380px', margin: '0 auto', lineHeight: 1.7,
                            fontSize: '0.9rem', marginBottom: 'var(--space-xl)',
                        }}>
                            Every great studio starts with its first project. Add a film, series, or short and bring your vision to life.
                        </p>
                        <button onClick={openCreate} className="btn btn-primary btn-lg" style={{ gap: '6px' }}>
                            + Create Your First Project
                        </button>
                        <div style={{
                            fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-lg)',
                            opacity: 0.6, display: 'flex', justifyContent: 'center', alignItems: 'center',
                            gap: '4px', width: '100%',
                        }}>
                            💡 Tip: Add a cover image and trailer to make your project shine on the public site.
                        </div>
                    </div>
                ) : (
                    <div className="grid-auto-fill">
                        {projects.map((project) => {
                            const status = statusConfig[project.status] || statusConfig.upcoming
                            return (
                                <div key={project.id} className="glass-card" style={{ overflow: 'hidden', opacity: deleting === project.id ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                                    {/* Cover Image */}
                                    <div style={{
                                        height: '160px',
                                        backgroundImage: project.coverImage ? `url(${project.coverImage})` : 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                                        backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative',
                                    }}>
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, var(--bg-glass) 100%)' }} />
                                        <div style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)', display: 'flex', gap: '4px' }}>
                                            <span className={`badge ${status.className}`}>{status.label}</span>
                                            {project.featured && <span className="badge badge-gold">★ Featured</span>}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div style={{ padding: 'var(--space-lg)' }}>
                                        <h3 style={{ marginBottom: '4px' }}>{project.title}</h3>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                                            {project.genre} {project.year ? `• ${project.year}` : ''} {project.duration ? `• ${project.duration}` : ''}
                                        </div>
                                        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 'var(--space-md)' }}>
                                            {project.description.length > 120 ? project.description.slice(0, 120) + '...' : project.description}
                                        </p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                {project._count.castingCalls} casting call{project._count.castingCalls !== 1 ? 's' : ''}
                                            </span>
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                {/* CC / Subtitle button */}
                                                {project.filmUrl && (
                                                    <button
                                                        onClick={async () => {
                                                            if (subtitleStatus[project.id]?.startsWith('✓')) return
                                                            setSubtitleStatus(s => ({ ...s, [project.id]: '⏳ Loading engine...' }))
                                                            setSubtitleProgress(s => ({ ...s, [project.id]: 0 }))
                                                            try {
                                                                const result = await transcribeVideo(project.filmUrl!, (status, detail) => {
                                                                    setSubtitleStatus(s => ({ ...s, [project.id]: `⏳ ${detail || status}` }))
                                                                    const phaseProgress: Record<string, number> = {
                                                                        'loading-ffmpeg': 5, 'extracting-audio': 15,
                                                                        'loading-model': 25, 'transcribing': 40,
                                                                    }
                                                                    setSubtitleProgress(s => ({ ...s, [project.id]: phaseProgress[status] || s[project.id] || 0 }))
                                                                })
                                                                setSubtitleProgress(s => ({ ...s, [project.id]: 50 }))
                                                                setSubtitleStatus(s => ({ ...s, [project.id]: '🌐 Translating...' }))
                                                                const translations = await translateToAllLanguages(result.segments, 'en', (ts) => {
                                                                    setSubtitleStatus(s => ({ ...s, [project.id]: `🌐 ${ts.detail || ts.languageName}` }))
                                                                    setSubtitleProgress(s => ({ ...s, [project.id]: 50 + Math.round(ts.progress * 0.45) }))
                                                                })
                                                                setSubtitleProgress(s => ({ ...s, [project.id]: 97 }))
                                                                setSubtitleStatus(s => ({ ...s, [project.id]: '💾 Saving...' }))
                                                                await fetch('/api/admin/subtitles', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        projectId: project.id,
                                                                        language: 'en',
                                                                        segments: result.segments,
                                                                        translations,
                                                                        status: 'completed',
                                                                    }),
                                                                })
                                                                setSubtitleProgress(s => ({ ...s, [project.id]: 100 }))
                                                                setSubtitleStatus(s => ({ ...s, [project.id]: '✓ Subtitles ready' }))
                                                            } catch (err) {
                                                                setSubtitleStatus(s => ({ ...s, [project.id]: '❌ Failed' }))
                                                                setSubtitleProgress(s => ({ ...s, [project.id]: 0 }))
                                                            }
                                                        }}
                                                        disabled={!!subtitleStatus[project.id]?.startsWith('⏳') || !!subtitleStatus[project.id]?.startsWith('🌐')}
                                                        className="btn btn-ghost btn-sm"
                                                        title="Generate multi-language subtitles"
                                                        style={{
                                                            fontSize: '0.65rem', fontWeight: 700,
                                                            color: subtitleStatus[project.id]?.startsWith('✓') ? 'var(--accent-gold)' : undefined,
                                                        }}
                                                    >
                                                        {subtitleStatus[project.id] || 'CC'}
                                                    </button>
                                                )}
                                                <button onClick={() => openEdit(project)} className="btn btn-ghost btn-sm">Edit</button>
                                                <button
                                                    onClick={() => handleDelete(project.id, project.title)}
                                                    disabled={deleting === project.id}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--error)' }}
                                                >
                                                    {deleting === project.id ? '...' : '✕'}
                                                </button>
                                            </div>
                                        </div>
                                        {/* Progress bar for subtitle generation */}
                                        {subtitleProgress[project.id] > 0 && subtitleProgress[project.id] < 100 && (
                                            <div style={{ marginTop: '6px' }}>
                                                <div style={{
                                                    height: '4px', borderRadius: '2px',
                                                    background: 'rgba(255,255,255,0.08)',
                                                    overflow: 'hidden',
                                                }}>
                                                    <div style={{
                                                        height: '100%', borderRadius: '2px',
                                                        background: 'linear-gradient(90deg, var(--accent-gold), #e8c547)',
                                                        width: `${subtitleProgress[project.id]}%`,
                                                        transition: 'width 0.4s ease',
                                                        boxShadow: '0 0 8px rgba(212,168,83,0.4)',
                                                    }} />
                                                </div>
                                                <div style={{
                                                    fontSize: '0.6rem', color: 'var(--text-tertiary)',
                                                    marginTop: '2px', display: 'flex',
                                                    justifyContent: 'space-between',
                                                }}>
                                                    <span>{subtitleStatus[project.id]?.replace(/^[⏳🌐💾✓❌]\s?/, '')}</span>
                                                    <span>{subtitleProgress[project.id]}%</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {/* ── Modal ── */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 'var(--space-xl)',
                }} onClick={() => setShowModal(false)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xl)',
                            padding: 'var(--space-xl)',
                            width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto',
                        }}
                    >
                        <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: '1.2rem' }}>
                            {editingId ? '✏️ Edit Project' : '🎬 New Project'}
                        </h2>

                        <form onSubmit={handleSave}>
                            <div className="admin-form-stack" style={{ gap: 'var(--space-md)' }}>
                                {/* Title + Slug */}
                                <div className="admin-form-grid">
                                    <div>
                                        <label className="admin-label">Title *</label>
                                        <input className="admin-input" value={form.title}
                                            onChange={e => { updateField('title', e.target.value); if (!editingId) updateField('slug', slugify(e.target.value)) }}
                                            placeholder="e.g. Neon Saints" required />
                                    </div>
                                    <div>
                                        <label className="admin-label">Slug</label>
                                        <input className="admin-input" value={form.slug}
                                            onChange={e => updateField('slug', e.target.value)}
                                            placeholder="auto-generated" style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                </div>

                                {/* Tagline */}
                                <div>
                                    <label className="admin-label">Tagline</label>
                                    <input className="admin-input" value={form.tagline}
                                        onChange={e => updateField('tagline', e.target.value)}
                                        placeholder="A short hook for the project..." />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="admin-label">Description *</label>
                                    <textarea className="admin-textarea" rows={4} value={form.description}
                                        onChange={e => updateField('description', e.target.value)}
                                        placeholder="Full synopsis or description of the project..." required />
                                </div>

                                {/* Genre, Year, Duration */}
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <div>
                                        <label className="admin-label">Genre</label>
                                        <input className="admin-input" value={form.genre}
                                            onChange={e => updateField('genre', e.target.value)}
                                            placeholder="e.g. Sci-Fi Thriller" />
                                    </div>
                                    <div>
                                        <label className="admin-label">Year</label>
                                        <input className="admin-input" value={form.year}
                                            onChange={e => updateField('year', e.target.value)}
                                            placeholder="e.g. 2026" />
                                    </div>
                                    <div>
                                        <label className="admin-label">Duration</label>
                                        <input className="admin-input" value={form.duration}
                                            onChange={e => updateField('duration', e.target.value)}
                                            placeholder="e.g. 12 min" />
                                    </div>
                                </div>

                                {/* Status + Featured */}
                                <div className="admin-form-grid">
                                    <div>
                                        <label className="admin-label">Status</label>
                                        <select className="admin-input" value={form.status}
                                            onChange={e => updateField('status', e.target.value)}
                                            style={{ cursor: 'pointer', appearance: 'auto' }}>
                                            {STATUSES.map(s => (
                                                <option key={s} value={s}>
                                                    {s === 'in-production' ? 'In Production' : s.charAt(0).toUpperCase() + s.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                            <input type="checkbox" checked={form.featured}
                                                onChange={e => updateField('featured', e.target.checked)}
                                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)' }} />
                                            ★ Featured on homepage
                                        </label>
                                    </div>
                                </div>

                                {/* Cover Image — Drag & Drop */}
                                <FileUploader
                                    label="Cover Image"
                                    accept="image/*"
                                    category="covers"
                                    currentUrl={form.coverImage}
                                    onUpload={url => updateField('coverImage', url)}
                                    maxSizeMB={10}
                                    compact
                                />

                                {/* Media Section */}
                                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>
                                        Media & Content
                                    </div>
                                    <div className="admin-form-grid">
                                        <div>
                                            <label className="admin-label">Project Type</label>
                                            <select className="admin-input" value={form.projectType}
                                                onChange={e => updateField('projectType', e.target.value)}
                                                style={{ cursor: 'pointer', appearance: 'auto' }}>
                                                <option value="movie">Movie</option>
                                                <option value="series">Series</option>
                                            </select>
                                        </div>
                                        <div />
                                    </div>

                                    {/* Trailer — Drag & Drop */}
                                    <div style={{ marginTop: 'var(--space-md)' }}>
                                        <FileUploader
                                            label="Trailer (public)"
                                            accept="video/*"
                                            category="trailers"
                                            currentUrl={form.trailerUrl}
                                            onUpload={url => updateField('trailerUrl', url)}
                                            maxSizeMB={100}
                                            compact
                                        />
                                    </div>

                                    {/* Full Film — Drag & Drop */}
                                    <div style={{ marginTop: 'var(--space-md)' }}>
                                        <FileUploader
                                            label="Full Film (members only)"
                                            accept="video/*"
                                            category="films"
                                            currentUrl={form.filmUrl}
                                            onUpload={url => updateField('filmUrl', url)}
                                            maxSizeMB={500}
                                        />
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            When set, a &quot;Watch Now&quot; button appears on the project page (login required).
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div style={{
                                        fontSize: '0.85rem', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)',
                                        color: 'var(--error)', background: 'rgba(239,68,68,0.1)',
                                    }}>✗ {error}</div>
                                )}

                                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)' }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Saving...' : editingId ? '💾 Update' : '🎬 Create'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
