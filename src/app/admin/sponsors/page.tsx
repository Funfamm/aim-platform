'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'


const TIERS: Record<string, { color: string; bg: string; icon: string; glow: string }> = {
    platinum: { color: '#e5e7eb', bg: 'rgba(229,231,235,0.08)', icon: '💎', glow: '0 0 20px rgba(229,231,235,0.08)' },
    gold: { color: '#d4a853', bg: 'rgba(212,168,83,0.08)', icon: '🥇', glow: '0 0 20px rgba(212,168,83,0.08)' },
    silver: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: '🥈', glow: '0 0 20px rgba(148,163,184,0.06)' },
    bronze: { color: '#d97706', bg: 'rgba(217,119,6,0.08)', icon: '🥉', glow: '0 0 20px rgba(217,119,6,0.06)' },
}

interface Sponsor {
    id: string; name: string; description: string | null; logoUrl: string | null
    bannerUrl: string | null; website: string | null; tier: string; active: boolean
    featured: boolean; displayOn: string; contactEmail: string | null
    startDate: string | null; endDate: string | null; sortOrder: number
    bannerDurationHours: number; createdAt: string
    descriptionI18n: Record<string, string> | null
}

const LOCALES = [
    { code: 'en', flag: '🇺🇸', label: 'English' },
    { code: 'ar', flag: '🇸🇦', label: 'العربية' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'hi', flag: '🇮🇳', label: 'हिंदी' },
    { code: 'ja', flag: '🇯🇵', label: '日本語' },
    { code: 'ko', flag: '🇰🇷', label: '한국어' },
    { code: 'pt', flag: '🇧🇷', label: 'Português' },
    { code: 'ru', flag: '🇷🇺', label: 'Русский' },
    { code: 'zh', flag: '🇨🇳', label: '中文' },
]

const emptyForm = {
    name: '', description: '', logoUrl: '', bannerUrl: '', website: '', tier: 'bronze',
    active: true, featured: false, displayOn: 'sponsors', contactEmail: '',
    startDate: '', endDate: '', sortOrder: 0, bannerDurationHours: 24,
    descriptionI18n: {} as Record<string, string>,
}

export default function AdminSponsorsPage() {
    const [sponsors, setSponsors] = useState<Sponsor[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [bannerFile, setBannerFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState('')
    const [bannerPreview, setBannerPreview] = useState('')
    const [filter, setFilter] = useState('all')
    const [i18nLocale, setI18nLocale] = useState('en')

    const fetchSponsors = useCallback(async () => {
        const res = await fetch('/api/admin/sponsors')
        if (res.status === 401) { window.location.href = '/admin/login'; return }
        if (res.ok) setSponsors(await res.json())
        setLoading(false)
    }, [])

    useEffect(() => { fetchSponsors() }, [fetchSponsors])



    // File preview handlers
    const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        setLogoFile(file)
        if (file) {
            const reader = new FileReader()
            reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
            reader.readAsDataURL(file)
        } else setLogoPreview('')
    }
    const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        setBannerFile(file)
        if (file) {
            const reader = new FileReader()
            reader.onload = (ev) => setBannerPreview(ev.target?.result as string)
            reader.readAsDataURL(file)
        } else setBannerPreview('')
    }

    const uploadFile = async (file: File): Promise<string> => {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        const data = await res.json()
        return data.url || data.path || ''
    }

    // Get today in YYYY-MM-DD format (timezone-safe)
    const getTodayStr = () => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setSaving(true)

        if (!form.name.trim()) { setError('Sponsor name is required'); setSaving(false); return }

        const todayStr = getTodayStr()
        if (form.startDate && form.startDate < todayStr) { setError('Start date cannot be in the past'); setSaving(false); return }
        if (form.endDate && form.endDate < todayStr) { setError('End date cannot be in the past'); setSaving(false); return }
        if (form.startDate && form.endDate && form.endDate < form.startDate) { setError('End date must be after start date'); setSaving(false); return }

        try {
            let logoUrl = form.logoUrl
            let bannerUrl = form.bannerUrl
            if (logoFile) logoUrl = await uploadFile(logoFile)
            if (bannerFile) bannerUrl = await uploadFile(bannerFile)

            const body = { ...form, logoUrl: logoUrl || null, bannerUrl: bannerUrl || null,
                descriptionI18n: Object.fromEntries(
                    Object.entries(form.descriptionI18n).filter(([, v]) => v.trim())
                ) || null,
            }

            let res: Response
            if (editing) {
                res = await fetch(`/api/admin/sponsors/${editing}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
            } else {
                res = await fetch('/api/admin/sponsors', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                setError(errData.error || `Failed to ${editing ? 'update' : 'create'} sponsor (${res.status})`)
                setSaving(false); return
            }

            setShowForm(false); setEditing(null); setForm(emptyForm)
            setLogoFile(null); setBannerFile(null); setLogoPreview(''); setBannerPreview('')
            await fetchSponsors()
        } catch (err) {
            setError('Network error: could not save sponsor')
            console.error(err)
        }
        setSaving(false)
    }

    const startEdit = (s: Sponsor) => {
        setForm({
            name: s.name, description: s.description || '', logoUrl: s.logoUrl || '',
            bannerUrl: s.bannerUrl || '', website: s.website || '', tier: s.tier,
            active: s.active, featured: s.featured, displayOn: s.displayOn,
            contactEmail: s.contactEmail || '',
            startDate: s.startDate ? s.startDate.split('T')[0] : '',
            endDate: s.endDate ? s.endDate.split('T')[0] : '',
            sortOrder: s.sortOrder, bannerDurationHours: s.bannerDurationHours || 24,
            descriptionI18n: (s.descriptionI18n as Record<string, string>) || {},
        })
        setLogoPreview(s.logoUrl || ''); setBannerPreview(s.bannerUrl || '')
        setEditing(s.id); setShowForm(true)
    }

    const toggleActive = async (s: Sponsor) => {
        await fetch(`/api/admin/sponsors/${s.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !s.active }),
        })
        fetchSponsors()
    }

    const toggleFeatured = async (s: Sponsor) => {
        await fetch(`/api/admin/sponsors/${s.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ featured: !s.featured }),
        })
        fetchSponsors()
    }

    const deleteSponsor = async (id: string) => {
        if (!confirm('Delete this sponsor?')) return
        await fetch(`/api/admin/sponsors/${id}`, { method: 'DELETE' })
        fetchSponsors()
    }

    const filtered = filter === 'all' ? sponsors
        : filter === 'active' ? sponsors.filter(s => s.active)
        : filter === 'featured' ? sponsors.filter(s => s.featured)
        : sponsors.filter(s => s.tier === filter)

    const isExpired = (s: Sponsor) => s.endDate && new Date(s.endDate) < new Date()
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const daysLeft = (s: Sponsor) => {
        if (!s.endDate) return null
        return Math.ceil((new Date(s.endDate).getTime() - now) / 86400000)
    }

    // Shared dark input style
    const inp: React.CSSProperties = {
        width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
        color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit',
        outline: 'none', transition: 'border-color 0.2s',
    }
    // Dark select style — no white background
    const sel: React.CSSProperties = {
        ...inp, appearance: 'none' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
        paddingRight: '32px', cursor: 'pointer',
    }
    const lbl: React.CSSProperties = {
        display: 'block', fontSize: '0.58rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--text-tertiary)', marginBottom: '5px',
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, var(--accent-gold), #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            🤝 Sponsors & Partners
                        </h1>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            Manage sponsor banners, website links, tiers & display locations
                        </p>
                    </div>
                    <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm); setError(''); setLogoPreview(''); setBannerPreview(''); setLogoFile(null); setBannerFile(null) }} style={{
                        padding: '10px 22px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '10px', cursor: 'pointer',
                        border: showForm ? '1px solid rgba(239,68,68,0.3)' : 'none',
                        background: showForm ? 'rgba(239,68,68,0.06)' : 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(245,158,11,0.1))',
                        color: showForm ? '#ef4444' : 'var(--accent-gold)',
                        boxShadow: showForm ? 'none' : '0 0 15px rgba(212,168,83,0.1)',
                        transition: 'all 0.2s',
                    }}>
                        {showForm ? '✕ Cancel' : '+ Add Sponsor'}
                    </button>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                    {[
                        { label: 'Total', value: sponsors.length, icon: '🤝', color: 'var(--accent-gold)', bg: 'rgba(212,168,83,0.04)' },
                        { label: 'Active', value: sponsors.filter(s => s.active).length, icon: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.04)' },
                        { label: 'Featured', value: sponsors.filter(s => s.featured).length, icon: '⭐', color: '#f59e0b', bg: 'rgba(245,158,11,0.04)' },
                        { label: 'Expiring', value: sponsors.filter(s => { const d = daysLeft(s); return d !== null && d > 0 && d <= 30 }).length, icon: '⏰', color: '#f97316', bg: 'rgba(249,115,22,0.04)' },
                        { label: 'Expired', value: sponsors.filter(s => isExpired(s)).length, icon: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.04)' },
                    ].map(s => (
                        <div key={s.label} style={{
                            padding: '14px 10px', borderRadius: '12px', textAlign: 'center',
                            background: s.bg, border: '1px solid rgba(255,255,255,0.04)',
                            transition: 'transform 0.2s',
                        }}>
                            <div style={{ fontSize: '0.9rem' }}>{s.icon}</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color, marginTop: '2px' }}>{s.value}</div>
                            <div style={{ fontSize: '0.52rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '5px', marginBottom: '16px', flexWrap: 'wrap', padding: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {['all', 'active', 'featured', 'platinum', 'gold', 'silver', 'bronze'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            padding: '6px 14px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '8px',
                            border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                            background: filter === f ? 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))' : 'transparent',
                            color: filter === f ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            transition: 'all 0.2s',
                        }}>{f === 'all' ? `All (${sponsors.length})` : f}</button>
                    ))}
                </div>

                {/* Create/Edit Form */}
                {showForm && (
                    <form onSubmit={handleSave} style={{
                        padding: '20px', marginBottom: '16px', borderRadius: '14px',
                        background: 'linear-gradient(145deg, rgba(212,168,83,0.03), rgba(139,92,246,0.02), rgba(59,130,246,0.02))',
                        border: '1px solid rgba(212,168,83,0.1)',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)' }}>
                                {editing ? '✏️ Edit Sponsor' : '✨ New Sponsor'}
                            </div>
                        </div>
                        {error && (
                            <div style={{ padding: '10px 16px', marginBottom: '14px', borderRadius: '10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1rem' }}>⚠️</span> {error}
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {/* Row 1: Name + Website */}
                            <div>
                                <label style={lbl}>Sponsor Name *</label>
                                <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. TechCorp Inc." />
                            </div>
                            <div>
                                <label style={lbl}>Website URL</label>
                                <input style={inp} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" />
                            </div>

                            {/* Row 2: Description (default) + i18n tabs */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={lbl}>Description (Default / English)</label>
                                <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the sponsor..." />

                                {/* i18n translations panel */}
                                <div style={{ marginTop: '10px', border: '1px solid rgba(212,168,83,0.12)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ padding: '7px 12px', background: 'rgba(212,168,83,0.04)', borderBottom: '1px solid rgba(212,168,83,0.08)', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        🌐 Translations <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>— enter sponsor description in each language</span>
                                    </div>
                                    {/* Language selector tabs */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px 10px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        {LOCALES.map(({ code, flag, label }) => (
                                            <button key={code} type="button"
                                                onClick={() => setI18nLocale(code)}
                                                style={{
                                                    padding: '3px 9px', fontSize: '0.65rem', borderRadius: '6px',
                                                    border: i18nLocale === code ? '1px solid rgba(212,168,83,0.35)' : '1px solid rgba(255,255,255,0.05)',
                                                    background: i18nLocale === code ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.02)',
                                                    color: i18nLocale === code ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                    cursor: 'pointer', fontWeight: i18nLocale === code ? 700 : 400,
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                }}>
                                                {flag} {code.toUpperCase()}
                                                {form.descriptionI18n[code] && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Active locale textarea */}
                                    <div style={{ padding: '10px' }}>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginBottom: '5px' }}>
                                            {LOCALES.find(l => l.code === i18nLocale)?.flag} {LOCALES.find(l => l.code === i18nLocale)?.label}
                                        </div>
                                        <textarea
                                            style={{ ...inp, minHeight: '54px', resize: 'vertical' }}
                                            value={form.descriptionI18n[i18nLocale] || ''}
                                            onChange={e => setForm(f => ({
                                                ...f,
                                                descriptionI18n: { ...f.descriptionI18n, [i18nLocale]: e.target.value },
                                            }))}
                                            placeholder={`Description in ${LOCALES.find(l => l.code === i18nLocale)?.label || i18nLocale}...`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Logo + Banner with previews */}
                            <div>
                                <label style={lbl}>Logo Image</label>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    {/* Preview */}
                                    <div style={{
                                        width: '64px', height: '64px', borderRadius: '10px', flexShrink: 0,
                                        border: '1px dashed rgba(255,255,255,0.1)',
                                        background: (logoPreview || form.logoUrl) ? `url(${logoPreview || form.logoUrl}) center/contain no-repeat` : 'rgba(255,255,255,0.02)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.6rem', color: 'var(--text-tertiary)',
                                    }}>
                                        {!logoPreview && !form.logoUrl && '📷'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input type="file" accept="image/*" onChange={handleLogoFile} style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px', width: '100%' }} />
                                        <input style={{ ...inp, fontSize: '0.72rem', padding: '6px 10px' }} value={form.logoUrl} onChange={e => { setForm(f => ({ ...f, logoUrl: e.target.value })); setLogoPreview(e.target.value) }} placeholder="Or paste URL" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label style={lbl}>Banner Image</label>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: '100px', height: '64px', borderRadius: '10px', flexShrink: 0,
                                        border: '1px dashed rgba(255,255,255,0.1)',
                                        background: (bannerPreview || form.bannerUrl) ? `url(${bannerPreview || form.bannerUrl}) center/cover no-repeat` : 'rgba(255,255,255,0.02)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.6rem', color: 'var(--text-tertiary)',
                                    }}>
                                        {!bannerPreview && !form.bannerUrl && '🖼️'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input type="file" accept="image/*" onChange={handleBannerFile} style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px', width: '100%' }} />
                                        <input style={{ ...inp, fontSize: '0.72rem', padding: '6px 10px' }} value={form.bannerUrl} onChange={e => { setForm(f => ({ ...f, bannerUrl: e.target.value })); setBannerPreview(e.target.value) }} placeholder="Or paste URL" />
                                    </div>
                                </div>
                            </div>

                            {/* Row 4: Tier + Display */}
                            <div>
                                <label style={lbl}>Tier</label>
                                <select style={sel} value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}>
                                    <option value="platinum">💎 Platinum</option>
                                    <option value="gold">🥇 Gold</option>
                                    <option value="silver">🥈 Silver</option>
                                    <option value="bronze">🥉 Bronze</option>
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Display On</label>
                                <select style={sel} value={form.displayOn} onChange={e => setForm(f => ({ ...f, displayOn: e.target.value }))}>
                                    <option value="sponsors">📄 Sponsors Page Only</option>
                                    <option value="homepage">🏠 Homepage</option>
                                    <option value="footer">📎 Site Footer</option>
                                    <option value="all">🌐 All Pages</option>
                                </select>
                            </div>

                            {/* Row 5: Dates */}
                            <div>
                                <label style={lbl}>Start Date</label>
                                <input style={inp} type="date" value={form.startDate} min={getTodayStr()} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                            </div>
                            <div>
                                <label style={lbl}>End Date</label>
                                <input style={inp} type="date" value={form.endDate} min={form.startDate || getTodayStr()} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                            </div>

                            {/* Row 6: Contact + Sort */}
                            <div>
                                <label style={lbl}>Contact Email</label>
                                <input style={inp} type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="partner@example.com" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={lbl}>Sort Order</label>
                                    <input style={inp} type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
                                </div>
                                <div>
                                    <label style={lbl}>Banner Duration (Hours)</label>
                                    <input style={inp} type="number" min={1} value={form.bannerDurationHours} onChange={e => setForm(f => ({ ...f, bannerDurationHours: parseInt(e.target.value) || 24 }))} />
                                    <div style={{ fontSize: '0.56rem', color: 'var(--text-tertiary)', marginTop: '3px', opacity: 0.7 }}>How many hours this banner displays before rotating to next sponsor</div>
                                </div>
                            </div>

                            {/* Row 7: Toggles + Save */}
                            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '24px', paddingTop: '4px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                    <div style={{
                                        width: '36px', height: '20px', borderRadius: '10px', position: 'relative', cursor: 'pointer',
                                        background: form.active ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)',
                                        border: `1px solid ${form.active ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                        transition: 'all 0.2s',
                                    }} onClick={() => setForm(f => ({ ...f, active: !f.active }))}>
                                        <div style={{
                                            position: 'absolute', top: '2px', width: '14px', height: '14px', borderRadius: '50%',
                                            left: form.active ? '18px' : '2px',
                                            background: form.active ? '#22c55e' : 'rgba(255,255,255,0.3)',
                                            transition: 'all 0.2s',
                                        }} />
                                    </div>
                                    <span style={{ color: form.active ? '#22c55e' : 'var(--text-tertiary)' }}>Active</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                    <div style={{
                                        width: '36px', height: '20px', borderRadius: '10px', position: 'relative', cursor: 'pointer',
                                        background: form.featured ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)',
                                        border: `1px solid ${form.featured ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                        transition: 'all 0.2s',
                                    }} onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}>
                                        <div style={{
                                            position: 'absolute', top: '2px', width: '14px', height: '14px', borderRadius: '50%',
                                            left: form.featured ? '18px' : '2px',
                                            background: form.featured ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                                            transition: 'all 0.2s',
                                        }} />
                                    </div>
                                    <span style={{ color: form.featured ? '#f59e0b' : 'var(--text-tertiary)' }}>⭐ Featured</span>
                                </label>
                                <div style={{ flex: 1 }} />
                                <button type="submit" disabled={saving} style={{
                                    padding: '10px 28px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '10px', cursor: 'pointer',
                                    border: 'none',
                                    background: saving ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, rgba(212,168,83,0.25), rgba(245,158,11,0.15))',
                                    color: 'var(--accent-gold)', opacity: saving ? 0.6 : 1,
                                    boxShadow: saving ? 'none' : '0 0 20px rgba(212,168,83,0.08)',
                                    transition: 'all 0.2s',
                                }}>
                                    {saving ? '⏳ Saving...' : editing ? '💾 Update Sponsor' : '✨ Create Sponsor'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {/* Sponsors List */}
                {loading ? (
                    <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '8px', animation: 'pulse 1.5s infinite' }}>⏳</div>
                        Loading sponsors...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '50px', textAlign: 'center', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: '2.5rem', opacity: 0.2, marginBottom: '12px' }}>🤝</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {filter === 'all' ? 'No sponsors yet' : `No ${filter} sponsors`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                            {filter === 'all' ? 'Click "+ Add Sponsor" to get started' : 'Try a different filter'}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filtered.map(s => {
                            const t = TIERS[s.tier] || TIERS.bronze
                            const expired = isExpired(s)
                            const dl = daysLeft(s)

                            return (
                                <div key={s.id} style={{
                                    display: 'flex', gap: '14px', padding: '14px', borderRadius: '12px',
                                    background: expired ? 'rgba(239,68,68,0.015)' : s.featured ? 'linear-gradient(135deg, rgba(212,168,83,0.03), rgba(245,158,11,0.015))' : 'rgba(255,255,255,0.015)',
                                    border: `1px solid ${expired ? 'rgba(239,68,68,0.1)' : s.featured ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)'}`,
                                    opacity: s.active ? 1 : 0.45, transition: 'all 0.25s',
                                    boxShadow: s.featured ? t.glow : 'none',
                                }}>
                                    {/* Logo */}
                                    <div style={{
                                        width: '52px', height: '52px', borderRadius: '10px', flexShrink: 0,
                                        background: s.logoUrl ? `url(${s.logoUrl}) center/contain no-repeat, rgba(255,255,255,0.02)` : `linear-gradient(135deg, ${t.bg}, transparent)`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: `1px solid ${t.color}15`, fontSize: '1.4rem',
                                    }}>
                                        {!s.logoUrl && t.icon}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>{s.name}</span>
                                            <span style={{ fontSize: '0.5rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, background: t.bg, color: t.color, border: `1px solid ${t.color}20`, letterSpacing: '0.02em' }}>{t.icon} {s.tier.toUpperCase()}</span>
                                            {s.featured && <span style={{ fontSize: '0.5rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontWeight: 600 }}>⭐ FEATURED</span>}
                                            {!s.active && <span style={{ fontSize: '0.5rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>INACTIVE</span>}
                                            {expired && <span style={{ fontSize: '0.5rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>EXPIRED</span>}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                            {s.website && <a href={s.website} target="_blank" rel="noopener" style={{ color: '#60a5fa', textDecoration: 'none' }}>🌐 {s.website.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 30)}</a>}
                                            <span>📍 {s.displayOn}</span>
                                            {s.startDate && <span>📅 {new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                                            {dl !== null && <span style={{ color: dl <= 7 ? '#ef4444' : dl <= 30 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>⏰ {dl > 0 ? `${dl}d left` : 'Expired'}</span>}
                                            {s.contactEmail && <span>✉️ {s.contactEmail}</span>}
                                        </div>
                                        {s.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', maxHeight: '34px', overflow: 'hidden', lineHeight: 1.5, opacity: 0.8 }}>{s.description}</div>}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0, alignItems: 'flex-start' }}>
                                        <button onClick={() => toggleActive(s)} title={s.active ? 'Deactivate' : 'Activate'} style={{
                                            padding: '5px 9px', fontSize: '0.72rem', borderRadius: '8px', cursor: 'pointer',
                                            background: s.active ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${s.active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)'}`,
                                            color: s.active ? '#22c55e' : 'var(--text-tertiary)', transition: 'all 0.2s',
                                        }}>{s.active ? '✅' : '⬜'}</button>
                                        <button onClick={() => toggleFeatured(s)} title={s.featured ? 'Unfeature' : 'Feature'} style={{
                                            padding: '5px 9px', fontSize: '0.72rem', borderRadius: '8px', cursor: 'pointer',
                                            background: s.featured ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${s.featured ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.06)'}`,
                                            color: s.featured ? '#f59e0b' : 'var(--text-tertiary)', transition: 'all 0.2s',
                                        }}>{s.featured ? '⭐' : '☆'}</button>
                                        <button onClick={() => startEdit(s)} title="Edit" style={{
                                            padding: '5px 9px', fontSize: '0.72rem', borderRadius: '8px', cursor: 'pointer',
                                            background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)', color: '#60a5fa', transition: 'all 0.2s',
                                        }}>✏️</button>
                                        <button onClick={() => deleteSponsor(s.id)} title="Delete" style={{
                                            padding: '5px 9px', fontSize: '0.72rem', borderRadius: '8px', cursor: 'pointer',
                                            background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', color: '#ef4444', transition: 'all 0.2s',
                                        }}>🗑️</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Display guide */}
                <div style={{ marginTop: '20px', padding: '14px 18px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(255,255,255,0.015), rgba(212,168,83,0.02))', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.7rem', color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '6px' }}>📋 Display Guide</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                        <div>📄 <strong>Sponsors Page</strong>: Full cards with logo, description &amp; website link</div>
                        <div>🏠 <strong>Homepage</strong>: Featured sponsors in the hero area</div>
                        <div>📎 <strong>Footer</strong>: Logo strip across all pages</div>
                        <div>🌐 <strong>All Pages</strong>: Displays everywhere. Visitors click to visit site</div>
                    </div>
                </div>
            </main>

            <style>{`
                select option { background: #1a1a2e !important; color: #e2e8f0 !important; }
                input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
                input:focus, select:focus, textarea:focus { border-color: rgba(212,168,83,0.3) !important; }
            `}</style>
        </div>
    )
}
