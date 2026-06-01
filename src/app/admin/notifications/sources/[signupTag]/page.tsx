'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

// Readable labels for known signupTags
const TAG_LABELS: Record<string, string> = {
    footer_cta: 'Footer Newsletter',
    subscribe_general: 'Subscribe Page',
    casting_general: 'Casting Updates',
    training_general: 'Training Updates',
}

function getReadableLabel(tag: string): string {
    if (TAG_LABELS[tag]) return TAG_LABELS[tag]
    if (tag.startsWith('scripts_')) return 'Script Call'
    return tag
}

interface SignupItem {
    id: string; email: string; language: string; country: string | null
    requestedBy: string | null; requestSource: string | null
    sourceType: string | null; sourceEntityId: string | null
    sourcePageUrl: string | null; status: string
    userId: string | null
    confirmationSentAt: string | null; confirmationInAppAt: string | null
    notifiedAt: string | null; finalNoticeSentAt: string | null
    createdAt: string
}

interface DistItem { language?: string; country?: string; count: number }

export default function AdminSourceDetail() {
    const params = useParams()
    const signupTag = decodeURIComponent(params.signupTag as string)

    const [signups, setSignups] = useState<SignupItem[]>([])
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
    const [langDist, setLangDist] = useState<DistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

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

    const openDispatchPreview = async () => {
        setDispatchLoading(true)
        setDispatchResult(null)
        setDispatchConfirmed(false)
        try {
            const res = await fetch(`/api/admin/notify-dispatch/preview?signupTag=${encodeURIComponent(signupTag)}`)
            const data = await res.json()
            setDispatchPreview(data)
            setShowDispatch(true)
        } catch { setDispatchPreview(null) }
        setDispatchLoading(false)
    }

    const sendDispatch = async (dryRun: boolean) => {
        setDispatchSending(true)
        try {
            const res = await fetch('/api/admin/notify-dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signupTag,
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

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const qs = new URLSearchParams({ page: String(page), limit: '50', ...(search ? { search } : {}) })
                const res = await fetch(`/api/admin/notify-sources/${encodeURIComponent(signupTag)}/signups?${qs}`)
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
    }, [signupTag, page, search])

    const exportCsv = () => {
        window.open(`/api/admin/notify-sources/${encodeURIComponent(signupTag)}/signups?format=csv`, '_blank')
    }

    const label = getReadableLabel(signupTag)

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
            <div style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <Link href="/admin/notifications/ctas" style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textDecoration: 'none' }}>
                    ← Back to CTAs
                </Link>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '8px 0 4px', color: 'var(--text-primary)' }}>
                    📬 {label}
                </h1>
                <code style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{signupTag}</code>
            </div>

            {/* Stats */}
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

            {/* Signup table */}
            <div style={{
                borderRadius: '10px', border: '1px solid var(--border-subtle)',
                background: 'rgba(255,255,255,0.02)', overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
                ) : signups.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No signups yet</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Email</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Lang</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Country</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>By</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Source</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Type</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem' }}>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signups.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{s.email}</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)' }}>{s.language}</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)' }}>{s.country || '—'}</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{s.requestedBy || '—'}</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{s.requestSource || '—'}</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{s.sourceType || '—'}</td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 600,
                                            background: s.status === 'active' ? 'rgba(72,187,120,0.1)' : 'rgba(160,174,192,0.1)',
                                            color: s.status === 'active' ? '#48bb78' : '#a0aec0',
                                        }}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                        {new Date(s.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
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

            {/* ── Send Notice Section ──────────────────────────────── */}
            <div style={{
                marginTop: '32px', padding: '20px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
            }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                    📨 Send Notice
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
                    Send an availability notice to all active, unnotified signups for &ldquo;{label}&rdquo;.
                </p>
                <button
                    onClick={openDispatchPreview}
                    disabled={dispatchLoading}
                    style={{
                        padding: '8px 20px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                        background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.3)',
                        color: '#d4a853', cursor: dispatchLoading ? 'wait' : 'pointer',
                    }}
                >
                    {dispatchLoading ? 'Loading preview…' : 'Send Notice'}
                </button>
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

                                <div style={{
                                    margin: '16px 0', padding: '12px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
                                }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Sample Subject</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{dispatchPreview.sampleSubject}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '8px', marginBottom: '4px' }}>Sample Body</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{dispatchPreview.sampleBody}</div>
                                </div>

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

                                <div style={{
                                    padding: '10px 14px', borderRadius: '8px', margin: '12px 0',
                                    background: 'rgba(245,101,101,0.08)', border: '1px solid rgba(245,101,101,0.2)',
                                }}>
                                    <span style={{ fontSize: '0.8rem', color: '#f56565', fontWeight: 600 }}>
                                        ⚠️ This will send emails to real users.
                                    </span>
                                </div>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '12px 0', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={dispatchConfirmed}
                                        onChange={e => setDispatchConfirmed(e.target.checked)}
                                    />
                                    I understand this will notify real users.
                                </label>

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

            </main>
        </div>
    )
}
