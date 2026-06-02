'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

interface SignupItem {
    id: string; email: string; language: string; country: string | null
    createdAt: string; notifiedAt: string | null
    requestedBy: string | null; requestSource: string | null
    sourceType: string | null; sourceEntityId: string | null
    sourcePageUrl: string | null; status: string
    userId: string | null
    confirmationSentAt: string | null; confirmationInAppAt: string | null
    finalNoticeSentAt: string | null
}

interface DistItem { language?: string; country?: string; count: number }

/* ── CopyField — defined at module scope to avoid "component created during render" ── */
function CopyField({ label, field, value, onChange }: {
    label: string; field: string; value: string
    onChange: (field: string, val: string) => void
}) {
    return (
        <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                {label}
            </label>
            <input
                value={value}
                onChange={e => onChange(field, e.target.value)}
                style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)', fontSize: '0.85rem',
                }}
            />
        </div>
    )
}

export default function AdminCtaDetail() {
    const params = useParams()
    const ctaId = params.id as string

    const [cta, setCta] = useState<Record<string, unknown> | null>(null)
    const [signups, setSignups] = useState<SignupItem[]>([])
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
    const [langDist, setLangDist] = useState<DistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState('')

    // ── Dispatch state ──────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [dispatchPreview, setDispatchPreview] = useState<any>(null)
    const [showDispatch, setShowDispatch] = useState(false)
    const [dispatchLoading, setDispatchLoading] = useState(false)
    const [dispatchConfirmed, setDispatchConfirmed] = useState(false)
    const [dispatchSending, setDispatchSending] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [dispatchResult, setDispatchResult] = useState<any>(null)
    const [dispatchMessage, setDispatchMessage] = useState('')

    // Collapsible copy sections — collapsed by default so Send Notice is the focus
    const [openSections, setOpenSections] = useState({ endCard: false, modal: false, confirmation: false, postRelease: false, behavior: false })
    const toggleSection = (k: keyof typeof openSections) => setOpenSections(prev => ({ ...prev, [k]: !prev[k] }))

    const openDispatchPreview = async () => {
        if (!cta) return
        setDispatchLoading(true)
        setDispatchResult(null)
        setDispatchConfirmed(false)
        try {
            const res = await fetch(`/api/admin/notify-dispatch/preview?signupTag=${encodeURIComponent(cta.signupTag as string)}`)
            const data = await res.json()
            setDispatchPreview(data)
            setShowDispatch(true)
        } catch { setDispatchPreview(null) }
        setDispatchLoading(false)
    }

    const sendDispatch = async (dryRun: boolean) => {
        if (!cta) return
        setDispatchSending(true)
        try {
            const res = await fetch('/api/admin/notify-dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signupTag: cta.signupTag as string,
                    message: dispatchMessage,
                    dryRun,
                    confirmed: true,
                }),
            })
            const data = await res.json()
            setDispatchResult(data)
        } catch { setDispatchResult({ error: 'Network error' }) }
        setDispatchSending(false)
    }

    // Editable copy fields
    const [editFields, setEditFields] = useState<Record<string, string>>({})

    // Fetch CTA data
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch(`/api/admin/cta-configurations?status=all`)
                const data = await res.json()
                const found = (data.ctas || []).find((c: Record<string, unknown>) => c.id === ctaId)
                if (found && !cancelled) {
                    setCta(found)
                    setEditFields({
                        eyebrow: found.eyebrow || '',
                        headlineRegular: found.headlineRegular || '',
                        headlineItalic: found.headlineItalic || '',
                        subtext: found.subtext || '',
                        buttonLabel: found.buttonLabel || '',
                        footnote: found.footnote || '',
                        modalHeadline: found.modalHeadline || '',
                        modalSubtext: found.modalSubtext || '',
                        modalButtonLabel: found.modalButtonLabel || '',
                        confirmationHeadline: found.confirmationHeadline || '',
                        confirmationSubtext: found.confirmationSubtext || '',
                        releasedEyebrow: found.releasedEyebrow || '',
                        releasedHeadline: found.releasedHeadline || '',
                        releasedSubtext: found.releasedSubtext || '',
                        releasedButtonLabel: found.releasedButtonLabel || '',
                        triggerSecondsFromEnd: String(found.triggerSecondsFromEnd || 5),
                    })
                }
            } catch {}
        })()
        return () => { cancelled = true }
    }, [ctaId])

    // Fetch signups
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const qs = new URLSearchParams({ page: String(page), limit: '30', ...(search ? { search } : {}) })
                const res = await fetch(`/api/admin/cta-configurations/${ctaId}/signups?${qs}`)
                const data = await res.json()
                if (!cancelled) {
                    setSignups(data.signups || [])
                    setPagination(data.pagination || { page: 1, total: 0, totalPages: 1 })
                    setLangDist(data.distributions?.languages || [])
                }
            } catch {}
            if (!cancelled) setLoading(false)
        })()
        return () => { cancelled = true }
    }, [ctaId, page, search])

    const saveCopy = async () => {
        setSaving(true); setSaveMsg('')
        try {
            const res = await fetch('/api/admin/cta-configurations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: ctaId,
                    ...editFields,
                    triggerSecondsFromEnd: parseInt(editFields.triggerSecondsFromEnd, 10) || 5,
                }),
            })
            if (res.ok) {
                setSaveMsg('Saved!')
                setTimeout(() => setSaveMsg(''), 2000)
            } else {
                const d = await res.json()
                setSaveMsg(d.error || 'Save failed')
            }
        } catch { setSaveMsg('Network error') }
        setSaving(false)
    }

    const exportCsv = () => {
        window.open(`/api/admin/cta-configurations/${ctaId}/signups?format=csv`, '_blank')
    }

    const handleFieldChange = (field: string, val: string) => {
        setEditFields(prev => ({ ...prev, [field]: val }))
    }

    if (!cta) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>

    const project = cta.project as Record<string, string> | null

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
            <div style={{ maxWidth: '1200px' }}>
            {/* Header — Send Notice always visible here */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
                <div>
                    <Link href="/admin/notifications/ctas" style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textDecoration: 'none' }}>
                        ← Back to CTAs
                    </Link>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '8px 0 4px', color: 'var(--text-primary)' }}>
                        {project?.title || 'Unknown'} — {(cta.notificationType as string) === 'release' ? '🔔 Release' : '🔁 More'} CTA
                    </h1>
                    <code style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{cta.signupTag as string}</code>
                </div>
                {/* Send Notice — pinned to header so it's always visible */}
                <button
                    onClick={openDispatchPreview}
                    disabled={dispatchLoading}
                    style={{
                        padding: '10px 22px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700,
                        background: 'rgba(212,168,83,0.18)', border: '1px solid rgba(212,168,83,0.4)',
                        color: '#d4a853', cursor: dispatchLoading ? 'wait' : 'pointer',
                        whiteSpace: 'nowrap', flexShrink: 0, marginTop: '4px',
                    }}
                >
                    {dispatchLoading ? '⏳ Loading…' : '📨 Send Notice'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', alignItems: 'start' }}>
                {/* Left: Collapsible Copy Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {/* Section helper */}
                    {([
                        { key: 'endCard', label: 'End-Card Copy', fields: [
                            { label: 'Eyebrow', field: 'eyebrow' }, { label: 'Headline (Regular)', field: 'headlineRegular' },
                            { label: 'Headline (Italic)', field: 'headlineItalic' }, { label: 'Subtext', field: 'subtext' },
                            { label: 'Button Label', field: 'buttonLabel' }, { label: 'Footnote', field: 'footnote' },
                        ]},
                        { key: 'modal', label: 'Modal Copy', fields: [
                            { label: 'Modal Headline', field: 'modalHeadline' }, { label: 'Modal Subtext', field: 'modalSubtext' },
                            { label: 'Modal Button', field: 'modalButtonLabel' },
                        ]},
                        { key: 'confirmation', label: 'Confirmation Copy', fields: [
                            { label: 'Headline', field: 'confirmationHeadline' }, { label: 'Subtext', field: 'confirmationSubtext' },
                        ]},
                        { key: 'postRelease', label: 'Post-Release "Now Playing" Copy', fields: [
                            { label: 'Released Eyebrow', field: 'releasedEyebrow' }, { label: 'Released Headline', field: 'releasedHeadline' },
                            { label: 'Released Subtext', field: 'releasedSubtext' }, { label: 'Released Button', field: 'releasedButtonLabel' },
                        ]},
                        { key: 'behavior', label: 'Behavior', fields: [
                            { label: 'Trigger (seconds from end)', field: 'triggerSecondsFromEnd' },
                        ]},
                    ] as { key: keyof typeof openSections; label: string; fields: { label: string; field: string }[] }[]).map(section => (
                        <div key={section.key} style={{ borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                            <button type="button"
                                onClick={() => toggleSection(section.key)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{section.label}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', transition: 'transform 0.15s', display: 'inline-block', transform: openSections[section.key] ? 'rotate(180deg)' : 'none' }}>▾</span>
                            </button>
                            {openSections[section.key] && (
                                <div style={{ padding: '0 16px 16px' }}>
                                    {section.fields.map(f => (
                                        <CopyField key={f.field} label={f.label} field={f.field} value={editFields[f.field] || ''} onChange={handleFieldChange} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Save */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                        <button onClick={saveCopy} disabled={saving} style={{
                            padding: '8px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem',
                            background: 'var(--accent-gold)', border: 'none', color: '#000', cursor: 'pointer',
                        }}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        {saveMsg && <span style={{ fontSize: '0.8rem', color: saveMsg === 'Saved!' ? '#48bb78' : 'rgba(255,80,80,0.9)' }}>{saveMsg}</span>}
                    </div>
                </div>

                {/* Right: Signups */}
                <div>
                    {/* Stats cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.15)', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{pagination.total}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Total Signups</div>
                        </div>
                        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(72,187,120,0.06)', border: '1px solid rgba(72,187,120,0.15)', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#48bb78' }}>{langDist.length}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Languages</div>
                        </div>
                    </div>

                    {/* Language chips */}
                    {langDist.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>By Language</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {langDist.map(l => (
                                    <span key={l.language} style={{
                                        padding: '3px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 600,
                                        background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                                    }}>
                                        {l.language}: {l.count}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search + Export */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            placeholder="Search emails..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            style={{
                                flex: 1, padding: '8px 12px', borderRadius: '8px',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)', fontSize: '0.85rem',
                            }}
                        />
                        <button onClick={exportCsv} style={{
                            padding: '8px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                        }}>
                            📥 CSV
                        </button>
                    </div>

                    {/* Signup list */}
                    <div style={{
                        borderRadius: '10px', border: '1px solid var(--border-subtle)',
                        background: 'rgba(255,255,255,0.02)', overflow: 'hidden',
                    }}>
                        {loading ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
                        ) : signups.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No signups yet</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Email</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Lang</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>By</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Source</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Status</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {signups.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{s.email}</td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)' }}>{s.language}</td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{s.requestedBy || '—'}</td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{s.requestSource || '—'}</td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 600,
                                                    background: s.status === 'active' ? 'rgba(72,187,120,0.1)' : 'rgba(160,174,192,0.1)',
                                                    color: s.status === 'active' ? '#48bb78' : '#a0aec0',
                                                }}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                                {new Date(s.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '0.78rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)', cursor: page <= 1 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                ← Prev
                            </button>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', padding: '4px 8px' }}>
                                {page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page >= pagination.totalPages}
                                style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '0.78rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </div>


            {/* ── Dispatch Modal ───────────────────────────────────── */}
            {showDispatch && dispatchPreview && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setShowDispatch(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: 'var(--bg-elevated, #1a1d23)', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)', padding: '28px', maxWidth: '560px',
                        width: '90%', maxHeight: '80vh', overflowY: 'auto',
                    }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                            📨 Send Notice Preview
                        </h3>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '4px 0' }}>
                            {dispatchPreview.label || dispatchPreview.signupTag}
                        </div>
                        {dispatchPreview.workTitle && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', margin: '2px 0 4px' }}>
                                🎬 {dispatchPreview.workTitle}
                            </div>
                        )}
                        <code style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{dispatchPreview.signupTag}</code>

                        {dispatchPreview.totalEligible === 0 ? (
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', margin: '20px 0' }}>
                                No active unnotified requests for this source.
                            </p>
                        ) : (
                            <>
                                <div style={{ margin: '16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {[{ l: 'Eligible', v: dispatchPreview.totalEligible, c: '#48bb78' },
                                      { l: 'Skipped', v: dispatchPreview.totalSkipped, c: '#a0aec0' },
                                      { l: 'Already notified', v: dispatchPreview.alreadyNotifiedCount, c: '#63b3ed' },
                                      { l: 'Suppressed', v: dispatchPreview.suppressedCount, c: '#f56565' },
                                      { l: 'Duplicates', v: dispatchPreview.duplicateEmailCount, c: '#ed8936' },
                                      { l: 'In-app (members)', v: dispatchPreview.inAppCount, c: '#9f7aea' },
                                    ].map(item => (
                                        <div key={item.l} style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{item.l}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: item.c }}>{item.v}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Language breakdown */}
                                {Object.keys(dispatchPreview.languageBreakdown || {}).length > 0 && (
                                    <div style={{ margin: '12px 0' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Languages</div>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {Object.entries(dispatchPreview.languageBreakdown).map(([lang, count]) => (
                                                <span key={lang} style={{
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600,
                                                    background: 'rgba(159,122,234,0.1)', color: '#9f7aea',
                                                }}>
                                                    {lang}: {count as number}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Requester breakdown */}
                                {Object.keys(dispatchPreview.requestedByBreakdown || {}).length > 0 && (
                                    <div style={{ margin: '12px 0' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Requester Type</div>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {Object.entries(dispatchPreview.requestedByBreakdown).map(([type, count]) => (
                                                <span key={type} style={{
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600,
                                                    background: 'rgba(72,187,120,0.1)', color: '#48bb78',
                                                }}>
                                                    {type}: {count as number}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Sample message */}
                                <div style={{
                                    margin: '16px 0', padding: '12px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
                                }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Sample Subject</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{dispatchPreview.sampleSubject}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '8px', marginBottom: '4px' }}>Sample Body</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{dispatchPreview.sampleBody}</div>
                                </div>

                                {/* Optional admin message */}
                                <div style={{ margin: '12px 0' }}>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                                        Custom message (optional)
                                    </label>
                                    <textarea
                                        value={dispatchMessage}
                                        onChange={e => setDispatchMessage(e.target.value)}
                                        placeholder="Add an optional message to include in the notice…"
                                        rows={2}
                                        style={{
                                            width: '100%', padding: '8px 12px', borderRadius: '8px', boxSizing: 'border-box',
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                                            color: 'var(--text-primary)', fontSize: '0.82rem', resize: 'vertical',
                                        }}
                                    />
                                </div>

                                {/* Warning */}
                                <div style={{
                                    padding: '10px 14px', borderRadius: '8px', margin: '12px 0',
                                    background: 'rgba(245,101,101,0.08)', border: '1px solid rgba(245,101,101,0.2)',
                                }}>
                                    <span style={{ fontSize: '0.8rem', color: '#f56565', fontWeight: 600 }}>
                                        ⚠️ This will send emails to real users.
                                    </span>
                                </div>

                                {/* Confirmation checkbox */}
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '12px 0', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={dispatchConfirmed}
                                        onChange={e => setDispatchConfirmed(e.target.checked)}
                                    />
                                    I understand this will notify real users.
                                </label>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                    <button
                                        onClick={() => sendDispatch(true)}
                                        disabled={dispatchSending}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                                            background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.3)',
                                            color: '#63b3ed', cursor: dispatchSending ? 'wait' : 'pointer',
                                        }}
                                    >
                                        Dry Run
                                    </button>
                                    <button
                                        onClick={() => sendDispatch(false)}
                                        disabled={!dispatchConfirmed || dispatchSending}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                                            background: dispatchConfirmed ? 'rgba(212,168,83,0.2)' : 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${dispatchConfirmed ? 'rgba(212,168,83,0.4)' : 'var(--border-subtle)'}`,
                                            color: dispatchConfirmed ? '#d4a853' : 'var(--text-tertiary)',
                                            cursor: !dispatchConfirmed || dispatchSending ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        {dispatchSending ? 'Sending…' : 'Send Notice'}
                                    </button>
                                    <button
                                        onClick={() => { setShowDispatch(false); setDispatchResult(null); setDispatchConfirmed(false) }}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem',
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                                            color: 'var(--text-secondary)', cursor: 'pointer',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Dispatch result */}
                        {dispatchResult && (
                            <div style={{
                                marginTop: '16px', padding: '14px', borderRadius: '8px',
                                background: dispatchResult.error ? 'rgba(245,101,101,0.08)' : 'rgba(72,187,120,0.08)',
                                border: `1px solid ${dispatchResult.error ? 'rgba(245,101,101,0.2)' : 'rgba(72,187,120,0.2)'}`,
                            }}>
                                {dispatchResult.error ? (
                                    <div style={{ color: '#f56565', fontSize: '0.85rem', fontWeight: 600 }}>{dispatchResult.error}</div>
                                ) : (
                                    <>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: dispatchResult.dryRun ? '#63b3ed' : '#48bb78', marginBottom: '8px' }}>
                                            {dispatchResult.dryRun ? '🧪 Dry Run Complete' : '✅ Dispatch Complete'}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            <span>Sent: {dispatchResult.sentCount}</span>
                                            <span>Failed: {dispatchResult.failedCount}</span>
                                            <span>Suppressed: {dispatchResult.suppressedCount}</span>
                                            <span>Duplicates: {dispatchResult.duplicateCount}</span>
                                            <span>In-app: {dispatchResult.inAppCreated}</span>
                                        </div>
                                        {dispatchResult.unsupportedLanguages?.length > 0 && (
                                            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#ed8936' }}>
                                                ⚠ Unsupported languages (fell back to English): {dispatchResult.unsupportedLanguages.join(', ')}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            </div>
            </div>
            </main>
        </div>
    )
}
