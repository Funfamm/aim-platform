'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

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

const PAGES = [
    { value: 'home', label: 'Homepage' },
    { value: 'works', label: 'Works Page' },
    { value: 'casting', label: 'Casting Page' },
    { value: 'upcoming', label: 'Upcoming Page' },
    { value: 'training', label: 'Training Page' },
    { value: 'scripts', label: 'Scripts Page' },
    { value: 'about', label: 'About Page' },
    { value: 'donate', label: 'Donate Page' },
    { value: 'subscribe', label: 'Notification Page' },
    { value: 'contact', label: 'Contact Page' },
]

const HERO_VIDEO_PAGES = [
    { value: 'all', label: '🌐 All Pages', short: 'All' },
    { value: 'home', label: '🏠 Homepage', short: 'Home' },
    { value: 'works', label: '🎬 Works', short: 'Works' },
    { value: 'casting', label: '🎭 Casting', short: 'Casting' },
    { value: 'upcoming', label: '📅 Upcoming', short: 'Upcoming' },
    { value: 'training', label: '🎓 Training', short: 'Training' },
    { value: 'scripts', label: '✍️ Scripts', short: 'Scripts' },
]

const SIDEBAR_LINKS = [
    { href: '/admin/analytics', label: '📊 Analytics' },
    { href: '/admin/projects', label: '🎬 Projects' },
    { href: '/admin/casting', label: '🎭 Casting' },
    { href: '/admin/applications', label: '📋 Applications' },
    { href: '/admin/media', label: '🖼️ Media Manager', active: true },
    { href: '/admin/sponsors', label: '🤝 Sponsors' },
    { href: '/admin/donations', label: '💰 Donations' },
    { href: '/admin/users', label: '👥 Users' },
    { href: '/admin/scripts', label: '✍️ Scripts' },
    { href: '/admin/training', label: '🎓 Training' },
    { href: '/admin/settings', label: '⚙️ Settings' },
]

type TabType = 'media' | 'hero-videos'

export default function AdminMediaPage() {
    const [activeTab, setActiveTab] = useState<TabType>('media')

    // ─── Page Media state ───
    const [media, setMedia] = useState<MediaItem[]>([])
    const [filterPage, setFilterPage] = useState<string>('all')
    const [uploading, setUploading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ page: 'donate', title: '', url: '', type: 'background', sortOrder: 1, duration: 10, target: 'all' })
    const [editingId, setEditingId] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    // ─── Hero Videos state ───
    const [heroVideos, setHeroVideos] = useState<MediaItem[]>([])
    const [showVidForm, setShowVidForm] = useState(false)
    const [vidForm, setVidForm] = useState({ title: '', url: '', pages: ['all'] as string[], duration: 10, sortOrder: 1, active: true, target: 'all' })
    const [vidEditingId, setVidEditingId] = useState<string | null>(null)
    const vidFileRef = useRef<HTMLInputElement>(null)
    const vidFormRef = useRef<HTMLDivElement>(null)
    const [vidUploading, setVidUploading] = useState(false)
    const [vidUploadMsg, setVidUploadMsg] = useState('')

    // ─── Delete confirmation state ───
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    // ─── Drag state ───
    const [isDragging, setIsDragging] = useState(false)
    const dragCounterRef = useRef(0)

    // ─── Fetch ───
    const fetchMedia = useCallback(async () => {
        const url = filterPage === 'all' ? '/api/admin/media?admin=true' : `/api/admin/media?page=${filterPage}&admin=true`
        const res = await fetch(url)
        const data = await res.json()
        setMedia(data.filter((m: MediaItem) => m.type !== 'hero-video'))
    }, [filterPage])

    const fetchHeroVideos = async () => {
        const res = await fetch('/api/admin/media?type=hero-video&admin=true')
        if (res.status === 401) { window.location.href = '/admin/login'; return }
        const data = await res.json()
        setHeroVideos(data)
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchMedia() }, [fetchMedia])
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchHeroVideos() }, [])

    // ─── Page Media handlers ───
    const resetForm = () => {
        const defaultPage = filterPage !== 'all' ? filterPage : 'donate'
        const nextSort = media.length > 0 ? Math.max(...media.map(m => m.sortOrder)) + 1 : 1
        setForm({ page: defaultPage, title: '', url: '', type: 'background', sortOrder: nextSort, duration: 10, target: 'all' })
        setEditingId(null)
        setShowForm(false)
        if (fileRef.current) fileRef.current.value = ''
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        try {
            const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (data.url) setForm(prev => ({ ...prev, url: data.url }))
        } catch { /* */ }
        setUploading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.url) return
        if (editingId) {
            await fetch('/api/admin/media', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...form }) })
        } else {
            await fetch('/api/admin/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, active: true }) })
        }
        resetForm()
        fetchMedia()
    }

    const handleEdit = (item: MediaItem) => {
        setForm({ page: item.page, title: item.title, url: item.url, type: item.type, sortOrder: item.sortOrder, duration: item.duration || 10, target: item.target || 'all' })
        setEditingId(item.id)
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id)
            setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000)
            return
        }
        setConfirmDeleteId(null)
        try {
            await fetch(`/api/admin/media?id=${id}`, { method: 'DELETE' })
            fetchMedia()
            fetchHeroVideos()
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const handleToggle = async (item: MediaItem) => {
        await fetch('/api/admin/media', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, active: !item.active }) })
        fetchMedia()
        fetchHeroVideos()
    }

    // ─── Hero Video handlers ───
    const resetVidForm = () => {
        const nextSort = heroVideos.length > 0 ? Math.max(...heroVideos.map(v => v.sortOrder)) + 1 : 1
        setVidForm({ title: '', url: '', pages: ['all'], duration: 10, sortOrder: nextSort, active: true, target: 'all' })
        setVidEditingId(null)
        setShowVidForm(false)
    }

    const openVidForm = () => {
        const nextSort = heroVideos.length > 0 ? Math.max(...heroVideos.map(v => v.sortOrder)) + 1 : 1
        setVidForm(prev => ({ ...prev, sortOrder: nextSort }))
        setShowVidForm(true)
        setTimeout(() => vidFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }

    const togglePage = (val: string) => {
        setVidForm(prev => {
            if (val === 'all') return { ...prev, pages: ['all'] }
            let next = prev.pages.filter(p => p !== 'all')
            if (next.includes(val)) next = next.filter(p => p !== val)
            else next.push(val)
            return { ...prev, pages: next.length === 0 ? ['all'] : next }
        })
    }

    const handleVidSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const payload = {
            page: vidForm.pages.join(','),
            type: 'hero-video',
            title: vidForm.title,
            url: vidForm.url,
            duration: vidForm.duration,
            sortOrder: vidForm.sortOrder,
            active: vidForm.active,
            target: vidForm.target,
        }
        try {
            let res: Response
            if (vidEditingId) {
                res = await fetch('/api/admin/media', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: vidEditingId, ...payload }) })
            } else {
                res = await fetch('/api/admin/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }))
                alert(`Failed to save: ${err.error || res.statusText}`)
                return
            }
            resetVidForm()
            fetchHeroVideos()
        } catch (err) {
            alert(`Network error: ${err instanceof Error ? err.message : 'Unknown'}`)
        }
    }

    const handleVidEdit = (item: MediaItem) => {
        const pages = item.page ? item.page.split(',').filter(Boolean) : ['all']
        setVidForm({ title: item.title, url: item.url, pages, duration: item.duration || 10, sortOrder: item.sortOrder, active: item.active, target: item.target || 'all' })
        setVidEditingId(item.id)
        setShowVidForm(true)
        setTimeout(() => vidFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }

    const handleVidFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return
        const file = files[0]
        if (!file.type.startsWith('video/')) {
            setVidUploadMsg('Not a video file')
            setTimeout(() => setVidUploadMsg(''), 2000)
            return
        }
        // Warn if file is very large (>100 MB) — server proxy may reject it
        if (file.size > 100 * 1024 * 1024) {
            setVidUploadMsg(`⚠️ File is ${(file.size / 1024 / 1024).toFixed(0)} MB — large files may fail via the proxy. Consider using a CDN URL instead.`)
            setTimeout(() => setVidUploadMsg(''), 5000)
        }
        setVidUploading(true)
        setVidUploadMsg(`Uploading ${file.name}…`)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('directory', 'videos')
        try {
            const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
            if (!res.ok) {
                // Read raw text to avoid JSON parse crash on HTML error responses (e.g. Vercel 413)
                const errText = await res.text().catch(() => res.statusText)
                const friendlyMsg = res.status === 413
                    ? '⚠️ File too large for proxy upload (>4.5 MB). Use a direct CDN URL or reduce file size.'
                    : `❌ Upload failed (${res.status}): ${errText.slice(0, 120)}`
                setVidUploadMsg(friendlyMsg)
                setTimeout(() => { setVidUploading(false); setVidUploadMsg('') }, 6000)
                return
            }
            const data = await res.json()
            if (data.url) {
                const label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
                setVidForm(prev => ({ ...prev, title: label, url: data.url, sortOrder: heroVideos.length + 1 }))
                setVidEditingId(null)
                setShowVidForm(true)
                setTimeout(() => vidFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                setVidUploadMsg('✓ Uploaded, configure below')
                setTimeout(() => { setVidUploadMsg(''); setVidUploading(false) }, 2000)
            } else {
                setVidUploadMsg(`❌ Upload response missing URL: ${JSON.stringify(data).slice(0, 80)}`)
                setTimeout(() => { setVidUploading(false); setVidUploadMsg('') }, 4000)
            }
        } catch (err) {
            setVidUploadMsg(`❌ Upload failed: ${err instanceof Error ? err.message : 'Network error'}`)
            setTimeout(() => { setVidUploading(false); setVidUploadMsg('') }, 4000)
        }
    }, [heroVideos.length])

    // Drag handlers (hero videos tab only)
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation()
        dragCounterRef.current++
        if (activeTab === 'hero-videos' && e.dataTransfer.types.includes('Files')) setIsDragging(true)
    }, [activeTab])
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation()
        dragCounterRef.current--
        if (dragCounterRef.current === 0) setIsDragging(false)
    }, [])
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }, [])
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation()
        setIsDragging(false); dragCounterRef.current = 0
        if (activeTab === 'hero-videos') handleVidFileUpload(e.dataTransfer.files)
    }, [activeTab, handleVidFileUpload])

    const getPagePills = (val: string) => {
        const pages = val.split(',').filter(Boolean)
        return pages.map(p => {
            const found = HERO_VIDEO_PAGES.find(o => o.value === p)
            return { label: found?.short || p, icon: found?.label.charAt(0) || '📄' }
        })
    }

    const getPageLabel = (page: string) => {
        return PAGES.find(p => p.value === page)?.label || page
    }

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '0.5rem 0.7rem',
        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none',
    }
    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: '0.65rem', color: 'var(--text-tertiary)',
        marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
    }

    return (
        <div className="admin-layout"
            onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
            onDragOver={handleDragOver} onDrop={handleDrop}
        >
            <AdminSidebar />

            <main className="admin-main">
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
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>🎬</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Drop video here</div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="admin-header">
                    <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Media Manager</h1>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '2px', marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {([
                        { key: 'media' as TabType, label: '🖼️ Page Media', count: media.length },
                        { key: 'hero-videos' as TabType, label: '🎥 Hero Videos', count: heroVideos.length },
                    ]).map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                            padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: activeTab === tab.key ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            borderBottom: activeTab === tab.key ? '2px solid var(--accent-gold)' : '2px solid transparent',
                            marginBottom: '-1px', transition: 'all 0.2s',
                        }}>
                            {tab.label} <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>({tab.count})</span>
                        </button>
                    ))}
                </div>

                {/* ═══════════ PAGE MEDIA TAB ═══════════ */}
                {activeTab === 'media' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            {/* Filter pills */}
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <button onClick={() => setFilterPage('all')}
                                    style={{
                                        padding: '3px 10px', fontSize: '0.68rem', fontWeight: 600,
                                        borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 0.15s',
                                        border: `1px solid ${filterPage === 'all' ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                                        background: filterPage === 'all' ? 'rgba(212,168,83,0.12)' : 'transparent',
                                        color: filterPage === 'all' ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                    }}>All</button>
                                {PAGES.map(p => (
                                    <button key={p.value} onClick={() => setFilterPage(p.value)}
                                        style={{
                                            padding: '3px 10px', fontSize: '0.68rem', fontWeight: 600,
                                            borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 0.15s',
                                            border: `1px solid ${filterPage === p.value ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                                            background: filterPage === p.value ? 'rgba(212,168,83,0.12)' : 'transparent',
                                            color: filterPage === p.value ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                        }}>{p.label}</button>
                                ))}
                            </div>
                            <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem' }}>
                                {showForm ? 'Cancel' : '+ Add Media'}
                            </button>
                        </div>

                        {showForm && (
                            <div style={{
                                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)',
                            }}>
                                <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '0.9rem', fontWeight: 700 }}>
                                    {editingId ? '✏️ Edit Media' : '🖼️ Add New Media'}
                                </h3>
                                <form onSubmit={handleSubmit}>
                                    <div className="grid-3col" style={{ marginBottom: 'var(--space-sm)', gap: 'var(--space-sm)' }}>
                                        <div>
                                            <label style={labelStyle}>Page</label>
                                            <select value={form.page} onChange={e => setForm({ ...form, page: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                                {PAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Type</label>
                                            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                                <option value="background">Background</option>
                                            <option value="video">Video</option>
                                            <option value="gallery">Gallery</option>
                                            <option value="hero">Hero</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Sort Order</label>
                                            <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Math.max(1, parseInt(e.target.value) || 1) })} min={1} style={inputStyle} />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: 'var(--space-sm)' }}>
                                        <label style={labelStyle}>Title / Label</label>
                                        <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
                                    </div>
                                    <div className="form-grid-2col" style={{ marginBottom: 'var(--space-sm)', gap: 'var(--space-sm)' }}>
                                        <div>
                                            <label style={labelStyle}>Upload File</label>
                                            <input type="file" accept="image/*,video/*" ref={fileRef} onChange={handleUpload}
                                                style={{ ...inputStyle, padding: '0.35rem', fontSize: '0.78rem' }} />
                                            {uploading && <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', marginTop: '3px' }}>Uploading...</div>}
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Or enter URL</label>
                                            <input type="text" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={inputStyle} />
                                        </div>
                                    </div>
                                    {form.url && (
                                        <div style={{ marginBottom: 'var(--space-sm)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: '100px' }}>
                                            <img src={form.url} alt="Preview" style={{ width: '100%', height: '100px', objectFit: 'cover' }} />
                                        </div>
                                    )}
                                    {/* Device target */}
                                    <div style={{ marginBottom: 'var(--space-sm)' }}>
                                        <label style={labelStyle}>Show On Device</label>
                                        <div style={{ display: 'flex', gap: '5px', marginTop: '3px' }}>
                                            {[
                                                { value: 'all', label: '🌐 All' },
                                                { value: 'desktop', label: '🖥️ Desktop' },
                                                { value: 'mobile', label: '📱 Mobile' },
                                            ].map(opt => {
                                                const sel = form.target === opt.value
                                                return (
                                                    <button key={opt.value} type="button" onClick={() => setForm(prev => ({ ...prev, target: opt.value }))} style={{
                                                        padding: '3px 9px', fontSize: '0.65rem', fontWeight: 600,
                                                        borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                                        border: `1px solid ${sel ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                                                        background: sel ? 'rgba(212,168,83,0.12)' : 'transparent',
                                                        color: sel ? 'var(--accent-gold)' : 'var(--text-tertiary)', transition: 'all 0.15s',
                                                    }}>{opt.label}</button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem' }}>
                                        {editingId ? 'Update Media' : 'Add Media'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* ─── Compact Table Listing ─── */}
                        {media.length === 0 ? (
                            <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', fontSize: '0.85rem' }}>
                                No media found. Click &quot;+ Add Media&quot; to upload.
                            </div>
                        ) : (
                            <div style={{
                                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                            }}>
                                {/* Table header */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '52px 1fr 90px 60px 50px 90px',
                                    gap: '8px', padding: '8px 12px', alignItems: 'center',
                                    borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)',
                                }}>
                                    <div style={thStyle}></div>
                                    <div style={thStyle}>Title</div>
                                    <div style={thStyle}>Page</div>
                                    <div style={thStyle}>Type</div>
                                    <div style={{ ...thStyle, textAlign: 'center' }}>Pos</div>
                                    <div style={{ ...thStyle, textAlign: 'right' }}>Actions</div>
                                </div>
                                {/* Rows */}
                                {media.map((item, idx) => (
                                    <div key={item.id} style={{
                                        display: 'grid', gridTemplateColumns: '52px 1fr 90px 60px 50px 90px',
                                        gap: '8px', padding: '6px 12px', alignItems: 'center',
                                        borderBottom: idx < media.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                        opacity: item.active ? 1 : 0.45,
                                        transition: 'all 0.15s',
                                        background: 'transparent',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.03)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {/* Thumbnail */}
                                        <div style={{
                                            width: '48px', height: '32px', borderRadius: '4px', overflow: 'hidden',
                                            background: '#0a0a0a', flexShrink: 0,
                                        }}>
                                            <img src={item.url} alt={item.page || 'Media item'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        {/* Title + status */}
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.title || 'Untitled'}
                                                </span>
                                                {!item.active && (
                                                    <span style={{
                                                        fontSize: '0.5rem', padding: '1px 4px', borderRadius: 'var(--radius-full)',
                                                        background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700,
                                                        border: '1px solid rgba(239,68,68,0.15)', textTransform: 'uppercase',
                                                    }}>Hidden</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Page */}
                                        <div>
                                            <span style={{
                                                fontSize: '0.6rem', padding: '2px 6px', borderRadius: 'var(--radius-full)',
                                                background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.12)',
                                                color: 'var(--accent-gold)', fontWeight: 600, textTransform: 'capitalize',
                                            }}>{item.page}</span>
                                        </div>
                                        {/* Type */}
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{item.type}</div>
                                        {/* Sort position */}
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                width: '22px', height: '22px', borderRadius: '4px',
                                                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                                                fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)',
                                            }}>{item.sortOrder}</span>
                                        </div>
                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                                            <button onClick={() => handleToggle(item)} title={item.active ? 'Hide' : 'Show'} style={compactBtnStyle}>
                                                {item.active ? '👁' : '👁‍🗨'}
                                            </button>
                                            <button onClick={() => handleEdit(item)} title="Edit" style={compactBtnStyle}>✏️</button>
                                            <button onClick={() => handleDelete(item.id)} title={confirmDeleteId === item.id ? 'Click again to confirm' : 'Delete'} style={{ ...compactBtnStyle, color: '#ef4444', background: confirmDeleteId === item.id ? 'rgba(239,68,68,0.15)' : 'none', minWidth: confirmDeleteId === item.id ? '48px' : '24px' }}>{confirmDeleteId === item.id ? 'Sure?' : '🗑'}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ═══════════ HERO VIDEOS TAB ═══════════ */}
                {activeTab === 'hero-videos' && (
                    <>
                        <input ref={vidFileRef} type="file" accept="video/*" style={{ display: 'none' }}
                            onChange={e => handleVidFileUpload(e.target.files)} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', margin: 0 }}>
                                {heroVideos.length} video{heroVideos.length !== 1 ? 's' : ''} · {heroVideos.filter(v => v.active).length} active
                            </p>
                            <button onClick={() => { resetVidForm(); openVidForm() }} className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem' }}>+ Add Video</button>
                        </div>

                        {vidUploading && (
                            <div style={{
                                background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)',
                                borderRadius: 'var(--radius-md)', padding: '6px 12px',
                                marginBottom: 'var(--space-md)', fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 600,
                            }}>{vidUploadMsg}</div>
                        )}

                        {/* Video Form */}
                        {showVidForm && (
                            <div ref={vidFormRef} style={{
                                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
                                        {vidEditingId ? '✏️ Edit Video' : '🎬 Add Hero Video'}
                                    </h3>
                                    <button onClick={resetVidForm} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                                </div>
                                <form onSubmit={handleVidSubmit}>
                                    {!vidEditingId && !vidForm.url && (
                                        <div onClick={() => vidFileRef.current?.click()} style={{
                                            border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                            padding: 'var(--space-md)', textAlign: 'center', cursor: 'pointer',
                                            marginBottom: 'var(--space-md)', background: 'rgba(212,168,83,0.02)',
                                        }}>
                                            <div style={{ fontSize: '1.1rem', marginBottom: '2px' }}>📤</div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                Drop a video or <span style={{ color: 'var(--accent-gold)' }}>browse</span>
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>MP4, WebM, MOV</div>
                                        </div>
                                    )}
                                    {vidForm.url && !vidEditingId && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '5px 10px', background: 'rgba(34,197,94,0.06)',
                                            border: '1px solid rgba(34,197,94,0.12)', borderRadius: 'var(--radius-sm)',
                                            marginBottom: 'var(--space-md)', fontSize: '0.72rem', color: '#22c55e',
                                        }}>
                                            ✓ <code style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem' }}>{vidForm.url}</code>
                                            <button type="button" onClick={() => setVidForm(prev => ({ ...prev, url: '' }))}
                                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.68rem' }}>Change</button>
                                        </div>
                                    )}
                                    <div className="form-grid-2col" style={{ gap: 'var(--space-sm)' }}>
                                        <div>
                                            <label style={labelStyle}>Label</label>
                                            <input type="text" value={vidForm.title} onChange={e => setVidForm({ ...vidForm, title: e.target.value })} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Video URL *</label>
                                            <input type="text" value={vidForm.url} onChange={e => setVidForm({ ...vidForm, url: e.target.value })} required style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Duration (s)</label>
                                            <input type="number" value={vidForm.duration} onChange={e => setVidForm({ ...vidForm, duration: parseInt(e.target.value) || 10 })} min={3} max={120} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Play Position</label>
                                            <input type="number" value={vidForm.sortOrder} onChange={e => setVidForm({ ...vidForm, sortOrder: Math.max(1, parseInt(e.target.value) || 1) })} min={1} style={inputStyle} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 'var(--space-sm)' }}>
                                        <label style={labelStyle}>Show On Pages</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px' }}>
                                            {HERO_VIDEO_PAGES.map(opt => {
                                                const sel = vidForm.pages.includes(opt.value)
                                                return (
                                                    <button key={opt.value} type="button" onClick={() => togglePage(opt.value)} style={{
                                                        padding: '3px 9px', fontSize: '0.65rem', fontWeight: 600,
                                                        borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                                        border: `1px solid ${sel ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                                                        background: sel ? 'rgba(212,168,83,0.12)' : 'transparent',
                                                        color: sel ? 'var(--accent-gold)' : 'var(--text-tertiary)', transition: 'all 0.15s',
                                                    }}>{opt.label}</button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    {/* Device target */}
                                    <div style={{ marginTop: 'var(--space-sm)' }}>
                                        <label style={labelStyle}>Show On Device</label>
                                        <div style={{ display: 'flex', gap: '5px', marginTop: '3px' }}>
                                            {[
                                                { value: 'all', label: '🌐 All Devices' },
                                                { value: 'desktop', label: '🖥️ Desktop Only' },
                                                { value: 'mobile', label: '📱 Mobile Only' },
                                            ].map(opt => {
                                                const sel = vidForm.target === opt.value
                                                return (
                                                    <button key={opt.value} type="button" onClick={() => setVidForm(prev => ({ ...prev, target: opt.value }))} style={{
                                                        padding: '3px 9px', fontSize: '0.65rem', fontWeight: 600,
                                                        borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                                        border: `1px solid ${sel ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                                                        background: sel ? 'rgba(212,168,83,0.12)' : 'transparent',
                                                        color: sel ? 'var(--accent-gold)' : 'var(--text-tertiary)', transition: 'all 0.15s',
                                                    }}>{opt.label}</button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                                            <input type="checkbox" checked={vidForm.active} onChange={e => setVidForm({ ...vidForm, active: e.target.checked })}
                                                style={{ width: '14px', height: '14px', accentColor: 'var(--accent-gold)' }} /> Active
                                        </label>
                                        <div style={{ flex: 1 }} />
                                        <button type="submit" className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem' }}>
                                            {vidEditingId ? 'Save Changes' : 'Add Video'}
                                        </button>
                                        <button type="button" onClick={resetVidForm} className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem' }}>Cancel</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Video listing */}
                        {heroVideos.length === 0 ? (
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                padding: 'var(--space-3xl) var(--space-xl)',
                                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border-subtle)', textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🎬</div>
                                <h3 style={{ fontSize: '1rem', margin: '0 0 6px 0' }}>No Hero Videos</h3>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', margin: '0 0 var(--space-md) 0' }}>Add your first background video.</p>
                                <button onClick={() => { resetVidForm(); openVidForm() }} className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem' }}>+ Add Video</button>
                            </div>
                        ) : (
                            <div style={{
                                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                            }}>
                                {heroVideos.map((v, idx) => (
                                    <div key={v.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                                        padding: '10px 14px',
                                        borderBottom: idx < heroVideos.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                        opacity: v.active ? 1 : 0.55, transition: 'all 0.2s',
                                        background: 'transparent',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.03)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {/* Position badge */}
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                                            background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-gold)',
                                        }}>{v.sortOrder}</div>

                                        {/* Thumbnail */}
                                        <div style={{ width: '80px', height: '48px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#0a0a0a' }}>
                                            <video src={v.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                                                onMouseLeave={e => { const el = e.target as HTMLVideoElement; el.pause(); el.currentTime = 0 }} />
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {v.title || 'Untitled'}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.5rem', padding: '1px 5px', borderRadius: 'var(--radius-full)',
                                                    fontWeight: 700, textTransform: 'uppercase',
                                                    background: v.active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                                                    color: v.active ? '#4ade80' : '#f87171',
                                                    border: `1px solid ${v.active ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}`,
                                                }}>{v.active ? 'Live' : 'Paused'}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{v.duration}s</span>
                                                <span style={{ fontSize: '0.5rem', color: 'var(--border-subtle)' }}>·</span>
                                                {/* Page pills */}
                                                {getPagePills(v.page).map((pill, i) => (
                                                    <span key={i} style={{
                                                        fontSize: '0.55rem', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                                        background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.12)',
                                                        color: 'var(--accent-gold)', fontWeight: 600,
                                                    }}>{pill.icon} {pill.label}</span>
                                                ))}
                                                {/* Device target pill */}
                                                {v.target && v.target !== 'all' && (
                                                    <span style={{
                                                        fontSize: '0.55rem', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                                        background: v.target === 'mobile' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)',
                                                        border: `1px solid ${v.target === 'mobile' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)'}`,
                                                        color: v.target === 'mobile' ? '#60a5fa' : '#a78bfa', fontWeight: 600,
                                                    }}>{v.target === 'mobile' ? '📱' : '🖥️'} {v.target}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                            <button onClick={() => handleToggle(v)} title={v.active ? 'Pause' : 'Resume'} style={actionBtnStyle}>{v.active ? '⏸' : '▶'}</button>
                                            <button onClick={() => handleVidEdit(v)} title="Edit" style={actionBtnStyle}>✏️</button>
                                            <button onClick={() => handleDelete(v.id)} title={confirmDeleteId === v.id ? 'Click again to confirm' : 'Delete'} style={{ ...actionBtnStyle, color: '#ef4444', background: confirmDeleteId === v.id ? 'rgba(239,68,68,0.15)' : 'none', minWidth: confirmDeleteId === v.id ? '56px' : '28px' }}>{confirmDeleteId === v.id ? 'Sure?' : '🗑'}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{
                            marginTop: 'var(--space-lg)', padding: '8px 12px',
                            background: 'rgba(212,168,83,0.03)', border: '1px solid rgba(212,168,83,0.08)',
                            borderRadius: 'var(--radius-md)', fontSize: '0.7rem', color: 'var(--text-tertiary)',
                        }}>
                            <strong style={{ color: 'var(--accent-gold)' }}>💡</strong>{' '}
                            Drag videos here · Pause hides without deleting · Lower position plays first · Hover to preview
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}

const thStyle: React.CSSProperties = {
    fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-tertiary)',
}

const compactBtnStyle: React.CSSProperties = {
    width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.6rem', transition: 'all 0.15s', color: 'var(--text-secondary)',
}

const actionBtnStyle: React.CSSProperties = {
    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', fontSize: '0.7rem', transition: 'all 0.15s', color: 'var(--text-secondary)',
}
