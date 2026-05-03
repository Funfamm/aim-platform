'use client'
// Force rebuild 1

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

import AdminSidebar from '@/components/AdminSidebar'
import FileUploader from '@/components/FileUploader'
import { TOTAL_SUBTITLE_LANGS, SUBTITLE_TARGET_LANGS, requiresTranslationGate } from '@/config/subtitles'
import PublishGateModal from '@/components/admin/PublishGateModal'

/* ── Types ── */
type FormData = {
    title: string; slug: string; tagline: string; description: string
    status: string; genre: string; year: string; duration: string
    featured: boolean; published: boolean; coverImage: string
    trailerUrl: string; filmUrl: string; projectType: string
    gallery: string; credits: string; sponsorData: string
}

const EMPTY_FORM: FormData = {
    title: '', slug: '', tagline: '', description: '',
    status: 'upcoming', genre: '', year: '', duration: '',
    featured: false, published: false, coverImage: '',
    trailerUrl: '', filmUrl: '', projectType: 'movie',
    gallery: '', credits: '', sponsorData: '',
}

const STATUSES = ['upcoming', 'in-production', 'completed']
const GENRES = ['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Fantasy','Historical','Horror','Musical','Mystery','Romance','Sci-Fi','Short Film','Thriller','War','Western']

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

type RollOption = { id: string; title: string; icon: string; displayOn: string; visible: boolean }

export default function ProjectEditPage() {
    const router = useRouter()
    const params = useParams()
    const projectId = params.id as string
    const isNew = projectId === 'new'

    const [form, setForm] = useState<FormData>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(!isNew)
    const [originalTitle, setOriginalTitle] = useState('')

    // Rolls
    const [allRolls, setAllRolls] = useState<RollOption[]>([])
    const [selectedRollIds, setSelectedRollIds] = useState<string[]>([])
    const [rollsLoading, setRollsLoading] = useState(false)
    const [rollError, setRollError] = useState(false)

    // Subtitle state
    const [translationCount, setTranslationCount] = useState(0)
    const [translateStatus, setTranslateStatus] = useState('pending')
    const [subtitleApproval, setSubtitleApproval] = useState('')
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [subGenerating, setSubGenerating] = useState(false)

    // Publish gate

    const [showPublishWarning, setShowPublishWarning] = useState(false)

    // Episodes
    type EpisodeRow = {
        id?: string; title: string; number: number; season: number
        videoUrl: string; duration: string; description: string
        thumbnail: string; published: boolean; _dirty?: boolean; _new?: boolean
    }
    const [episodes, setEpisodes] = useState<EpisodeRow[]>([])
    const [episodeSaving, setEpisodeSaving] = useState<string | null>(null)

    // Section collapse state
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        basic: true, status: true, media: true, episodes: false, sponsor: false,
        gallery: false, subtitles: false, rolls: false,
    })

    const toggleSection = (key: string) => setOpenSections(s => ({ ...s, [key]: !s[key] }))

    // Load project data
    useEffect(() => {
        if (isNew) {
            setRollsLoading(true)
            fetch('/api/admin/movie-rolls').then(r => r.ok ? r.json() : []).then(setAllRolls).catch(() => {}).finally(() => setRollsLoading(false))
            return
        }
        setLoading(true)
        Promise.all([
            fetch('/api/admin/projects').then(r => { if (r.status === 401) { window.location.href = '/admin/login'; return [] } return r.json() }),
            fetch('/api/admin/movie-rolls').then(r => r.ok ? r.json() : []),
            fetch(`/api/admin/projects/${projectId}/rolls`).then(r => r.ok ? r.json() : []),
            fetch(`/api/admin/subtitles?projectId=${projectId}`).then(r => r.ok ? r.json() : {}).catch(() => ({})),
        ]).then(([projects, rolls, assignedIds, subData]) => {
            const p = (projects as any[]).find((x: any) => x.id === projectId)
            if (!p) { router.push('/admin/projects'); return }
            setForm({
                title: p.title, slug: p.slug, tagline: p.tagline || '',
                description: p.description, status: p.status,
                genre: p.genre || '', year: p.year || '', duration: p.duration || '',
                featured: p.featured, published: p.published ?? false,
                coverImage: p.coverImage || '', trailerUrl: p.trailerUrl || '',
                filmUrl: p.filmUrl || '', projectType: p.projectType || 'movie',
                gallery: p.gallery || '', credits: p.credits || '',
                sponsorData: p.sponsorData || '',
            })
            setOriginalTitle(p.title)
            setAllRolls(rolls)
            setSelectedRollIds(assignedIds)
            const sd = subData as Record<string, any>
            if (sd?.subtitle?.status) setSubtitleApproval(sd.subtitle.status)
            // Check subtitle count
            if (p.filmUrl) {
                fetch(`/api/subtitles/${projectId}?lang=en`).then(r => r.json()).then(sub => {
                    setTranslationCount(sub.available?.length ?? 0)
                    setTranslateStatus(sub.translateStatus ?? 'pending')
                }).catch(() => {})
            }
            // Load episodes for series and shorts
            if (p.projectType === 'series' || p.projectType === 'shorts') {
                fetch(`/api/admin/episodes?projectId=${projectId}`)
                    .then(r => r.ok ? r.json() : { episodes: [] })
                    .then((data: any) => {
                        const eps = Array.isArray(data) ? data : (data.episodes || [])
                        setEpisodes(eps.map((e: any) => ({
                            id: e.id, title: e.title, number: e.number, season: e.season,
                            videoUrl: e.videoUrl || '', duration: e.duration || '',
                            description: e.description || '', thumbnail: e.thumbnail || '',
                            published: e.published ?? false,
                        })))
                    })
                    .catch(() => {})
            }
        }).catch(() => setError('Failed to load project')).finally(() => setLoading(false))
    }, [projectId, isNew, router])

    const updateField = (field: keyof FormData, value: string | boolean) =>
        setForm(f => ({ ...f, [field]: value }))

    const doSave = async (override = false) => {
        if (!form.title || !form.description) { setError('Please fill in title and description'); return }
        const needsGate = (form.published || requiresTranslationGate(form.status, form.filmUrl)) && !!form.filmUrl
        if (!override && needsGate && !isNew) {
            // Re-fetch the latest subtitle count right before the gate — avoids stale state
            // if subtitles were generated after the page was first loaded.
            let freshCount = translationCount
            try {
                const subRes = await fetch(`/api/subtitles/${projectId}?lang=en`)
                if (subRes.ok) {
                    const subJson = await subRes.json()
                    // Filter to target langs only — `available` also contains the source language
                    const allAvail: string[] = subJson.available ?? []
                    freshCount = allAvail.filter((l: string) => (SUBTITLE_TARGET_LANGS as readonly string[]).includes(l)).length
                    setTranslationCount(freshCount)
                }
            } catch { /* fall through with cached count */ }
            if (freshCount < TOTAL_SUBTITLE_LANGS) { setShowPublishWarning(true); return }
        }
        if (allRolls.length > 0 && selectedRollIds.length === 0) {
            setError('🎬 This project must be assigned to at least one Movie Roll before saving.')
            setRollError(true); return
        }
        setSaving(true); setError(''); setRollError(false)
        try {
            const payload = { ...form, slug: form.slug || slugify(form.title) }
            const url = isNew ? '/api/admin/projects' : `/api/admin/projects/${projectId}`
            const method = isNew ? 'POST' : 'PUT'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to save') }
            const saved = await res.json()
            // Save roll assignments
            fetch(`/api/admin/projects/${saved.id}/rolls`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rollIds: selectedRollIds }),
            }).catch(() => {})
            // Stay on editor — show success banner
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally { setSaving(false) }
    }

    const handleSave = async (e: React.FormEvent) => { e.preventDefault(); await doSave(false) }

    // ── Episode helpers ──
    const updateEpisode = (idx: number, field: string, value: string | number | boolean) => {
        setEpisodes(prev => prev.map((ep, i) => i === idx ? { ...ep, [field]: value, _dirty: true } : ep))
    }

    const addEpisode = () => {
        const maxNum = episodes.filter(e => e.season === 1).reduce((max, e) => Math.max(max, e.number), 0)
        setEpisodes(prev => [...prev, {
            title: '', number: maxNum + 1, season: 1,
            videoUrl: '', duration: '', description: '',
            thumbnail: '', published: false, _new: true, _dirty: true,
        }])
    }

    const saveEpisode = async (idx: number) => {
        if (isNew) { setError('Save the project first, then add episodes'); return }
        const ep = episodes[idx]
        if (!ep.title) { setError('Episode title is required'); return }
        const key = ep.id || `new-${idx}`
        setEpisodeSaving(key)
        try {
            const payload = {
                projectId: projectId,
                title: ep.title, number: ep.number, season: ep.season,
                videoUrl: ep.videoUrl || null, duration: ep.duration || null,
                description: ep.description || null, thumbnail: ep.thumbnail || null,
                published: ep.published,
            }
            const isCreate = !ep.id
            const res = await fetch('/api/admin/episodes', {
                method: isCreate ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isCreate ? payload : { id: ep.id, ...payload }),
            })
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
            const data = await res.json()
            const saved = data.episode || data
            setEpisodes(prev => prev.map((e, i) => i === idx ? {
                ...e, id: saved.id, _new: false, _dirty: false,
            } : e))
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save episode')
        } finally { setEpisodeSaving(null) }
    }

    const deleteEpisode = async (idx: number) => {
        const ep = episodes[idx]
        if (ep._new) { setEpisodes(prev => prev.filter((_, i) => i !== idx)); return }
        if (!confirm(`Delete episode S${ep.season}E${ep.number} "${ep.title}"?`)) return
        try {
            const res = await fetch(`/api/admin/episodes?id=${ep.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            setEpisodes(prev => prev.filter((_, i) => i !== idx))
        } catch { setError('Failed to delete episode') }
    }

    // ── Episode subtitle generation ──
    const [episodeSubStatus, setEpisodeSubStatus] = useState<Record<string, 'idle' | 'generating' | 'done' | 'error'>>({})
    const [episodeSubLangs, setEpisodeSubLangs] = useState<Record<string, string[]>>({})

    // Check subtitle availability for each saved episode on mount
    useEffect(() => {
        episodes.forEach(ep => {
            if (!ep.id || !ep.videoUrl) return
            fetch(`/api/subtitles/${projectId}?lang=en&episodeId=${ep.id}`)
                .then(r => r.json())
                .then(data => {
                    if (data.available?.length) {
                        setEpisodeSubLangs(prev => ({ ...prev, [ep.id!]: data.available }))
                        setEpisodeSubStatus(prev => ({ ...prev, [ep.id!]: 'done' }))
                    }
                })
                .catch(() => {})
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [episodes.length])

    const generateEpisodeSubtitles = async (epId: string, videoUrl: string) => {
        if (!videoUrl) { setError('Episode needs a video URL first'); return }
        setEpisodeSubStatus(prev => ({ ...prev, [epId]: 'generating' }))
        try {
            const res = await fetch('/api/subtitles/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, episodeId: epId, videoUrl }),
            })
            if (!res.ok) {
                const d = await res.json()
                if (res.status === 409) {
                    // Already running
                    setError('Subtitle job already in progress for this episode')
                    return
                }
                throw new Error(d.error || 'Failed to start')
            }
            const { jobId } = await res.json()
            // Poll job status
            const poll = setInterval(async () => {
                try {
                    const jr = await fetch(`/api/subtitles/status/${jobId}`)
                    const jd = await jr.json()
                    if (jd.status === 'completed') {
                        clearInterval(poll)
                        setEpisodeSubStatus(prev => ({ ...prev, [epId]: 'done' }))
                        // Refresh available languages
                        fetch(`/api/subtitles/${projectId}?lang=en&episodeId=${epId}`)
                            .then(r => r.json())
                            .then(data => { if (data.available) setEpisodeSubLangs(prev => ({ ...prev, [epId]: data.available })) })
                            .catch(() => {})
                    } else if (jd.status === 'failed') {
                        clearInterval(poll)
                        setEpisodeSubStatus(prev => ({ ...prev, [epId]: 'error' }))
                        setError(`Subtitle generation failed for episode`)
                    }
                } catch { /* keep polling */ }
            }, 5000)
            // Stop polling after 10 minutes
            setTimeout(() => clearInterval(poll), 600_000)
        } catch (err) {
            setEpisodeSubStatus(prev => ({ ...prev, [epId]: 'error' }))
            setError(err instanceof Error ? err.message : 'Subtitle generation failed')
        }
    }

    const epLabelStyle: React.CSSProperties = {
        fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', display: 'block',
    }

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading project…</div>
                </main>
            </div>
        )
    }

    /* ── Section header component ── */
    const SectionHeader = ({ id, emoji, title }: { id: string; emoji: string; title: string }) => (
        <button
            type="button"
            onClick={() => toggleSection(id)}
            style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0',
                fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left',
            }}
        >
            <span>{emoji}</span>
            <span style={{ flex: 1 }}>{title}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: openSections[id] ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </button>
    )

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                {/* Header */}
                <div className="admin-header" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                        <button onClick={() => router.push('/admin/projects')} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>← Back</button>
                        <h1 className="admin-page-title" style={{ fontSize: '1.3rem', flex: 1 }}>
                            {isNew ? '🎬 New Project' : `✏️ ${originalTitle}`}
                        </h1>
                        {/* Preview as User — only for saved projects with video content */}
                        {!isNew && form.slug && (form.filmUrl || episodes.some(e => e.videoUrl)) && (
                            <a
                                href={`/${params?.locale || 'en'}/works/${form.slug}/watch`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.78rem', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--accent-gold)' }}
                            >
                                👁 Preview as User
                            </a>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSave} style={{ maxWidth: '720px' }}>
                    {/* ══ BASIC INFO ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="basic" emoji="📝" title="Basic Information" />
                        {openSections.basic && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div>
                                        <label className="form-label">Title *</label>
                                        <input className="form-input" value={form.title}
                                            onChange={e => { updateField('title', e.target.value); if (isNew) updateField('slug', slugify(e.target.value)) }}
                                            placeholder="e.g. Neon Saints" required />
                                    </div>
                                    <div>
                                        <label className="form-label">Slug</label>
                                        <input className="form-input" value={form.slug}
                                            onChange={e => updateField('slug', e.target.value)}
                                            placeholder="auto-generated" style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Tagline</label>
                                    <input className="form-input" value={form.tagline}
                                        onChange={e => updateField('tagline', e.target.value)}
                                        placeholder="A short hook for the project..." />
                                </div>
                                <div>
                                    <label className="form-label">Description *</label>
                                    <textarea className="form-input" rows={4} value={form.description}
                                        onChange={e => updateField('description', e.target.value)}
                                        placeholder="Full synopsis or description..." required />
                                </div>
                                {/* Genre pills */}
                                <div>
                                    <label className="form-label">Genre</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {GENRES.map(g => {
                                            const selected = form.genre?.split(',').map(x => x.trim()).includes(g)
                                            return (
                                                <button key={g} type="button"
                                                    onClick={() => {
                                                        const current = form.genre ? form.genre.split(',').map(x => x.trim()).filter(Boolean) : []
                                                        const next = selected ? current.filter(x => x !== g) : [...current, g]
                                                        updateField('genre', next.join(', '))
                                                    }}
                                                    style={{
                                                        fontSize: '0.65rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                                                        border: selected ? '1px solid rgba(212,168,83,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                                        background: selected ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.04)',
                                                        color: selected ? 'var(--accent-gold)' : 'var(--text-tertiary)', transition: 'all 0.15s',
                                                    }}
                                                >{g}</button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div>
                                        <label className="form-label">Year</label>
                                        <input className="form-input" value={form.year} onChange={e => updateField('year', e.target.value)} placeholder="e.g. 2026" />
                                    </div>
                                    <div>
                                        <label className="form-label">Duration</label>
                                        <input className="form-input" value={form.duration} onChange={e => updateField('duration', e.target.value)} placeholder="e.g. 12 min" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ══ STATUS & VISIBILITY ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="status" emoji="🔒" title="Status & Visibility" />
                        {openSections.status && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div>
                                        <label className="form-label">Status</label>
                                        <select className="form-input" value={form.status} onChange={e => updateField('status', e.target.value)}>
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Project Type</label>
                                        <select className="form-input" value={form.projectType} onChange={e => updateField('projectType', e.target.value)}>
                                            <option value="movie">Movie</option>
                                            <option value="series">Series</option>
                                            <option value="short">Short Film</option>
                                            <option value="shorts">Shorts (no trailer)</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-xl)', paddingTop: 'var(--space-sm)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={form.featured} onChange={e => updateField('featured', e.target.checked)} />
                                        ⭐ Featured
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={form.published} onChange={e => updateField('published', e.target.checked)} />
                                        🌐 Published
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ══ MEDIA ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="media" emoji="🎥" title="Media" />
                        {openSections.media && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div>
                                    <label className="form-label">Cover Image</label>
                                    <FileUploader
                                        category="projects" accept="image/*"
                                        currentUrl={form.coverImage}
                                        onUpload={(url) => updateField('coverImage', url)}
                                        label="Cover Image"
                                    />
                                </div>

                                {/* Trailer — hidden for Shorts since they don't use trailers */}
                                {form.projectType !== 'shorts' && (
                                    <div>
                                        <FileUploader
                                            category="trailers" accept="video/*,image/*"
                                            maxSizeMB={2000}
                                            currentUrl={form.trailerUrl}
                                            onUpload={(url) => updateField('trailerUrl', url)}
                                            label="Trailer (drag & drop or paste URL)"
                                        />
                                    </div>
                                )}

                                {/* Film URL — for movies and short films (not series/shorts which use episodes) */}
                                {(form.projectType === 'movie' || form.projectType === 'short') && (
                                    <div>
                                        <FileUploader
                                            category="films" accept="video/*,image/*"
                                            maxSizeMB={5000}
                                            currentUrl={form.filmUrl}
                                            onUpload={(url) => updateField('filmUrl', url)}
                                            label="Film / Main Video (drag & drop or paste URL)"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ══ SPONSOR ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="sponsor" emoji="🤝" title="Project Sponsor" />
                        {openSections.sponsor && (() => {
                            let sd: { name?: string; logoUrl?: string; description?: string } = {}
                            try { if (form.sponsorData) sd = JSON.parse(form.sponsorData) } catch { /* ignore */ }
                            const updateSponsor = (field: string, value: string) => {
                                const current = { ...sd, [field]: value }
                                if (!current.name && !current.logoUrl && !current.description) updateField('sponsorData', '')
                                else updateField('sponsorData', JSON.stringify(current))
                            }
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Sponsor info appears in publish emails.</p>
                                    <input className="form-input" placeholder="Sponsor Name" value={sd.name || ''} onChange={e => updateSponsor('name', e.target.value)} />
                                    <input className="form-input" placeholder="Logo URL" value={sd.logoUrl || ''} onChange={e => updateSponsor('logoUrl', e.target.value)} />
                                    <input className="form-input" placeholder="Short description" value={sd.description || ''} onChange={e => updateSponsor('description', e.target.value)} />
                                </div>
                            )
                        })()}
                    </div>

                    {/* ══ GALLERY & CREDITS ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="gallery" emoji="📸" title="Gallery & Credits" />
                        {openSections.gallery && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div>
                                    <label className="form-label" htmlFor="gallery">Gallery Media <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(images &amp; videos — one URL per line)</span></label>
                                    <textarea className="form-input" rows={3} value={form.gallery} onChange={e => updateField('gallery', e.target.value)}
                                        placeholder={"https://cdn.example.com/still-1.jpg\nhttps://cdn.example.com/bts-clip.mp4\nhttps://cdn.example.com/still-2.jpg"}
                                        style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                                </div>
                                <div>
                                    <label className="form-label">Credits <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(one per line: Role — Name)</span></label>
                                    <textarea className="form-input" rows={4} value={form.credits} onChange={e => updateField('credits', e.target.value)}
                                        placeholder={"Director — Jane Doe\nProducer — John Smith\nEditor — Alex Kim"}
                                        style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ══ EPISODES (series + shorts) ══ */}
                    {(form.projectType === 'series' || form.projectType === 'shorts') && (
                        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <SectionHeader id="episodes" emoji="📺" title={`Episodes (${episodes.length})`} />
                            {openSections.episodes && (
                                <div style={{ paddingTop: 'var(--space-sm)' }}>
                                    {episodes.length === 0 && (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>No episodes yet. Add the first one below.</p>
                                    )}

                                    {episodes.map((ep, idx) => (
                                        <div key={ep.id || `new-${idx}`} style={{
                                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                            padding: 'var(--space-md)', marginBottom: 'var(--space-sm)',
                                            background: ep._new ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '60px 60px 1fr', gap: '8px', marginBottom: '8px' }}>
                                                <div>
                                                    <label style={epLabelStyle}>S#</label>
                                                    <input className="form-input" type="number" min={1} value={ep.season}
                                                        onChange={e => updateEpisode(idx, 'season', Number(e.target.value))}
                                                        style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>E#</label>
                                                    <input className="form-input" type="number" min={1} value={ep.number}
                                                        onChange={e => updateEpisode(idx, 'number', Number(e.target.value))}
                                                        style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>Title *</label>
                                                    <input className="form-input" value={ep.title}
                                                        onChange={e => updateEpisode(idx, 'title', e.target.value)}
                                                        placeholder="Episode title" style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
                                                </div>
                                            </div>
                                            <div style={{ marginBottom: '8px' }}>
                                                <FileUploader
                                                    category="episodes" accept="video/*,image/*"
                                                    maxSizeMB={5000}
                                                    currentUrl={ep.videoUrl}
                                                    compact
                                                    onUpload={(url) => updateEpisode(idx, 'videoUrl', url)}
                                                    label="Episode Video (drag & drop or paste URL)"
                                                />
                                            </div>
                                            <div style={{ marginBottom: '8px' }}>
                                                <label style={epLabelStyle}>Duration</label>
                                                <input className="form-input" value={ep.duration}
                                                    onChange={e => updateEpisode(idx, 'duration', e.target.value)}
                                                    placeholder="e.g. 12 min" style={{ fontSize: '0.78rem', padding: '6px 8px' }} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                                <div>
                                                    <label style={epLabelStyle}>Thumbnail URL</label>
                                                    <input className="form-input" value={ep.thumbnail}
                                                        onChange={e => updateEpisode(idx, 'thumbnail', e.target.value)}
                                                        placeholder="Episode thumbnail" style={{ fontSize: '0.78rem', padding: '6px 8px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>Description</label>
                                                    <input className="form-input" value={ep.description}
                                                        onChange={e => updateEpisode(idx, 'description', e.target.value)}
                                                        placeholder="Short description" style={{ fontSize: '0.78rem', padding: '6px 8px' }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                                                        <input type="checkbox" checked={ep.published}
                                                            onChange={e => updateEpisode(idx, 'published', e.target.checked)} />
                                                        Published
                                                    </label>
                                                    {/* Subtitle status & generate button */}
                                                    {ep.id && ep.videoUrl && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {episodeSubStatus[ep.id] === 'generating' ? (
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', animation: 'pulse 1.5s infinite' }}>⏳ Generating subtitles…</span>
                                                            ) : episodeSubStatus[ep.id] === 'done' ? (
                                                                <span style={{ fontSize: '0.7rem', color: '#34d399' }}>
                                                                    🗨️ {episodeSubLangs[ep.id]?.length || 0} lang{(episodeSubLangs[ep.id]?.length || 0) !== 1 ? 's' : ''}
                                                                </span>
                                                            ) : episodeSubStatus[ep.id] === 'error' ? (
                                                                <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>❌ Failed</span>
                                                            ) : null}
                                                            {episodeSubStatus[ep.id] !== 'generating' && (
                                                                <button type="button"
                                                                    onClick={() => generateEpisodeSubtitles(ep.id!, ep.videoUrl)}
                                                                    style={{
                                                                        fontSize: '0.68rem', fontWeight: 600, padding: '3px 8px',
                                                                        borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                                        background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                                                                    }}>
                                                                    {episodeSubStatus[ep.id] === 'done' ? '🔄 Regen' : '🗨️ Subtitles'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button type="button" onClick={() => saveEpisode(idx)} disabled={episodeSaving === (ep.id || `new-${idx}`)}
                                                        style={{
                                                            fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px',
                                                            borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                            background: 'rgba(52,211,153,0.15)', color: '#34d399',
                                                        }}>
                                                        {episodeSaving === (ep.id || `new-${idx}`) ? 'Saving…' : ep._new ? '➕ Create' : '💾 Save'}
                                                    </button>
                                                    {ep.id && (
                                                        <button type="button" onClick={() => deleteEpisode(idx)}
                                                            style={{
                                                                fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px',
                                                                borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                                            }}>
                                                            🗑
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button type="button" onClick={addEpisode} style={{
                                        width: '100%', padding: '10px', fontSize: '0.82rem', fontWeight: 600,
                                        borderRadius: 'var(--radius-md)', border: '1px dashed rgba(212,168,83,0.3)',
                                        background: 'rgba(212,168,83,0.06)', color: 'var(--accent-gold)',
                                        cursor: 'pointer', transition: 'all 0.15s', marginTop: 'var(--space-sm)',
                                    }}>
                                        + Add Episode
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ SUBTITLES (movie / short only) ══ */}
                    {!isNew && (form.projectType === 'movie' || form.projectType === 'short') && (
                        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <SectionHeader id="subtitles" emoji="🗨️" title={`Subtitles & Transcription (${translationCount}/${TOTAL_SUBTITLE_LANGS} langs)`} />
                            {openSections.subtitles && (
                                <div style={{ paddingTop: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {!form.filmUrl ? (
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                                            Upload a Film video above first, then generate subtitles here.
                                        </p>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                        Transcribes the film audio → generates subtitles in {TOTAL_SUBTITLE_LANGS} languages automatically.
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                        {translationCount > 0
                                                            ? `✅ ${translationCount} language${translationCount !== 1 ? 's' : ''} done`
                                                            : 'No subtitles generated yet'}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={subGenerating}
                                                    onClick={async () => {
                                                        setSubGenerating(true)
                                                        setError('')
                                                        try {
                                                            const res = await fetch('/api/subtitles/generate', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ projectId, videoUrl: form.filmUrl }),
                                                            })
                                                            if (!res.ok) {
                                                                const d = await res.json()
                                                                if (res.status === 409) { setError('Subtitle job already in progress'); return }
                                                                throw new Error(d.error || 'Failed to start')
                                                            }
                                                            setSaveSuccess(false)
                                                            // Show success note
                                                            setError('')
                                                            alert('Subtitle generation started! This runs in the background. Come back in a few minutes to check.')
                                                        } catch (err) {
                                                            setError(err instanceof Error ? err.message : 'Failed to start subtitle generation')
                                                        } finally {
                                                            setSubGenerating(false)
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: subGenerating ? 'default' : 'pointer',
                                                        background: 'rgba(99,102,241,0.14)', color: '#818cf8',
                                                        fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {subGenerating ? '⏳ Starting…' : translationCount > 0 ? '🔄 Regenerate Subtitles' : '🗨️ Generate Subtitles'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ MOVIE ROLLS ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }} id="roll-assignment-section">
                        <SectionHeader id="rolls" emoji="🎞️" title="Movie Roll Assignment" />
                        {openSections.rolls && (
                            <div style={{ paddingTop: 'var(--space-sm)' }}>
                                {rollsLoading ? (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Loading rolls…</p>
                                ) : allRolls.length === 0 ? (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>No movie rolls configured yet.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {allRolls.map(roll => {
                                            const isSelected = selectedRollIds.includes(roll.id)
                                            return (
                                                <label key={roll.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                                                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                    background: isSelected ? 'rgba(212,168,83,0.1)' : 'transparent',
                                                    border: isSelected ? '1px solid rgba(212,168,83,0.3)' : '1px solid var(--border-subtle)',
                                                    transition: 'all 0.15s',
                                                }}>
                                                    <input type="checkbox" checked={isSelected}
                                                        onChange={() => setSelectedRollIds(prev =>
                                                            isSelected ? prev.filter(x => x !== roll.id) : [...prev, roll.id]
                                                        )} />
                                                    <span>{roll.icon}</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400 }}>{roll.title}</span>
                                                </label>
                                            )
                                        })}
                                        {rollError && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: 4 }}>Select at least one roll.</p>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ══ STICKY SAVE BAR ══ */}
                    {saveSuccess && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)',
                            fontSize: '0.85rem', fontWeight: 600, padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)',
                            color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                            ✓ Project saved successfully
                        </div>
                    )}
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)',
                            fontSize: '0.85rem', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)',
                            color: 'var(--error)', background: 'rgba(239,68,68,0.1)' }}>
                            <span style={{ flex: 1 }}>✗ {error}</span>
                            <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '1rem' }}>✕</button>
                        </div>
                    )}

                    <div style={{
                        position: 'sticky', bottom: 0, background: 'var(--bg-secondary)',
                        borderTop: '1px solid var(--border-subtle)',
                        padding: 'var(--space-md) 0', display: 'flex', gap: 'var(--space-md)',
                        justifyContent: 'flex-end', zIndex: 10,
                    }}>
                        <button type="button" onClick={() => router.push('/admin/projects')} className="btn btn-ghost">Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : isNew ? '🎬 Create Project' : '💾 Save Changes'}
                        </button>
                    </div>
                </form>
            </main>

            {/* Publish gate */}
            {showPublishWarning && (
                <PublishGateModal
                    isOpen={true}
                    translatedCount={translationCount}
                    saving={saving}
                    onConfirm={() => { setShowPublishWarning(false); doSave(true) }}
                    onCancel={() => setShowPublishWarning(false)}
                />
            )}
        </div>
    )
}
