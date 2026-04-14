'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import AdminSidebar from '@/components/AdminSidebar'

interface Roll {
    id: string
    title: string
    icon: string
    slug: string
    displayOn: string
    visible: boolean
    sortOrder: number
    _count: { projects: number }
}

type ModalMode = 'create' | 'edit'

const DISPLAY_LABELS: Record<string, string> = {
    both: 'Both Pages', homepage: 'Homepage Only', works: 'Works Page Only',
}

const DISPLAY_OPTIONS = [
    { value: 'both', label: '📺 Both Pages' },
    { value: 'homepage', label: '🏠 Homepage Only' },
    { value: 'works', label: '🎬 Works Page Only' },
]

const ICON_PRESETS = ['🎬', '⭐', '🔥', '🆕', '🏆', '🎞️', '✅', '🎭', '🌟', '🎪', '🎥', '💎']

const S = {
    btnGold: {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '0.6rem 1.3rem', borderRadius: '10px',
        background: 'linear-gradient(135deg,#d4a853,#b8903f)',
        color: '#000', fontWeight: 800, fontSize: '0.85rem',
        border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    } as React.CSSProperties,
    btnGhost: {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '0.45rem 0.85rem', borderRadius: '8px',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
    } as React.CSSProperties,
    btnDanger: {
        display: 'inline-flex', alignItems: 'center',
        padding: '0.4rem 0.75rem', borderRadius: '7px',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
    } as React.CSSProperties,
    input: {
        width: '100%', padding: '0.6rem 0.85rem', borderRadius: '9px',
        border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
        color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
    } as React.CSSProperties,
    label: {
        display: 'block', fontSize: '0.7rem', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.45)', marginBottom: '6px',
    } as React.CSSProperties,
}

/* ── Custom Select Dropdown ─────────────────────────────────── */
function CustomSelect({
    value, onChange, options,
}: {
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string }[]
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const selected = options.find(o => o.value === value)

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', padding: '0.6rem 0.85rem', borderRadius: '9px',
                    border: `1px solid ${open ? 'rgba(212,168,83,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    background: 'rgba(255,255,255,0.06)', color: '#fff',
                    fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'border-color 0.15s',
                }}
            >
                <span>{selected?.label ?? 'Select…'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round"
                    style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10,
                    background: 'linear-gradient(160deg,#14162a,#0f1020)',
                    border: '1px solid rgba(212,168,83,0.25)', borderRadius: '10px',
                    overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
                }}>
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            style={{
                                width: '100%', padding: '0.55rem 0.85rem', textAlign: 'left',
                                background: opt.value === value ? 'rgba(212,168,83,0.12)' : 'transparent',
                                border: 'none', color: opt.value === value ? '#d4a853' : 'rgba(255,255,255,0.8)',
                                fontSize: '0.85rem', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', gap: '8px', transition: 'background 0.12s',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,168,83,0.08)' }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLButtonElement).style.background =
                                    opt.value === value ? 'rgba(212,168,83,0.12)' : 'transparent'
                            }}
                        >
                            {opt.value === value && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                    stroke="#d4a853" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                            )}
                            <span style={{ marginLeft: opt.value === value ? 0 : '20px' }}>{opt.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

/* ── Main page ─────────────────────────────────────────────── */
export default function MovieRollsAdmin() {
    const [rolls, setRolls]     = useState<Roll[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving]   = useState(false)
    const [toast, setToast]     = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [isMounted, setIsMounted] = useState(false)

    const [modal, setModal]                   = useState<{ mode: ModalMode; roll?: Roll } | null>(null)
    const [formTitle, setFormTitle]           = useState('')
    const [formIcon, setFormIcon]             = useState('🎬')
    const [formDisplayOn, setFormDisplayOn]   = useState('both')
    const [formVisible, setFormVisible]       = useState(true)
    const [formSortOrder, setFormSortOrder]   = useState('0')
    const [formSlug, setFormSlug]             = useState('')
    const [formError, setFormError]           = useState('')
    const titleInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { setIsMounted(true) }, [])

    /* ── Data ── */
    const fetchRolls = useCallback(async () => {
        const res = await fetch('/api/admin/movie-rolls')
        if (res.ok) setRolls(await res.json())
    }, [])

    useEffect(() => { fetchRolls().finally(() => setLoading(false)) }, [fetchRolls])

    /* ── Helpers ── */
    const notify = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }, [])

    const openCreate = () => {
        setFormTitle(''); setFormIcon('🎬'); setFormDisplayOn('both')
        setFormVisible(true); setFormSortOrder(String(rolls.length)); setFormSlug('')
        setFormError('')
        setModal({ mode: 'create' })
        setTimeout(() => titleInputRef.current?.focus(), 80)
    }

    const openEdit = (roll: Roll) => {
        setFormTitle(roll.title); setFormIcon(roll.icon)
        setFormDisplayOn(roll.displayOn); setFormVisible(roll.visible)
        setFormSortOrder(String(roll.sortOrder)); setFormSlug(roll.slug)
        setFormError('')
        setModal({ mode: 'edit', roll })
        setTimeout(() => titleInputRef.current?.focus(), 80)
    }

    const closeModal = () => setModal(null)

    /* ── CRUD ── */
    const handleSubmit = async () => {
        if (!formTitle.trim()) { setFormError('Title is required'); return }
        setFormError('')
        setSaving(true)
        try {
            if (modal?.mode === 'create') {
                const res = await fetch('/api/admin/movie-rolls', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: formTitle.trim(), icon: formIcon,
                        displayOn: formDisplayOn, visible: formVisible,
                        sortOrder: parseInt(formSortOrder) || 0,
                        slug: formSlug.trim() || undefined,
                    }),
                })
                if (!res.ok) { setFormError((await res.json()).error || 'Create failed'); notify('Create failed', 'err'); return }
                notify('Roll created ✓'); closeModal(); await fetchRolls()
            } else if (modal?.mode === 'edit' && modal.roll) {
                const res = await fetch('/api/admin/movie-rolls', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: modal.roll.id, title: formTitle.trim(), icon: formIcon,
                        displayOn: formDisplayOn, visible: formVisible,
                        sortOrder: parseInt(formSortOrder) || 0,
                        slug: formSlug.trim() || undefined,
                    }),
                })
                if (!res.ok) { setFormError((await res.json()).error || 'Update failed'); notify('Update failed', 'err'); return }
                notify('Roll updated ✓'); closeModal(); await fetchRolls()
            }
        } finally { setSaving(false) }
    }

    const deleteRoll = async (roll: Roll) => {
        if (!confirm(`Delete "${roll.title}"?\nProjects will be removed from this roll but not deleted.`)) return
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

    /* ── Modal JSX (inline, not a separate component, so closures always fresh) ── */
    const modalJSX = modal && isMounted ? createPortal(
        <div
            onClick={closeModal}
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
            }}
        >
            <style>{`
                @keyframes mrSlideUp{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:none}}
                .mr-fi:focus{border-color:rgba(212,168,83,0.5)!important;outline:none}
                .mr-icon-pick:hover{border-color:rgba(212,168,83,0.4)!important}
                .mr-icon-pick.sel{border-color:rgba(212,168,83,0.7)!important;background:rgba(212,168,83,0.14)!important}
            `}</style>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'linear-gradient(160deg,#0d0f1c,#0a0b16)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px', padding: '2rem',
                    width: '100%', maxWidth: '520px',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
                    animation: 'mrSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)',
                    maxHeight: '90vh', overflowY: 'auto',
                }}
            >
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '0 0 1.5rem' }}>
                    {modal.mode === 'create' ? '✦ New Movie Roll' : `✦ Edit — ${modal.roll?.title}`}
                </h2>

                {/* Title */}
                <div style={{ marginBottom: '1.1rem' }}>
                    <label style={S.label}>Title *</label>
                    <input
                        ref={titleInputRef}
                        className="mr-fi" style={S.input} type="text"
                        placeholder="e.g. Award Winners, Fan Favourites…"
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
                    />
                </div>

                {/* Icon */}
                <div style={{ marginBottom: '1.1rem' }}>
                    <label style={S.label}>Icon</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        {ICON_PRESETS.map(ic => (
                            <button key={ic} type="button"
                                className={`mr-icon-pick ${formIcon === ic ? 'sel' : ''}`}
                                onClick={() => setFormIcon(ic)}
                                style={{
                                    width: '38px', height: '38px', borderRadius: '9px', fontSize: '1.25rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
                                    background: formIcon === ic ? 'rgba(212,168,83,0.14)' : 'rgba(255,255,255,0.04)',
                                    transition: 'all 0.15s',
                                }}
                            >{ic}</button>
                        ))}
                        <input className="mr-fi"
                            style={{ ...S.input, width: '52px', textAlign: 'center', fontSize: '1.1rem', padding: '0.4rem' }}
                            type="text" maxLength={4} value={formIcon}
                            onChange={e => setFormIcon(e.target.value)} placeholder="…" />
                    </div>
                </div>

                {/* Display on + Sort Order */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.1rem' }}>
                    <div>
                        <label style={S.label}>Display On</label>
                        <CustomSelect
                            value={formDisplayOn}
                            onChange={setFormDisplayOn}
                            options={DISPLAY_OPTIONS}
                        />
                    </div>
                    <div>
                        <label style={S.label}>Position / Sort Order</label>
                        <input className="mr-fi" style={S.input} type="number" min={0} step={1}
                            value={formSortOrder} onChange={e => setFormSortOrder(e.target.value)}
                            placeholder="0 = first" />
                    </div>
                </div>

                {/* Slug */}
                <div style={{ marginBottom: '1.1rem' }}>
                    <label style={S.label}>Custom Slug <span style={{ fontWeight: 400, opacity: 0.4 }}>(optional)</span></label>
                    <input className="mr-fi" style={S.input} type="text"
                        placeholder="auto-generated from title"
                        value={formSlug} onChange={e => setFormSlug(e.target.value)} />
                </div>

                {/* Visibility */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Visible to public</span>
                    <button type="button" onClick={() => setFormVisible(!formVisible)} style={{
                        width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer', position: 'relative',
                        background: formVisible ? 'rgba(212,168,83,0.85)' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s',
                        flexShrink: 0,
                    }}>
                        <span style={{
                            position: 'absolute', top: '3px', width: '20px', height: '20px', borderRadius: '50%',
                            background: '#fff', transition: 'left 0.2s', left: formVisible ? 'calc(100% - 23px)' : '3px',
                        }} />
                    </button>
                </div>

                {/* Error */}
                {formError && (
                    <div style={{
                        padding: '0.5rem 0.85rem', borderRadius: '8px', marginBottom: '1rem',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        fontSize: '0.8rem', color: '#f87171', fontWeight: 600,
                    }}>✗ {formError}</div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                    <button type="button" style={S.btnGhost} onClick={closeModal}>Cancel</button>
                    <button
                        type="button"
                        style={{ ...S.btnGold, opacity: saving ? 0.6 : 1, minWidth: '120px', justifyContent: 'center' }}
                        disabled={saving}
                        onClick={handleSubmit}
                    >
                        {saving ? 'Saving…' : modal.mode === 'create' ? '+ Create Roll' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null

    if (loading) return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎞️</div>
                    <p style={{ fontSize: '0.85rem' }}>Loading rolls…</p>
                </div>
            </main>
        </div>
    )

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 99998,
                        padding: '0.65rem 1.1rem', borderRadius: '10px',
                        fontSize: '0.82rem', fontWeight: 700,
                        background: toast.type === 'ok' ? 'rgba(52,211,153,0.18)' : 'rgba(239,68,68,0.18)',
                        border: `1px solid ${toast.type === 'ok' ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'}`,
                        color: toast.type === 'ok' ? '#34d399' : '#f87171',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}>
                        {toast.msg}
                    </div>
                )}

                {/* Portal modal */}
                {modalJSX}

                {/* Header */}
                <div className="admin-header">
                    <h1 className="admin-page-title">🎞️ Movie Rolls</h1>
                    <button style={S.btnGold} onClick={openCreate}>+ New Roll</button>
                </div>

                <div style={{ padding: '0 var(--space-xl) var(--space-xl)' }}>
                    {/* Subtitle */}
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', marginTop: 0 }}>
                        Create and order curated rows.{' '}
                        <strong style={{ color: 'rgba(255,255,255,0.55)' }}>
                            Assign projects to rolls from the Projects page.
                        </strong>
                    </p>

                    {/* Tip callout */}
                    <div style={{
                        padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: 'var(--space-lg)',
                        background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.15)',
                        fontSize: '0.78rem', color: 'rgba(212,168,83,0.9)', display: 'flex', alignItems: 'flex-start', gap: '8px',
                    }}>
                        <span style={{ flexShrink: 0, fontSize: '1rem' }}>💡</span>
                        <span>
                            Rolls are <strong>containers</strong>. To assign a movie to a roll, go to{' '}
                            <strong>Admin → Projects</strong>, edit the project, and select rolls from the{' '}
                            <em>Movie Rolls</em> section.
                        </span>
                    </div>

                    {/* Empty state */}
                    {rolls.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '5rem 2rem',
                            background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.08)',
                            borderRadius: '16px',
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>🎞️</div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: '0 0 0.5rem' }}>
                                No rolls yet
                            </h3>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', margin: '0 0 1.5rem' }}>
                                Create rolls, then assign projects to them from the Projects page.
                            </p>
                            <button style={S.btnGold} onClick={openCreate}>+ Create First Roll</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {rolls.map((roll, idx) => (
                                <div key={roll.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.9rem 1rem', borderRadius: '12px',
                                    border: `1px solid ${roll.visible ? 'rgba(212,168,83,0.2)' : 'rgba(255,255,255,0.07)'}`,
                                    background: 'rgba(255,255,255,0.022)',
                                }}>
                                    <span style={{
                                        width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                                        background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800,
                                        color: 'rgba(255,255,255,0.35)',
                                    }}>{idx + 1}</span>

                                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{roll.icon}</span>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{roll.title}</span>
                                            <span style={{
                                                fontSize: '0.58rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px',
                                                background: roll.visible ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                                                color: roll.visible ? '#34d399' : 'rgba(255,255,255,0.35)',
                                                textTransform: 'uppercase',
                                            }}>{roll.visible ? 'Live' : 'Hidden'}</span>
                                            <span style={{
                                                fontSize: '0.58rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px',
                                                background: 'rgba(96,165,250,0.1)', color: '#60a5fa',
                                            }}>{DISPLAY_LABELS[roll.displayOn] ?? roll.displayOn}</span>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: '3px' }}>
                                            {roll._count.projects} project{roll._count.projects !== 1 ? 's' : ''} assigned · /{roll.slug}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                        <button style={S.btnGhost} onClick={() => toggleVisibility(roll)}>
                                            {roll.visible ? '👁 Hide' : '✦ Show'}
                                        </button>
                                        <button style={S.btnGhost} onClick={() => openEdit(roll)}>✏️ Edit</button>
                                        <button style={S.btnDanger} onClick={() => deleteRoll(roll)}>🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
