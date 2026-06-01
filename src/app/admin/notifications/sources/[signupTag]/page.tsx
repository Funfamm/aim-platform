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
            </main>
        </div>
    )
}
