'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { locales, localeNames } from '@/i18n/routing'


interface UserRow { id: string; name: string; email: string; role: string; applications: number; donations: number; createdAt: string; preferredLanguage: string; authProvider: 'email' | 'google' | 'apple' | 'multiple' }
interface Pagination { page: number; limit: number; total: number; totalPages: number }

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserRow[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 })
    const [stats, setStats] = useState({ total: 0, members: 0, admins: 0, superadmins: 0, withApplications: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('all')
    const [language, setLanguage] = useState('all')
    const [sort, setSort] = useState('newest')
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const fetchUsers = useCallback(async (page = 1) => {
        setLoading(true)
        setSelected(new Set())
        const params = new URLSearchParams({ page: String(page), limit: '25', sort })
        if (search) params.set('search', search)
        if (role !== 'all') params.set('role', role)
        if (language !== 'all') params.set('language', language)
        const res = await fetch(`/api/admin/users?${params}`)
        if (res.ok) {
            const data = await res.json()
            setUsers(data.users); setPagination(data.pagination); setStats(data.stats)
        }
        setLoading(false)
    }, [search, role, language, sort])

    useEffect(() => { fetchUsers(1) }, [fetchUsers])

    const handleSearch = (val: string) => {
        setSearch(val)
        if (searchTimeout) clearTimeout(searchTimeout)
        setSearchTimeout(setTimeout(() => fetchUsers(1), 300))
    }

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (selected.size === users.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(users.map(u => u.id)))
        }
    }

    const handleBulkDelete = async () => {
        if (selected.size === 0) return
        setDeleting(true)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selected) }),
            })
            const data = await res.json()
            if (res.ok) {
                setConfirmDelete(false)
                await fetchUsers(pagination.page)
                alert(`Deleted ${data.deleted} user${data.deleted !== 1 ? 's' : ''} successfully.`)
            } else {
                alert(`Error: ${data.error}`)
            }
        } catch {
            alert('Network error. Please try again.')
        }
        setDeleting(false)
    }

    const inp: React.CSSProperties = {
        padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
        color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
    }

    // Separate deletable from protected (superadmins)
    const deletableSelected = Array.from(selected).filter(id => {
        const u = users.find(u => u.id === id)
        return u && u.role !== 'superadmin'
    })

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 16px' }}>👥 Users</h1>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                    {[
                        { label: 'Total Users', value: stats.total, color: 'var(--accent-gold)', icon: '👥' },
                        { label: 'Members', value: stats.members, color: '#34d399', icon: '🧑' },
                        { label: 'Power Admins', value: stats.admins, color: '#f59e0b', icon: '⚡' },
                        { label: 'Super Admins', value: stats.superadmins, color: '#ef4444', icon: '🔱' },
                        { label: 'With Apps', value: stats.withApplications, color: '#60a5fa', icon: '📋' },
                    ].map(s => (
                        <div key={s.label} style={{
                            padding: '12px', borderRadius: '10px', textAlign: 'center',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <div style={{ fontSize: '0.9rem' }}>{s.icon}</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</div>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Search + Filters */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <input
                        style={{ ...inp, flex: 1, minWidth: '180px' }}
                        placeholder="🔍 Search by name or email..."
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                    />
                    <select style={inp} value={role} onChange={e => { setRole(e.target.value) }}>
                        <option value="all">All Roles</option>
                        <option value="member">Members</option>
                        <option value="admin">Power Admins</option>
                        <option value="superadmin">Super Admins</option>
                    </select>
                    <select style={inp} value={language} onChange={e => { setLanguage(e.target.value) }}>
                        <option value="all">All Languages</option>
                        {locales.map(loc => (
                            <option key={loc} value={loc}>{localeNames[loc]} ({loc.toUpperCase()})</option>
                        ))}
                    </select>
                    <select style={inp} value={sort} onChange={e => { setSort(e.target.value) }}>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="name">Name A-Z</option>
                    </select>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                        {pagination.total.toLocaleString()} result{pagination.total !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Bulk Action Toolbar */}
                {selected.size > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '10px', marginBottom: '12px',
                    }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ef4444' }}>
                            {selected.size} user{selected.size !== 1 ? 's' : ''} selected
                            {deletableSelected.length < selected.size && (
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                                    {' '}({selected.size - deletableSelected.length} superadmin{(selected.size - deletableSelected.length) !== 1 ? 's' : ''} protected)
                                </span>
                            )}
                        </span>
                        <div style={{ flex: 1 }} />
                        <button
                            onClick={() => setSelected(new Set())}
                            style={{ ...inp, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                        >
                            Clear Selection
                        </button>
                        <button
                            onClick={() => setConfirmDelete(true)}
                            disabled={deletableSelected.length === 0}
                            style={{
                                padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: deletableSelected.length === 0 ? 'not-allowed' : 'pointer',
                                background: deletableSelected.length === 0 ? 'rgba(239,68,68,0.2)' : '#ef4444',
                                color: 'white', fontWeight: 700, fontSize: '0.8rem', opacity: deletableSelected.length === 0 ? 0.5 : 1,
                            }}
                        >
                            🗑 Delete {deletableSelected.length > 0 ? `${deletableSelected.length} ` : ''}User{deletableSelected.length !== 1 ? 's' : ''}
                        </button>
                    </div>
                )}

                {/* Confirm Delete Modal */}
                {confirmDelete && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '8px' }}>Confirm Bulk Delete</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
                                You are about to permanently delete <strong style={{ color: '#ef4444' }}>{deletableSelected.length} user{deletableSelected.length !== 1 ? 's' : ''}</strong>.
                                This will also remove all their applications, donations, and data. This cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    style={{ ...inp, cursor: 'pointer', padding: '10px 24px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={deleting}
                                    style={{
                                        padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer',
                                        background: '#ef4444', color: 'white', fontWeight: 700, fontSize: '0.9rem',
                                        opacity: deleting ? 0.7 : 1,
                                    }}
                                >
                                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
                ) : users.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '2rem', opacity: 0.3, marginBottom: '8px' }}>👥</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {search ? 'No users match your search' : 'No registered users yet'}
                        </div>
                    </div>
                ) : (
                    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <th style={{ padding: '8px 12px', width: '36px' }}>
                                        <input
                                            type="checkbox"
                                            checked={users.length > 0 && selected.size === users.length}
                                            onChange={toggleAll}
                                            style={{ cursor: 'pointer', accentColor: 'var(--accent-gold)', width: '14px', height: '14px' }}
                                        />
                                    </th>
                                    {['Name', 'Email', 'Role', 'Via', 'Apps', 'Donations', 'Joined', 'Language'].map(h => (
                                        <th key={h} style={{ padding: '8px 12px', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', textAlign: 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, i) => {
                                    const isSelected = selected.has(u.id)
                                    const isSuperAdmin = u.role === 'superadmin'
                                    return (
                                        <tr key={u.id} style={{
                                            borderTop: '1px solid rgba(255,255,255,0.04)',
                                            background: isSelected
                                                ? 'rgba(239,68,68,0.06)'
                                                : i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                            transition: 'background 0.15s',
                                        }}>
                                            <td style={{ padding: '8px 12px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleOne(u.id)}
                                                    disabled={isSuperAdmin}
                                                    title={isSuperAdmin ? 'Superadmins cannot be bulk deleted' : undefined}
                                                    style={{ cursor: isSuperAdmin ? 'not-allowed' : 'pointer', opacity: isSuperAdmin ? 0.3 : 1, accentColor: '#ef4444', width: '14px', height: '14px' }}
                                                />
                                            </td>
                                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{u.name}</td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{u.email}</td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <span style={{
                                                    fontSize: '0.58rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700,
                                                    background: u.role === 'superadmin' ? 'rgba(239,68,68,0.12)'
                                                        : u.role === 'admin' ? 'rgba(212,168,83,0.1)' : 'rgba(59,130,246,0.1)',
                                                    color: u.role === 'superadmin' ? '#ef4444'
                                                        : u.role === 'admin' ? 'var(--accent-gold)' : '#60a5fa',
                                                    border: `1px solid ${u.role === 'superadmin' ? 'rgba(239,68,68,0.25)'
                                                        : u.role === 'admin' ? 'rgba(212,168,83,0.2)' : 'rgba(59,130,246,0.2)'}`,
                                                }}>{u.role === 'superadmin' ? '🔱 Super Admin' : u.role === 'admin' ? '⚡ Power Admin' : 'Member'}</span>
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                {u.authProvider === 'google' && (
                                                    <span title="Signed up via Google" style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        fontSize: '0.6rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 700,
                                                        background: 'rgba(66,133,244,0.1)', color: '#4285F4',
                                                        border: '1px solid rgba(66,133,244,0.25)',
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                                        Google
                                                    </span>
                                                )}
                                                {u.authProvider === 'apple' && (
                                                    <span title="Signed up via Apple" style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        fontSize: '0.6rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 700,
                                                        background: 'rgba(255,255,255,0.07)', color: '#e5e5e5',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                    }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.4-3.74 4.25z"/></svg>
                                                        Apple
                                                    </span>
                                                )}
                                                {u.authProvider === 'email' && (
                                                    <span title="Signed up with email & password" style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        fontSize: '0.6rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 700,
                                                        background: 'rgba(212,168,83,0.1)', color: 'var(--accent-gold)',
                                                        border: '1px solid rgba(212,168,83,0.2)',
                                                    }}>
                                                        ✉ Email
                                                    </span>
                                                )}
                                                {u.authProvider === 'multiple' && (
                                                    <span title="Linked email + OAuth" style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        fontSize: '0.6rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 700,
                                                        background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                                                        border: '1px solid rgba(139,92,246,0.2)',
                                                    }}>
                                                        🔗 Multi
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>{u.applications}</td>
                                            <td style={{ padding: '8px 12px' }}>{u.donations}</td>
                                            <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                {u.preferredLanguage?.toUpperCase() || 'EN'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '16px' }}>
                        <button disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)}
                            style={{ ...inp, cursor: pagination.page > 1 ? 'pointer' : 'not-allowed', opacity: pagination.page <= 1 ? 0.3 : 1 }}>Prev</button>
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
                            const p = start + i
                            if (p > pagination.totalPages) return null
                            return (
                                <button key={p} onClick={() => fetchUsers(p)} style={{
                                    ...inp, minWidth: '34px', textAlign: 'center', cursor: 'pointer', fontWeight: p === pagination.page ? 800 : 400,
                                    background: p === pagination.page ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)',
                                    color: p === pagination.page ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                    borderColor: p === pagination.page ? 'rgba(212,168,83,0.3)' : 'rgba(255,255,255,0.08)',
                                }}>{p}</button>
                            )
                        })}
                        <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchUsers(pagination.page + 1)}
                            style={{ ...inp, cursor: pagination.page < pagination.totalPages ? 'pointer' : 'not-allowed', opacity: pagination.page >= pagination.totalPages ? 0.3 : 1 }}>Next</button>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                            Page {pagination.page} of {pagination.totalPages.toLocaleString()}
                        </span>
                    </div>
                )}
            </main>
        </div>
    )
}
