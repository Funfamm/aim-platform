'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import Footer from '@/components/Footer'
import CinematicBackground from '@/components/CinematicBackground'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import ProfileTab from '@/components/dashboard/ProfileTab'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import DashboardStats from '@/components/dashboard/DashboardStats'
import TabNavigation, { type TabType } from '@/components/dashboard/TabNavigation'
import EmptyState from '@/components/dashboard/EmptyState'
import { useTranslations, useLocale } from 'next-intl'

interface ApplicationData {
    id: string
    fullName: string
    status: string
    statusNote: string | null
    createdAt: string
    castingCall: {
        roleName: string
        roleType: string
        project: { title: string; slug: string }
    }
}

interface WatchlistItem {
    id: string
    createdAt: string
    project: {
        id: string; title: string; slug: string
        coverImage: string | null; genre: string | null
        status: string; tagline: string
    }
}

interface HistoryItem {
    id: string
    watchedAt: string
    progress: number
    project: {
        id: string; title: string; slug: string
        coverImage: string | null; genre: string | null
        duration: string | null
    }
}

interface DonationItem {
    id: string
    name: string
    amount: number
    message: string | null
    anonymous: boolean
    method: string
    status: string
    createdAt: string
}

function getStatusConfig(t: (key: string) => string): Record<string, { label: string; color: string; bg: string }> {
    return {
        'pending': { label: `📩 ${t('statusSubmitted')}`, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        'submitted': { label: `📩 ${t('statusSubmitted')}`, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        'under-review': { label: `🔍 ${t('statusUnderReview')}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        'reviewed': { label: `🔍 ${t('statusUnderReview')}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        'shortlisted': { label: `⭐ ${t('statusShortlisted')}`, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        'contacted': { label: `✉️ ${t('statusContacted')}`, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
        'final-review': { label: `🎯 ${t('statusFinalReview')}`, color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
        'approved': { label: `✅ ${t('statusApproved')}`, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
        'selected': { label: `✅ ${t('statusSelected')}`, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
        'rejected': { label: t('statusNotSelected'), color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
        'not-selected': { label: t('statusNotSelected'), color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
    }
}

// Pagination state type
interface PaginationState {
    appsCursor: string | null; appsHasMore: boolean
    watchCursor: string | null; watchHasMore: boolean
    historyCursor: string | null; historyHasMore: boolean
    donationsCursor: string | null; donationsHasMore: boolean
    loadingMore: string | null // which tab is loading more
}

export default function DashboardPage() {
    const { user, loading, refreshUser } = useAuth()
    const router = useRouter()
    const t = useTranslations('dashboard')
    const locale = useLocale()
    const STATUS_CONFIG = getStatusConfig(t)
    const [applications, setApplications] = useState<ApplicationData[]>([])
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [donations, setDonations] = useState<DonationItem[]>([])
    const [loadingApps, setLoadingApps] = useState(true)
    const [loadingWatchlist, setLoadingWatchlist] = useState(true)
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [loadingDonations, setLoadingDonations] = useState(true)
    const [activeTab, setActiveTab] = useState<TabType>('applications')
    const [pagination, setPagination] = useState<PaginationState>({
        appsCursor: null, appsHasMore: false,
        watchCursor: null, watchHasMore: false,
        historyCursor: null, historyHasMore: false,
        donationsCursor: null, donationsHasMore: false,
        loadingMore: null,
    })

    useEffect(() => {
        if (!loading && !user) router.push('/login')
    }, [user, loading, router])

    useEffect(() => {
        if (!user) return
        fetch(`/api/dashboard/applications?locale=${locale}`).then(r => r.json())
            .then(data => {
                setApplications(data.applications || [])
                setPagination(p => ({ ...p, appsCursor: data.nextCursor, appsHasMore: data.hasMore ?? false }))
                setLoadingApps(false)
            })
            .catch(() => setLoadingApps(false))
        fetch('/api/dashboard/watchlist').then(r => r.json())
            .then(data => {
                setWatchlist(data.watchlist || [])
                setPagination(p => ({ ...p, watchCursor: data.nextCursor, watchHasMore: data.hasMore ?? false }))
                setLoadingWatchlist(false)
            })
            .catch(() => setLoadingWatchlist(false))
        fetch('/api/dashboard/history').then(r => r.json())
            .then(data => {
                setHistory(data.history || [])
                setPagination(p => ({ ...p, historyCursor: data.nextCursor, historyHasMore: data.hasMore ?? false }))
                setLoadingHistory(false)
            })
            .catch(() => setLoadingHistory(false))
        fetch('/api/dashboard/donations').then(r => r.json())
            .then(data => {
                setDonations(data.donations || [])
                setPagination(p => ({ ...p, donationsCursor: data.nextCursor, donationsHasMore: data.hasMore ?? false }))
                setLoadingDonations(false)
            })
            .catch(() => setLoadingDonations(false))
    }, [user])

    const loadMore = useCallback(async (tab: 'applications' | 'watchlist' | 'history' | 'donations') => {
        const cursorMap = { applications: pagination.appsCursor, watchlist: pagination.watchCursor, history: pagination.historyCursor, donations: pagination.donationsCursor }
        const cursor = cursorMap[tab]
        if (!cursor) return
        setPagination(p => ({ ...p, loadingMore: tab }))
        try {
            const res = await fetch(`/api/dashboard/${tab}?cursor=${cursor}`)
            const data = await res.json()
            if (tab === 'applications') {
                setApplications(prev => [...prev, ...(data.applications || [])])
                setPagination(p => ({ ...p, appsCursor: data.nextCursor, appsHasMore: data.hasMore ?? false, loadingMore: null }))
            } else if (tab === 'watchlist') {
                setWatchlist(prev => [...prev, ...(data.watchlist || [])])
                setPagination(p => ({ ...p, watchCursor: data.nextCursor, watchHasMore: data.hasMore ?? false, loadingMore: null }))
            } else if (tab === 'history') {
                setHistory(prev => [...prev, ...(data.history || [])])
                setPagination(p => ({ ...p, historyCursor: data.nextCursor, historyHasMore: data.hasMore ?? false, loadingMore: null }))
            } else {
                setDonations(prev => [...prev, ...(data.donations || [])])
                setPagination(p => ({ ...p, donationsCursor: data.nextCursor, donationsHasMore: data.hasMore ?? false, loadingMore: null }))
            }
        } catch { setPagination(p => ({ ...p, loadingMore: null })) }
    }, [pagination.appsCursor, pagination.watchCursor, pagination.historyCursor, pagination.donationsCursor])

    if (loading || !user) {
        return (
            <><main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'var(--text-tertiary)' }}>{t('loading')}</div>
            </main></>
        )
    }

    const totalDonated = donations.reduce((s, d) => s + d.amount, 0)

    const printReceipt = (d: DonationItem) => {
        const w = window.open('', '_blank', 'width=500,height=600')
        if (!w) return
        w.document.write(`
            <html><head><title>Donation Receipt</title>
            <style>body{font-family:system-ui,sans-serif;padding:40px;color:#1a1a2e;max-width:460px;margin:0 auto}
            h1{font-size:20px;margin-bottom:4px}h2{font-size:14px;color:#666;font-weight:400;margin-bottom:24px}
            .line{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px}
            .line span:first-child{color:#888}.line span:last-child{font-weight:600}
            .total{font-size:24px;font-weight:800;color:#d4a853;text-align:center;margin:20px 0}
            .footer{text-align:center;margin-top:30px;font-size:11px;color:#aaa}
            .id{font-family:monospace;font-size:11px;color:#999;text-align:center;margin-bottom:16px}
            hr{border:none;border-top:2px solid #d4a853;margin:16px 0}
            @media print{button{display:none !important}}
            </style></head><body>
            <h1>🎬 Donation Receipt</h1>
            <h2>Thank you for your support</h2>
            <hr/>
            <div class="id">Receipt #${d.id.slice(0, 12).toUpperCase()}</div>
            <div class="line"><span>Date</span><span>${new Date(d.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
            <div class="line"><span>Donor</span><span>${d.anonymous ? 'Anonymous' : d.name}</span></div>
            <div class="line"><span>Method</span><span style="text-transform:capitalize">${d.method}</span></div>
            <div class="line"><span>Status</span><span style="text-transform:capitalize">${d.status}</span></div>
            ${d.message ? `<div class="line"><span>Message</span><span>${d.message}</span></div>` : ''}
            <div class="total">$${d.amount.toFixed(2)}</div>
            <hr/>
            <div class="footer">This receipt confirms your generous contribution.<br/>100% goes toward bringing stories to life. 🎥</div>
            <div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 24px;font-size:13px;font-weight:600;background:#d4a853;color:#000;border:none;border-radius:6px;cursor:pointer">🖨️ Print Receipt</button></div>
            </body></html>
        `)
        w.document.close()
    }

    const tabs: { key: TabType; label: string; icon: string; count?: number }[] = [
        { key: 'applications', label: t('applications'), icon: '📋', count: applications.length },
        { key: 'watchlist', label: t('watchlist'), icon: '🎬', count: watchlist.length },
        { key: 'activity', label: t('watchHistory'), icon: '📺', count: history.length },
        { key: 'donations', label: t('donations'), icon: '💛', count: donations.length },
        { key: 'profile', label: t('profile'), icon: '👤' },
    ]

    const loadMoreStyle: React.CSSProperties = {
        display: 'block', width: '100%', marginTop: 'var(--space-md)',
        padding: '0.7rem', fontSize: '0.8rem', fontWeight: 600,
        background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)',
        borderRadius: 'var(--radius-lg)', color: 'var(--accent-gold)',
        cursor: 'pointer', transition: 'all 0.2s',
    }

    return (
        <>
<CinematicBackground variant="dashboard" />
            <main style={{ paddingTop: 'calc(80px + var(--space-2xl))' }}>
                <div className="container" style={{ maxWidth: '900px', paddingBottom: 'var(--space-5xl)' }}>
                    {/* Header with Banner — Next.js Image optimized */}
                    <DashboardHeader userName={user.name} bannerUrl={user.bannerUrl} />

                    {/* Stats Row */}
                    <ScrollReveal3D direction="up" delay={100} distance={20}>
                        <DashboardStats
                            applications={applications.length}
                            saved={watchlist.length}
                            watched={history.length}
                            donated={donations.reduce((sum, d) => sum + (d.amount || 0), 0)}
                        />
                    </ScrollReveal3D>

                    {/* Tabs */}
                    <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />

                    {/* Tab Content */}
                    {activeTab === 'applications' && (
                        <>
                            {loadingApps ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>{t('loadingApps')}</div>
                            ) : applications.length === 0 ? (
                                <EmptyState icon="🎭" title={t('noAppsTitle')} desc={t('noAppsDesc')} linkHref="/casting#roles" linkText={t('noAppsCta')} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {applications.map((app, i) => {
                                        const statusInfo = STATUS_CONFIG[app.status] || STATUS_CONFIG['submitted']
                                        return (
                                            <ScrollReveal3D key={app.id} direction="up" delay={250 + i * 60} distance={15}>
                                                <div style={{
                                                    background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
                                                    borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)',
                                                }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: '4px' }}>
                                                            <Link href={`/works/${app.castingCall.project.slug}`} style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>
                                                                {app.castingCall.project.title}
                                                            </Link>
                                                            <span style={{ fontSize: '0.65rem', padding: '2px 8px', background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.15)', borderRadius: 'var(--radius-full)', color: 'var(--accent-gold)', fontWeight: 600, textTransform: 'uppercase' as const }}>{app.castingCall.roleType}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('role')}: <strong>{app.castingCall.roleName}</strong></div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{t('applied')} {new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                        {app.statusNote && (
                                                            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(228,185,90,0.06)', borderLeft: '2px solid var(--accent-gold)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                                                                {app.statusNote}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ padding: '0.35rem 0.9rem', background: statusInfo.bg, border: `1px solid ${statusInfo.color}30`, borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600, color: statusInfo.color, whiteSpace: 'nowrap' }}>
                                                        {statusInfo.label}
                                                    </div>
                                                </div>
                                            </ScrollReveal3D>
                                        )
                                    })}
                                    {pagination.appsHasMore && (
                                        <button onClick={() => loadMore('applications')} disabled={pagination.loadingMore === 'applications'} style={loadMoreStyle}>
                                            {pagination.loadingMore === 'applications' ? t('loading') : t('loadMoreApps')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'watchlist' && (
                        <>
                            {loadingWatchlist ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>{t('loadingWatchlist')}</div>
                            ) : watchlist.length === 0 ? (
                                <EmptyState icon="🎬" title={t('noWatchTitle')} desc={t('noWatchDesc')} linkHref="/works" linkText={t('noWatchCta')} />
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-md)' }}>
                                    {watchlist.map((item, i) => (
                                        <ScrollReveal3D key={item.id} direction="up" delay={250 + i * 60} distance={15}>
                                            <Link href={`/works/${item.project.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                                                <div style={{
                                                    background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
                                                    borderRadius: 'var(--radius-lg)', overflow: 'hidden', transition: 'all 0.3s',
                                                }}>
                                                    <div style={{
                                                        height: '140px',
                                                        backgroundImage: item.project.coverImage ? `url(${item.project.coverImage})` : 'linear-gradient(135deg, rgba(212,168,83,0.1), rgba(212,168,83,0.02))',
                                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                                    }} />
                                                    <div style={{ padding: 'var(--space-md)' }}>
                                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>{item.project.title}</h4>
                                                        {item.project.tagline && <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '8px', lineHeight: 1.4 }}>{item.project.tagline.slice(0, 80)}</p>}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {item.project.genre && <span style={{ fontSize: '0.6rem', padding: '2px 8px', background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.15)', borderRadius: 'var(--radius-full)', color: 'var(--accent-gold)' }}>{item.project.genre}</span>}
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{t('saved')} {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </ScrollReveal3D>
                                    ))}
                                    {pagination.watchHasMore && (
                                        <button onClick={() => loadMore('watchlist')} disabled={pagination.loadingMore === 'watchlist'} style={loadMoreStyle}>
                                            {pagination.loadingMore === 'watchlist' ? t('loading') : t('loadMore')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'activity' && (
                        <>
                            {loadingHistory ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>{t('loadingHistory')}</div>
                            ) : history.length === 0 ? (
                                <EmptyState icon="📺" title={t('noHistoryTitle')} desc={t('noHistoryDesc')} linkHref="/works" linkText={t('noHistoryCta')} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {history.map((item, i) => (
                                        <ScrollReveal3D key={item.id} direction="up" delay={250 + i * 60} distance={15}>
                                            <Link href={`/works/${item.project.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                                                <div style={{
                                                    background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
                                                    borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)',
                                                    display: 'flex', gap: 'var(--space-md)', alignItems: 'center',
                                                }}>
                                                    <div style={{
                                                        width: '100px', height: '60px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                                                        backgroundImage: item.project.coverImage ? `url(${item.project.coverImage})` : 'linear-gradient(135deg, rgba(212,168,83,0.1), rgba(212,168,83,0.02))',
                                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                                    }} />
                                                    <div style={{ flex: 1 }}>
                                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '2px', color: 'var(--text-primary)' }}>{item.project.title}</h4>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {item.project.genre && <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.15)', borderRadius: 'var(--radius-full)', color: 'var(--accent-gold)' }}>{item.project.genre}</span>}
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{t('watched')} {new Date(item.watchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        {item.progress > 0 && (
                                                            <div style={{ marginTop: '6px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', width: '100%' }}>
                                                                <div style={{ height: '100%', width: `${item.progress}%`, background: 'var(--accent-gold)', borderRadius: '2px', transition: 'width 0.3s' }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {item.project.duration && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{item.project.duration}</span>}
                                                </div>
                                            </Link>
                                        </ScrollReveal3D>
                                    ))}
                                    {pagination.historyHasMore && (
                                        <button onClick={() => loadMore('history')} disabled={pagination.loadingMore === 'history'} style={loadMoreStyle}>
                                            {pagination.loadingMore === 'history' ? t('loading') : t('loadMoreHistory')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'donations' && (
                        <>
                            {loadingDonations ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>{t('loadingDonations')}</div>
                            ) : donations.length === 0 ? (
                                <EmptyState icon="💛" title={t('noDonTitle')} desc={t('noDonDesc')} linkHref="/donate" linkText={t('noDonCta')} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {/* Summary Bar */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: 'var(--space-md)', background: 'linear-gradient(135deg, rgba(212,168,83,0.08), rgba(212,168,83,0.02))',
                                        border: '1px solid rgba(212,168,83,0.15)', borderRadius: 'var(--radius-lg)',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{t('totalDonated')}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)' }}>${totalDonated.toFixed(2)}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{t('contributions')}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{donations.length}</div>
                                        </div>
                                    </div>

                                    {/* Donation Records */}
                                    {donations.map((d, i) => (
                                        <ScrollReveal3D key={d.id} direction="up" delay={250 + i * 60} distance={15}>
                                            <div style={{
                                                background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
                                                borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)',
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-gold)' }}>${d.amount.toFixed(2)}</span>
                                                        <span style={{
                                                            fontSize: '0.6rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600,
                                                            textTransform: 'uppercase' as const,
                                                            background: d.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                                            color: d.status === 'completed' ? '#22c55e' : '#f59e0b',
                                                            border: `1px solid ${d.status === 'completed' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                                                        }}>{d.status}</span>
                                                        {d.anonymous && (
                                                            <span style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(139,92,246,0.1)', color: '#a78bfa', fontWeight: 600 }}>🤫 {t('anonymous')}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                        {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        <span style={{ marginLeft: '8px', fontSize: '0.65rem', fontFamily: 'monospace', opacity: 0.5 }}>#{d.id.slice(0, 8)}</span>
                                                    </div>
                                                    {d.message && (
                                                        <div style={{ marginTop: '6px', padding: '6px 10px', background: 'rgba(228,185,90,0.04)', borderLeft: '2px solid var(--accent-gold)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                            {d.message}
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => printReceipt(d)} style={{
                                                    padding: '6px 14px', fontSize: '0.72rem', fontWeight: 600,
                                                    borderRadius: 'var(--radius-md)', border: '1px solid rgba(212,168,83,0.2)',
                                                    background: 'rgba(212,168,83,0.06)', color: 'var(--accent-gold)',
                                                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                                }}>
                                                    🧾 Receipt
                                                </button>
                                            </div>
                                        </ScrollReveal3D>
                                    ))}
                                    {pagination.donationsHasMore && (
                                        <button onClick={() => loadMore('donations')} disabled={pagination.loadingMore === 'donations'} style={loadMoreStyle}>
                                            {pagination.loadingMore === 'donations' ? t('loading') : t('loadMoreDonations')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'profile' && (
                        <ProfileTab user={user} refreshUser={refreshUser} />
                    )}
                </div>
            </main>
            <Footer />
        </>
    )
}
