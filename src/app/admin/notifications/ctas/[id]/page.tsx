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
            <div style={{ maxWidth: '1100px' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <Link href="/admin/notifications/ctas" style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textDecoration: 'none' }}>
                    ← Back to CTAs
                </Link>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '8px 0 4px', color: 'var(--text-primary)' }}>
                    {project?.title || 'Unknown'} — {(cta.notificationType as string) === 'release' ? '🔔 Release' : '🔁 More'} CTA
                </h1>
                <code style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{cta.signupTag as string}</code>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left: Copy Editor */}
                <div>
                    <div style={{
                        padding: '20px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                    }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
                            End-Card Copy
                        </h3>
                        <CopyField label="Eyebrow" field="eyebrow" value={editFields.eyebrow || ''} onChange={handleFieldChange} />
                        <CopyField label="Headline (Regular)" field="headlineRegular" value={editFields.headlineRegular || ''} onChange={handleFieldChange} />
                        <CopyField label="Headline (Italic)" field="headlineItalic" value={editFields.headlineItalic || ''} onChange={handleFieldChange} />
                        <CopyField label="Subtext" field="subtext" value={editFields.subtext || ''} onChange={handleFieldChange} />
                        <CopyField label="Button Label" field="buttonLabel" value={editFields.buttonLabel || ''} onChange={handleFieldChange} />
                        <CopyField label="Footnote" field="footnote" value={editFields.footnote || ''} onChange={handleFieldChange} />

                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '20px 0 12px', color: 'var(--text-primary)' }}>
                            Modal Copy
                        </h3>
                        <CopyField label="Modal Headline" field="modalHeadline" value={editFields.modalHeadline || ''} onChange={handleFieldChange} />
                        <CopyField label="Modal Subtext" field="modalSubtext" value={editFields.modalSubtext || ''} onChange={handleFieldChange} />
                        <CopyField label="Modal Button" field="modalButtonLabel" value={editFields.modalButtonLabel || ''} onChange={handleFieldChange} />

                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '20px 0 12px', color: 'var(--text-primary)' }}>
                            Confirmation Copy
                        </h3>
                        <CopyField label="Headline" field="confirmationHeadline" value={editFields.confirmationHeadline || ''} onChange={handleFieldChange} />
                        <CopyField label="Subtext" field="confirmationSubtext" value={editFields.confirmationSubtext || ''} onChange={handleFieldChange} />

                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '20px 0 12px', color: 'var(--text-primary)' }}>
                            Post-Release &quot;Now Playing&quot; Copy
                        </h3>
                        <CopyField label="Released Eyebrow" field="releasedEyebrow" value={editFields.releasedEyebrow || ''} onChange={handleFieldChange} />
                        <CopyField label="Released Headline" field="releasedHeadline" value={editFields.releasedHeadline || ''} onChange={handleFieldChange} />
                        <CopyField label="Released Subtext" field="releasedSubtext" value={editFields.releasedSubtext || ''} onChange={handleFieldChange} />
                        <CopyField label="Released Button" field="releasedButtonLabel" value={editFields.releasedButtonLabel || ''} onChange={handleFieldChange} />

                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '20px 0 12px', color: 'var(--text-primary)' }}>
                            Behavior
                        </h3>
                        <CopyField label="Trigger (seconds from end)" field="triggerSecondsFromEnd" value={editFields.triggerSecondsFromEnd || ''} onChange={handleFieldChange} />

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
                            <button onClick={saveCopy} disabled={saving} style={{
                                padding: '8px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem',
                                background: 'var(--accent-gold)', border: 'none', color: '#000', cursor: 'pointer',
                            }}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            {saveMsg && <span style={{ fontSize: '0.8rem', color: saveMsg === 'Saved!' ? '#48bb78' : 'rgba(255,80,80,0.9)' }}>{saveMsg}</span>}
                        </div>
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
            </div>
            </div>
            </main>
        </div>
    )
}
