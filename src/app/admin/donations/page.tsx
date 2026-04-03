'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'


interface DonationRow { id: string; name: string; email: string; amount: number; method: string; status: string; anonymous: boolean; project: string; createdAt: string }
interface Pagination { page: number; limit: number; total: number; totalPages: number }

export default function AdminDonationsPage() {
    const [donations, setDonations] = useState<DonationRow[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 })
    const [stats, setStats] = useState({ totalRaised: 0, count: 0, avgAmount: 0, uniqueDonors: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')
    const [sort, setSort] = useState('newest')
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

    const fetchDonations = useCallback(async (page = 1) => {
        setLoading(true)
        const params = new URLSearchParams({ page: String(page), limit: '25', sort })
        if (search) params.set('search', search)
        if (status !== 'all') params.set('status', status)
        const res = await fetch(`/api/admin/donations?${params}`)
        if (res.ok) {
            const data = await res.json()
            setDonations(data.donations); setPagination(data.pagination); setStats(data.stats)
        }
        setLoading(false)
    }, [search, status, sort])

    useEffect(() => { fetchDonations(1) }, [fetchDonations])

    const handleSearch = (val: string) => {
        setSearch(val)
        if (searchTimeout) clearTimeout(searchTimeout)
        setSearchTimeout(setTimeout(() => fetchDonations(1), 300))
    }

    const inp: React.CSSProperties = {
        padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
        color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 16px' }}>💰 Donations</h1>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                    {[
                        { label: 'Total Raised', value: `$${stats.totalRaised.toLocaleString()}`, color: 'var(--accent-gold)', icon: '💰' },
                        { label: 'Donations', value: stats.count.toLocaleString(), color: '#34d399', icon: '🎁' },
                        { label: 'Avg Amount', value: `$${stats.avgAmount}`, color: '#60a5fa', icon: '📊' },
                        { label: 'Unique Donors', value: stats.uniqueDonors.toLocaleString(), color: '#a78bfa', icon: '🧑' },
                    ].map(s => (
                        <div key={s.label} style={{ padding: '12px', borderRadius: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.9rem' }}>{s.icon}</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Search + Filters */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <input style={{ ...inp, flex: 1, minWidth: '180px' }} placeholder="🔍 Search by donor name or email..." value={search} onChange={e => handleSearch(e.target.value)} />
                    <select style={inp} value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                    </select>
                    <select style={inp} value={sort} onChange={e => setSort(e.target.value)}>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="amount_high">Highest Amount</option>
                        <option value="amount_low">Lowest Amount</option>
                    </select>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{pagination.total.toLocaleString()} result{pagination.total !== 1 ? 's' : ''}</span>
                </div>

                {/* Table */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
                ) : donations.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '2rem', opacity: 0.3, marginBottom: '8px' }}>💰</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{search ? 'No donations match your search' : 'No donations yet'}</div>
                    </div>
                ) : (
                    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    {['Donor', 'Amount', 'Project', 'Method', 'Status', 'Date'].map(h => (
                                        <th key={h} style={{ padding: '8px 12px', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {donations.map((d, i) => (
                                    <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                        <td style={{ padding: '8px 12px' }}>
                                            <div style={{ fontWeight: 600 }}>{d.anonymous ? '🤫 Anonymous' : d.name}</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{d.email}</div>
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--accent-gold)' }}>${d.amount.toFixed(2)}</td>
                                        <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{d.project}</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span style={{ fontSize: '0.58rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', textTransform: 'capitalize' }}>{d.method}</span>
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span style={{
                                                fontSize: '0.58rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
                                                background: d.status === 'completed' ? 'rgba(34,197,94,0.1)' : d.status === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                color: d.status === 'completed' ? '#22c55e' : d.status === 'pending' ? '#f59e0b' : '#ef4444',
                                            }}>{d.status}</span>
                                        </td>
                                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                            {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '16px' }}>
                        <button disabled={pagination.page <= 1} onClick={() => fetchDonations(pagination.page - 1)} style={{ ...inp, cursor: pagination.page > 1 ? 'pointer' : 'not-allowed', opacity: pagination.page <= 1 ? 0.3 : 1 }}>← Prev</button>
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
                            const p = start + i
                            if (p > pagination.totalPages) return null
                            return (
                                <button key={p} onClick={() => fetchDonations(p)} style={{
                                    ...inp, minWidth: '34px', textAlign: 'center', cursor: 'pointer',
                                    fontWeight: p === pagination.page ? 800 : 400,
                                    background: p === pagination.page ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)',
                                    color: p === pagination.page ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                }}>{p}</button>
                            )
                        })}
                        <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchDonations(pagination.page + 1)} style={{ ...inp, cursor: pagination.page < pagination.totalPages ? 'pointer' : 'not-allowed', opacity: pagination.page >= pagination.totalPages ? 0.3 : 1 }}>Next →</button>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: '8px' }}>Page {pagination.page} of {pagination.totalPages.toLocaleString()}</span>
                    </div>
                )}
            </main>
        </div>
    )
}
