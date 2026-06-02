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
interface Stats { total: number; active: number; inactive: number; pendingReview: number; failed: number; surveySent: number; surveyResponded: number }
interface BotStats { highRisk: number; medRisk: number; countryBreakdown: { country: string; count: number }[] }
interface Conversion {
    totalSubscribers: number; totalUsers: number; converted: number
    conversionRate: number; subscriberOnly: number; userOnly: number
    overlap: number; newConversionsThisMonth: number
}
interface AddUserFound {
    user: { id: string; name: string | null; email: string; role: string; loginMethod: string | null; googleId: string | null; preferredLanguage: string; createdAt: string }
    isSuppressed: boolean
    suppression: { reason: string; createdAt: string } | null
    subscriber: { id: string; active: boolean; confirmedAt: string | null; suppressedAt: string | null; suppressReason: string | null; source: string | null } | null
    notificationSignups: { id: string; signupTag: string; notificationType: string; sourceType: string | null; status: string; createdAt: string }[]
    ctaTags: { signupTag: string; notificationType: string }[]
}

const KNOWN_SYSTEM_TAGS = [
    { signupTag: 'subscribe_general', notificationType: 'more' },
    { signupTag: 'footer_cta', notificationType: 'more' },
    { signupTag: 'casting_general', notificationType: 'more' },
    { signupTag: 'training_general', notificationType: 'more' },
    { signupTag: 'scripts_general', notificationType: 'more' },
]

export default function AdminSubscribersPage() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([])
    const [pagination, setPagination]   = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
    const [stats, setStats]             = useState<Stats>({ total: 0, active: 0, inactive: 0, pendingReview: 0, failed: 0, surveySent: 0, surveyResponded: 0 })
    const [botStats, setBotStats]       = useState<BotStats>({ highRisk: 0, medRisk: 0, countryBreakdown: [] })
    const [conversion, setConversion]   = useState<Conversion>({ totalSubscribers: 0, totalUsers: 0, converted: 0, conversionRate: 0, subscriberOnly: 0, userOnly: 0, overlap: 0, newConversionsThisMonth: 0 })
    const [loading, setLoading]         = useState(true)
    const [search, setSearch]           = useState('')
    const [status, setStatus]           = useState('pending_review')
    const [sort, setSort]               = useState('newest')
    const [selected, setSelected]       = useState<Set<string>>(new Set())
    const [actionLoading, setActionLoading] = useState(false)
    const [toast, setToast]             = useState('')
    const [purging, setPurging]         = useState(false)
    const [purgingBots, setPurgingBots] = useState(false)
    const [campaign, setCampaign]       = useState<{ eligible: number; lastSentAt: string | null; cooldownActive: boolean } | null>(null)
    const [campaignLoading, setCampaignLoading] = useState(true)
    const [campaignSending, setCampaignSending] = useState(false)
    // ── Bot cleanup panel ──
    type BotSuspect = { id: string; email: string; name: string | null; country: string | null; subscribedAt: string; botScore: number; active: boolean; flags: string[] }
    const [botPanelOpen, setBotPanelOpen]       = useState(false)
    const [botSuspects, setBotSuspects]         = useState<BotSuspect[]>([])
    const [botSuspectsLoading, setBotSuspectsLoading] = useState(false)
    const [selectedBotIds, setSelectedBotIds]   = useState<Set<string>>(new Set())
    const [botDeleting, setBotDeleting]         = useState(false)
    const [botScoreFilter, setBotScoreFilter]   = useState(60) // threshold for bulk deselect
    const [autoDeleting, setAutoDeleting]       = useState(false)

    // ── Add Existing User to List panel ──
    const [addOpen, setAddOpen]             = useState(false)
    const [addEmail, setAddEmail]           = useState('')
    const [addSearching, setAddSearching]   = useState(false)
    const [addFound, setAddFound]           = useState<AddUserFound | null>(null)
    const [addNotFound, setAddNotFound]     = useState(false)
    const [addListType, setAddListType]     = useState<'subscriber' | 'notification'>('subscriber')
    const [addSignupTag, setAddSignupTag]   = useState('')
    const [addCustomTag, setAddCustomTag]   = useState('')
    const [addSourceType, setAddSourceType] = useState('general')
    const [addNotifType, setAddNotifType]   = useState('more')
    const [addResult, setAddResult]         = useState<{ code: string; message?: string; error?: string } | null>(null)
    const [addLoading, setAddLoading]       = useState(false)

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
            const totalPurgeable = (preview.purgeableCount || 0) + (preview.expiredUnconfirmedCount || 0)
            if (totalPurgeable === 0) {
                showToast('✅ No dead or expired addresses to purge')
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

    const openBotCleanup = async () => {
        setBotPanelOpen(true)
        setBotSuspectsLoading(true)
        try {
            const res = await fetch('/api/admin/subscribers/bot-suspects?threshold=40&limit=200')
            if (res.ok) {
                const data = await res.json()
                setBotSuspects(data.suspects || [])
                // Pre-select all by default
                setSelectedBotIds(new Set((data.suspects || []).map((s: BotSuspect) => s.id)))
            }
        } catch { /* silent */ }
        setBotSuspectsLoading(false)
    }

    const confirmBotDelete = async () => {
        if (selectedBotIds.size === 0) return
        if (!confirm(`Permanently delete ${selectedBotIds.size} suspected bot subscriber${selectedBotIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
        setBotDeleting(true)
        try {
            const res = await fetch('/api/admin/subscribers/bot-suspects', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [...selectedBotIds], dryRun: false }),
            })
            const result = await res.json()
            if (res.ok) {
                showToast(`🤖 Deleted ${result.deleted} bot subscriber${result.deleted !== 1 ? 's' : ''}`)
                setBotPanelOpen(false)
                setBotSuspects([])
                setSelectedBotIds(new Set())
                await fetchData(1)
            } else {
                showToast(`❌ ${result.error || 'Delete failed'}`)
            }
        } catch {
            showToast('❌ Delete failed — network error')
        }
        setBotDeleting(false)
    }

    const autoDeleteAllBots = async () => {
        // Step 1: fetch count so confirmation shows the real number
        const previewRes = await fetch('/api/admin/subscribers/bot-suspects?threshold=80&limit=1')
        const preview = previewRes.ok ? await previewRes.json() : null
        const count: number = preview?.total ?? 0
        if (count === 0) {
            showToast('✅ No subscribers with botScore ≥ 80 found')
            return
        }
        if (!confirm(
            `Permanently delete ALL ${count} subscriber${count !== 1 ? 's' : ''} with botScore ≥ 80?\n\n` +
            'This cannot be undone.'
        )) return
        setAutoDeleting(true)
        try {
            const res = await fetch('/api/admin/subscribers/delete-high-risk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: 80 }),
            })
            const data = await res.json()
            if (res.ok) {
                showToast(`🤖 Auto-deleted ${data.deleted} high-risk bot subscriber${data.deleted !== 1 ? 's' : ''}`)
                await fetchData(1)
            } else {
                showToast(`❌ ${data.error || 'Auto-delete failed'}`)
            }
        } catch {
            showToast('❌ Auto-delete failed — network error')
        }
        setAutoDeleting(false)
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

    const searchExistingUser = async () => {
        const email = addEmail.toLowerCase().trim()
        if (!email) return
        setAddSearching(true)
        setAddFound(null)
        setAddNotFound(false)
        setAddResult(null)
        try {
            const res = await fetch(`/api/admin/users/find-by-email?email=${encodeURIComponent(email)}`)
            const data = await res.json()
            if (!res.ok || !data.found) { setAddNotFound(true); return }
            setAddFound(data as AddUserFound)
            // Pre-select notif type from first available CTA tag if any
            if (data.ctaTags?.length > 0) {
                setAddSignupTag(data.ctaTags[0].signupTag)
                setAddNotifType(data.ctaTags[0].notificationType || 'more')
            } else if (KNOWN_SYSTEM_TAGS.length > 0) {
                setAddSignupTag(KNOWN_SYSTEM_TAGS[0].signupTag)
                setAddNotifType(KNOWN_SYSTEM_TAGS[0].notificationType)
            }
        } catch { setAddNotFound(true) }
        finally { setAddSearching(false) }
    }

    const confirmAddToList = async () => {
        if (!addFound) return
        setAddLoading(true)
        setAddResult(null)
        const effectiveTag = addSignupTag === '__custom__' ? addCustomTag.trim() : addSignupTag
        try {
            const res = await fetch('/api/admin/users/add-to-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: addFound.user.email,
                    listType: addListType,
                    signupTag: effectiveTag,
                    sourceType: addSourceType,
                    notificationType: addNotifType,
                }),
            })
            const data = await res.json()
            setAddResult(data)
        } catch { setAddResult({ code: 'error', error: 'Network error.' }) }
        finally { setAddLoading(false) }
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
                            onClick={openBotCleanup}
                            disabled={botSuspectsLoading}
                            style={{
                                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                                fontSize: '0.78rem', fontWeight: 600, cursor: botSuspectsLoading ? 'not-allowed' : 'pointer',
                                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
                                color: '#f59e0b', opacity: botSuspectsLoading ? 0.5 : 1, transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {botSuspectsLoading ? '⏳ Loading…' : '🤖 Bot Cleanup'}
                        </button>
                        <button
                            type="button"
                            id="auto-delete-bots-btn"
                            onClick={autoDeleteAllBots}
                            disabled={autoDeleting}
                            style={{
                                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                                fontSize: '0.78rem', fontWeight: 600, cursor: autoDeleting ? 'not-allowed' : 'pointer',
                                background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
                                color: '#dc2626', opacity: autoDeleting ? 0.5 : 1, transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {autoDeleting ? '⏳ Deleting…' : '⚡ Auto-Delete ≥80'}
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

                {/* ── Add Existing User to List ── */}
                <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)', border: '1px solid rgba(59,130,246,0.22)', background: 'rgba(59,130,246,0.03)' }}>
                    <button type="button" onClick={() => { setAddOpen(o => !o); setAddFound(null); setAddNotFound(false); setAddResult(null) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: 0 }}>
                        <span style={{ fontSize: '1rem' }}>{addOpen ? '▾' : '▸'}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>👤 Add Existing User to List</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: '4px' }}>Manually enrol a Google-login user without creating duplicates</span>
                    </button>

                    {addOpen && (
                        <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

                            {/* Step 1 — Email search */}
                            <div>
                                <label style={labelStyle}>Step 1 — Search by email</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input style={{ ...inputStyle, maxWidth: '340px' }}
                                        type="email" placeholder="user@example.com"
                                        value={addEmail}
                                        onChange={e => { setAddEmail(e.target.value); setAddFound(null); setAddNotFound(false); setAddResult(null) }}
                                        onKeyDown={e => e.key === 'Enter' && searchExistingUser()}
                                    />
                                    <button type="button" onClick={searchExistingUser} disabled={addSearching || !addEmail.trim()}
                                        style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', opacity: (addSearching || !addEmail.trim()) ? 0.5 : 1 }}>
                                        {addSearching ? '⏳ Searching…' : '🔍 Search'}
                                    </button>
                                </div>
                            </div>

                            {/* Not found */}
                            {addNotFound && (
                                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.82rem', color: '#ef4444' }}>
                                    ❌ No user found with that email. This tool only works for existing users — do not create a new account from here.
                                </div>
                            )}

                            {/* User found — summary */}
                            {addFound && (
                                <>
                                    <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '6px' }}>✅ User found</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            <div><span style={{ color: 'var(--text-tertiary)' }}>Name:</span> {addFound.user.name || '—'}</div>
                                            <div><span style={{ color: 'var(--text-tertiary)' }}>Email:</span> {addFound.user.email}</div>
                                            <div><span style={{ color: 'var(--text-tertiary)' }}>Login:</span> {addFound.user.googleId ? '🔵 Google' : addFound.user.loginMethod || 'email'}</div>
                                            <div><span style={{ color: 'var(--text-tertiary)' }}>Role:</span> {addFound.user.role}</div>
                                            <div><span style={{ color: 'var(--text-tertiary)' }}>Joined:</span> {new Date(addFound.user.createdAt).toLocaleDateString()}</div>
                                            <div><span style={{ color: 'var(--text-tertiary)' }}>Language:</span> {addFound.user.preferredLanguage}</div>
                                        </div>
                                    </div>

                                    {/* Suppression warning */}
                                    {addFound.isSuppressed && (
                                        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.82rem', color: '#ef4444' }}>
                                            ⛔ <strong>Email is suppressed</strong> ({addFound.suppression?.reason}). Cannot add to any active list without lifting suppression first.
                                        </div>
                                    )}

                                    {/* Existing memberships summary */}
                                    {(addFound.subscriber || addFound.notificationSignups.length > 0) && (
                                        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.78rem' }}>
                                            <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>Existing memberships:</div>
                                            {addFound.subscriber && (
                                                <div>• Newsletter: <span style={{ color: addFound.subscriber.active ? '#34d399' : '#f87171' }}>{addFound.subscriber.active ? 'active' : addFound.subscriber.suppressedAt ? 'suppressed' : 'inactive'}</span> (source: {addFound.subscriber.source || '—'})</div>
                                            )}
                                            {addFound.notificationSignups.map(ns => (
                                                <div key={ns.id}>• {ns.signupTag} — <span style={{ color: ns.status === 'active' ? '#34d399' : '#94a3b8' }}>{ns.status}</span></div>
                                            ))}
                                        </div>
                                    )}

                                    {!addFound.isSuppressed && (
                                        <>
                                            {/* Step 2 — Target selection */}
                                            <div>
                                                <label style={labelStyle}>Step 2 — Select target list</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {(['subscriber', 'notification'] as const).map(lt => (
                                                        <button key={lt} type="button" onClick={() => { setAddListType(lt); setAddResult(null) }}
                                                            style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                                                                background: addListType === lt ? 'rgba(59,130,246,0.15)' : 'transparent',
                                                                borderColor: addListType === lt ? 'rgba(59,130,246,0.5)' : 'var(--border-subtle)',
                                                                color: addListType === lt ? '#3b82f6' : 'var(--text-secondary)',
                                                            }}>
                                                            {lt === 'subscriber' ? '📬 Newsletter / General Updates' : '🔔 Notify Me / CTA Source'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Notification-specific fields */}
                                            {addListType === 'notification' && (() => {
                                                const ctaOptions = [
                                                    ...KNOWN_SYSTEM_TAGS.filter(s => !addFound.ctaTags.some(c => c.signupTag === s.signupTag)),
                                                    ...addFound.ctaTags,
                                                ]
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                                        <div>
                                                            <label style={labelStyle}>SignupTag</label>
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                <select style={{ ...selectStyle, minWidth: '240px' }}
                                                                    value={addSignupTag}
                                                                    onChange={e => {
                                                                        setAddSignupTag(e.target.value)
                                                                        setAddResult(null)
                                                                        const match = ctaOptions.find(c => c.signupTag === e.target.value)
                                                                        if (match) setAddNotifType(match.notificationType)
                                                                    }}>
                                                                    <optgroup label="System tags">
                                                                        {KNOWN_SYSTEM_TAGS.map(s => <option key={s.signupTag} value={s.signupTag}>{s.signupTag}</option>)}
                                                                    </optgroup>
                                                                    {addFound.ctaTags.length > 0 && (
                                                                        <optgroup label="CTA configurations">
                                                                            {addFound.ctaTags.map(c => <option key={c.signupTag} value={c.signupTag}>{c.signupTag}</option>)}
                                                                        </optgroup>
                                                                    )}
                                                                    <optgroup label="Custom">
                                                                        <option value="__custom__">✏️ Custom tag…</option>
                                                                    </optgroup>
                                                                </select>
                                                                {addSignupTag === '__custom__' && (
                                                                    <input style={{ ...inputStyle, maxWidth: '220px' }}
                                                                        placeholder="e.g. scripts_abc123"
                                                                        value={addCustomTag}
                                                                        onChange={e => { setAddCustomTag(e.target.value); setAddResult(null) }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                                                            <div>
                                                                <label style={labelStyle}>Source Type</label>
                                                                <select style={selectStyle} value={addSourceType} onChange={e => setAddSourceType(e.target.value)}>
                                                                    {['general', 'work', 'casting', 'training', 'scripts'].map(t => <option key={t} value={t}>{t}</option>)}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label style={labelStyle}>Notification Type</label>
                                                                <select style={selectStyle} value={addNotifType} onChange={e => setAddNotifType(e.target.value)}>
                                                                    <option value="more">more</option>
                                                                    <option value="release">release</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })()}

                                            {/* Result banner */}
                                            {addResult && (
                                                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', fontWeight: 500,
                                                    background: addResult.code === 'added' ? 'rgba(52,211,153,0.08)' : addResult.code === 'already_subscribed' || addResult.code === 'already_on_list' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                                                    border: `1px solid ${addResult.code === 'added' ? 'rgba(52,211,153,0.25)' : addResult.code === 'already_subscribed' || addResult.code === 'already_on_list' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                                    color: addResult.code === 'added' ? '#34d399' : addResult.code === 'already_subscribed' || addResult.code === 'already_on_list' ? '#f59e0b' : '#ef4444',
                                                }}>
                                                    {addResult.code === 'added' ? '✅' : addResult.code === 'already_subscribed' || addResult.code === 'already_on_list' ? '⚠️' : '❌'}{' '}
                                                    {addResult.message || addResult.error}
                                                </div>
                                            )}

                                            {/* Confirm button */}
                                            {addResult?.code !== 'added' && (
                                                <div>
                                                    <button type="button" onClick={confirmAddToList} disabled={addLoading || (addListType === 'notification' && !addSignupTag && !addCustomTag.trim())}
                                                        style={{ padding: '9px 20px', borderRadius: 'var(--radius-md)', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                                            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#3b82f6',
                                                            opacity: (addLoading || (addListType === 'notification' && !addSignupTag && !addCustomTag.trim())) ? 0.5 : 1,
                                                        }}>
                                                        {addLoading ? '⏳ Adding…' : `✅ Confirm Add to ${addListType === 'subscriber' ? 'Newsletter' : addSignupTag || addCustomTag || 'list'}`}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Overview Dashboard ── */}
                <div className="admin-card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden' }}>

                    {/* Row 1 — Subscriber health: 6 clickable stat cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
                        {[
                            { label: 'Total',          value: stats.total,          color: '#d4a853', filter: 'all' },
                            { label: 'Pending Review',  value: stats.pendingReview,  color: '#f59e0b', filter: 'pending_review' },
                            { label: 'Active',          value: stats.active,         color: '#10b981', filter: 'active' },
                            { label: 'Inactive',        value: stats.inactive,       color: '#6b7280', filter: 'inactive' },
                            { label: 'Failed Sends',    value: stats.failed,         color: '#ef4444', filter: 'failed' },
                            { label: 'Bot Risk',        value: botStats.highRisk,    color: '#dc2626', filter: 'suspect_bot' },
                        ].map((s, i) => (
                            <div
                                key={s.label}
                                onClick={() => setStatus(s.filter)}
                                style={{
                                    padding: '18px 20px 15px',
                                    cursor: 'pointer',
                                    borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                    borderTop: `2px solid ${status === s.filter ? s.color : 'transparent'}`,
                                    background: status === s.filter ? `${s.color}09` : 'transparent',
                                    transition: 'background 0.15s, border-color 0.15s',
                                }}
                            >
                                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>
                                    {s.value.toLocaleString()}
                                </div>
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-tertiary)', marginTop: '6px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Row 2 — Conversion · Survey · Countries */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

                        {/* Conversion */}
                        <div style={{ padding: '12px 20px 14px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '10px' }}>Conversion</div>
                            <div style={{ display: 'flex', gap: '28px' }}>
                                {[
                                    { label: 'Registered', value: conversion.converted.toLocaleString(), color: '#8b5cf6', filter: 'converted' },
                                    { label: 'Conv. Rate',  value: `${conversion.conversionRate}%`,       color: '#06b6d4', filter: '' },
                                ].map(s => (
                                    <div key={s.label} onClick={() => s.filter && setStatus(s.filter)} style={{ cursor: s.filter ? 'pointer' : 'default' }}>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-tertiary)', marginTop: '4px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Survey */}
                        <div style={{ padding: '12px 20px 14px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '10px' }}>Survey</div>
                            <div style={{ display: 'flex', gap: '28px' }}>
                                {[
                                    { label: 'Sent',       value: stats.surveySent.toLocaleString(),                                                                                     color: '#3b82f6', filter: 'survey_sent' },
                                    { label: 'Responded',  value: `${stats.surveyResponded}${stats.surveySent > 0 ? ` (${Math.round(stats.surveyResponded / stats.surveySent * 100)}%)` : ''}`, color: '#10b981', filter: 'survey_responded' },
                                ].map(s => (
                                    <div key={s.label} onClick={() => setStatus(s.filter)} style={{ cursor: 'pointer' }}>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-tertiary)', marginTop: '4px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Countries */}
                        <div style={{ padding: '12px 20px 14px' }}>
                            <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '10px' }}>Top Countries</div>
                            {botStats.countryBreakdown.length > 0 ? (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {botStats.countryBreakdown.slice(0, 6).map(c => (
                                        <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontWeight: 700, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                                                {c.country}
                                            </span>
                                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.66rem' }}>{c.count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>—</span>
                            )}
                        </div>

                    </div>
                </div>

                {/* ── Bot Cleanup Panel ── */}
                {botPanelOpen && (
                    <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)', border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>🤖 Bot Cleanup Preview</span>
                                <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                    {botSuspectsLoading ? 'Loading suspects…' : `${botSuspects.length} suspect${botSuspects.length !== 1 ? 's' : ''} found (score ≥ 40)`}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <button
                                    onClick={() => { setSelectedBotIds(new Set(botSuspects.map(s => s.id))) }}
                                    style={{ padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}
                                >Select All</button>
                                <button
                                    onClick={() => setSelectedBotIds(new Set())}
                                    style={{ padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}
                                >Deselect All</button>
                                {/* ── Bulk deselect by score ── */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '8px' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Keep score ≥</span>
                                    <select
                                        value={botScoreFilter}
                                        onChange={e => setBotScoreFilter(Number(e.target.value))}
                                        style={{
                                            padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer',
                                            borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)',
                                            outline: 'none',
                                        }}
                                    >
                                        {[40, 45, 50, 60, 70, 80].map(v => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => {
                                            const next = new Set(selectedBotIds)
                                            let deselected = 0
                                            botSuspects.forEach(s => {
                                                if (s.botScore < botScoreFilter) {
                                                    next.delete(s.id)
                                                    deselected++
                                                }
                                            })
                                            setSelectedBotIds(next)
                                            if (deselected > 0) {
                                                showToast(`✅ Kept ${next.size} suspects with score ≥ ${botScoreFilter} — deselected ${deselected}`)
                                            } else {
                                                showToast(`ℹ️ All ${next.size} selected suspects already have score ≥ ${botScoreFilter}`)
                                            }
                                        }}
                                        style={{
                                            padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer',
                                            borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.08)',
                                            border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >Apply</button>
                                </div>
                                <button
                                    onClick={confirmBotDelete}
                                    disabled={botDeleting || selectedBotIds.size === 0}
                                    style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', borderRadius: 'var(--radius-md)', background: selectedBotIds.size > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedBotIds.size > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`, color: selectedBotIds.size > 0 ? '#ef4444' : 'var(--text-tertiary)', opacity: botDeleting ? 0.6 : 1 }}
                                >{botDeleting ? '⏳ Deleting…' : `⚠️ Delete ${selectedBotIds.size} selected`}</button>
                                <button
                                    onClick={() => { setBotPanelOpen(false); setBotSuspects([]); setSelectedBotIds(new Set()) }}
                                    style={{ padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-tertiary)' }}
                                >✕ Close</button>
                            </div>
                        </div>
                        {botSuspectsLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Scanning…</div>
                        ) : botSuspects.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#10b981', fontSize: '0.82rem' }}>✅ No bot suspects found with score ≥ 40</div>
                        ) : (
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, width: '32px' }}></th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Email</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Score</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Country</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Flags</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>Subscribed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {botSuspects.map(s => (
                                            <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: selectedBotIds.has(s.id) ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                                                <td style={{ padding: '6px 8px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedBotIds.has(s.id)}
                                                        onChange={e => {
                                                            const next = new Set(selectedBotIds)
                                                            e.target.checked ? next.add(s.id) : next.delete(s.id)
                                                            setSelectedBotIds(next)
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{s.email}</td>
                                                <td style={{ padding: '6px 8px' }}>
                                                    <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, background: s.botScore >= 70 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: s.botScore >= 70 ? '#ef4444' : '#f59e0b' }}>{s.botScore}</span>
                                                </td>
                                                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{s.country || '—'}</td>
                                                <td style={{ padding: '6px 8px' }}>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {s.flags.map((f, i) => (
                                                            <span key={i} style={{ padding: '1px 6px', borderRadius: '99px', fontSize: '0.62rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{f}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '6px 8px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{new Date(s.subscribedAt).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}


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
                                <optgroup label="Review">
                                    <option value="pending_review">⏳ Pending Review</option>
                                </optgroup>
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
                            ✅ Approve
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
                                    {/* Email — not filterable */}
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Email</th>
                                    {/* Country — sort toggle */}
                                    {([
                                        { label: 'Country',    isActive: sort === 'country',         onClick: () => setSort(sort === 'country' ? 'newest' : 'country') },
                                        { label: 'Status',     isActive: status === 'active' || status === 'inactive' || status === 'pending_review', onClick: () => setStatus(status === 'active' ? 'inactive' : status === 'inactive' ? 'pending_review' : status === 'pending_review' ? 'all' : 'active') },
                                        { label: 'Bot Risk',   isActive: status === 'suspect_bot',   onClick: () => setStatus(status === 'suspect_bot' ? 'all' : 'suspect_bot') },
                                        { label: 'Converted',  isActive: status === 'converted',     onClick: () => setStatus(status === 'converted'    ? 'all' : 'converted') },
                                        { label: 'Survey',     isActive: status === 'survey_sent' || status === 'survey_responded', onClick: () => setStatus(status === 'survey_sent' ? 'survey_responded' : status === 'survey_responded' ? 'all' : 'survey_sent') },
                                        { label: 'Subscribed', isActive: sort === 'newest' || sort === 'oldest', onClick: () => setSort(sort === 'newest' ? 'oldest' : 'newest') },
                                        { label: 'Fails',      isActive: status === 'failed' || sort === 'fails', onClick: () => { if (status !== 'failed') { setStatus('failed') } else { setStatus('all'); setSort('fails') } } },
                                    ] as { label: string; isActive: boolean; onClick: () => void }[]).map(col => (
                                        <th
                                            key={col.label}
                                            onClick={col.onClick}
                                            title={`Filter by ${col.label}`}
                                            style={{
                                                padding: '10px 14px', textAlign: 'left',
                                                fontSize: '0.65rem', fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                                cursor: 'pointer', userSelect: 'none',
                                                color: col.isActive ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                borderBottom: col.isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                                transition: 'color 0.15s, border-color 0.15s',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {col.label}
                                            {col.isActive && <span style={{ marginLeft: '4px', opacity: 0.7 }}>▼</span>}
                                        </th>
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
