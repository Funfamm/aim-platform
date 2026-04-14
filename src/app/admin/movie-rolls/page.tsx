'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

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
    both: 'Both Pages', homepage: 'Homepage', works: 'Works Page',
}

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
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
        color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
    } as React.CSSProperties,
    select: {
        width: '100%', padding: '0.6rem 0.85rem', borderRadius: '9px',
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
        color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
        colorScheme: 'dark',
    } as React.CSSProperties,
    label: {
        display: 'block', fontSize: '0.7rem', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.45)', marginBottom: '6px',
    } as React.CSSProperties,
}

/* ── Modal (portal) ────────────────────────────────────────── */
function RollModal({
    mode, roll, saving,
    formTitle, setFormTitle,
    formIcon, setFormIcon,
    formDisplayOn, setFormDisplayOn,
    formVisible, setFormVisible,
    formSortOrder, setFormSortOrder,
    formSlug, setFormSlug,
    onClose, onSubmit, titleInputRef,
}: {
    mode: ModalMode; roll?: Roll; saving: boolean
    formTitle: string; setFormTitle: (v: string) => void
    formIcon: string; setFormIcon: (v: string) => void
    formDisplayOn: string; setFormDisplayOn: (v: string) => void
    formVisible: boolean; setFormVisible: (v: boolean) => void
    formSortOrder: string; setFormSortOrder: (v: string) => void
    formSlug: string; setFormSlug: (v: string) => void
    onClose: () => void
    onSubmit: (e: React.FormEvent) => void
    titleInputRef: React.RefObject<HTMLInputElement | null>
}) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])
    if (!mounted) return null

    return createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
            }}
        >
            <style>{`
                @keyframes mrSlideUp{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:none}}
                .mr-fi:focus{border-color:rgba(212,168,83,0.5)!important}
                .mr-icon-pick.sel{border-color:rgba(212,168,83,0.7)!important;background:rgba(212,168,83,0.14)!important}
            `}</style>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'linear-gradient(160deg,#0d0f1c,#0a0b16)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '18px', padding: '2rem',
                    width: '100%', maxWidth: '500px',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
                    animation: 'mrSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)',
                }}
            >
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '0 0 1.5rem' }}>
                    {mode === 'create' ? '✦ New Movie Roll' : `✦ Edit — ${roll?.title}`}
                </h2>
                <form onSubmit={onSubmit}>
                    {/* Title */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={S.label}>Title *</label>
                        <input
                            ref={titleInputRef as React.RefObject<HTMLInputElement>}
                            className="mr-fi" style={S.input} type="text"
                            placeholder="e.g. Award Winners, Fan Favourites…"
                            value={formTitle} onChange={e => setFormTitle(e.target.value)} required
                        />
                    </div>

                    {/* Icon */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={S.label}>Icon</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                            {ICON_PRESETS.map(ic => (
                                <button key={ic} type="button"
                                    className={`mr-icon-pick ${formIcon === ic ? 'sel' : ''}`}
                                    onClick={() => setFormIcon(ic)}
                                    style={{
                                        width: '36px', height: '36px', borderRadius: '8px', fontSize: '1.2rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
                                        background: formIcon === ic ? 'rgba(212,168,83,0.14)' : 'rgba(255,255,255,0.04)',
                                    }}
                                >{ic}</button>
                            ))}
                            <input className="mr-fi" style={{ ...S.input, width: '52px', textAlign: 'center', fontSize: '1.1rem', padding: '0.4rem' }}
                                type="text" maxLength={4} value={formIcon} onChange={e => setFormIcon(e.target.value)} placeholder="…" />
                        </div>
                    </div>

                    {/* Display on + Sort Order (two columns) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={S.label}>Display On</label>
                            <select className="mr-fi" style={S.select} value={formDisplayOn} onChange={e => setFormDisplayOn(e.target.value)}>
                                <option value="both">Both Pages</option>
                                <option value="homepage">Homepage Only</option>
                                <option value="works">Works Page Only</option>
                            </select>
                        </div>
                        <div>
                            <label style={S.label}>Position / Sort Order</label>
                            <input className="mr-fi" style={S.input} type="number" min={0} step={1}
                                value={formSortOrder} onChange={e => setFormSortOrder(e.target.value)}
                                placeholder="0 = first" />
                        </div>
                    </div>

                    {/* Slug */}
                    <div style={{ marginBottom: '1rem' }}>
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
                            background: formVisible ? 'rgba(212,168,83,0.8)' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s',
                        }}>
                            <span style={{
                                position: 'absolute', top: '3px', width: '20px', height: '20px', borderRadius: '50%',
                                background: '#fff', transition: 'left 0.2s', left: formVisible ? 'calc(100% - 23px)' : '3px',
                            }} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" style={S.btnGhost} onClick={onClose}>Cancel</button>
                        <button type="submit" style={{ ...S.btnGold, opacity: saving || !formTitle.trim() ? 0.5 : 1 }} disabled={saving || !formTitle.trim()}>
                            {saving ? 'Saving…' : mode === 'create' ? '+ Create Roll' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}

/* ── Main page ─────────────────────────────────────────────── */
export default function MovieRollsAdmin() {
    const [rolls, setRolls]     = useState<Roll[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving]   = useState(false)
    const [toast, setToast]     = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    const [modal, setModal]                   = useState<{ mode: ModalMode; roll?: Roll } | null>(null)
    const [formTitle, setFormTitle]           = useState('')
    const [formIcon, setFormIcon]             = useState('🎬')
    const [formDisplayOn, setFormDisplayOn]   = useState('both')
    const [formVisible, setFormVisible]       = useState(true)
    const [formSortOrder, setFormSortOrder]   = useState('0')
    const [formSlug, setFormSlug]             = useState('')
    const titleInputRef = useRef<HTMLInputElement | null>(null)

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
        setModal({ mode: 'create' })
        setTimeout(() => titleInputRef.current?.focus(), 100)
    }

    const openEdit = (roll: Roll) => {
        setFormTitle(roll.title); setFormIcon(roll.icon)
        setFormDisplayOn(roll.displayOn); setFormVisible(roll.visible)
        setFormSortOrder(String(roll.sortOrder)); setFormSlug(roll.slug)
        setModal({ mode: 'edit', roll })
        setTimeout(() => titleInputRef.current?.focus(), 100)
    }

    const closeModal = () => setModal(null)

    /* ── CRUD ── */
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
                        title: formTitle.trim(), icon: formIcon,
                        displayOn: formDisplayOn, visible: formVisible,
                        sortOrder: parseInt(formSortOrder) || 0,
                        slug: formSlug.trim() || undefined,
                    }),
                })
                if (!res.ok) { notify((await res.json()).error || 'Create failed', 'err'); return }
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
                if (!res.ok) { notify((await res.json()).error || 'Update failed', 'err'); return }
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

    if (loading) return (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎞️</div>
            <p style={{ fontSize: '0.85rem' }}>Loading rolls…</p>
        </div>
    )

    return (
        <>
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

            {/* Modal */}
            {modal && (
                <RollModal
                    mode={modal.mode} roll={modal.roll} saving={saving}
                    formTitle={formTitle} setFormTitle={setFormTitle}
                    formIcon={formIcon} setFormIcon={setFormIcon}
                    formDisplayOn={formDisplayOn} setFormDisplayOn={setFormDisplayOn}
                    formVisible={formVisible} setFormVisible={setFormVisible}
                    formSortOrder={formSortOrder} setFormSortOrder={setFormSortOrder}
                    formSlug={formSlug} setFormSlug={setFormSlug}
                    onClose={closeModal} onSubmit={handleSubmit}
                    titleInputRef={titleInputRef}
                />
            )}

            <div style={{ padding: '2rem 2.5rem', maxWidth: '900px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#fff' }}>🎞️ Movie Rolls</h1>
                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', margin: '5px 0 0' }}>
                            Create and order curated rows. Assign projects to rolls from the <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Projects</strong> page.
                        </p>
                    </div>
                    <button style={S.btnGold} onClick={openCreate}>+ New Roll</button>
                </div>

                {/* Tip callout */}
                <div style={{
                    padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.5rem',
                    background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.15)',
                    fontSize: '0.78rem', color: 'rgba(212,168,83,0.9)', display: 'flex', alignItems: 'flex-start', gap: '8px',
                }}>
                    <span style={{ flexShrink: 0, fontSize: '1rem' }}>💡</span>
                    <span>
                        Rolls are <strong>containers</strong>. To assign a movie to a roll, go to
                        {' '}<strong>Admin → Projects</strong>, edit the project, and select rolls from the
                        {' '}<em>Movie Rolls</em> section.
                    </span>
                </div>

                {/* Empty */}
                {rolls.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '5rem 2rem',
                        background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.08)',
                        borderRadius: '16px', color: 'rgba(255,255,255,0.3)',
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>🎞️</div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: '0 0 0.5rem' }}>No rolls yet</h3>
                        <p style={{ fontSize: '0.82rem', margin: '0 0 1.5rem' }}>Create rolls, then assign projects to them from the Projects page.</p>
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
                                {/* Position number */}
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

                                {/* Actions */}
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
        </>
    )
}
