'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaItem {
    id: string
    page: string
    type: string
    url: string
    title: string
    sortOrder: number
    duration: number
    active: boolean
    target: string  // 'all' | 'desktop' | 'mobile'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGES = [
    { value: 'home',      label: 'Homepage' },
    { value: 'works',     label: 'Works' },
    { value: 'casting',   label: 'Casting' },
    { value: 'upcoming',  label: 'Upcoming' },
    { value: 'training',  label: 'Training' },
    { value: 'scripts',   label: 'Scripts' },
    { value: 'about',     label: 'About' },
    { value: 'donate',    label: 'Donate' },
    { value: 'subscribe', label: 'Notifications' },
    { value: 'contact',   label: 'Contact' },
]

const HERO_PAGES = [
    { value: 'all',      label: '🌐 All Pages',  short: 'All' },
    { value: 'home',     label: '🏠 Homepage',   short: 'Home' },
    { value: 'works',    label: '🎬 Works',       short: 'Works' },
    { value: 'casting',  label: '🎭 Casting',     short: 'Casting' },
    { value: 'upcoming', label: '📅 Upcoming',    short: 'Upcoming' },
    { value: 'training', label: '🎓 Training',    short: 'Training' },
    { value: 'scripts',  label: '✍️ Scripts',     short: 'Scripts' },
]

const MEDIA_TYPES = [
    { value: 'background',  label: 'Background',   icon: '🎨' },
    { value: 'image',       label: 'Image',         icon: '🖼️' },
    { value: 'video',       label: 'Video',         icon: '📹' },
    { value: 'gallery',     label: 'Gallery',       icon: '🗃️' },
    { value: 'hero',        label: 'Hero (Page)',    icon: '⭐' },
    { value: 'hero-video',  label: 'Hero Video',    icon: '🎥' },
]

const EMPTY_FORM = {
    page: 'home',
    pages: ['all'] as string[],   // for hero-video
    type: 'image',
    title: '',
    url: '',
    sortOrder: 1,
    duration: 10,
    active: true,
    target: 'all',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminMediaPage() {
    const [items, setItems]             = useState<MediaItem[]>([])
    const [loading, setLoading]         = useState(true)
    const [filterPage, setFilterPage]   = useState('all')
    const [filterType, setFilterType]   = useState('all')

    const [showForm, setShowForm]       = useState(false)
    const [editingId, setEditingId]     = useState<string | null>(null)
    const [form, setForm]               = useState({ ...EMPTY_FORM })
    const [uploading, setUploading]     = useState(false)
    const [uploadMsg, setUploadMsg]     = useState('')
    const [saving, setSaving]           = useState(false)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const [isDragging, setIsDragging]   = useState(false)
    const dragCounterRef                = useRef(0)
    const fileRef                       = useRef<HTMLInputElement>(null)
    const formRef                       = useRef<HTMLDivElement>(null)

    // ─── Data fetching ────────────────────────────────────────────────────────

    const fetchItems = useCallback(async () => {
        setLoading(true)
        try {
            // Fetch all items (page media + hero videos) in one call
            const all = await fetch('/api/admin/media?admin=true').then(r => r.json())
            setItems(Array.isArray(all) ? all : [])
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchItems() }, [fetchItems])

    // ─── Derived view ─────────────────────────────────────────────────────────

    const visible = items.filter(item => {
        if (filterType !== 'all' && item.type !== filterType) return false
        if (filterPage === 'all') return true
        // hero-video page field is comma-separated
        const pageParts = (item.page || '').split(',').map(s => s.trim())
        return pageParts.includes(filterPage) || pageParts.includes('all')
    })

    // ─── Form helpers ─────────────────────────────────────────────────────────

    const isHeroVideo = form.type === 'hero-video'

    const openNew = () => {
        const nextSort = items.length > 0 ? Math.max(...items.map(m => m.sortOrder)) + 1 : 1
        setForm({ ...EMPTY_FORM, sortOrder: nextSort, page: filterPage !== 'all' ? filterPage : 'home' })
        setEditingId(null)
        setShowForm(true)
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }

    const openEdit = (item: MediaItem) => {
        const pages = item.type === 'hero-video'
            ? (item.page || 'all').split(',').filter(Boolean)
            : ['all']
        setForm({
            page:      item.type !== 'hero-video' ? item.page : 'home',
            pages,
            type:      item.type,
            title:     item.title || '',
            url:       item.url,
            sortOrder: item.sortOrder,
            duration:  item.duration || 10,
            active:    item.active,
            target:    item.target || 'all',
        })
        setEditingId(item.id)
        setShowForm(true)
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }

    const cancelForm = () => { setShowForm(false); setEditingId(null); setUploadMsg('') }

    const toggleHeroPage = (val: string) => {
        setForm(prev => {
            if (val === 'all') return { ...prev, pages: ['all'] }
            let next = prev.pages.filter(p => p !== 'all')
            if (next.includes(val)) next = next.filter(p => p !== val)
            else next.push(val)
            return { ...prev, pages: next.length === 0 ? ['all'] : next }
        })
    }

    // ─── File upload ──────────────────────────────────────────────────────────

    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || !files.length) return
        const file = files[0]
        const isVideo = file.type.startsWith('video/')
        const isImage = file.type.startsWith('image/')
        if (!isVideo && !isImage) { setUploadMsg('Only image or video files are accepted.'); return }
        if (file.size > 100 * 1024 * 1024) setUploadMsg(`⚠️ File is ${(file.size / 1024 / 1024).toFixed(0)} MB — large files may time out. Consider using a direct URL.`)
        setUploading(true)
        setUploadMsg(`Uploading ${file.name}…`)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('directory', isVideo ? 'videos' : 'images')
        try {
            const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
            if (!res.ok) {
                const txt = await res.text().catch(() => res.statusText)
                setUploadMsg(res.status === 413
                    ? '⚠️ File too large (>4.5 MB). Use a direct CDN URL instead.'
                    : `❌ Upload failed (${res.status}): ${txt.slice(0, 100)}`)
                setTimeout(() => setUploadMsg(''), 6000)
                return
            }
            const data = await res.json()
            if (data.url) {
                const label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
                setForm(prev => ({
                    ...prev,
                    url: data.url,
                    title: prev.title || label,
                    type: isVideo ? (prev.type === 'hero-video' ? 'hero-video' : 'video') : prev.type,
                }))
                setUploadMsg('✓ Uploaded successfully')
                setTimeout(() => setUploadMsg(''), 2500)
            }
        } catch (err) {
            setUploadMsg(`❌ ${err instanceof Error ? err.message : 'Network error'}`)
            setTimeout(() => setUploadMsg(''), 4000)
        } finally { setUploading(false) }
    }, [])

    // ─── CRUD ────────────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.url) return
        setSaving(true)
        // hero-video items are stored in prisma.pageMedia (type='hero-video').
        // The HeroVideo model (prisma.heroVideo / /api/admin/videos) has no `target` field,
        // so we intentionally omit target from hero-video payloads for forward-compatibility.
        const payload = isHeroVideo
            ? { page: form.pages.join(','), type: 'hero-video', title: form.title, url: form.url, duration: form.duration, sortOrder: form.sortOrder, active: form.active }
            : { page: form.page, type: form.type, title: form.title, url: form.url, duration: form.duration, sortOrder: form.sortOrder, active: form.active, target: form.target }
        try {
            if (editingId) {
                await fetch('/api/admin/media', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...payload }) })
            } else {
                await fetch('/api/admin/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            }
            cancelForm()
            fetchItems()
        } catch { /* ignore */ }
        finally { setSaving(false) }
    }

    const handleToggle = async (item: MediaItem) => {
        await fetch('/api/admin/media', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, active: !item.active }) })
        fetchItems()
    }

    const handleDelete = async (id: string) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id)
            setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000)
            return
        }
        setConfirmDeleteId(null)
        await fetch(`/api/admin/media?id=${id}`, { method: 'DELETE' })
        fetchItems()
    }

    // ─── Drag-and-drop ────────────────────────────────────────────────────────

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation()
        dragCounterRef.current++
        if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
    }, [])
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation()
        dragCounterRef.current--
        if (dragCounterRef.current === 0) setIsDragging(false)
    }, [])
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }, [])
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation()
        setIsDragging(false); dragCounterRef.current = 0
        handleFileUpload(e.dataTransfer.files)
    }, [handleFileUpload])

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const getTypeIcon = (t: string) => MEDIA_TYPES.find(x => x.value === t)?.icon ?? '📄'
    const getTypeLabel = (t: string) => MEDIA_TYPES.find(x => x.value === t)?.label ?? t
    const getPagePills = (page: string) =>
        page.split(',').filter(Boolean).map(p => HERO_PAGES.find(h => h.value === p)?.short ?? p)

    // ─── Styles ───────────────────────────────────────────────────────────────

    const inputSt: React.CSSProperties = {
        width: '100%', padding: '0.5rem 0.7rem',
        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none',
    }
    const labelSt: React.CSSProperties = {
        display: 'block', fontSize: '0.62rem', color: 'var(--text-tertiary)',
        marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
    }
    const pillBtn = (active: boolean): React.CSSProperties => ({
        padding: '3px 9px', fontSize: '0.65rem', fontWeight: 600,
        borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 0.15s',
        border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
        background: active ? 'rgba(212,168,83,0.12)' : 'transparent',
        color: active ? 'var(--accent-gold)' : 'var(--text-tertiary)',
    })
    const actionBtn: React.CSSProperties = {
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
        cursor: 'pointer', fontSize: '0.72rem', transition: 'all 0.15s', color: 'var(--text-secondary)',
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="admin-layout"
            onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
            onDragOver={handleDragOver} onDrop={handleDrop}
        >
            <AdminSidebar />

            {/* Hidden file input */}
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
                onChange={e => handleFileUpload(e.target.files)} />

            {/* Drag overlay */}
            {isDragging && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                }}>
                    <div style={{
                        textAlign: 'center', padding: 'var(--space-2xl)',
                        border: '3px dashed var(--accent-gold)', borderRadius: 'var(--radius-xl)',
                        background: 'rgba(212,168,83,0.05)', maxWidth: '400px',
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>📁</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Drop image or video here</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>JPG, PNG, WebP, MP4, WebM, MOV</div>
                    </div>
                </div>
            )}

            <main className="admin-main">

                {/* Header */}
                <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 className="admin-page-title" style={{ marginBottom: '4px' }}>Media Manager</h1>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
                            {items.length} item{items.length !== 1 ? 's' : ''} · drag &amp; drop to upload · hover video thumbnails to preview
                        </p>
                    </div>
                    <button onClick={openNew} className="btn btn-primary btn-sm" style={{ fontSize: '0.8rem' }}>
                        + Add Media
                    </button>
                </div>

                {/* ─── Unified Form ─────────────────────────────────────────── */}
                {showForm && (
                    <div ref={formRef} style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>
                                {editingId ? '✏️ Edit Media Item' : '➕ Add New Media'}
                            </h3>
                            <button onClick={cancelForm} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Row 1: Type + Device target (hidden for hero-video) + Sort */}
                            <div style={{ display: 'grid', gridTemplateColumns: isHeroVideo ? '1fr auto' : '1fr 1fr auto', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                                <div>
                                    <label style={labelSt}>Media Type</label>
                                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
                                        {MEDIA_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                                    </select>
                                </div>
                                {/* Device target — not applicable for hero-video (HeroVideo model has no target column) */}
                                {!isHeroVideo && (
                                    <div>
                                        <label style={labelSt}>Show On Device</label>
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                            {[{ value: 'all', label: '🌐 All' }, { value: 'desktop', label: '🖥️ Desktop' }, { value: 'mobile', label: '📱 Mobile' }].map(o => (
                                                <button key={o.value} type="button" onClick={() => setForm(f => ({ ...f, target: o.value }))} style={pillBtn(form.target === o.value)}>{o.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={{ minWidth: '80px' }}>
                                    <label style={labelSt}>Sort #</label>
                                    <input type="number" value={form.sortOrder} min={1}
                                        onChange={e => setForm(f => ({ ...f, sortOrder: Math.max(1, parseInt(e.target.value) || 1) }))}
                                        style={inputSt} />
                                </div>
                            </div>

                            {/* Row 2: Page assignment */}
                            <div style={{ marginBottom: 'var(--space-sm)' }}>
                                {isHeroVideo ? (
                                    <>
                                        <label style={labelSt}>Show On Pages (Hero Video)</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px' }}>
                                            {HERO_PAGES.map(p => (
                                                <button key={p.value} type="button" onClick={() => toggleHeroPage(p.value)} style={pillBtn(form.pages.includes(p.value))}>
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <label style={labelSt}>Assign to Page</label>
                                        <select value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
                                            {PAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </>
                                )}
                            </div>

                            {/* Row 3: Title */}
                            <div style={{ marginBottom: 'var(--space-sm)' }}>
                                <label style={labelSt}>Title / Label</label>
                                <input type="text" value={form.title} placeholder="Optional — for internal reference"
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputSt} />
                            </div>

                            {/* Row 4: File upload + URL */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                                <div>
                                    <label style={labelSt}>Upload File</label>
                                    <div
                                        onClick={() => fileRef.current?.click()}
                                        style={{
                                            padding: '0.65rem', background: 'var(--bg-primary)', border: '2px dashed var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(212,168,83,0.4)')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                                    >
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                            {uploading ? uploadMsg || '⏳ Uploading…' : '📁 Click or drag to upload'}
                                        </div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', opacity: 0.6, marginTop: '2px' }}>image or video</div>
                                    </div>
                                    {uploadMsg && !uploading && (
                                        <div style={{ fontSize: '0.68rem', marginTop: '4px', color: uploadMsg.startsWith('✓') ? '#22c55e' : '#f59e0b' }}>{uploadMsg}</div>
                                    )}
                                </div>
                                <div>
                                    <label style={labelSt}>Or Paste URL</label>
                                    <input type="url" value={form.url} placeholder="https://..."
                                        onChange={e => setForm(f => ({ ...f, url: e.target.value }))} style={inputSt} />
                                    {form.url && (
                                        <div style={{ marginTop: '6px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '60px', background: '#0a0a0a' }}>
                                            {form.type === 'video' || form.type === 'hero-video'
                                                ? <video src={form.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <img src={form.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Duration (for video types) */}
                            {(form.type === 'video' || form.type === 'hero-video') && (
                                <div style={{ maxWidth: '160px', marginBottom: 'var(--space-sm)' }}>
                                    <label style={labelSt}>Duration (seconds)</label>
                                    <input type="number" value={form.duration} min={3} max={120}
                                        onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 10 }))} style={inputSt} />
                                </div>
                            )}

                            {/* Active toggle + submit */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                                    <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                                        style={{ width: '14px', height: '14px', accentColor: 'var(--accent-gold)' }} />
                                    Active (visible on site)
                                </label>
                                <div style={{ flex: 1 }} />
                                <button type="button" onClick={cancelForm} className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem' }}>Cancel</button>
                                <button type="submit" disabled={saving || !form.url} className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem', opacity: saving || !form.url ? 0.6 : 1 }}>
                                    {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Media'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ─── Filter Pills ─────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: 'var(--space-md)', alignItems: 'center' }}>
                    {/* Type filter */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button onClick={() => setFilterType('all')} style={pillBtn(filterType === 'all')}>All Types</button>
                        {MEDIA_TYPES.map(t => (
                            <button key={t.value} onClick={() => setFilterType(t.value)} style={pillBtn(filterType === t.value)}>
                                {t.icon} {t.label} <span style={{ opacity: 0.5, fontSize: '0.6em' }}>({items.filter(i => i.type === t.value).length})</span>
                            </button>
                        ))}
                    </div>
                    <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />
                    {/* Page filter */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button onClick={() => setFilterPage('all')} style={pillBtn(filterPage === 'all')}>All Pages</button>
                        {PAGES.map(p => (
                            <button key={p.value} onClick={() => setFilterPage(p.value)} style={pillBtn(filterPage === p.value)}>{p.label}</button>
                        ))}
                    </div>
                </div>

                {/* ─── Unified Media Table ──────────────────────────────────── */}
                {loading ? (
                    <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Loading media…</div>
                ) : visible.length === 0 ? (
                    <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                        {items.length === 0 ? (
                            <>
                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🖼️</div>
                                <div style={{ fontWeight: 700, marginBottom: '4px' }}>No media yet</div>
                                <div>Click <strong>+ Add Media</strong> or drag &amp; drop a file to get started.</div>
                            </>
                        ) : 'No items match the current filters.'}
                    </div>
                ) : (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                        {/* Table header */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '60px 1fr 110px 100px 40px 50px 90px',
                            gap: '8px', padding: '8px 14px', alignItems: 'center',
                            borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)',
                        }}>
                            {['', 'Title', 'Page / Pages', 'Type', '#', 'Device', 'Actions'].map((h, i) => (
                                <div key={i} style={{
                                    fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                                    textAlign: i >= 4 && i <= 5 ? 'center' : i === 6 ? 'right' : 'left',
                                }}>{h}</div>
                            ))}
                        </div>

                        {/* Rows */}
                        {visible.map((item, idx) => {
                            const isVid = item.type === 'video' || item.type === 'hero-video'
                            return (
                                <div key={item.id} style={{
                                    display: 'grid', gridTemplateColumns: '60px 1fr 110px 100px 40px 50px 90px',
                                    gap: '8px', padding: '7px 14px', alignItems: 'center',
                                    borderBottom: idx < visible.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                    opacity: item.active ? 1 : 0.45, transition: 'all 0.15s', background: 'transparent',
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.03)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    {/* Thumbnail */}
                                    <div style={{ width: '56px', height: '36px', borderRadius: '5px', overflow: 'hidden', background: '#0a0a0a', flexShrink: 0 }}>
                                        {isVid
                                            ? <video src={item.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                                                onMouseLeave={e => { const el = e.target as HTMLVideoElement; el.pause(); el.currentTime = 0 }} />
                                            : <img src={item.url} alt={item.title || item.page} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        }
                                    </div>

                                    {/* Title */}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.title || 'Untitled'}
                                            </span>
                                            {!item.active && (
                                                <span style={{ fontSize: '0.48rem', padding: '1px 4px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700, border: '1px solid rgba(239,68,68,0.15)', textTransform: 'uppercase', flexShrink: 0 }}>Hidden</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginTop: '1px', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.url}</div>
                                    </div>

                                    {/* Page */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                        {item.type === 'hero-video'
                                            ? getPagePills(item.page).map((p, i) => (
                                                <span key={i} style={{ fontSize: '0.52rem', padding: '1px 5px', borderRadius: 'var(--radius-full)', background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.12)', color: 'var(--accent-gold)', fontWeight: 600 }}>{p}</span>
                                            ))
                                            : <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.12)', color: '#a78bfa', fontWeight: 600, textTransform: 'capitalize' }}>{item.page}</span>
                                        }
                                    </div>

                                    {/* Type + source discriminator (plan §2: UnifiedMediaItem source flag) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <span>{getTypeIcon(item.type)}</span>
                                            <span style={{ whiteSpace: 'nowrap' }}>{getTypeLabel(item.type)}</span>
                                        </div>
                                        {item.type === 'hero-video' && (
                                            <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>pageMedia</span>
                                        )}
                                    </div>

                                    {/* Sort order */}
                                    <div style={{ textAlign: 'center' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            width: '22px', height: '22px', borderRadius: '4px',
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                                            fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)',
                                        }}>{item.sortOrder}</span>
                                    </div>

                                    {/* Device */}
                                    <div style={{ textAlign: 'center', fontSize: '0.7rem' }}>
                                        {item.target === 'mobile' ? '📱' : item.target === 'desktop' ? '🖥️' : '🌐'}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => handleToggle(item)} title={item.active ? 'Hide' : 'Show'} style={actionBtn}>
                                            {item.active ? '👁' : '🙈'}
                                        </button>
                                        <button onClick={() => openEdit(item)} title="Edit" style={actionBtn}>✏️</button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            title={confirmDeleteId === item.id ? 'Click again to confirm' : 'Delete'}
                                            style={{ ...actionBtn, color: '#ef4444', background: confirmDeleteId === item.id ? 'rgba(239,68,68,0.15)' : 'none', minWidth: confirmDeleteId === item.id ? '50px' : '28px' }}
                                        >{confirmDeleteId === item.id ? 'Sure?' : '🗑️'}</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Info bar */}
                <div style={{
                    marginTop: 'var(--space-lg)', padding: '8px 14px',
                    background: 'rgba(212,168,83,0.03)', border: '1px solid rgba(212,168,83,0.08)',
                    borderRadius: 'var(--radius-md)', fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.6,
                }}>
                    <strong style={{ color: 'var(--accent-gold)' }}>💡</strong>{' '}
                    Drag &amp; drop any image or video to upload · Hover video previews to play · Hidden items are preserved but not shown on the frontend ·{' '}
                    Hero Videos display as full-screen background loops on the selected pages
                </div>
            </main>
        </div>
    )
}
