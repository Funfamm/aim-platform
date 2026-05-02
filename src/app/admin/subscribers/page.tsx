'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

interface Subscriber {
    id: string
    email: string
    name: string | null
    active: boolean
    subscribedAt: string
    failedSends: number
    country: string | null
    botScore: number
    hasOpened: boolean
    // Conversion fields
    converted: boolean
    userId: string | null
    convertedAt: string | null
    emailVerified: boolean | null
    language: string | null
    // Survey fields
    surveySent: boolean
    surveyResponded: boolean
}
interface Pagination { page: number; limit: number; total: number; totalPages: number }
interface Stats { total: number; active: number; inactive: number; failed: number; surveySent: number; surveyResponded: number }
interface BotStats { highRisk: number; medRisk: number; countryBreakdown: { country: string; count: number }[] }
interface Conversion {
    totalSubscribers: number; totalUsers: number; converted: number
    conversionRate: number; subscriberOnly: number; userOnly: number
    overlap: number; newConversionsThisMonth: number
}

export default function AdminSubscribersPage() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([])
    const [pagination, setPagination]   = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
    const [stats, setStats]             = useState<Stats>({ total: 0, active: 0, inactive: 0, failed: 0, surveySent: 0, surveyResponded: 0 })
    const [botStats, setBotStats]       = useState<BotStats>({ highRisk: 0, medRisk: 0, countryBreakdown: [] })
    const [conversion, setConversion]   = useState<Conversion>({ totalSubscribers: 0, totalUsers: 0, converted: 0, conversionRate: 0, subscriberOnly: 0, userOnly: 0, overlap: 0, newConversionsThisMonth: 0 })
    const [loading, setLoading]         = useState(true)
    const [search, setSearch]           = useState('')
    const [status, setStatus]           = useState('all')
    const [sort, setSort]               = useState('newest')
    const [selected, setSelected]       = useState<Set<string>>(new Set())
    const [actionLoading, setActionLoading] = useState(false)
    const [toast, setToast]             = useState('')
    const [purging, setPurging]         = useState(false)
    const [purgingBots, setPurgingBots] = useState(false)
    const [campaign, setCampaign]       = useState<{ eligible: number; lastSentAt: string | null; cooldownActive: boolean } | null>(null)
    const [campaignLoading, setCampaignLoading] = useState(true)
    const [campaignSending, setCampaignSending] = useState(false)

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(''), 3500)
    }

    const fetchData = useCallback(async (page = 1) => {
        setLoading(true)
        setSelected(new Set())
        const params = new URLSearchParams({ page: String(page), limit: '50', sort, status })
        if (search) params.set('search', search)
        const res = await fetch(`/api/admin/subscribers?${params}`)
        if (res.ok) {
            const data = await res.json()
            let subs = data.subscribers as Subscriber[]
            // Client-side sort for enriched fields not available in DB
            if (sort === 'fails') {
                subs = [...subs].sort((a, b) => b.failedSends - a.failedSends)
            }
            setSubscribers(subs)
            setPagination(data.pagination)
            setStats(data.stats)
            if (data.botStats) setBotStats(data.botStats)
            if (data.conversion) setConversion(data.conversion)
        }
        setLoading(false)
    }, [search, status, sort])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchData(1) }, [fetchData])

    // Fetch campaign status
    useEffect(() => {
        fetch('/api/admin/subscriber-campaign')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setCampaign(data) })
            .catch(() => {})
            .finally(() => setCampaignLoading(false))
    }, [])

    // debounced search
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        const t = setTimeout(() => fetchData(1), 300)
        return () => clearTimeout(t)
    }, [search, fetchData])

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }
    const toggleAll = () => {
        if (selected.size === subscribers.length) setSelected(new Set())
        else setSelected(new Set(subscribers.map(s => s.id)))
    }

    const bulkSetActive = async (active: boolean) => {
        if (selected.size === 0) return
        setActionLoading(true)
        const res = await fetch('/api/admin/subscribers', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selected), active }),
        })
        if (res.ok) {
            const data = await res.json()
            showToast(`✅ ${data.updated} subscriber${data.updated !== 1 ? 's' : ''} ${active ? 'activated' : 'deactivated'}`)
            await fetchData(pagination.page)
        }
        setActionLoading(false)
    }

    const bulkDelete = async () => {
        if (selected.size === 0) return
        if (!confirm(`Permanently delete ${selected.size} subscriber${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
        setActionLoading(true)
        const res = await fetch('/api/admin/subscribers', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selected) }),
        })
        if (res.ok) {
            const data = await res.json()
            showToast(`🗑️ ${data.deleted} subscriber${data.deleted !== 1 ? 's' : ''} deleted`)
            await fetchData(1)
        }
        setActionLoading(false)
    }

    const handlePurgeDead = async () => {
        setPurging(true)
        try {
            // Step 1: Preview — how many will be deleted?
            const previewRes = await fetch('/api/admin/subscribers/purge')
            if (!previewRes.ok) {
                showToast('❌ Failed to load purge preview')
                setPurging(false)
                return
            }
            const preview = await previewRes.json()
            if (preview.purgeableCount === 0) {
                showToast('✅ No dead addresses to purge')
                setPurging(false)
                return
            }

            // Step 2: Confirm
            const reasons = Object.entries(preview.breakdown as Record<string, number>)
                .map(([reason, count]) => `${reason}: ${count}`)
                .join(', ')
            if (!confirm(
                `Permanently delete ${preview.purgeableCount} suppressed subscriber${preview.purgeableCount !== 1 ? 's' : ''}?\n\n` +
                `Suppression reasons: ${reasons}\n\n` +
                `These addresses are permanently blocked from receiving email. This cannot be undone.`
            )) {
                setPurging(false)
                return
            }

            // Step 3: Execute
            const purgeRes = await fetch('/api/admin/subscribers/purge', { method: 'POST' })
            if (purgeRes.ok) {
                const result = await purgeRes.json()
                showToast(`🗑️ ${result.message}`)
                await fetchData(1)
            } else {
                showToast('❌ Purge failed')
            }
        } catch {
            showToast('❌ Purge failed — network error')
        }
        setPurging(false)
    }

    const handlePurgeBots = async () => {
        setPurgingBots(true)
        try {
            // Preview: get count of high-risk bot subscribers
            const previewRes = await fetch('/api/admin/email-suppression?reason=bot&active=true')
            const previewData = await previewRes.json()
            const botCount = previewData.total ?? 0

            // Also count suppressable bots not yet on list by querying subscribers directly
            const botSubRes = await fetch('/api/admin/subscribers?botRisk=high&limit=1')
            const botSubData = botSubRes.ok ? await botSubRes.json() : {}
            const eligible = botSubData.stats?.highRisk ?? botCount

            if (!confirm(
                `Permanently suppress and delete high-risk bot subscribers (bot score ≥ 70)?\n\n` +
                `This will:\n• Add all high-risk bots to the suppression list with reason "bot"\n• Permanently delete their subscriber records\n• They cannot re-subscribe\n\nThis cannot be undone. Continue?`
            )) {
                setPurgingBots(false)
                return
            }

            const res = await fetch('/api/admin/email-suppression', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'purge_bots', threshold: 70 }),
            })
            const result = await res.json()
            if (res.ok) {
                const protected_ = result.protected ?? 0
                showToast(`🤖 Purged ${result.purged} bot${result.purged !== 1 ? 's' : ''}${protected_ > 0 ? ` · ${protected_} real subscriber${protected_ !== 1 ? 's' : ''} protected` : ''}`)
                await fetchData(1)
            } else {
                showToast(`❌ ${result.error || 'Purge failed'}`)
            }
        } catch {
            showToast('❌ Purge failed — network error')
        }
        setPurgingBots(false)
    }

    const exportCsv = () => {
        const params = new URLSearchParams({ format: 'csv', sort, status })
        if (search) params.set('search', search)
        window.open(`/api/admin/subscribers?${params}`, '_blank')
    }

    const sendCampaign = async () => {
        setCampaignSending(true)
        try {
            // Step 1: Dry run preview
            const previewRes = await fetch('/api/admin/subscriber-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun: true }),
            })
            const preview = await previewRes.json()
            if (!previewRes.ok) {
                showToast(`❌ ${preview.error || 'Campaign failed'}`)
                setCampaignSending(false)
                return
            }
            if (preview.eligible === 0) {
                showToast('✅ All subscribers already have accounts!')
                setCampaignSending(false)
                return
            }

            // Step 2: Confirm
            if (!confirm(
                `Send conversion campaign?\n\n` +
                `${preview.eligible} eligible subscribers will receive an email.\n` +
                `${preview.alreadyRegistered} already have accounts (skipped).\n\n` +
                `Sample: ${preview.sampleEmails?.join(', ') || 'none'}\n\n` +
                `Continue?`
            )) {
                setCampaignSending(false)
                return
            }

            // Step 3: Send
            const sendRes = await fetch('/api/admin/subscriber-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun: false }),
            })
            const result = await sendRes.json()
            if (sendRes.ok) {
                showToast(`📧 Campaign queued: ${result.queued} emails`)
                // Refresh campaign status
                const statusRes = await fetch('/api/admin/subscriber-campaign')
                if (statusRes.ok) setCampaign(await statusRes.json())
            } else {
                showToast(`❌ ${result.error || 'Campaign failed'}`)
            }
        } catch {
            showToast('❌ Campaign failed — network error')
        }
        setCampaignSending(false)
    }

    const sendTestCampaign = async () => {
        setCampaignSending(true)
        try {
            // Get admin's own email
            const meRes = await fetch('/api/auth/me')
            const me = await meRes.json()
            const adminEmail = me?.user?.email
            if (!adminEmail) {
                showToast('❌ Could not determine your email')
                setCampaignSending(false)
                return
            }
            const res = await fetch('/api/admin/subscriber-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testEmail: adminEmail }),
            })
            const data = await res.json()
            if (res.ok) {
                showToast(`📧 Test email queued to ${adminEmail}`)
            } else {
                showToast(`❌ ${data.error || 'Test failed'}`)
            }
        } catch {
            showToast('❌ Test failed — network error')
        }
        setCampaignSending(false)
    }

    const labelStyle: React.CSSProperties = {
        fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block',
    }
    const inputStyle: React.CSSProperties = {
        padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)', outline: 'none', width: '100%',
    }
    const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', cursor: 'pointer' }

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                {/* Header */}
                <div className="admin-header">
                    <h1 className="admin-page-title">📬 Subscribers</h1>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={handlePurgeDead}
                            disabled={purging}
                            style={{
                                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                                fontSize: '0.78rem', fontWeight: 600, cursor: purging ? 'not-allowed' : 'pointer',
                                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)',
                                color: '#ef4444', opacity: purging ? 0.5 : 1, transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {purging ? '⏳ Purging…' : '🗑️ Purge Dead'}
                        </button>
                        <button
                            type="button"
                            onClick={handlePurgeBots}
                            disabled={purgingBots}
                            style={{
                                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                                fontSize: '0.78rem', fontWeight: 600, cursor: purgingBots ? 'not-allowed' : 'pointer',
                                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
                                color: '#f59e0b', opacity: purgingBots ? 0.5 : 1, transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {purgingBots ? '⏳ Purging…' : '🤖 Purge Bots'}
                        </button>
                        <button
                            type="button"
                            onClick={exportCsv}
                            className="btn btn-ghost"
                            style={{ fontSize: '0.8rem' }}
                        >
                            ⬇️ Export CSV
                        </button>
                    </div>
                </div>

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)', padding: '12px 20px',
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease',
                    }}>
                        {toast}
                    </div>
                )}

                {/* Stats */}
                {/* Subscriber stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                    {[
                        { label: 'Total', value: stats.total, color: '#d4a853', filter: 'all' },
                        { label: 'Active',   value: stats.active,   color: '#10b981', filter: 'active' },
                        { label: 'Inactive', value: stats.inactive, color: '#6b7280', filter: 'inactive' },
                        { label: 'Failed Sends', value: stats.failed, color: '#ef4444', filter: 'failed' },
                        { label: '🤖 Bot Risk (High)', value: botStats.highRisk, color: '#dc2626', filter: 'suspect_bot' },
                    ].map(s => (
                        <div key={s.label} className="admin-card" style={{
                            padding: 'var(--space-lg)', textAlign: 'center', cursor: 'pointer',
                            border: status === s.filter ? `1px solid ${s.color}44` : undefined,
                            background: status === s.filter ? `${s.color}08` : undefined,
                            transition: 'all 0.15s',
                        }}
                            onClick={() => setStatus(s.filter)}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Country breakdown — only show if there are multiple countries */}
                {botStats.countryBreakdown.length > 1 && (
                    <div className="admin-card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Top Countries</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {botStats.countryBreakdown.map(c => (
                                <span key={c.country} style={{
                                    padding: '4px 10px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 600,
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                }}>
                                    {c.country} · {c.count}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Conversion reporting */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                    {[
                        { label: 'Converted', value: conversion.converted, color: '#8b5cf6', suffix: '', filter: 'converted' },
                        { label: 'Conversion Rate', value: conversion.conversionRate, color: '#06b6d4', suffix: '%', filter: '' },
                        { label: 'Survey Sent', value: stats.surveySent, color: '#3b82f6', suffix: '', filter: 'survey_sent' },
                        { label: 'Responded', value: stats.surveyResponded, color: '#10b981', suffix: stats.surveySent > 0 ? ` (${Math.round(stats.surveyResponded / stats.surveySent * 100)}%)` : '', filter: 'survey_responded' },
                    ].map(s => (
                        <div key={s.label} className="admin-card" style={{
                            padding: 'var(--space-lg)', textAlign: 'center',
                            cursor: s.filter ? 'pointer' : 'default',
                            border: s.filter && status === s.filter ? `1px solid ${s.color}44` : undefined,
                            background: s.filter && status === s.filter ? `${s.color}08` : undefined,
                            transition: 'all 0.15s',
                        }}
                            onClick={() => s.filter && setStatus(s.filter)}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}{s.suffix}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Conversion Campaign */}
                <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)', border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                                📧 Subscriber → User Campaign
                            </h3>
                            {campaignLoading ? (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Loading...</span>
                            ) : campaign ? (
                                <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    <span><strong style={{ color: '#8b5cf6' }}>{campaign.eligible}</strong> eligible</span>
                                    {campaign.lastSentAt && (
                                        <span>Last sent: {new Date(campaign.lastSentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    )}
                                    {campaign.cooldownActive && (
                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>⏳ 7-day cooldown active</span>
                                    )}
                                </div>
                            ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={sendTestCampaign}
                                disabled={campaignSending}
                                style={{
                                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                                    fontSize: '0.82rem', fontWeight: 600, cursor: campaignSending ? 'not-allowed' : 'pointer',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: 'var(--text-secondary)',
                                    opacity: campaignSending ? 0.5 : 1,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {campaignSending ? '⏳...' : '🧪 Send Test'}
                            </button>
                            <button
                                type="button"
                                onClick={sendCampaign}
                                disabled={campaignSending || (campaign?.cooldownActive ?? false) || (campaign?.eligible === 0)}
                                style={{
                                    padding: '8px 20px', borderRadius: 'var(--radius-md)',
                                    fontSize: '0.82rem', fontWeight: 700, cursor: campaignSending ? 'not-allowed' : 'pointer',
                                    background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))',
                                    border: '1px solid rgba(139,92,246,0.3)',
                                    color: '#a78bfa',
                                    opacity: (campaignSending || campaign?.cooldownActive || campaign?.eligible === 0) ? 0.5 : 1,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {campaignSending ? '⏳ Sending...' : '🚀 Send Campaign'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="admin-card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={labelStyle}>Search</label>
                            <input
                                style={inputStyle}
                                placeholder="Search by email or name…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select style={selectStyle} value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="all">All</option>
                                <optgroup label="Subscription">
                                    <option value="active">● Active</option>
                                    <option value="inactive">○ Inactive</option>
                                    <option value="new_month">🆕 New This Month</option>
                                </optgroup>
                                <optgroup label="Conversion">
                                    <option value="converted">🔗 Converted (Registered)</option>
                                    <option value="subscriber_only">📩 Subscriber Only</option>
                                </optgroup>
                                <optgroup label="Verification">
                                    <option value="verified">✓ Email Verified</option>
                                    <option value="unverified">✕ Not Verified</option>
                                </optgroup>
                                <optgroup label="Health">
                                    <option value="failed">⚠️ Has Failures</option>
                                    <option value="suspect_bot">🤖 Suspect Bots</option>
                                </optgroup>
                                <optgroup label="Survey">
                                    <option value="survey_sent">📧 Survey Sent</option>
                                    <option value="survey_responded">📋 Survey Responded</option>
                                    <option value="survey_not_sent">❌ Survey Not Sent</option>
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Sort</label>
                            <select style={selectStyle} value={sort} onChange={e => setSort(e.target.value)}>
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="name">By email</option>
                                <option value="fails">Most failures</option>
                            </select>
                        </div>
                        {status !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setStatus('all')}
                                style={{
                                    padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem',
                                    fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                ✕ Clear filter
                            </button>
                        )}
                    </div>
                </div>

                {/* Bulk actions bar */}
                {selected.size > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                        padding: '10px 16px', borderRadius: 'var(--radius-lg)',
                        background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)',
                        marginBottom: 'var(--space-md)',
                    }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                            {selected.size} selected
                        </span>
                        <button type="button" disabled={actionLoading} onClick={() => bulkSetActive(true)}
                            style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                            ✓ Activate
                        </button>
                        <button type="button" disabled={actionLoading} onClick={() => bulkSetActive(false)}
                            style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.3)', color: '#9ca3af' }}>
                            ✕ Deactivate
                        </button>
                        <button type="button" disabled={actionLoading} onClick={bulkDelete}
                            style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                            🗑️ Delete
                        </button>
                        <button type="button" onClick={() => setSelected(new Set())}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Clear
                        </button>
                    </div>
                )}

                {/* Table */}
                <div className="admin-card" style={{ overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                            Loading subscribers…
                        </div>
                    ) : subscribers.length === 0 ? (
                        <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>📭</div>
                            <div style={{ fontSize: '0.9rem' }}>No subscribers found</div>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', width: '36px' }}>
                                        <input type="checkbox"
                                            checked={selected.size === subscribers.length && subscribers.length > 0}
                                            onChange={toggleAll}
                                            style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                                        />
                                    </th>
                                    {['Email', 'Name', 'Country', 'Status', 'Bot Risk', 'Converted', 'Survey', 'Subscribed', 'Fails'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {subscribers.map((sub, i) => (
                                    <tr key={sub.id}
                                        onClick={() => toggleOne(sub.id)}
                                        style={{
                                            borderBottom: i < subscribers.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                            background: selected.has(sub.id) ? 'rgba(212,168,83,0.04)' : 'transparent',
                                            cursor: 'pointer', transition: 'background 0.12s',
                                        }}>
                                        <td style={{ padding: '10px 14px' }}>
                                            <input type="checkbox"
                                                checked={selected.has(sub.id)}
                                                onChange={() => toggleOne(sub.id)}
                                                onClick={e => e.stopPropagation()}
                                                style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{sub.email}</span>
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{sub.name || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>—</span>}</span>
                                        </td>
                                        {/* Country */}
                                        <td style={{ padding: '10px 14px' }}>
                                            {sub.country ? (
                                                <span style={{
                                                    padding: '2px 7px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600,
                                                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
                                                    color: '#818cf8', textTransform: 'uppercase',
                                                }}>
                                                    {sub.country}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                                background: sub.active ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                                                color: sub.active ? '#10b981' : '#9ca3af',
                                                border: `1px solid ${sub.active ? 'rgba(16,185,129,0.25)' : 'rgba(107,114,128,0.2)'}`,
                                            }}>
                                                {sub.active ? '● Active' : '○ Inactive'}
                                            </span>
                                        </td>
                                        {/* Bot Risk */}
                                        <td style={{ padding: '10px 14px' }}>
                                            {sub.botScore >= 70 ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                    padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                                    background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)',
                                                    color: '#ef4444',
                                                }}>
                                                    🤖 High ({sub.botScore})
                                                </span>
                                            ) : sub.botScore >= 40 ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                    padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                                                    color: '#f59e0b',
                                                }}>
                                                    ⚠️ Med ({sub.botScore})
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
                                                    ✓ Low
                                                </span>
                                            )}
                                        </td>
                                        {/* Converted */}
                                        <td style={{ padding: '10px 14px' }}>
                                            {sub.converted ? (
                                                <div>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                                        background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                                                        color: '#a78bfa',
                                                    }}>
                                                        🔗 Registered
                                                    </span>
                                                    {sub.convertedAt && (
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                                            {new Date(sub.convertedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>Subscriber only</span>
                                            )}
                                        </td>
                                        {/* Survey */}
                                        <td style={{ padding: '10px 14px' }}>
                                            {sub.surveyResponded ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                    padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                                                    color: '#10b981',
                                                }}>
                                                    📋 Responded
                                                </span>
                                            ) : sub.surveySent ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                    padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                                                    color: '#60a5fa',
                                                }}>
                                                    ✉️ Sent
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>—</span>
                                            )}
                                        </td>
                                        {/* Subscribed */}
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                                {new Date(sub.subscribedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </span>
                                        </td>

                                        {/* Fails */}
                                        <td style={{ padding: '10px 14px' }}>
                                            {sub.failedSends > 0 ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                    padding: '2px 7px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                                    background: sub.failedSends >= 3 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
                                                    color: sub.failedSends >= 3 ? '#ef4444' : '#f59e0b',
                                                    border: `1px solid ${sub.failedSends >= 3 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
                                                }}>
                                                    ⚠️ {sub.failedSends}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                        <button type="button" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}
                            className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                            ← Prev
                        </button>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            Page {pagination.page} of {pagination.totalPages} &nbsp;·&nbsp; {pagination.total.toLocaleString()} total
                        </span>
                        <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchData(pagination.page + 1)}
                            className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                            Next →
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}
