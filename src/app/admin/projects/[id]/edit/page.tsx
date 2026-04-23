'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'
import FileUploader from '@/components/FileUploader'
import { TOTAL_SUBTITLE_LANGS, requiresTranslationGate } from '@/config/subtitles'
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

    // Publish gate
    const [showPublishWarning, setShowPublishWarning] = useState(false)

    // Section collapse state
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        basic: true, status: true, media: true, sponsor: false,
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
        }).catch(() => setError('Failed to load project')).finally(() => setLoading(false))
    }, [projectId, isNew, router])

    const updateField = (field: keyof FormData, value: string | boolean) =>
        setForm(f => ({ ...f, [field]: value }))

    const doSave = async (override = false) => {
        if (!form.title || !form.description) { setError('Please fill in title and description'); return }
        const needsGate = (form.published || requiresTranslationGate(form.status, form.filmUrl)) && !!form.filmUrl
        if (!override && needsGate && !isNew) {
            if (translationCount < TOTAL_SUBTITLE_LANGS) { setShowPublishWarning(true); return }
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
            router.push('/admin/projects')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally { setSaving(false) }
    }

    const handleSave = async (e: React.FormEvent) => { e.preventDefault(); await doSave(false) }

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button onClick={() => router.push('/admin/projects')} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>← Back</button>
                        <h1 className="admin-page-title" style={{ fontSize: '1.3rem' }}>
                            {isNew ? '🎬 New Project' : `✏️ ${originalTitle}`}
                        </h1>
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
                                    <FileUploader category="projects" accept="image/*" onUpload={(url) => updateField('coverImage', url)} />
                                    {form.coverImage && <input className="form-input" value={form.coverImage} onChange={e => updateField('coverImage', e.target.value)} style={{ marginTop: 6, fontSize: '0.75rem' }} />}
                                </div>
                                <div>
                                    <label className="form-label">Trailer URL</label>
                                    <input className="form-input" value={form.trailerUrl} onChange={e => updateField('trailerUrl', e.target.value)} placeholder="YouTube embed or direct video URL" />
                                </div>
                                <div>
                                    <label className="form-label">Film URL</label>
                                    <input className="form-input" value={form.filmUrl} onChange={e => updateField('filmUrl', e.target.value)} placeholder="Direct video file URL (R2/CDN)" />
                                </div>
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
