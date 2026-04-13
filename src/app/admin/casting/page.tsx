'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import TranslationBadge, { getTranslationCoverage } from '@/components/TranslationBadge'
import AdminImageUpload from '@/components/AdminImageUpload'

/* ── Types ── */
type Project = { id: string; title: string; slug: string; genre: string | null; year: string | null; coverImage: string | null }
type CastingCall = {
    id: string; projectId: string; project: Project
    roleName: string; roleType: string; roleDescription: string
    ageRange: string | null; gender: string | null; ethnicity: string | null
    requirements: string; compensation: string | null; deadline: string | null; status: string
    translations: string | null
    _count: { applications: number }
}

type FormData = {
    projectId: string; roleName: string; roleType: string; roleDescription: string
    ageRange: string; gender: string; ethnicity: string
    requirements: string; compensation: string; deadline: string; status: string
    bannerUrl: string
}

const EMPTY_FORM: FormData = {
    projectId: '', roleName: '', roleType: 'lead', roleDescription: '',
    ageRange: '', gender: '', ethnicity: '',
    requirements: '', compensation: 'Voluntary', deadline: '', status: 'open',
    bannerUrl: '',
}

const ROLE_TYPES = ['lead', 'supporting', 'extra', 'voice']
const STATUSES = ['open', 'closed', 'filled']

const SIDEBAR_LINKS = [
    { href: '/admin/analytics', label: '📊 Analytics' },
    { href: '/admin/projects', label: '🎬 Projects' },
    { href: '/admin/casting', label: '🎭 Casting', active: true },
    { href: '/admin/applications', label: '📋 Applications' },
    { href: '/admin/media', label: '🖼️ Page Media' },
    { href: '/admin/sponsors', label: '🤝 Sponsors' },
    { href: '/admin/donations', label: '💰 Donations' },
    { href: '/admin/users', label: '👥 Users' },
    { href: '/admin/scripts', label: '✍️ Scripts' },
    { href: '/admin/training', label: '🎓 Training' },
    { href: '/admin/settings', label: '⚙️ Settings' },
]

const statusConfig: Record<string, { label: string; className: string }> = {
    open: { label: 'Open', className: 'badge-green' },
    closed: { label: 'Closed', className: 'badge-red' },
    filled: { label: 'Filled', className: 'badge-blue' },
}

const roleTypeConfig: Record<string, string> = {
    lead: 'badge-gold',
    supporting: 'badge-blue',
    extra: 'badge-gray',
    voice: 'badge-green',
}

export default function AdminCastingPage() {
    const [castingCalls, setCastingCalls] = useState<CastingCall[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<FormData>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [castingEnabled, setCastingEnabled] = useState(true)
    const [togglingCasting, setTogglingCasting] = useState(false)

    // Fetch data
    useEffect(() => {
        Promise.all([
            fetch('/api/admin/casting').then(r => { if (r.status === 401) { window.location.href = '/admin/login'; return [] } return r.json() }),
            fetch('/api/admin/projects').then(r => { if (r.status === 401) return []; return r.json() }),
        ])
            .then(([calls, projs]) => {
                setCastingCalls(calls)
                setProjects(projs)
            })
            .catch(() => setError('Failed to load data'))
            .finally(() => setLoading(false))
        // Fetch casting toggle state
        fetch('/api/admin/toggles').then(r => r.json()).then(s => {
            if (typeof s.castingCallsEnabled === 'boolean') setCastingEnabled(s.castingCallsEnabled)
        }).catch(() => {})
    }, [])

    const openCreate = () => {
        setEditingId(null)
        setForm(EMPTY_FORM)
        setShowModal(true)
        setError('')
    }

    const openEdit = (c: CastingCall) => {
        setEditingId(c.id)
        setForm({
            projectId: c.projectId,
            roleName: c.roleName,
            roleType: c.roleType,
            roleDescription: c.roleDescription,
            ageRange: c.ageRange || '',
            gender: c.gender || '',
            ethnicity: c.ethnicity || '',
            requirements: c.requirements,
            compensation: c.compensation || '',
            deadline: c.deadline || '',
            status: c.status,
            bannerUrl: (c as unknown as { bannerUrl?: string }).bannerUrl || '',
        })
        setShowModal(true)
        setError('')
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.projectId || !form.roleName || !form.roleDescription || !form.requirements) {
            setError('Please fill in all required fields')
            return
        }
        // Validate deadline is not in the past
        if (form.deadline) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const deadline = new Date(form.deadline)
            if (deadline < today) {
                setError('Deadline cannot be in the past')
                return
            }
        }
        setSaving(true)
        setError('')
        // ── Translation check: warn before opening without full translations
        const editingCall = editingId ? castingCalls.find(c => c.id === editingId) : null
        if (form.status === 'open' && editingCall) {
            const { isComplete, count, total } = getTranslationCoverage(editingCall.translations)
            if (!isComplete) {
                const ok = confirm(
                    `⚠️ Translation Warning\n\nOnly ${count}/${total} languages have been translated for "${form.roleName}".\n\nOpening this role means international users will see untranslated content.\n\nContinue anyway?`
                )
                if (!ok) { setSaving(false); return }
            }
        }
        try {
            const url = editingId ? `/api/admin/casting/${editingId}` : '/api/admin/casting'
            const method = editingId ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to save')
            }
            const saved = await res.json()
            if (editingId) {
                setCastingCalls(prev => prev.map(c => c.id === editingId ? saved : c))
            } else {
                setCastingCalls(prev => [saved, ...prev])
            }
            setShowModal(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this casting call? This will also delete all applications.')) return
        setDeleting(id)
        try {
            const res = await fetch(`/api/admin/casting/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            setCastingCalls(prev => prev.filter(c => c.id !== id))
        } catch {
            alert('Failed to delete casting call')
        } finally {
            setDeleting(null)
        }
    }

    const updateField = (field: keyof FormData, value: string) =>
        setForm(f => ({ ...f, [field]: value }))

    const openCount = castingCalls.filter(c => c.status === 'open').length
    const totalApps = castingCalls.reduce((sum, c) => sum + c._count.applications, 0)
    const filledCount = castingCalls.filter(c => c.status === 'filled').length

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                <div className="admin-header">
                    <h1 className="admin-page-title">Casting Calls</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button
                            onClick={async () => {
                                setTogglingCasting(true)
                                try {
                                    const newVal = !castingEnabled
                                    const res = await fetch('/api/admin/toggles', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ castingCallsEnabled: newVal }),
                                    })
                                    if (res.ok) setCastingEnabled(newVal)
                                    else alert('Failed to toggle')
                                } catch { alert('Failed to toggle') }
                                setTogglingCasting(false)
                            }}
                            disabled={togglingCasting}
                            style={{
                                padding: '6px 16px', fontSize: '0.78rem', fontWeight: 700,
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: castingEnabled ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                                color: castingEnabled ? '#34d399' : '#ef4444',
                                transition: 'all 0.2s',
                            }}
                        >
                            {togglingCasting ? '...' : castingEnabled ? '🟢 Casting Live' : '🔴 Casting Hidden'}
                        </button>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{castingCalls.length} total</span>
                        <button onClick={openCreate} className="btn btn-primary btn-sm">+ New Casting Call</button>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid-4" style={{ marginBottom: 'var(--space-2xl)' }}>
                    <div className="stat-card">
                        <div className="stat-card-label">Total Calls</div>
                        <div className="stat-card-value">{castingCalls.length}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Open Calls</div>
                        <div className="stat-card-value" style={{ color: 'var(--success)' }}>{openCount}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Total Applications</div>
                        <div className="stat-card-value">{totalApps}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Filled Roles</div>
                        <div className="stat-card-value" style={{ color: 'var(--accent-gold)' }}>{filledCount}</div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                        Loading casting calls...
                    </div>
                ) : castingCalls.length === 0 ? (
                    <div style={{
                        position: 'relative', overflow: 'hidden',
                        borderRadius: '20px',
                        background: 'linear-gradient(160deg, rgba(212,168,83,0.05) 0%, var(--bg-secondary) 45%, rgba(139,92,246,0.03) 100%)',
                        border: '1px solid rgba(212,168,83,0.12)',
                        padding: '64px 40px 52px',
                        textAlign: 'center',
                    }}>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                            background: 'linear-gradient(90deg, transparent, var(--accent-gold), rgba(139,92,246,0.6), var(--accent-gold), transparent)',
                            opacity: 0.45,
                        }} />
                        <div style={{
                            position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
                            width: '300px', height: '300px', borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(212,168,83,0.09) 0%, transparent 70%)',
                            animation: 'orbFloat 7s ease-in-out infinite',
                            pointerEvents: 'none',
                        }} />
                        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '24px' }}>
                            <div style={{
                                width: '80px', height: '80px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(212,168,83,0.14), rgba(139,92,246,0.08))',
                                border: '1px solid rgba(212,168,83,0.22)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem', margin: '0 auto',
                                boxShadow: '0 0 32px rgba(212,168,83,0.18)',
                            }}>🎭</div>
                            <div style={{
                                position: 'absolute', top: '-3px', right: '-3px',
                                width: '14px', height: '14px', borderRadius: '50%',
                                background: 'var(--accent-gold)',
                                boxShadow: '0 0 10px rgba(212,168,83,0.7)',
                                animation: 'livePulse 2s ease-in-out infinite',
                            }} />
                        </div>
                        <h3 style={{
                            fontSize: '1.55rem', fontWeight: 900, margin: '0 0 12px',
                            background: 'linear-gradient(135deg, var(--text-primary) 40%, var(--accent-gold))',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em',
                        }}>The Stage Awaits</h3>
                        <p style={{
                            fontSize: '0.88rem', lineHeight: 1.75,
                            color: 'var(--text-tertiary)',
                            maxWidth: '340px', margin: '0 auto 28px',
                            textAlign: 'center',
                        }}>
                            Every great film needs the perfect cast.{' '}
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Create your first casting call</span>{' '}
                            and let talent come to you.
                        </p>
                        <button
                            onClick={openCreate}
                            style={{
                                padding: '12px 32px', fontSize: '0.88rem', fontWeight: 700,
                                borderRadius: '50px', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, var(--accent-gold), #c4943a)',
                                color: '#0a0a0a',
                                boxShadow: '0 4px 22px rgba(212,168,83,0.35)',
                                transition: 'all 0.25s ease',
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 30px rgba(212,168,83,0.5)'
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 22px rgba(212,168,83,0.35)'
                            }}
                        >
                            <span>🎬</span> Open Auditions
                        </button>
                        <p style={{
                            marginTop: '16px', fontSize: '0.65rem',
                            color: 'rgba(255,255,255,0.18)',
                            letterSpacing: '0.12em', textTransform: 'uppercase',
                            textAlign: 'center', margin: '16px auto 0',
                        }}>Talent is waiting for their moment</p>
                    </div>






                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Group casting calls by project */}
                        {Object.entries(
                            castingCalls.reduce((acc, call) => {
                                const key = call.project.id
                                if (!acc[key]) acc[key] = { project: call.project, calls: [] }
                                acc[key].calls.push(call)
                                return acc
                            }, {} as Record<string, { project: typeof castingCalls[0]['project']; calls: typeof castingCalls }>)
                        ).map(([projectId, { project, calls }]) => (
                            <div key={projectId} style={{
                                background: 'rgba(255,255,255,0.015)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '14px',
                                overflow: 'hidden',
                            }}>
                                {/* Project Header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '14px 20px',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    background: 'rgba(228,185,90,0.03)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '3px', height: '20px', borderRadius: '2px', background: 'var(--accent-gold)' }} />
                                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{project.title}</span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                            {calls.length} role{calls.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                        {calls.reduce((s, c) => s + c._count.applications, 0)} total applications
                                    </span>
                                </div>

                                {/* Role Cards */}
                                {calls.map((call, idx) => {
                                    const status = statusConfig[call.status] || statusConfig.open
                                    const roleClass = roleTypeConfig[call.roleType] || 'badge-blue'
                                    return (
                                        <div key={call.id} style={{
                                            display: 'grid', gridTemplateColumns: '1fr 140px auto',
                                            alignItems: 'center', gap: '16px',
                                            padding: '16px 20px',
                                            borderBottom: idx < calls.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                            opacity: deleting === call.id ? 0.3 : 1,
                                            transition: 'all 0.2s',
                                        }}>
                                            {/* Left: Role details */}
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{call.roleName}</span>
                                                    <span className={`badge ${roleClass}`} style={{ fontSize: '0.6rem', padding: '2px 8px' }}>{call.roleType}</span>
                                                    <span className={`badge ${status.className}`} style={{ fontSize: '0.6rem', padding: '2px 8px' }}>{status.label}</span>
                                                    <TranslationBadge translationsJson={call.translations} retry={{ type: 'casting', id: call.id }} />
                                                </div>
                                                <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', lineHeight: 1.4, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {call.roleDescription}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {call.ageRange && (
                                                        <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)' }}>
                                                            🎂 {call.ageRange}
                                                        </span>
                                                    )}
                                                    {call.gender && (
                                                        <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)' }}>
                                                            {call.gender}
                                                        </span>
                                                    )}
                                                    {call.deadline && (
                                                        <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)' }}>
                                                            📅 {call.deadline}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Center: Application count */}
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{
                                                    fontSize: '1.4rem', fontWeight: 800, lineHeight: 1,
                                                    color: call._count.applications > 0 ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)',
                                                }}>
                                                    {call._count.applications}
                                                </div>
                                                <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    applications
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                                <button onClick={() => openEdit(call)}
                                                    style={{
                                                        padding: '6px 12px', fontSize: '0.74rem', fontWeight: 600,
                                                        border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                        background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                                                        transition: 'all 0.15s',
                                                    }}>
                                                    ✏️ Edit
                                                </button>
                                                <Link href={`/admin/applications?casting=${call.id}`}
                                                    style={{
                                                        padding: '6px 12px', fontSize: '0.74rem', fontWeight: 600,
                                                        borderRadius: '6px', textDecoration: 'none',
                                                        background: 'rgba(228,185,90,0.08)', color: 'var(--accent-gold)',
                                                        transition: 'all 0.15s',
                                                    }}>
                                                    📋 Apps
                                                </Link>
                                                <button onClick={() => handleDelete(call.id)} disabled={deleting === call.id}
                                                    style={{
                                                        padding: '6px 8px', fontSize: '0.74rem', fontWeight: 600,
                                                        border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                        background: 'transparent', color: 'rgba(239,68,68,0.6)',
                                                        transition: 'all 0.15s',
                                                    }}>
                                                    {deleting === call.id ? '...' : '🗑️'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
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
                            {editingId ? '✏️ Edit Casting Call' : '🎭 New Casting Call'}
                        </h2>

                        <form onSubmit={handleSave}>
                            <div className="admin-form-stack" style={{ gap: 'var(--space-md)' }}>
                                {/* Project */}
                                <div>
                                    <label className="admin-label">Project *</label>
                                    <select className="admin-input" value={form.projectId} onChange={e => updateField('projectId', e.target.value)}
                                        style={{ cursor: 'pointer', appearance: 'auto' }} required>
                                        <option value="">Select a project...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                </div>

                                {/* Role Name + Type */}
                                <div className="admin-form-grid">
                                    <div>
                                        <label className="admin-label">Role Name *</label>
                                        <input className="admin-input" value={form.roleName} onChange={e => updateField('roleName', e.target.value)}
                                            placeholder="e.g. Detective Cross" required />
                                    </div>
                                    <div>
                                        <label className="admin-label">Role Type</label>
                                        <select className="admin-input" value={form.roleType} onChange={e => updateField('roleType', e.target.value)}
                                            style={{ cursor: 'pointer', appearance: 'auto' }}>
                                            {ROLE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="admin-label">Role Description *</label>
                                    <textarea className="admin-textarea" rows={3} value={form.roleDescription}
                                        onChange={e => updateField('roleDescription', e.target.value)}
                                        placeholder="Describe the character and their role in the story..." required />
                                </div>

                                {/* Age, Gender, Ethnicity */}
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <div>
                                        <label className="admin-label">Age Range</label>
                                        <input className="admin-input" value={form.ageRange} onChange={e => updateField('ageRange', e.target.value)}
                                            placeholder="e.g. 25-40" />
                                    </div>
                                    <div>
                                        <label className="admin-label">Gender</label>
                                        <select className="admin-input" value={form.gender} onChange={e => updateField('gender', e.target.value)}
                                            style={{ cursor: 'pointer', appearance: 'auto' }}>
                                            <option value="">Any</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Non-binary">Non-binary</option>
                                            <option value="Any">Any</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="admin-label">Ethnicity</label>
                                        <input className="admin-input" value={form.ethnicity} onChange={e => updateField('ethnicity', e.target.value)}
                                            placeholder="Any" />
                                    </div>
                                </div>

                                {/* Requirements */}
                                <div>
                                    <label className="admin-label">Requirements *</label>
                                    <textarea className="admin-textarea" rows={2} value={form.requirements}
                                        onChange={e => updateField('requirements', e.target.value)}
                                        placeholder="e.g. Strong dramatic range, comfortable with action..." required />
                                </div>

                                {/* Compensation, Deadline, Status */}
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <div>
                                        <label className="admin-label">Compensation</label>
                                        <input className="admin-input" value={form.compensation} onChange={e => updateField('compensation', e.target.value)}
                                            placeholder="e.g. Voluntary" />
                                    </div>
                                    <div>
                                        <label className="admin-label">Deadline</label>
                                        <input className="admin-input" type="date" value={form.deadline}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={e => updateField('deadline', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="admin-label">Status</label>
                                        <select className="admin-input" value={form.status} onChange={e => updateField('status', e.target.value)}
                                            style={{ cursor: 'pointer', appearance: 'auto' }}>
                                            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Banner Image */}
                                <AdminImageUpload
                                    value={form.bannerUrl}
                                    onChange={url => updateField('bannerUrl', url)}
                                    category="casting"
                                    label="Banner Image (optional)"
                                    hint="Hero image displayed on the casting call page. Recommended 1200×400px."
                                    previewSize={72}
                                />

                                {error && (
                                    <div style={{
                                        fontSize: '0.85rem', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)',
                                        color: 'var(--error)', background: 'rgba(239,68,68,0.1)',
                                    }}>✗ {error}</div>
                                )}

                                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)' }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Saving...' : editingId ? '💾 Update' : '🎭 Create'}
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
