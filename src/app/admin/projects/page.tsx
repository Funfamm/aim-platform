'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import FileUploader from '@/components/FileUploader'
import { transcribeVideo } from '@/lib/transcribe-client'
import { runQC, formatQCSummary, type QCResult } from '@/lib/subtitle-qc'
import { LANGUAGE_NAMES, TOTAL_SUBTITLE_LANGS } from '@/lib/subtitle-languages'
import LangStatusGrid from '@/components/admin/LangStatusGrid'

/* â”€â”€ Types â”€â”€ */
type Project = {
    id: string; title: string; slug: string; tagline: string; description: string
    status: string; genre: string | null; year: string | null; duration: string | null
    featured: boolean; sortOrder: number; coverImage: string | null
    trailerUrl: string | null; filmUrl: string | null; projectType: string
    viewCount: number
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

type FilmCastMember = {
    id: string
    name: string
    jobTitle: string
    character: string | null
    bio: string | null
    photoUrl: string | null
    instagramUrl: string | null
    bioTranslations: string | null
    sortOrder: number
}

type CastForm = {
    name: string
    jobTitle: string
    character: string
    bio: string
    photoUrl: string
    instagramUrl: string
}

const EMPTY_CAST_FORM: CastForm = { name: '', jobTitle: 'Actor', character: '', bio: '', photoUrl: '', instagramUrl: '' }

type ReviewSegment = { start: number; end: number; text: string }
type ReviewSubtitle = {
    segments: ReviewSegment[]
    translations: Record<string, ReviewSegment[]>
    qcIssues: QCResult[]
    translateStatus: string
    transcribedWith: string | null
    generatedWith: string | null
    langStatus: Record<string, string> | null  // per-language status from new schema field
}

export default function AdminProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<'default' | 'views'>('default')
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<FormData>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [subtitleStatus, setSubtitleStatus] = useState<Record<string, string>>({})
    const [subtitleProgress, setSubtitleProgress] = useState<Record<string, number>>({})
    const [subtitlePhase, setSubtitlePhase] = useState<Record<string, 'transcribing' | 'translating' | 'done' | 'error' | null>>({})
    const [translationCount, setTranslationCount] = useState<Record<string, number>>({})
    const [translateStatus, setTranslateStatus] = useState<Record<string, string>>({})
    // Review modal
    const [reviewProjectId, setReviewProjectId] = useState<string | null>(null)
    const [reviewProjectTitle, setReviewProjectTitle] = useState('')
    const [reviewData, setReviewData] = useState<ReviewSubtitle | null>(null)
    const [reviewLang, setReviewLang] = useState('en')
    const [reviewLoading, setReviewLoading] = useState(false)
    const [retryingLang, setRetryingLang] = useState<string | null>(null)  // lang currently being retried
    // Generational counter — guards openReview against async race conditions.
    // If admin clicks Review on project B before project A's fetch resolves,
    // A's response is silently discarded.
    const reviewRequestRef = useRef(0)
    // Cast modal
    const [castProjectId, setCastProjectId] = useState<string | null>(null)
    const [castProjectTitle, setCastProjectTitle] = useState('')
    const [castMembers, setCastMembers] = useState<FilmCastMember[]>([])
    const [castLoading, setCastLoading] = useState(false)
    const [castForm, setCastForm] = useState<CastForm>(EMPTY_CAST_FORM)
    const [castSaving, setCastSaving] = useState(false)
    const [castError, setCastError] = useState('')
    const [translatingId, setTranslatingId] = useState<string | null>(null)
    // Publish confirmation gate
    const [showPublishWarning, setShowPublishWarning] = useState(false)

    // â”€â”€ Movie Roll assignment (inside project modal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    type RollOption = { id: string; title: string; icon: string; displayOn: string; visible: boolean }
    const [allRolls, setAllRolls] = useState<RollOption[]>([])
    const [selectedRollIds, setSelectedRollIds] = useState<string[]>([])
    const [rollsLoading, setRollsLoading] = useState(false)
    const [rollError, setRollError] = useState(false)

    // TOTAL_SUBTITLE_LANGS comes from subtitle-languages.ts — canonical constant, not hard-coded

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
                                const count = sub.available?.length ?? 0
                                setTranslationCount(s => ({ ...s, [p.id]: count }))
                                setTranslateStatus(s => ({ ...s, [p.id]: sub.translateStatus ?? 'pending' }))
                                if (count > 0) {
                                    setSubtitleStatus(s => ({ ...s, [p.id]: count >= TOTAL_SUBTITLE_LANGS ? '✓ All languages ready' : `✓ ${count} lang` }))
                                    setSubtitlePhase(s => ({ ...s, [p.id]: 'done' }))
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
        setSelectedRollIds([])
        setShowModal(true)
        setError('')
        // Fetch available rolls
        setRollsLoading(true)
        fetch('/api/admin/movie-rolls')
            .then(r => r.ok ? r.json() : [])
            .then(setAllRolls)
            .catch(() => {})
            .finally(() => setRollsLoading(false))
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
        setSelectedRollIds([])
        setShowModal(true)
        setError('')
        // Fetch rolls + current assignments in parallel
        setRollsLoading(true)
        Promise.all([
            fetch('/api/admin/movie-rolls').then(r => r.ok ? r.json() : []),
            fetch(`/api/admin/projects/${p.id}/rolls`).then(r => r.ok ? r.json() : []),
        ]).then(([rolls, assignedIds]) => {
            setAllRolls(rolls)
            setSelectedRollIds(assignedIds)
        }).catch(() => {}).finally(() => setRollsLoading(false))
    }

    // Core save logic — called directly by handleSave (override=false)
    // or by handlePublishOverride (override=true) to bypass the translation gate.
    const doSave = async (override = false) => {
        if (!form.title || !form.description) {
            setError('Please fill in title and description')
            return
        }
        // Gate: translation confirmation required before setting a public status
        // on a project that has a film. Admin must explicitly override if incomplete.
        const isPublicStatus = form.status === 'completed' || form.status === 'in-production'
        if (!override && isPublicStatus && editingId && form.filmUrl) {
            const count = translationCount[editingId] ?? 0
            if (count < TOTAL_SUBTITLE_LANGS) {
                setShowPublishWarning(true)
                return
            }
        }
        // Gate: at least one roll must be selected
        if (allRolls.length > 0 && selectedRollIds.length === 0) {
            setError('🎬 This project must be assigned to at least one Movie Roll before saving.')
            setRollError(true)
            document.getElementById('roll-assignment-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }
        setSaving(true)
        setError('')
        setRollError(false)
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
            // Save roll assignments (fire-and-forget — non-blocking)
            fetch(`/api/admin/projects/${saved.id}/rolls`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rollIds: selectedRollIds }),
            }).catch(() => {})
            if (editingId) {
                setProjects(prev => prev.map(p => p.id === editingId ? saved : p))
            } else {
                setProjects(prev => [...prev, saved])
            }
            // Re-check subtitle status if this project has a film URL (new or updated)
            if (saved.filmUrl) {
                fetch(`/api/subtitles/${saved.id}?lang=en`)
                    .then(r => r.json())
                    .then(sub => {
                        const count = sub.available?.length ?? 0
                        setTranslationCount(s => ({ ...s, [saved.id]: count }))
                        setTranslateStatus(s => ({ ...s, [saved.id]: sub.translateStatus ?? 'pending' }))
                        if (count > 0) {
                            setSubtitleStatus(s => ({ ...s, [saved.id]: count >= TOTAL_SUBTITLE_LANGS ? '✓ All languages ready' : `✓ ${count} lang` }))
                            setSubtitlePhase(s => ({ ...s, [saved.id]: 'done' }))
                        }
                    })
                    .catch(() => {})
            }
            setShowModal(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    // Form submit — normal path (no override).
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        await doSave(false)
    }

    // Called when admin explicitly confirms they want to publish without full translations.
    const handlePublishOverride = async () => {
        setShowPublishWarning(false)
        await doSave(true)
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

    const openReview = async (projectId: string, title: string) => {
        const requestId = ++reviewRequestRef.current
        setReviewProjectId(projectId)
        setReviewProjectTitle(title)
        setReviewLang('en')
        setReviewData(null)
        setReviewLoading(true)
        setRetryingLang(null)
        try {
            const res = await fetch(`/api/admin/subtitles?projectId=${projectId}`)
            const { subtitle } = await res.json()
            if (requestId !== reviewRequestRef.current) return
            if (subtitle) {
                setReviewData({
                    segments: JSON.parse(subtitle.segments || '[]'),
                    translations: subtitle.translations ? JSON.parse(subtitle.translations) : {},
                    qcIssues: subtitle.qcIssues ? JSON.parse(subtitle.qcIssues) : [],
                    translateStatus: subtitle.translateStatus || 'pending',
                    transcribedWith: subtitle.transcribedWith || null,
                    generatedWith: subtitle.generatedWith || null,
                    langStatus: subtitle.langStatus ?? null,
                })
            }
        } catch { /* subtitle not found */ }
        if (requestId === reviewRequestRef.current) setReviewLoading(false)
    }

    /** Retry a single failed/pending language via SSE */
    const retryLang = async (lang: string) => {
        if (!reviewProjectId || retryingLang === lang) return
        setRetryingLang(lang)
        try {
            const res = await fetch('/api/admin/subtitles/retry-lang', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: reviewProjectId, lang }),
            })
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            // Optimistically mark as processing in the UI
            setReviewData(prev => prev ? {
                ...prev,
                langStatus: { ...(prev.langStatus ?? {}), [lang]: 'processing' },
            } : prev)
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const events = buffer.split('\n\n')
                buffer = events.pop() || ''
                for (const event of events) {
                    const line = event.replace(/^data: /, '').trim()
                    if (!line) continue
                    try {
                        const data = JSON.parse(line) as { phase?: string; lang?: string }
                        if (data.phase === 'done') {
                            // Refresh subtitle data from server
                            const freshRes = await fetch(`/api/admin/subtitles?projectId=${reviewProjectId}`)
                            const { subtitle } = await freshRes.json()
                            if (subtitle) {
                                setReviewData({
                                    segments: JSON.parse(subtitle.segments || '[]'),
                                    translations: subtitle.translations ? JSON.parse(subtitle.translations) : {},
                                    qcIssues: subtitle.qcIssues ? JSON.parse(subtitle.qcIssues) : [],
                                    translateStatus: subtitle.translateStatus || 'pending',
                                    transcribedWith: subtitle.transcribedWith || null,
                                    generatedWith: subtitle.generatedWith || null,
                                    langStatus: subtitle.langStatus ?? null,
                                })
                            }
                        } else if (data.phase === 'error') {
                            setReviewData(prev => prev ? {
                                ...prev,
                                langStatus: { ...(prev.langStatus ?? {}), [lang]: 'failed' },
                            } : prev)
                        }
                    } catch { /* malformed */ }
                }
            }
        } catch (err) {
            setReviewData(prev => prev ? {
                ...prev,
                langStatus: { ...(prev.langStatus ?? {}), [lang]: 'failed' },
            } : prev)
            console.error('[retry-lang]', err)
        }
        setRetryingLang(null)
    }

    const closeReview = () => {
        setReviewProjectId(null)
        setReviewData(null)
    }

    const openCastModal = async (projectId: string, title: string) => {
        setCastProjectId(projectId)
        setCastProjectTitle(title)
        setCastMembers([])
        setCastForm(EMPTY_CAST_FORM)
        setCastError('')
        setCastLoading(true)
        try {
            const res = await fetch(`/api/admin/cast?projectId=${projectId}`)
            const { cast } = await res.json()
            setCastMembers(cast || [])
        } catch { /* ignore */ }
        setCastLoading(false)
    }

    const closeCastModal = () => { setCastProjectId(null); setCastMembers([]) }

    const handleAddCastMember = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!castForm.name.trim() || !castForm.jobTitle.trim()) {
            setCastError('Name and Job Title are required')
            return
        }
        setCastSaving(true)
        setCastError('')
        try {
            const res = await fetch('/api/admin/cast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: castProjectId, ...castForm, sortOrder: castMembers.length }),
            })
            if (!res.ok) throw new Error()
            const { member } = await res.json()
            setCastMembers(prev => [...prev, member])
            setCastForm(EMPTY_CAST_FORM)
        } catch { setCastError('Failed to add member') }
        setCastSaving(false)
    }

    const handleDeleteCastMember = async (id: string) => {
        if (!confirm('Remove this cast member?')) return
        try {
            await fetch(`/api/admin/cast/${id}`, { method: 'DELETE' })
            setCastMembers(prev => prev.filter(m => m.id !== id))
        } catch { alert('Failed to delete') }
    }

    const handleTranslateCastMember = async (m: FilmCastMember) => {
        if (!m.bio && !m.character) {
            alert('Add a bio or character name first before translating.')
            return
        }
        setTranslatingId(m.id)
        try {
            const res = await fetch(`/api/admin/cast/${m.id}/translate`, { method: 'POST' })
            if (!res.ok) throw new Error()
            const { member } = await res.json()
            setCastMembers(prev => prev.map(c => c.id === m.id ? { ...c, bioTranslations: member.bioTranslations } : c))
        } catch { alert('Translation failed — check API key or try again.') }
        setTranslatingId(null)
    }

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
                    <>
                    {/* Sort / filter bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: 'var(--space-md)',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px' }}>Sort by</span>
                        {(['default', 'views'] as const).map(opt => (
                            <button
                                key={opt}
                                onClick={() => setSortBy(opt)}
                                style={{
                                    padding: '3px 12px', borderRadius: 'var(--radius-full)',
                                    fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                                    background: sortBy === opt ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)',
                                    color: sortBy === opt ? '#0a0a0a' : 'var(--text-tertiary)',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {opt === 'default' ? '📋 Manual order' : '👁 Most viewed'}
                            </button>
                        ))}
                        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                            {projects.length} project{projects.length !== 1 ? 's' : ''} · {projects.reduce((s, p) => s + p.viewCount, 0).toLocaleString()} total views
                        </span>
                    </div>
                    <div className="grid-auto-fill">
                        {[...projects].sort((a, b) => sortBy === 'views' ? b.viewCount - a.viewCount : 0).map((project, idx, arr) => {
                            const status = statusConfig[project.status] || statusConfig.upcoming
                            const maxViews = Math.max(...arr.map(p => p.viewCount), 1)
                            const viewPct = Math.round((project.viewCount / maxViews) * 100)
                            const isTrending = sortBy === 'views' ? idx === 0 : project.viewCount === maxViews && project.viewCount > 0
                            return (
                                <div key={project.id} className="glass-card" style={{ overflow: 'hidden', opacity: deleting === project.id ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                                    {/* Cover Image */}
                                    <div style={{
                                        height: '160px',
                                        backgroundImage: project.coverImage ? `url(${project.coverImage})` : 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                                        backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative',
                                    }}>
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, var(--bg-glass) 100%)' }} />
                                        <div style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)', display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <span className={`badge ${status.className}`}>{status.label}</span>
                                            {project.featured && <span className="badge badge-gold">★ Featured</span>}
                                            {isTrending && <span className="badge badge-gold">🔥 Trending</span>}
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
                                        {/* Engagement bar */}
                                        <div style={{ marginBottom: 'var(--space-sm)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                                                    👁 {project.viewCount.toLocaleString()} view{project.viewCount !== 1 ? 's' : ''}
                                                </span>
                                                {viewPct > 0 && (
                                                    <span style={{ fontSize: '0.55rem', color: isTrending ? 'var(--accent-gold)' : 'var(--text-tertiary)', fontWeight: 700 }}>
                                                        {viewPct}% of top
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: '2px',
                                                    width: `${viewPct}%`,
                                                    background: isTrending
                                                        ? 'linear-gradient(90deg, var(--accent-gold), #e8c547)'
                                                        : 'linear-gradient(90deg, rgba(59,130,246,0.6), rgba(96,165,250,0.4))',
                                                    transition: 'width 0.6s ease',
                                                }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                {project._count.castingCalls} casting call{project._count.castingCalls !== 1 ? 's' : ''}
                                            </span>
                                            {/* Translation completeness badge */}
                                            {project.filmUrl && (() => {
                                                const count = translationCount[project.id] ?? -1
                                                const isFull = count >= TOTAL_SUBTITLE_LANGS
                                                const isPartial = count > 0 && count < TOTAL_SUBTITLE_LANGS
                                                const isNone = count === 0
                                                const isPending = count === -1
                                                return (
                                                    <span style={{
                                                        fontSize: '0.62rem', fontWeight: 700,
                                                        padding: '2px 8px', borderRadius: '6px',
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        background: isFull ? 'rgba(52,211,153,0.1)' : isPartial ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                                                        border: `1px solid ${isFull ? 'rgba(52,211,153,0.25)' : isPartial ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`,
                                                        color: isFull ? '#34d399' : isPartial ? '#f59e0b' : 'var(--text-tertiary)',
                                                    }}>
                                                        {isPending ? '…' : isFull ? '✅' : isNone ? '🌍' : 'âš ï¸'}
                                                        {isPending ? 'checking' : `${Math.max(0, count)}/${TOTAL_SUBTITLE_LANGS} langs`}
                                                    </span>
                                                )
                                            })()}
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                {/* Generate Subtitles / Resume button */}
                                                {project.filmUrl && (
                                                    <button
                                                        onClick={async () => {
                                                            const pid = project.id
                                                            const isRunning = subtitlePhase[pid] === 'transcribing' || subtitlePhase[pid] === 'translating'
                                                            if (isRunning) return

                                                            const isResume = translateStatus[pid] === 'partial'

                                                            if (!isResume) {
                                                                // â”€â”€ Step 1: Browser transcription (Whisper-medium) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                                                                setSubtitlePhase(s => ({ ...s, [pid]: 'transcribing' }))
                                                                setSubtitleStatus(s => ({ ...s, [pid]: '⏳ Loading audio engine...' }))
                                                                setSubtitleProgress(s => ({ ...s, [pid]: 2 }))
                                                                try {
                                                                    const result = await transcribeVideo(project.filmUrl!, (status, detail) => {
                                                                        setSubtitleStatus(s => ({ ...s, [pid]: `⏳ ${detail || status}` }))
                                                                        const phaseProgress: Record<string, number> = {
                                                                            'loading-ffmpeg': 5, 'extracting-audio': 15,
                                                                            'loading-model': 25, 'transcribing': 42,
                                                                        }
                                                                        setSubtitleProgress(s => ({ ...s, [pid]: phaseProgress[status] || s[pid] || 0 }))
                                                                    })

                                                                    // Run QC on English track
                                                                    const qcSummary = runQC(result.segments)

                                                                    // Save English segments to DB
                                                                    setSubtitleStatus(s => ({ ...s, [pid]: '💾 Saving transcript...' }))
                                                                    setSubtitleProgress(s => ({ ...s, [pid]: 48 }))
                                                                    await fetch('/api/admin/subtitles', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            projectId: pid,
                                                                            language: 'en',
                                                                            segments: result.segments,
                                                                            transcribedWith: 'whisper-medium',
                                                                            qcIssues: qcSummary.results,
                                                                            status: 'pending',
                                                                        }),
                                                                    })
                                                                    setSubtitleProgress(s => ({ ...s, [pid]: 50 }))
                                                                    setSubtitleStatus(s => ({ ...s, [pid]: `✅ Transcript saved — ${formatQCSummary(qcSummary)}` }))
                                                                } catch (err) {
                                                                    setSubtitleStatus(s => ({ ...s, [pid]: `❌ Transcription failed: ${err instanceof Error ? err.message : 'error'}` }))
                                                                    setSubtitlePhase(s => ({ ...s, [pid]: 'error' }))
                                                                    setSubtitleProgress(s => ({ ...s, [pid]: 0 }))
                                                                    return
                                                                }
                                                            } else {
                                                                setSubtitleProgress(s => ({ ...s, [pid]: 50 }))
                                                            }

                                                            // â”€â”€ Step 2: Server-side SSE translation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                                                            setSubtitlePhase(s => ({ ...s, [pid]: 'translating' }))
                                                            setSubtitleStatus(s => ({ ...s, [pid]: '🌍 Starting server translation...' }))

                                                            try {
                                                                const res = await fetch('/api/admin/subtitles/translate', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ projectId: pid }),
                                                                })

                                                                if (!res.ok || !res.body) {
                                                                    const err = await res.json().catch(() => ({}))
                                                                    throw new Error((err as {error?: string}).error || `HTTP ${res.status}`)
                                                                }

                                                                const reader = res.body.getReader()
                                                                const decoder = new TextDecoder()
                                                                let buffer = ''
                                                                let completed = 0

                                                                while (true) {
                                                                    const { done, value } = await reader.read()
                                                                    if (done) break
                                                                    buffer += decoder.decode(value, { stream: true })
                                                                    const events = buffer.split('\n\n')
                                                                    buffer = events.pop() || ''

                                                                    for (const event of events) {
                                                                        const line = event.replace(/^data: /, '').trim()
                                                                        if (!line) continue
                                                                        try {
                                                                            const data = JSON.parse(line) as {
                                                                                phase?: string; lang?: string; langName?: string;
                                                                                pct?: number; total?: number; completed?: number;
                                                                                allDone?: boolean; error?: string;
                                                                            }
                                                                            if (data.phase === 'translating' && data.langName) {
                                                                                setSubtitleStatus(s => ({ ...s, [pid]: `🌍 Translating ${data.langName}...` }))
                                                                                setSubtitleProgress(s => ({ ...s, [pid]: 50 + Math.round((data.pct ?? 0) * 0.48) }))
                                                                            } else if (data.phase === 'done') {
                                                                                completed++
                                                                                setTranslationCount(s => ({ ...s, [pid]: completed + 1 })) // +1 for English
                                                                            } else if (data.phase === 'complete') {
                                                                                const allDone = data.allDone ?? false
                                                                                setSubtitleProgress(s => ({ ...s, [pid]: 100 }))
                                                                                setSubtitleStatus(s => ({ ...s, [pid]: allDone ? `✓ All ${TOTAL_SUBTITLE_LANGS} languages ready` : `✓ ${completed + 1} languages ready` }))
                                                                                setSubtitlePhase(s => ({ ...s, [pid]: 'done' }))
                                                                                setTranslateStatus(s => ({ ...s, [pid]: allDone ? 'complete' : 'partial' }))
                                                                                setTranslationCount(s => ({ ...s, [pid]: allDone ? TOTAL_SUBTITLE_LANGS : completed + 1 }))
                                                                            } else if (data.phase === 'error' && data.lang) {
                                                                                setSubtitleStatus(s => ({ ...s, [pid]: `âš ï¸ ${data.lang} failed — continuing...` }))
                                                                            }
                                                                        } catch { /* malformed event */ }
                                                                    }
                                                                }
                                                            } catch (err) {
                                                                setSubtitleStatus(s => ({ ...s, [pid]: `❌ Translation error: ${err instanceof Error ? err.message : 'error'}` }))
                                                                setSubtitlePhase(s => ({ ...s, [pid]: 'error' }))
                                                                setTranslateStatus(s => ({ ...s, [pid]: 'partial' }))
                                                            }
                                                        }}
                                                        disabled={subtitlePhase[project.id] === 'transcribing' || subtitlePhase[project.id] === 'translating'}
                                                        className="btn btn-ghost btn-sm"
                                                        title={
                                                            translateStatus[project.id] === 'partial'
                                                                ? 'Resume translation (some languages already done)'
                                                                : translationCount[project.id] >= TOTAL_SUBTITLE_LANGS
                                                                    ? 'All subtitles generated — click to regenerate'
                                                                    : 'Generate multi-language subtitles'
                                                        }
                                                        style={{
                                                            fontSize: '0.65rem', fontWeight: 700,
                                                            color: subtitlePhase[project.id] === 'done'
                                                                ? 'var(--accent-gold)'
                                                                : translateStatus[project.id] === 'partial'
                                                                    ? 'var(--warning, #f59e0b)'
                                                                    : undefined,
                                                        }}
                                                    >
                                                        {subtitlePhase[project.id] === 'transcribing' ? '⏳'
                                                            : subtitlePhase[project.id] === 'translating' ? '🌍'
                                                            : translateStatus[project.id] === 'partial' ? '↻ Resume'
                                                            : subtitlePhase[project.id] === 'done' ? 'CC ✓'
                                                            : 'CC'}
                                                    </button>
                                                )}
                                                {/* Review button — appears when subtitles exist */}
                                                {project.filmUrl && (
                                                    translateStatus[project.id] === 'complete' ||
                                                    translateStatus[project.id] === 'partial' ||
                                                    (translationCount[project.id] ?? 0) > 0
                                                ) && (
                                                    <button
                                                        onClick={() => openReview(project.id, project.title)}
                                                        className="btn btn-ghost btn-sm"
                                                        title="Review subtitles and QC report before publishing"
                                                        style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-gold)', opacity: 0.85 }}
                                                    >
                                                        🔍 Review
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openCastModal(project.id, project.title)}
                                                    className="btn btn-ghost btn-sm"
                                                    title="Manage cast & crew for this project"
                                                    style={{ fontSize: '0.65rem', fontWeight: 700 }}
                                                >
                                                    🎭 Cast
                                                </button>
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
                                                    <span>{subtitleStatus[project.id]?.replace(/^[⏳🌍💾✓❌]\s?/, '')}</span>
                                                    <span>{subtitleProgress[project.id]}%</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    </>
                )}
            </main>

            {/* â”€â”€ Modal â”€â”€ */}
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

                                {/* Genre (multi-select pills), Year, Duration */}
                                <div>
                                    <label className="admin-label">Genre <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(select all that apply)</span></label>
                                    {form.genre && (
                                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                            {form.genre.split(',').filter(Boolean).map(g => (
                                                <span key={g} style={{
                                                    fontSize: '0.65rem', fontWeight: 700,
                                                    color: 'var(--accent-gold)',
                                                    background: 'rgba(212,168,83,0.12)',
                                                    border: '1px solid rgba(212,168,83,0.3)',
                                                    padding: '2px 8px', borderRadius: '20px',
                                                }}>{g.trim()}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Fantasy','Historical','Horror','Musical','Mystery','Romance','Sci-Fi','Short Film','Thriller','War','Western'].map(g => {
                                            const selected = form.genre?.split(',').map(x => x.trim()).includes(g)
                                            return (
                                                <button key={g} type="button"
                                                    onClick={() => {
                                                        const current = form.genre ? form.genre.split(',').map(x => x.trim()).filter(Boolean) : []
                                                        const next = selected ? current.filter(x => x !== g) : [...current, g]
                                                        updateField('genre', next.join(', '))
                                                    }}
                                                    style={{
                                                        fontSize: '0.65rem', fontWeight: 600,
                                                        padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                                                        border: selected ? '1px solid rgba(212,168,83,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                                        background: selected ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.04)',
                                                        color: selected ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >{g}</button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Year, Duration */}
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
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

                                {/* â”€â”€ Movie Rolls Assignment â”€â”€ */}
                                <div
                                    id="roll-assignment-section"
                                    style={{
                                        borderTop: rollError ? 'none' : '1px solid var(--border-subtle)',
                                        paddingTop: rollError ? 0 : 'var(--space-md)',
                                        marginTop: rollError ? 'var(--space-md)' : undefined,
                                        padding: rollError ? '14px' : undefined,
                                        borderRadius: rollError ? '10px' : undefined,
                                        background: rollError ? 'rgba(239,68,68,0.04)' : undefined,
                                        border: rollError ? '1px solid rgba(239,68,68,0.4)' : undefined,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: rollError ? '#ef4444' : 'var(--accent-gold)', marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🎞️ Movie Rolls
                                        {rollError && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 8px', borderRadius: '99px', border: '1px solid rgba(239,68,68,0.25)', textTransform: 'none' }}>âš  required — pick at least one</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: rollError ? '#ef4444' : 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                                        {rollError
                                            ? 'A project must belong to at least one roll before it can be saved.'
                                            : 'Select which rolls this project should appear in. You can choose multiple or all.'}
                                    </div>
                                    {rollsLoading ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', padding: '0.5rem 0' }}>Loading rolls…</div>
                                    ) : allRolls.length === 0 ? (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '0.25rem 0' }}>
                                            No rolls yet — create rolls from the <strong>Movie Rolls</strong> page first.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {/* Select All / Clear */}
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                                <button type="button"
                                                    onClick={() => setSelectedRollIds(allRolls.map(r => r.id))}
                                                    style={{
                                                        padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem',
                                                        fontWeight: 700, cursor: 'pointer',
                                                        background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)',
                                                        color: 'var(--accent-gold)',
                                                    }}
                                                >Select All</button>
                                                <button type="button"
                                                    onClick={() => setSelectedRollIds([])}
                                                    style={{
                                                        padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem',
                                                        fontWeight: 700, cursor: 'pointer',
                                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: 'var(--text-tertiary)',
                                                    }}
                                                >Clear All</button>
                                            </div>
                                            {allRolls.map(roll => {
                                                const isSelected = selectedRollIds.includes(roll.id)
                                                return (
                                                    <label key={roll.id}
                                                        onClick={() => setRollError(false)}
                                                        style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '8px 12px', borderRadius: '9px', cursor: 'pointer',
                                                        background: isSelected ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.025)',
                                                        border: `1px solid ${isSelected ? 'rgba(212,168,83,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                                        transition: 'all 0.15s',
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={e => {
                                                                if (e.target.checked) setSelectedRollIds(prev => [...prev, roll.id])
                                                                else setSelectedRollIds(prev => prev.filter(id => id !== roll.id))
                                                            }}
                                                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent-gold)', flexShrink: 0 }}
                                                        />
                                                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{roll.icon}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                                                                {roll.title}
                                                            </div>
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                                                {roll.displayOn === 'both' ? 'Homepage + Works' : roll.displayOn === 'homepage' ? 'Homepage only' : 'Works only'}
                                                                {!roll.visible && <span style={{ color: 'rgba(239,68,68,0.7)', marginLeft: '6px' }}>· hidden</span>}
                                                            </div>
                                                        </div>
                                                        {isSelected && <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', fontWeight: 700 }}>✓ Added</span>}
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    )}
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
            {/* â”€â”€ Subtitle Review Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {/* â”€â”€ Cast Management Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <style>{`
                @media (max-width: 540px) {
                    .cast-admin-form-grid { grid-template-columns: 1fr !important; }
                    .cast-admin-modal-inner { max-height: 100dvh !important; border-radius: 16px 16px 0 0 !important; }
                    .cast-admin-modal-wrap { align-items: flex-end !important; padding: 0 !important; }
                }
            `}</style>
            {castProjectId && (
                <div
                    className="cast-admin-modal-wrap"
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1150, padding: 'var(--space-lg)', backdropFilter: 'blur(8px)',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) closeCastModal() }}
                >
                    <div className="cast-admin-modal-inner" style={{
                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '700px',
                        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 32px 100px rgba(0,0,0,0.7)',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: 'var(--space-lg) var(--space-xl)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2px' }}>🎭 Cast & Crew</h2>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{castProjectTitle} · {castMembers.length} member{castMembers.length !== 1 ? 's' : ''}</p>
                            </div>
                            <button onClick={closeCastModal} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {/* Existing members */}
                            {castLoading ? (
                                <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>⏳ Loading...</div>
                            ) : castMembers.length > 0 ? (
                                <div style={{ padding: 'var(--space-md) var(--space-xl)' }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: 'var(--space-sm)' }}>Current Members</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {castMembers.map(m => (
                                            <div key={m.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '10px 12px', borderRadius: '8px',
                                                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                            }}>
                                                {/* Mini portrait */}
                                                <div style={{
                                                    width: '40px', height: '52px', borderRadius: '6px', flexShrink: 0,
                                                    background: m.photoUrl
                                                        ? `url(${m.photoUrl}) center/cover`
                                                        : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1.2rem', opacity: m.photoUrl ? 1 : 0.4,
                                                    userSelect: 'none',
                                                }}>
                                                    {!m.photoUrl && '🎭'}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {m.name}
                                                        {m.bioTranslations && (
                                                            <span title="Bio translated into all languages" style={{ marginLeft: '6px', fontSize: '0.6rem', color: '#4ade80', fontWeight: 800 }}>✓ 10 langs</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 600 }}>{m.jobTitle}</div>
                                                    {m.character && <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>as {m.character}</div>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                    {/* Translate bio & character */}
                                                    <button
                                                        onClick={() => handleTranslateCastMember(m)}
                                                        disabled={translatingId === m.id}
                                                        style={{
                                                            background: 'none', border: '1px solid rgba(212,168,83,0.3)',
                                                            borderRadius: '4px', color: 'var(--accent-gold)',
                                                            cursor: translatingId === m.id ? 'wait' : 'pointer',
                                                            fontSize: '0.65rem', padding: '3px 6px', flexShrink: 0,
                                                            opacity: translatingId !== null && translatingId !== m.id ? 0.4 : 1,
                                                        }}
                                                        title="Translate bio & character to all 10 languages"
                                                    >
                                                        {translatingId === m.id ? '⏳' : '🌍'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCastMember(m.id)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.9rem', padding: '4px', flexShrink: 0 }}
                                                        title="Remove member"
                                                    >✕</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: 'var(--space-lg) var(--space-xl)', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No cast members yet. Add the first one below.</div>
                            )}

                            {/* Add member form */}
                            <form onSubmit={handleAddCastMember} style={{ padding: 'var(--space-md) var(--space-xl) var(--space-xl)' }}>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>+ Add Member</div>
                                {castError && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginBottom: 'var(--space-sm)' }}>{castError}</div>}

                                <div className="cast-admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Name *</label>
                                        <input
                                            className="form-input"
                                            placeholder="Emma Chen"
                                            value={castForm.name}
                                            onChange={e => setCastForm(f => ({ ...f, name: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Job Title *</label>
                                        <select
                                            className="form-input"
                                            value={castForm.jobTitle}
                                            onChange={e => setCastForm(f => ({ ...f, jobTitle: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        >
                                            {['Actor', 'Actress', 'Director', 'Producer', 'Writer', 'Cinematographer', 'Editor', 'Composer', 'Other'].map(t => (
                                                <option key={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Character Name</label>
                                        <input
                                            className="form-input"
                                            placeholder="Maya Williams"
                                            value={castForm.character}
                                            onChange={e => setCastForm(f => ({ ...f, character: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Photo URL</label>
                                        <input
                                            className="form-input"
                                            placeholder="https://..."
                                            value={castForm.photoUrl}
                                            onChange={e => setCastForm(f => ({ ...f, photoUrl: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Instagram URL</label>
                                        <input
                                            className="form-input"
                                            placeholder="https://instagram.com/..."
                                            value={castForm.instagramUrl}
                                            onChange={e => setCastForm(f => ({ ...f, instagramUrl: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Short Bio</label>
                                        <textarea
                                            className="form-input"
                                            placeholder="A brief background about this person..."
                                            value={castForm.bio}
                                            onChange={e => setCastForm(f => ({ ...f, bio: e.target.value }))}
                                            rows={2}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px', resize: 'none' }}
                                        />
                                    </div>
                                </div>

                                <button type="submit" disabled={castSaving} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                                    {castSaving ? 'Adding...' : '+ Add to Cast'}
                                </button>
                            </form>
                        </div>

                        <div style={{ padding: 'var(--space-md) var(--space-xl)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={closeCastModal} className="btn btn-ghost btn-sm">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {reviewProjectId && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1100, padding: 'var(--space-lg)', backdropFilter: 'blur(6px)',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) closeReview() }}
                >
                    <div style={{
                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '860px',
                        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: 'var(--space-lg) var(--space-xl)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '2px' }}>
                                    🔍 Subtitle Review
                                </h2>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {reviewProjectTitle}
                                    {reviewData && ` · ${reviewData.segments.length} segments`}
                                    {reviewData?.transcribedWith && ` · ${reviewData.transcribedWith}`}
                                </p>
                            </div>
                            <button
                                onClick={closeReview}
                                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1.2rem', cursor: 'pointer' }}
                            >✕</button>
                        </div>

                        {reviewLoading && (
                            <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                ⏳ Loading subtitle data...
                            </div>
                        )}

                        {!reviewLoading && !reviewData && (
                            <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                No subtitles found for this project. Generate them first using the CC button.
                            </div>
                        )}

                        {!reviewLoading && reviewData && (() => {
                            const allLangs = ['en', ...Object.keys(reviewData.translations)]
                            const previewSegs = reviewLang === 'en'
                                ? reviewData.segments
                                : (reviewData.translations[reviewLang] || [])
                            const flaggedIds = new Set(reviewData.qcIssues.map(q => q.segmentIndex))

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                                    {/* â”€â”€ Panel 1: Language Status Grid â”€â”€ */}
                                    <LangStatusGrid
                                        translations={reviewData.translations}
                                        langStatus={reviewData.langStatus}
                                        sourceSegmentCount={reviewData.segments.length}
                                        retryingLang={retryingLang}
                                        onRetry={retryLang}
                                    />

                                    {/* â”€â”€ Panel 2: QC Report â”€â”€ */}
                                    {reviewData.qcIssues.length > 0 && (
                                        <div style={{ padding: 'var(--space-md) var(--space-xl)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(245,158,11,0.04)' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f59e0b', marginBottom: 'var(--space-sm)' }}>
                                                âš ï¸ QC Issues — {reviewData.qcIssues.length} / {reviewData.segments.length} segments flagged
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {(Object.entries(
                                                    reviewData.qcIssues.reduce<Record<string, number>>((acc, q) => {
                                                        q.issues.forEach(i => { acc[i.type] = (acc[i.type] || 0) + 1 })
                                                        return acc
                                                    }, {})
                                                )).map(([type, count]) => (
                                                    <span key={type} style={{
                                                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem',
                                                        background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                                                        border: '1px solid rgba(245,158,11,0.3)',
                                                    }}>
                                                        {count}Ã— {type.replace(/-/g, ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* â”€â”€ Panel 3: Language Switcher + Subtitle Preview â”€â”€ */}
                                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                                        {/* Lang list */}
                                        <div style={{
                                            width: '140px', flexShrink: 0,
                                            borderRight: '1px solid var(--border-subtle)',
                                            overflowY: 'auto', padding: 'var(--space-sm)',
                                        }}>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', padding: '4px 8px', marginBottom: '2px' }}>
                                                Preview
                                            </div>
                                            {allLangs.map(lang => (
                                                <button
                                                    key={lang}
                                                    onClick={() => setReviewLang(lang)}
                                                    style={{
                                                        display: 'block', width: '100%', textAlign: 'left',
                                                        padding: '6px 8px', borderRadius: '6px', border: 'none',
                                                        background: reviewLang === lang ? 'var(--accent-gold-glow, rgba(212,168,83,0.15))' : 'transparent',
                                                        color: reviewLang === lang ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                        fontSize: '0.75rem', cursor: 'pointer',
                                                        borderLeft: reviewLang === lang ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {LANGUAGE_NAMES[lang] || lang}
                                                    {lang === 'en' && <span style={{ fontSize: '0.6rem', opacity: 0.5, marginLeft: '4px' }}>src</span>}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Segment list */}
                                        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm) var(--space-md)' }}>
                                            {previewSegs.length === 0 ? (
                                                <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                                    No segments for {LANGUAGE_NAMES[reviewLang] || reviewLang}
                                                </div>
                                            ) : (
                                                previewSegs.map((seg, i) => {
                                                    const isFlagged = reviewLang === 'en' && flaggedIds.has(i)
                                                    const flaggedSeg = isFlagged ? reviewData.qcIssues.find(q => q.segmentIndex === i) : null
                                                    return (
                                                        <div key={i} style={{
                                                            display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start',
                                                            padding: '6px 8px', borderRadius: '6px', marginBottom: '2px',
                                                            background: isFlagged ? 'rgba(245,158,11,0.07)' : 'transparent',
                                                            border: isFlagged ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                                                        }}>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontFamily: 'monospace', minWidth: '52px', paddingTop: '2px' }}>
                                                                {`${Math.floor(seg.start / 60)}:${String(Math.floor(seg.start % 60)).padStart(2, '0')}`}
                                                            </span>
                                                            <div style={{ flex: 1 }}>
                                                                <span style={{ fontSize: '0.8rem', color: isFlagged ? '#f59e0b' : 'var(--text-primary)', lineHeight: 1.5 }}>
                                                                    {seg.text}
                                                                </span>
                                                                {flaggedSeg && (
                                                                    <div style={{ marginTop: '2px' }}>
                                                                        {flaggedSeg.issues.map((iss, j) => (
                                                                            <span key={j} style={{
                                                                                fontSize: '0.6rem', padding: '1px 6px',
                                                                                borderRadius: '8px', marginRight: '4px',
                                                                                background: 'rgba(245,158,11,0.15)',
                                                                                color: '#f59e0b',
                                                                            }}>
                                                                                {iss.type}: {iss.detail}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div style={{
                                        padding: 'var(--space-md) var(--space-xl)',
                                        borderTop: '1px solid var(--border-subtle)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                            {reviewData.translateStatus === 'complete' ? '✅ All languages complete' : 'âš ï¸ Translation partially complete'}
                                            {reviewData.generatedWith && ` · AI: ${reviewData.generatedWith}`}
                                        </span>
                                        <button onClick={closeReview} className="btn btn-ghost btn-sm">Close</button>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}

            {/* ── Translation Incomplete — Publish Confirmation Gate ── */}
            {showPublishWarning && editingId && (() => {
                const count = translationCount[editingId] ?? 0
                const missing = TOTAL_SUBTITLE_LANGS - count
                return (
                    <div
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1100,
                            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 'var(--space-xl)',
                        }}
                        onClick={() => setShowPublishWarning(false)}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid rgba(245,158,11,0.35)',
                                borderRadius: 'var(--radius-xl)',
                                padding: 'var(--space-xl)',
                                width: '100%', maxWidth: '480px',
                                boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,158,11,0.1)',
                                animation: 'fadeIn 0.15s ease',
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: 'var(--space-lg)' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                                }}>⚠️</div>
                                <div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                                        Translation Incomplete
                                    </h3>
                                    <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, marginTop: '3px' }}>
                                        {count} of {TOTAL_SUBTITLE_LANGS} languages translated
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div style={{
                                background: 'rgba(245,158,11,0.05)',
                                border: '1px solid rgba(245,158,11,0.15)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-md)',
                                marginBottom: 'var(--space-lg)',
                                fontSize: '0.875rem', lineHeight: 1.65,
                                color: 'var(--text-secondary)',
                            }}>
                                Publishing this project with only{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>{count}/{TOTAL_SUBTITLE_LANGS} languages</strong>{' '}
                                means{' '}
                                <strong style={{ color: '#ef4444' }}>
                                    {missing} language{missing !== 1 ? 's' : ''} will have no subtitles
                                </strong>{' '}
                                for viewers who speak those languages.
                                <div style={{
                                    marginTop: '10px', paddingTop: '10px',
                                    borderTop: '1px solid rgba(245,158,11,0.1)',
                                    fontSize: '0.78rem', color: 'var(--text-tertiary)',
                                }}>
                                    <strong style={{ color: 'var(--text-secondary)' }}>Recommended:</strong>{' '}
                                    Close this dialog, use the <strong>CC</strong> button on the project card to complete all translations, then publish.
                                </div>
                            </div>

                            {/* Progress indicator */}
                            <div style={{ marginBottom: 'var(--space-lg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    <span>Translation Progress</span>
                                    <span>{Math.round((count / TOTAL_SUBTITLE_LANGS) * 100)}%</span>
                                </div>
                                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: '3px',
                                        background: count === 0 ? 'rgba(239,68,68,0.5)' : 'linear-gradient(90deg, #f59e0b, #e8c547)',
                                        width: `${Math.round((count / TOTAL_SUBTITLE_LANGS) * 100)}%`,
                                        transition: 'width 0.3s ease',
                                    }} />
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowPublishWarning(false)}
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontWeight: 600 }}
                                >
                                    Complete Translations First
                                </button>
                                <button
                                    onClick={handlePublishOverride}
                                    disabled={saving}
                                    className="btn btn-sm"
                                    style={{
                                        background: 'rgba(239,68,68,0.12)',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        color: '#ef4444', fontWeight: 700,
                                    }}
                                >
                                    {saving ? 'Publishing...' : 'Publish Anyway'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
