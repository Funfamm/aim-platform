'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

// Custom dark dropdown to avoid native white popups
function DarkDropdown({ value, onChange, options, style }: {
    value: string
    onChange: (val: string) => void
    options: { value: string; label: string }[]
    style?: React.CSSProperties
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const selected = options.find(o => o.value === value)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative', ...style }}>
            <button type="button" onClick={() => setOpen(!open)} style={{
                padding: '7px 28px 7px 12px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
                cursor: 'pointer', width: '100%', textAlign: 'left', whiteSpace: 'nowrap',
            }}>
                {selected?.label || value}
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.5rem', color: 'var(--text-tertiary)' }}>▼</span>
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    marginTop: '2px', background: '#1a1d26', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    minWidth: '180px',
                }}>
                    {options.map(opt => (
                        <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }} style={{
                            display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left',
                            background: value === opt.value ? 'rgba(212,168,83,0.12)' : 'transparent',
                            border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
                            color: value === opt.value ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            transition: 'background 0.1s',
                        }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = value === opt.value ? 'rgba(212,168,83,0.12)' : 'transparent')}
                        >{opt.label}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

interface Application {
    id: string; fullName: string; email: string; phone: string | null
    age: string | null; gender: string | null; status: string
    aiScore: number | null; aiFitLevel: string | null
    headshotPath: string | null; selfTapePath: string | null; createdAt: string
    castingCall: { roleName: string; roleType: string; project: { title: string } }
}
interface Pagination { page: number; limit: number; total: number; totalPages: number }

interface BulkPreview { eligible: number; ineligible: number; alreadyNotified: number; wouldNotify: number }

interface AuditEntry { id: string; action: string; details: Record<string, unknown>; createdAt: string }

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
    pending:      { label: 'Pending',      bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
    submitted:    { label: 'Submitted',    bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
    under_review: { label: 'Under Review', bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
    shortlisted:  { label: 'Shortlisted',  bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    contacted:    { label: 'Contacted',    bg: 'rgba(212,168,83,0.12)',  color: '#d4a853' },
    callback:     { label: 'Callback',     bg: 'rgba(212,168,83,0.12)',  color: '#d4a853' },
    audition:     { label: 'Audition',     bg: 'rgba(168,85,247,0.12)',  color: '#a855f7' },
    final_review: { label: 'Final Review', bg: 'rgba(168,85,247,0.12)',  color: '#a855f7' },
    selected:     { label: 'Selected',     bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
    rejected:     { label: 'Rejected',     bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
    not_selected: { label: 'Not Selected', bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
    approved:     { label: 'Approved',     bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
    withdrawn:    { label: 'Withdrawn',    bg: 'rgba(239,68,68,0.10)',   color: '#f87171' },
}

const DESTRUCTIVE_ACTIONS = new Set(['rejected', 'not_selected', 'delete'])
const NOTIFY_ACTIONS = new Set(['shortlisted', 'callback', 'contacted', 'audition', 'final_review', 'selected', 'rejected', 'not_selected'])

export default function AdminApplicationsPage() {
    const [apps, setApps] = useState<Application[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 })
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')
    const [sort, setSort] = useState('newest')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [selectAllQuery, setSelectAllQuery] = useState(false)
    const [bulkAction, setBulkAction] = useState('')
    const [notifyToggle, setNotifyToggle] = useState(true)
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
    // Batch audit state
    const [batchRunning, setBatchRunning] = useState(false)
    const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; results: Array<{ id: string; fullName: string; status: string; aiScore?: number; recommendation?: string; error?: string }> } | null>(null)
    const [bulkToast, setBulkToast] = useState<string | null>(null)
    // Preview & confirm modal
    const [preview, setPreview] = useState<BulkPreview | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [rejectionNote, setRejectionNote] = useState('')
    const [confirmChecked, setConfirmChecked] = useState(false)
    const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false)
    // Audit trail
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
    const [showAudit, setShowAudit] = useState(false)

    const fetchApps = useCallback(async (page = 1) => {
        setLoading(true)
        const params = new URLSearchParams({ page: String(page), limit: '25', sort })
        if (search) params.set('search', search)
        if (status !== 'all') params.set('status', status)
        const res = await fetch(`/api/admin/applications?${params}`)
        if (res.ok) {
            const data = await res.json()
            setApps(data.applications); setPagination(data.pagination); setStatusCounts(data.statusCounts)
        }
        setLoading(false)
    }, [search, status, sort])

    useEffect(() => { fetchApps(1) }, [fetchApps])

    const fetchAuditLog = useCallback(async () => {
        const res = await fetch('/api/admin/audit-log?action=CHANGE_STATUS&action=DELETE_APPLICATIONS&limit=10')
        if (res.ok) setAuditLog(await res.json())
    }, [])

    useEffect(() => { if (showAudit) fetchAuditLog() }, [showAudit, fetchAuditLog])

    const handleSearch = (val: string) => {
        setSearch(val)
        if (searchTimeout) clearTimeout(searchTimeout)
        setSearchTimeout(setTimeout(() => fetchApps(1), 300))
    }

    const toggleSelect = (id: string) => {
        setSelectAllQuery(false)
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const selectAll = () => {
        setSelectAllQuery(false)
        if (selected.size === apps.length) setSelected(new Set())
        else setSelected(new Set(apps.map(a => a.id)))
    }

    // ── Open preview modal ───────────────────────────────────────────────────
    const openPreview = async () => {
        if (!bulkAction || (selected.size === 0 && !selectAllQuery)) return
        if (bulkAction === 'batch_audit') { handleBulkAction(); return }
        if (bulkAction === 'download') { handleBulkAction(); return }
        if (bulkAction === 'export_csv') { handleExportCsv(); return }

        setPreviewLoading(true)
        setRejectionNote('')
        setConfirmChecked(false)
        setDeleteConfirmChecked(false)

        if (bulkAction !== 'delete') {
            const res = await fetch('/api/admin/applications/bulk-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationIds: selectAllQuery ? [] : [...selected],
                    selectAllQuery,
                    search, statusFilter: status, sort,
                    status: bulkAction,
                }),
            })
            if (res.ok) setPreview(await res.json())
        } else {
            setPreview(null)
        }

        setPreviewLoading(false)
        setShowConfirm(true)
    }

    // ── CSV Export ───────────────────────────────────────────────────────────
    const handleExportCsv = async () => {
        const res = await fetch('/api/admin/applications/export-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                applicationIds: selectAllQuery ? [] : [...selected],
                selectAllQuery, search, statusFilter: status, sort,
            }),
        })
        if (!res.ok) return
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `AIM_Applications_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a); a.click()
        document.body.removeChild(a); URL.revokeObjectURL(url)
        setBulkAction('')
    }

    // ── Confirm and apply bulk action ────────────────────────────────────────
    const confirmBulkAction = async () => {
        setShowConfirm(false)
        await handleBulkAction()
    }

    const handleBulkAction = async () => {
        if (!bulkAction || (selected.size === 0 && !selectAllQuery)) return

        // ── Batch AI Audit ───────────────────────────────────────────────────
        if (bulkAction === 'batch_audit') {
            setBatchRunning(true)
            setBatchProgress({ total: selected.size, done: 0, results: [] })
            try {
                const res = await fetch('/api/admin/applications/batch-audit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ applicationIds: [...selected], delaySeconds: 8 }),
                })
                if (!res.ok) {
                    const err = await res.json()
                    setBatchProgress(prev => prev ? { ...prev, results: [{ id: '', fullName: 'Error', status: 'error', error: err.error }] } : null)
                } else {
                    const reader = res.body?.getReader()
                    if (!reader) return
                    const decoder = new TextDecoder()
                    let done = false
                    while (!done) {
                        const { value, done: streamDone } = await reader.read()
                        if (value) {
                            const chunk = decoder.decode(value, { stream: true })
                            const lines = chunk.split('\n').filter(l => l.trim().length > 0)
                            for (const line of lines) {
                                try {
                                    const obj = JSON.parse(line)
                                    if (obj.type === 'result') {
                                        setBatchProgress(prev => ({
                                            total: prev?.total ?? selected.size,
                                            done: (prev?.done ?? 0) + 1,
                                            results: [...(prev?.results ?? []), obj],
                                        }))
                                    } else if (obj.type === 'eof') {
                                        setBatchProgress(prev => ({
                                            total: prev?.total ?? obj.summary.total,
                                            done: obj.summary.total,
                                            results: prev?.results ?? [],
                                        }))
                                    }
                                } catch (e) { console.error('Failed to parse NDJSON', e) }
                            }
                        }
                        done = streamDone
                    }
                    fetchApps(pagination.page)
                }
            } catch (e) {
                console.error('Batch audit error', e)
            } finally {
                setBatchRunning(false)
                setSelected(new Set()); setBulkAction('')
                setSelectAllQuery(false)
            }
            return
        }

        // ── Download ZIP ─────────────────────────────────────────────────────
        if (bulkAction === 'download') {
            try {
                const res = await fetch('/api/admin/applications/download', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ applicationIds: [...selected] }),
                })
                if (!res.ok) throw new Error('Download failed')
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `AIM_Applications_${new Date().toISOString().slice(0, 10)}.zip`
                document.body.appendChild(a); a.click()
                document.body.removeChild(a); URL.revokeObjectURL(url)
            } catch (err) { console.error('Download error:', err) }
            setBulkAction(''); return
        }

        // ── Delete ───────────────────────────────────────────────────────────
        if (bulkAction === 'delete') {
            await fetch('/api/admin/applications/bulk-delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationIds: [...selected] }),
            })
            setSelected(new Set()); setBulkAction(''); setSelectAllQuery(false)
            fetchApps(pagination.page)
            return
        }

        // ── Status change (with dedup, rate-limiting, notifications) ─────────
        const eligibleMap: Record<string, string[]> = {
            under_review: ['submitted', 'pending'],
            shortlisted:  ['submitted', 'under_review', 'pending'],
            callback:     ['shortlisted'],
            final_review: ['shortlisted', 'callback'],
            selected:     ['final_review', 'shortlisted'],
            rejected:     ['submitted', 'under_review', 'shortlisted', 'callback', 'final_review'],
            not_selected: ['submitted', 'under_review', 'shortlisted', 'callback', 'final_review'],
        }
        const allowed = eligibleMap[bulkAction]
        const eligibleIds = allowed
            ? apps.filter(a => selected.has(a.id) && allowed.includes(a.status)).map(a => a.id)
            : [...selected]

        if (eligibleIds.length === 0 && !selectAllQuery) {
            setBulkToast('⚠️ No selected applications are eligible for this action.')
            setTimeout(() => setBulkToast(null), 4000)
            setBulkAction('')
            return
        }

        const res = await fetch('/api/admin/applications/bulk-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                applicationIds: selectAllQuery ? [] : eligibleIds,
                selectAllQuery, search, statusFilter: status, sort,
                status: bulkAction,
                statusNote: rejectionNote || undefined,
                notify: notifyToggle,
            }),
        })

        if (res.ok) {
            const data = await res.json()
            const skippedEligibility = selected.size - eligibleIds.length
            let msg = `✅ ${data.updated} updated`
            if (data.notified > 0) msg += ` · ${data.notified} notified`
            if (data.skipped > 0) msg += ` · ${data.skipped} already notified (skipped)`
            if (skippedEligibility > 0) msg += ` · ${skippedEligibility} skipped (ineligible status)`
            setBulkToast(msg)
            setTimeout(() => setBulkToast(null), 5000)
        } else {
            setBulkToast('⚠️ Action failed. Please try again.')
            setTimeout(() => setBulkToast(null), 4000)
        }

        setSelected(new Set()); setBulkAction(''); setSelectAllQuery(false)
        setRejectionNote(''); setConfirmChecked(false)
        fetchApps(pagination.page)
    }

    const totalApps = Object.values(statusCounts).reduce((s, c) => s + c, 0)
    const selectedCount = selectAllQuery ? pagination.total : selected.size

    const getPhoto = (app: Application) => {
        if (!app.headshotPath) return null
        try { const photos = JSON.parse(app.headshotPath); return Array.isArray(photos) ? photos[0] : app.headshotPath } catch { return app.headshotPath }
    }

    const inp: React.CSSProperties = {
        padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
        color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit',
        colorScheme: 'dark',
    }

    const isDestructive = DESTRUCTIVE_ACTIONS.has(bulkAction)
    const willNotify = NOTIFY_ACTIONS.has(bulkAction) && notifyToggle

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>📋 Applications</h1>
                    <button
                        onClick={() => setShowAudit(v => !v)}
                        style={{
                            fontSize: '0.68rem', fontWeight: 600, padding: '5px 12px',
                            borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)',
                            background: showAudit ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.03)',
                            color: showAudit ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                        }}
                    >
                        📋 Action History
                    </button>
                </div>

                {/* ── Audit Trail Panel ── */}
                {showAudit && (
                    <div style={{
                        marginBottom: '14px', borderRadius: '10px', overflow: 'hidden',
                        border: '1px solid rgba(212,168,83,0.15)',
                        background: 'rgba(212,168,83,0.03)',
                    }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Recent Bulk Actions
                        </div>
                        {auditLog.length === 0 ? (
                            <div style={{ padding: '14px', fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>No bulk actions recorded yet.</div>
                        ) : auditLog.map((entry, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 14px', borderBottom: i < auditLog.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                fontSize: '0.72rem',
                            }}>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.action.replace(/_/g, ' ')}</span>
                                    {entry.details?.newStatus != null && <span style={{ marginLeft: '6px', color: 'var(--text-tertiary)' }}>→ {String(entry.details.newStatus)}</span>}
                                    {entry.details?.count != null && <span style={{ marginLeft: '6px', color: 'var(--accent-gold)' }}>({String(entry.details.count)} apps)</span>}
                                </div>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>
                                    {new Date(entry.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Status Pills */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => setStatus('all')} style={{
                        padding: '5px 14px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: status === 'all' ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)',
                        color: status === 'all' ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                    }}>All ({totalApps})</button>
                    {Object.entries(statusCounts).map(([s, c]) => {
                        const st = STATUS_STYLES[s] || STATUS_STYLES.pending
                        return (
                            <button key={s} onClick={() => setStatus(s)} style={{
                                padding: '5px 14px', fontSize: '0.68rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                                background: status === s ? st.bg : 'rgba(255,255,255,0.03)',
                                color: status === s ? st.color : 'var(--text-tertiary)',
                            }}>{st.label} ({c})</button>
                        )
                    })}
                </div>

                {/* Search + Controls */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <input style={{ ...inp, flex: 1, minWidth: '180px' }} placeholder="🔍 Search by name or email..." value={search} onChange={e => handleSearch(e.target.value)} />
                    <DarkDropdown value={sort} onChange={setSort} options={[
                        { value: 'newest', label: 'Newest First' },
                        { value: 'oldest', label: 'Oldest First' },
                        { value: 'score_high', label: 'Highest AI Score' },
                        { value: 'score_low', label: 'Lowest AI Score' },
                    ]} />
                    {(selected.size > 0 || selectAllQuery) && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                                {selectAllQuery ? `All ${pagination.total}` : selected.size} selected
                            </span>
                            <DarkDropdown value={bulkAction} onChange={setBulkAction} options={[
                                { value: '', label: 'Bulk Action...' },
                                { value: 'batch_audit', label: '🤖 Batch AI Audit' },
                                { value: 'download', label: '📥 Download ZIP' },
                                { value: 'export_csv', label: '📊 Export CSV' },
                                { value: 'under_review', label: '→ Begin Review' },
                                { value: 'shortlisted', label: '→ Shortlist' },
                                { value: 'callback', label: '→ Request Follow-up' },
                                { value: 'final_review', label: '→ Final Review' },
                                { value: 'not_selected', label: '→ Not Selected' },
                                { value: 'rejected', label: '→ Reject' },
                                { value: 'delete', label: '🗑️ Delete' },
                            ]} />
                            {/* Email notify toggle — only show for status-change actions */}
                            {NOTIFY_ACTIONS.has(bulkAction) && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                    <input
                                        type="checkbox"
                                        checked={notifyToggle}
                                        onChange={e => setNotifyToggle(e.target.checked)}
                                        style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                                    />
                                    Notify by email
                                </label>
                            )}
                            <button
                                onClick={openPreview}
                                disabled={!bulkAction || previewLoading}
                                style={{
                                    ...inp, cursor: bulkAction && !previewLoading ? 'pointer' : 'not-allowed',
                                    background: isDestructive ? 'rgba(244,63,94,0.1)' : 'rgba(212,168,83,0.1)',
                                    color: isDestructive ? '#f43f5e' : 'var(--accent-gold)',
                                    fontWeight: 700, opacity: !bulkAction ? 0.5 : 1,
                                    border: `1px solid ${isDestructive ? 'rgba(244,63,94,0.25)' : 'rgba(212,168,83,0.25)'}`,
                                }}
                            >
                                {previewLoading ? '...' : 'Apply'}
                            </button>
                        </div>
                    )}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{pagination.total.toLocaleString()} result{pagination.total !== 1 ? 's' : ''}</span>
                </div>

                {/* ── Select-All-Query Banner ── */}
                {!selectAllQuery && selected.size === apps.length && apps.length > 0 && pagination.total > apps.length && (
                    <div style={{
                        padding: '9px 14px', marginBottom: '10px', borderRadius: '8px',
                        background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)',
                        fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            All <strong style={{ color: '#60a5fa' }}>{apps.length}</strong> on this page are selected.
                        </span>
                        <button
                            onClick={() => setSelectAllQuery(true)}
                            style={{
                                background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)',
                                color: '#60a5fa', fontWeight: 700, fontSize: '0.72rem',
                                padding: '4px 12px', borderRadius: '6px', cursor: 'pointer',
                            }}
                        >
                            Select all {pagination.total.toLocaleString()} results
                        </button>
                    </div>
                )}
                {selectAllQuery && (
                    <div style={{
                        padding: '9px 14px', marginBottom: '10px', borderRadius: '8px',
                        background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)',
                        fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            All <strong style={{ color: 'var(--accent-gold)' }}>{pagination.total.toLocaleString()}</strong> matching results selected.
                        </span>
                        <button
                            onClick={() => { setSelectAllQuery(false); setSelected(new Set()) }}
                            style={{
                                background: 'transparent', border: 'none',
                                color: 'var(--text-tertiary)', fontSize: '0.7rem', cursor: 'pointer',
                            }}
                        >
                            Clear selection
                        </button>
                    </div>
                )}

                {/* Bulk Toast */}
                {bulkToast && (
                    <div style={{
                        padding: '10px 16px', marginBottom: '10px', borderRadius: '8px',
                        background: bulkToast.startsWith('⚠️') ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                        border: `1px solid ${bulkToast.startsWith('⚠️') ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)'}`,
                        fontSize: '0.78rem', fontWeight: 600,
                        color: bulkToast.startsWith('⚠️') ? '#f59e0b' : '#22c55e',
                    }}>
                        {bulkToast}
                    </div>
                )}

                {/* Batch Audit Progress */}
                {batchProgress && (
                    <div style={{
                        padding: '14px', marginBottom: '12px', borderRadius: '10px',
                        background: batchRunning
                            ? 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(212,168,83,0.04))'
                            : 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))',
                        border: `1px solid ${batchRunning ? 'rgba(139,92,246,0.2)' : 'rgba(34,197,94,0.2)'}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: batchRunning ? '#a78bfa' : '#22c55e' }}>
                                {batchRunning ? '⏳ AI Batch Audit Running...' : '✓ Batch Audit Complete'}
                            </div>
                            {!batchRunning && (
                                <button onClick={() => setBatchProgress(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                            )}
                        </div>
                        {batchRunning && (
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, #a78bfa, #d4a853)', width: '30%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    Processing {batchProgress.total} applications with rate-limited pacing (~8s between each)...
                                </div>
                            </div>
                        )}
                        {!batchRunning && batchProgress.results.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', fontSize: '0.72rem' }}>
                                    <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ {batchProgress.results.filter(r => r.status === 'success').length} audited</span>
                                    {batchProgress.results.filter(r => r.status === 'skipped').length > 0 && <span style={{ color: '#60a5fa' }}>⏭ {batchProgress.results.filter(r => r.status === 'skipped').length} skipped</span>}
                                    {batchProgress.results.filter(r => r.status === 'error').length > 0 && <span style={{ color: '#ef4444' }}>✗ {batchProgress.results.filter(r => r.status === 'error').length} errors</span>}
                                </div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {batchProgress.results.map((r, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '5px 8px', borderRadius: '4px', fontSize: '0.72rem',
                                            background: r.status === 'success' ? 'rgba(34,197,94,0.04)' : r.status === 'skipped' ? 'rgba(59,130,246,0.04)' : 'rgba(239,68,68,0.04)',
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{r.fullName}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {r.status === 'success' && <><span style={{ fontWeight: 700, fontSize: '0.7rem', color: (r.aiScore || 0) >= 75 ? '#22c55e' : (r.aiScore || 0) >= 50 ? '#f59e0b' : '#ef4444' }}>{r.aiScore}/100</span><span style={{ padding: '1px 6px', fontSize: '0.58rem', fontWeight: 700, borderRadius: '3px', background: r.recommendation === 'STRONG_FIT' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: r.recommendation === 'STRONG_FIT' ? '#22c55e' : '#f59e0b' }}>{(r.recommendation || '').replace(/_/g, ' ')}</span></>}
                                                {r.status === 'skipped' && <span style={{ fontSize: '0.65rem', color: '#60a5fa' }}>Already audited</span>}
                                                {r.status === 'error' && <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>{r.error?.slice(0, 50)}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Applications Grid */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
                ) : apps.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '2rem', opacity: 0.3, marginBottom: '8px' }}>📋</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {search ? 'No applications match your search' : 'No applications yet'}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {apps.map(app => {
                            const st = STATUS_STYLES[app.status] || STATUS_STYLES.pending
                            const photo = getPhoto(app)
                            const isWithdrawn = app.status === 'withdrawn'
                            return (
                                <div key={app.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: isWithdrawn ? 'rgba(239,68,68,0.02)' : selected.has(app.id) ? 'rgba(212,168,83,0.04)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isWithdrawn ? 'rgba(239,68,68,0.1)' : selected.has(app.id) ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.05)'}`,
                                    borderLeft: isWithdrawn ? '3px solid rgba(239,68,68,0.35)' : undefined,
                                    transition: 'all 0.15s', opacity: isWithdrawn ? 0.65 : 1,
                                }}>
                                    <input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleSelect(app.id)}
                                        disabled={isWithdrawn}
                                        style={{ cursor: isWithdrawn ? 'not-allowed' : 'pointer', accentColor: 'var(--accent-gold)', opacity: isWithdrawn ? 0.3 : 1 }} />
                                    {photo && (
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '6px', flexShrink: 0,
                                            backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center',
                                            border: '1px solid rgba(255,255,255,0.08)', filter: isWithdrawn ? 'grayscale(0.6)' : undefined,
                                        }} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Link href={`/admin/applications/${app.id}`} style={{
                                                fontSize: '0.85rem', fontWeight: 700, textDecoration: isWithdrawn ? 'line-through' : 'none',
                                                color: isWithdrawn ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                            }}>
                                                {app.fullName}
                                            </Link>
                                            <span style={{ fontSize: '0.52rem', padding: '1px 6px', borderRadius: '3px', fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                                            {app.aiScore !== null && (
                                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: app.aiScore >= 75 ? '#22c55e' : app.aiScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                                                    AI: {app.aiScore}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', gap: '8px', marginTop: '1px' }}>
                                            <span>🎬 {app.castingCall.project.title}</span>
                                            <span>🎭 {app.castingCall.roleName}</span>
                                            <span>📧 {app.email}</span>
                                            {isWithdrawn && <span style={{ color: '#f87171', fontWeight: 600 }}>⤺ Withdrawn by user</span>}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', flexShrink: 0, textAlign: 'right', lineHeight: 1.4 }}
                                        title={new Date(app.createdAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
                                    >
                                        <div>{new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                        <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>{new Date(app.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Select All + Pagination */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    {apps.length > 0 && (
                        <button onClick={selectAll} style={{
                            ...inp, cursor: 'pointer', fontSize: '0.7rem',
                            color: selected.size === apps.length ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                        }}>
                            {selected.size === apps.length ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                    {pagination.totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button disabled={pagination.page <= 1} onClick={() => fetchApps(pagination.page - 1)} style={{ ...inp, cursor: pagination.page > 1 ? 'pointer' : 'not-allowed', opacity: pagination.page <= 1 ? 0.3 : 1 }}>← Prev</button>
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
                                const p = start + i
                                if (p > pagination.totalPages) return null
                                return (
                                    <button key={p} onClick={() => fetchApps(p)} style={{
                                        ...inp, minWidth: '34px', textAlign: 'center', cursor: 'pointer',
                                        fontWeight: p === pagination.page ? 800 : 400,
                                        background: p === pagination.page ? 'var(--accent-gold-glow)' : 'rgba(255,255,255,0.03)',
                                        color: p === pagination.page ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                    }}>{p}</button>
                                )
                            })}
                            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchApps(pagination.page + 1)} style={{ ...inp, cursor: pagination.page < pagination.totalPages ? 'pointer' : 'not-allowed', opacity: pagination.page >= pagination.totalPages ? 0.3 : 1 }}>Next →</button>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Page {pagination.page} of {pagination.totalPages}</span>
                        </div>
                    )}
                </div>
            </main>

            {/* ─── Confirm / Preview Modal ─── */}
            {showConfirm && (
                <div
                    onClick={() => setShowConfirm(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9000,
                        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'linear-gradient(145deg, #141820, #101318)',
                            border: `1px solid ${isDestructive ? 'rgba(244,63,94,0.2)' : 'rgba(212,168,83,0.15)'}`,
                            borderRadius: '16px', padding: '32px',
                            maxWidth: '460px', width: '100%',
                            boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${isDestructive ? 'rgba(244,63,94,0.05)' : 'rgba(212,168,83,0.04)'}`,
                            animation: 'fadeUp 0.25s ease both',
                        }}
                    >
                        {/* Icon */}
                        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '12px' }}>
                            {bulkAction === 'delete' ? '🗑️' : isDestructive ? '⚠️' : '✅'}
                        </div>

                        {/* Title */}
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>
                            {bulkAction === 'delete' ? 'Permanently Delete?' : `Apply Bulk Action`}
                        </div>

                        {/* Description */}
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6, textAlign: 'center' }}>
                            {bulkAction === 'delete' ? (
                                <>You are about to <strong style={{ color: '#f43f5e' }}>permanently delete</strong> <strong>{selectedCount}</strong> application{selectedCount !== 1 ? 's' : ''} and all associated media files. This cannot be undone.</>
                            ) : (
                                <>Move <strong>{selectedCount}</strong> application{selectedCount !== 1 ? 's' : ''} to <strong style={{ color: isDestructive ? '#f43f5e' : 'var(--accent-gold)' }}>
                                    {STATUS_STYLES[bulkAction]?.label || bulkAction}
                                </strong>?</>
                            )}
                        </div>

                        {/* Preview breakdown */}
                        {preview && (
                            <div style={{
                                borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                                fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '5px',
                            }}>
                                {preview.eligible > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Eligible for update</span><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{preview.eligible}</span></div>}
                                {preview.ineligible > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Ineligible (wrong status)</span><span style={{ fontWeight: 700, color: '#f59e0b' }}>{preview.ineligible} — will be skipped</span></div>}
                                {willNotify && preview.wouldNotify > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Will receive email</span><span style={{ fontWeight: 700, color: '#60a5fa' }}>{preview.wouldNotify}</span></div>}
                                {willNotify && preview.alreadyNotified > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Already notified (skipped)</span><span style={{ fontWeight: 700, color: '#34d399' }}>{preview.alreadyNotified}</span></div>}
                            </div>
                        )}

                        {/* Rejection note */}
                        {(bulkAction === 'rejected' || bulkAction === 'not_selected') && (
                            <div style={{ marginBottom: '14px' }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Optional rejection note (included in email)
                                </div>
                                <textarea
                                    value={rejectionNote}
                                    onChange={e => setRejectionNote(e.target.value)}
                                    placeholder="Leave blank for the standard rejection message..."
                                    rows={3}
                                    style={{
                                        width: '100%', padding: '8px 10px', borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'var(--text-primary)', fontSize: '0.78rem', fontFamily: 'inherit',
                                        resize: 'vertical', colorScheme: 'dark', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        )}

                        {/* Required acknowledgement checkbox for destructive */}
                        {isDestructive && (
                            <label style={{
                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                marginBottom: '20px', cursor: 'pointer',
                                fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                            }}>
                                <input
                                    type="checkbox"
                                    checked={bulkAction === 'delete' ? deleteConfirmChecked : confirmChecked}
                                    onChange={e => bulkAction === 'delete' ? setDeleteConfirmChecked(e.target.checked) : setConfirmChecked(e.target.checked)}
                                    style={{ accentColor: '#f43f5e', marginTop: '2px', flexShrink: 0 }}
                                />
                                {bulkAction === 'delete'
                                    ? 'I understand this will permanently delete all selected applications and their media files. This cannot be undone.'
                                    : `I understand this will send a ${STATUS_STYLES[bulkAction]?.label || bulkAction} notification to ${willNotify && preview ? preview.wouldNotify : selectedCount} applicant${selectedCount !== 1 ? 's' : ''}.`
                                }
                            </label>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowConfirm(false)}
                                style={{
                                    flex: 1, padding: '11px', fontSize: '0.8rem', fontWeight: 600,
                                    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBulkAction}
                                disabled={isDestructive && !(bulkAction === 'delete' ? deleteConfirmChecked : confirmChecked)}
                                style={{
                                    flex: 1, padding: '11px', fontSize: '0.8rem', fontWeight: 700,
                                    borderRadius: '10px', cursor: 'pointer',
                                    opacity: isDestructive && !(bulkAction === 'delete' ? deleteConfirmChecked : confirmChecked) ? 0.4 : 1,
                                    background: isDestructive ? 'rgba(244,63,94,0.12)' : 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))',
                                    border: `1px solid ${isDestructive ? 'rgba(244,63,94,0.3)' : 'rgba(212,168,83,0.35)'}`,
                                    color: isDestructive ? '#f43f5e' : 'var(--accent-gold)',
                                    transition: 'opacity 0.15s',
                                }}
                            >
                                {bulkAction === 'delete' ? 'Delete Permanently' : isDestructive ? 'Confirm & Notify' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
