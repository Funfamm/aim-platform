'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'

interface LiveEvent {
    id: string
    title: string
    roomName: string
    status: string
    eventType: string
    hostUserId: string
    projectId: string | null
    castingCallId: string | null
    recordingUrl: string | null
    egressId: string | null
    startedAt: string | null
    endedAt: string | null
    createdAt: string
    participantCount: number   // real-time count from LiveKit (live rooms only)
}

interface Project { id: string; title: string }
interface CastingCall { id: string; roleName: string; projectId: string }

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    general:     { label: 'General',     icon: '📡', color: '#60a5fa' },
    audition:    { label: 'Audition',    icon: '🎭', color: '#a78bfa' },
    q_and_a:     { label: 'Q&A',         icon: '💬', color: '#34d399' },
    watch_party: { label: 'Watch Party', icon: '🎬', color: '#fb923c' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; glow: string; bg: string }> = {
    scheduled: { label: 'Scheduled', color: '#fbbf24', glow: 'rgba(251,191,36,0.4)',  bg: 'rgba(251,191,36,0.08)'  },
    live:      { label: 'Live',      color: '#34d399', glow: 'rgba(52,211,153,0.4)',  bg: 'rgba(52,211,153,0.08)'  },
    ended:     { label: 'Ended',     color: '#6b7280', glow: 'rgba(107,114,128,0.2)', bg: 'rgba(107,114,128,0.06)' },
}

export default function AdminEventsPage() {
    const [events, setEvents]           = useState<LiveEvent[]>([])
    const [projects, setProjects]       = useState<Project[]>([])
    const [castingCalls, setCastingCalls] = useState<CastingCall[]>([])
    const [loading, setLoading]         = useState(true)
    const [creating, setCreating]       = useState(false)
    const [ending, setEnding]           = useState<string | null>(null)
    const [deleting, setDeleting]       = useState<string | null>(null)  // eventId being deleted
    const [error, setError]             = useState<string | null>(null)
    const [success, setSuccess]         = useState<string | null>(null)
    const [showForm, setShowForm]       = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [recording, setRecording]     = useState<string | null>(null)
    const [copied, setCopied]           = useState<string | null>(null)
    const [shareEventId, setShareEventId] = useState<string | null>(null)  // eventId currently in share modal
    const [shareTarget, setShareTarget]   = useState<'all' | 'emails' | 'users'>('all')
    const [shareEmails, setShareEmails]   = useState('')  // newline-separated custom emails
    const [sharing, setSharing]           = useState(false)
    const [shareResult, setShareResult]   = useState<string | null>(null)
    // User search-to-select state
    const [userSearch, setUserSearch]       = useState('')
    const [userResults, setUserResults]     = useState<{ id: string; name: string; email: string }[]>([])
    const [selectedUsers, setSelectedUsers] = useState<{ id: string; name: string; email: string }[]>([])
    const [searchingUsers, setSearchingUsers] = useState(false)
    // Caption worker availability — checked once on mount via GET /api/livekit/captions/start
    const [captionWorkerOk, setCaptionWorkerOk] = useState<boolean | null>(null)
    // "You left" banner — populated from ?left=roomName query param after exit
    const [leftBanner, setLeftBanner]   = useState<string | null>(null)
    const searchParams = useSearchParams()

    const [form, setForm] = useState({
        title: '', roomName: '', eventType: 'general', projectId: '', castingCallId: '',
        scheduledAt: '', lobbyEnabled: true, replayEnabled: false,
    })

    const fetchEvents = useCallback(async () => {
        try {
            const res = await fetch('/api/livekit/rooms')
            if (!res.ok) throw new Error()
            const data = await res.json()
            setEvents(data.events || [])
        } catch { setError('Failed to load live events') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        fetchEvents()
        fetch('/api/admin/projects').then(r => r.json()).then((d: Project[]) => setProjects(Array.isArray(d) ? d : [])).catch(() => {})
        fetch('/api/admin/casting').then(r => r.json()).then((d: CastingCall[]) => setCastingCalls(Array.isArray(d) ? d : [])).catch(() => {})
        // Check caption worker availability once on mount (non-blocking)
        fetch('/api/livekit/captions/start')
            .then(r => r.json())
            .then((d: { configured?: boolean; reachable?: boolean }) => {
                setCaptionWorkerOk(d.configured === true && d.reachable === true)
            })
            .catch(() => setCaptionWorkerOk(false))
    }, [fetchEvents])

    // Auto-refresh participant counts every 15 s while any rooms are live.
    // Stops automatically when all rooms end or the component unmounts.
    useEffect(() => {
        const hasLive = events.some(e => e.status === 'live')
        if (!hasLive) return
        const interval = setInterval(fetchEvents, 15_000)
        return () => clearInterval(interval)
    }, [events, fetchEvents])

    // Read the ?left= param set by RoomShell.handleLeave — show a dismissible banner
    useEffect(() => {
        const leftRoom = searchParams.get('left')
        if (!leftRoom) return
        setLeftBanner(leftRoom)
        // Clean the URL without reloading
        const url = new URL(window.location.href)
        url.searchParams.delete('left')
        url.searchParams.delete('status')
        window.history.replaceState({}, '', url.toString())
        // Auto-dismiss after 8 s
        const t = setTimeout(() => setLeftBanner(null), 8_000)
        return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 5000) }

    // Debounced user search — only fires when shareTarget === 'users'
    useEffect(() => {
        if (shareTarget !== 'users' || !userSearch.trim()) { setUserResults([]); return }
        const t = setTimeout(async () => {
            setSearchingUsers(true)
            try {
                const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch.trim())}&limit=8`)
                if (res.ok) {
                    const data = await res.json()
                    const hits = (data.users ?? []) as { id: string; name: string; email: string }[]
                    // Exclude already-selected users
                    setUserResults(hits.filter(h => !selectedUsers.some(s => s.id === h.id)))
                }
            } catch { /* ignore */ }
            finally { setSearchingUsers(false) }
        }, 280) // 280 ms debounce
        return () => clearTimeout(t)
    }, [userSearch, shareTarget, selectedUsers])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true); setError(null)
        try {
            const res = await fetch('/api/livekit/rooms/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title:    form.title,
                    roomName: form.roomName,
                    eventType: form.eventType,
                    projectId: form.projectId || undefined,
                    castingCallId: form.castingCallId || undefined,
                    scheduledAt: form.scheduledAt || undefined,
                    lobbyEnabled: form.eventType === 'watch_party' ? form.lobbyEnabled : undefined,
                    replayEnabled: form.eventType === 'watch_party' ? form.replayEnabled : undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create room')
            showSuccess(`Room "${form.roomName}" created`)
            setForm({ title: '', roomName: '', eventType: 'general', projectId: '', castingCallId: '', scheduledAt: '', lobbyEnabled: true, replayEnabled: false })
            setShowForm(false)
            await fetchEvents()
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create room') }
        finally { setCreating(false) }
    }

    const handleEnd = async (roomName: string, title: string) => {
        if (!confirm(`End "${title}"? All participants will be disconnected.`)) return
        setEnding(roomName); setError(null)
        try {
            const res = await fetch('/api/livekit/rooms/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName }),
            })
            const data = await res.json()

            // 409 = already ended — treat as success (DB is correct, just refresh)
            if (res.status === 409) {
                showSuccess(`Room "${roomName}" was already ended — refreshing`)
                await fetchEvents()
                return
            }

            if (!res.ok) {
                // Surface the real error text from the server rather than a generic message
                throw new Error(data.error || `Server error (${res.status})`)
            }

            if (data.warning) {
                // LiveKit couldn't delete the room but DB was updated — show as info
                console.warn('[handleEnd]', data.warning)
            }

            showSuccess(`Room "${roomName}" ended`)
            await fetchEvents()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to end room')
        } finally {
            setEnding(null)
        }
    }

    const generateRoomName = () => {
        const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
        const suffix = Math.random().toString(36).slice(2, 6)
        setForm(f => ({ ...f, roomName: slug ? `${slug}-${suffix}` : `room-${suffix}` }))
    }

    const handleDelete = async (id: string, title: string, status: string) => {
        if (status === 'live') {
            setError('Cannot delete a live room. End the event first.')
            return
        }
        if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) return
        setDeleting(id); setError(null)
        try {
            const res = await fetch(`/api/livekit/rooms/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to delete event')
            showSuccess(`"${title}" deleted`)
            // Remove from local state immediately — no need to refetch
            setEvents(prev => prev.filter(e => e.id !== id))
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete event') }
        finally { setDeleting(null) }
    }

    const shareEvent = events.find(e => e.id === shareEventId)

    const handleShare = async () => {
        if (!shareEventId) return
        setSharing(true); setShareResult(null)
        try {
            const emails = shareTarget === 'emails'
                ? shareEmails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
                : []
            const userIds = shareTarget === 'users'
                ? selectedUsers.map(u => u.id)
                : []
            const res = await fetch('/api/livekit/rooms/share', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: shareEventId, target: shareTarget, emails, userIds }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to send invites')
            setShareResult(
                shareTarget === 'all'
                    ? `✓ Invite queued for ${data.targeted} eligible user${data.targeted !== 1 ? 's' : ''}`
                    : `✓ Invite sent to ${data.targeted} address${data.targeted !== 1 ? 'es' : ''}`
            )
        } catch (err) {
            setShareResult(`✗ ${err instanceof Error ? err.message : 'Failed'}`)
        } finally { setSharing(false) }
    }

    const filteredEvents = filterStatus === 'all' ? events : events.filter(e => e.status === filterStatus)
    const liveCount = events.filter(e => e.status === 'live').length
    const scheduledCount = events.filter(e => e.status === 'scheduled').length
    const endedCount = events.filter(e => e.status === 'ended').length

    return (
        <div className="admin-layout" style={{ background: '#06060f' }}>
            <AdminSidebar />
            <main className="admin-main" style={{ color: '#f0f0f5', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden' }}>
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

                    * { box-sizing: border-box; }

                    @keyframes pulse-live {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(0.85); }
                    }
                    @keyframes glow-pulse {
                        0%, 100% { box-shadow: 0 0 20px rgba(52,211,153,0.15), 0 0 0 1px rgba(52,211,153,0.2); }
                        50% { box-shadow: 0 0 35px rgba(52,211,153,0.3), 0 0 0 1px rgba(52,211,153,0.35); }
                    }
                    @keyframes slide-down {
                        from { opacity: 0; transform: translateY(-12px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes fade-in {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes shimmer {
                        0% { background-position: -200% center; }
                        100% { background-position: 200% center; }
                    }

                    .le-page { animation: fade-in 0.4s ease; }

                    /* ── Header ── */
                    .le-header {
                        display: flex; align-items: flex-start; justify-content: space-between;
                        flex-wrap: wrap; gap: 1.5rem; margin-bottom: 2rem;
                    }
                    .le-eyebrow {
                        font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em;
                        text-transform: uppercase; color: #d4a853; margin-bottom: 0.4rem;
                        display: flex; align-items: center; gap: 0.4rem;
                    }
                    .le-eyebrow::before { content: ''; width: 18px; height: 2px; background: #d4a853; border-radius: 2px; }
                    .le-title {
                        font-size: 2rem; font-weight: 900; color: #fff; margin: 0;
                        letter-spacing: -0.04em; line-height: 1.1;
                    }
                    .le-title span { 
                        background: linear-gradient(135deg, #ffffff 0%, #d4a853 60%, #f0c060 100%);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
                    }
                    .le-subtitle { font-size: 0.82rem; color: rgba(255,255,255,0.35); margin-top: 0.4rem; }

                    .le-create-btn {
                        display: inline-flex; align-items: center; gap: 0.5rem;
                        background: linear-gradient(135deg, #d4a853 0%, #f0c060 50%, #d4a853 100%);
                        background-size: 200%;
                        color: #0a0804; padding: 0.75rem 1.5rem;
                        border: none; border-radius: 12px; font-weight: 800;
                        font-size: 0.85rem; cursor: pointer; letter-spacing: 0.01em;
                        transition: all 0.3s ease; position: relative; overflow: hidden;
                        box-shadow: 0 4px 24px rgba(212,168,83,0.35);
                    }
                    .le-create-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 32px rgba(212,168,83,0.5);
                        background-position: right;
                    }
                    .le-create-btn.active {
                        background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
                        box-shadow: none; border: 1px solid rgba(255,255,255,0.1);
                    }

                    /* ── Stats Bar ── */
                    .le-stats {
                        display: flex; gap: 1px; margin-bottom: 2rem;
                        background: rgba(255,255,255,0.04);
                        border: 1px solid rgba(255,255,255,0.07);
                        border-radius: 16px; overflow: hidden;
                    }
                    .le-stat {
                        flex: 1; padding: 1rem 1.25rem;
                        display: flex; align-items: center; gap: 0.9rem;
                        cursor: pointer; transition: background 0.2s; position: relative;
                    }
                    .le-stat:hover { background: rgba(255,255,255,0.03); }
                    .le-stat.active { background: rgba(255,255,255,0.04); }
                    .le-stat.active::after {
                        content: ''; position: absolute; bottom: 0; left: 0; right: 0;
                        height: 2px; background: var(--stat-color);
                    }
                    .le-stat-icon {
                        width: 36px; height: 36px; border-radius: 10px;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 1rem; flex-shrink: 0;
                    }
                    .le-stat-num {
                        font-size: 1.5rem; font-weight: 900; letter-spacing: -0.03em;
                        color: #fff; line-height: 1;
                    }
                    .le-stat-label { font-size: 0.7rem; color: rgba(255,255,255,0.35); margin-top: 2px; font-weight: 500; }
                    @media (max-width: 640px) {
                        .le-stats { flex-direction: column; }
                        .le-stat.active::after { width: 3px; height: auto; top: 0; bottom: 0; left: 0; right: auto; }
                    }

                    /* ── Alerts ── */
                    .le-alert {
                        display: flex; align-items: center; gap: 0.75rem;
                        padding: 0.9rem 1.1rem; border-radius: 12px;
                        font-size: 0.82rem; font-weight: 600; margin-bottom: 1.25rem;
                        animation: slide-down 0.25s ease;
                    }
                    .le-alert--error   { background: rgba(239,68,68,0.08);  border: 1px solid rgba(239,68,68,0.2);  color: #fca5a5; }
                    .le-alert--success { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2); color: #6ee7b7; }
                    .le-alert-icon { font-size: 1rem; flex-shrink: 0; }

                    /* ── Create Form ── */
                    .le-form-wrap {
                        margin-bottom: 2rem; animation: slide-down 0.3s cubic-bezier(0.16,1,0.3,1);
                    }
                    .le-form-card {
                        background: rgba(255,255,255,0.025);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 20px; padding: 2rem;
                        position: relative; overflow: hidden;
                    }
                    .le-form-card::before {
                        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(212,168,83,0.4), transparent);
                    }
                    .le-form-title {
                        font-size: 1.1rem; font-weight: 800; color: #fff; margin: 0 0 0.25rem;
                        letter-spacing: -0.02em;
                    }
                    .le-form-desc { font-size: 0.76rem; color: rgba(255,255,255,0.3); margin: 0 0 1.75rem; }
                    .le-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
                    @media (max-width: 640px) { .le-form-grid { grid-template-columns: 1fr; } }
                    .le-field { display: flex; flex-direction: column; gap: 0.45rem; }
                    .le-label {
                        font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
                        letter-spacing: 0.1em; color: rgba(255,255,255,0.35);
                    }
                    .le-label span { color: #d4a853; }
                    .le-input, .le-select {
                        width: 100%; background: rgba(255,255,255,0.04);
                        border: 1px solid rgba(255,255,255,0.09); border-radius: 10px;
                        padding: 0.7rem 1rem; font-size: 0.85rem; color: #fff;
                        outline: none; transition: all 0.2s; font-family: inherit;
                    }
                    .le-input:focus, .le-select:focus {
                        border-color: rgba(212,168,83,0.45);
                        background: rgba(212,168,83,0.04);
                        box-shadow: 0 0 0 3px rgba(212,168,83,0.08);
                    }
                    .le-input::placeholder { color: rgba(255,255,255,0.18); }
                    .le-select option { background: #0d0d1a; color: #fff; }
                    .le-room-row { display: flex; gap: 0.5rem; align-items: stretch; }
                    .le-room-row .le-input { flex: 1; }
                    .le-auto-btn {
                        padding: 0 1rem; background: rgba(212,168,83,0.08);
                        border: 1px solid rgba(212,168,83,0.2); border-radius: 10px;
                        color: #d4a853; font-size: 0.72rem; font-weight: 700;
                        cursor: pointer; white-space: nowrap; letter-spacing: 0.05em;
                        text-transform: uppercase; transition: all 0.2s; font-family: inherit;
                    }
                    .le-auto-btn:hover { background: rgba(212,168,83,0.16); border-color: rgba(212,168,83,0.35); }
                    .le-type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
                    @media (max-width: 640px) { .le-type-grid { grid-template-columns: repeat(2, 1fr); } }
                    .le-type-opt {
                        padding: 0.6rem 0.5rem; border-radius: 10px; cursor: pointer;
                        border: 1px solid rgba(255,255,255,0.07); text-align: center;
                        transition: all 0.18s; background: rgba(255,255,255,0.03);
                    }
                    .le-type-opt:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); }
                    .le-type-opt.selected { border-color: rgba(212,168,83,0.4); background: rgba(212,168,83,0.08); }
                    .le-type-opt-icon { font-size: 1.2rem; display: block; margin-bottom: 0.2rem; }
                    .le-type-opt-label { font-size: 0.68rem; font-weight: 600; color: rgba(255,255,255,0.6); }
                    .le-type-opt.selected .le-type-opt-label { color: #d4a853; }
                    .le-form-actions {
                        display: flex; align-items: center; gap: 0.75rem; margin-top: 1.75rem; flex-wrap: wrap;
                    }
                    .le-submit-btn {
                        padding: 0.7rem 2rem; background: linear-gradient(135deg, #d4a853, #f0c060);
                        border: none; border-radius: 10px; color: #0a0804;
                        font-weight: 800; font-size: 0.85rem; cursor: pointer;
                        transition: all 0.2s; letter-spacing: 0.01em; font-family: inherit;
                    }
                    .le-submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(212,168,83,0.4); }
                    .le-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }
                    .le-cancel-btn {
                        padding: 0.7rem 1.25rem; background: transparent;
                        border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
                        color: rgba(255,255,255,0.4); font-size: 0.85rem; cursor: pointer;
                        transition: all 0.2s; font-family: inherit;
                    }
                    .le-cancel-btn:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.65); }

                    /* ── Events Grid ── */
                    .le-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
                        gap: 1.25rem;
                    }
                    @media (max-width: 800px) { .le-grid { grid-template-columns: 1fr; } }

                    .le-card {
                        background: rgba(255,255,255,0.025);
                        border: 1px solid rgba(255,255,255,0.07);
                        border-radius: 18px; padding: 1.5rem;
                        transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
                        position: relative; overflow: hidden;
                        animation: fade-in 0.4s ease;
                    }
                    .le-card::before {
                        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
                        transition: opacity 0.25s;
                    }
                    .le-card:hover {
                        border-color: rgba(255,255,255,0.13);
                        transform: translateY(-3px);
                        box-shadow: 0 16px 48px rgba(0,0,0,0.4);
                    }
                    .le-card--live {
                        border-color: rgba(52,211,153,0.2) !important;
                        animation: glow-pulse 3s ease-in-out infinite, fade-in 0.4s ease;
                    }
                    .le-card--live::before {
                        background: linear-gradient(90deg, transparent, rgba(52,211,153,0.2), transparent);
                    }
                    .le-card-corner {
                        position: absolute; top: 0; right: 0; width: 80px; height: 80px;
                        background: radial-gradient(circle at top right, var(--corner-color, rgba(255,255,255,0.02)) 0%, transparent 70%);
                        pointer-events: none;
                    }

                    .le-card-top {
                        display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;
                        margin-bottom: 1rem;
                    }
                    .le-card-title {
                        font-size: 1rem; font-weight: 800; color: #fff; margin: 0 0 0.3rem;
                        letter-spacing: -0.02em; line-height: 1.3;
                    }
                    .le-card-room {
                        font-size: 0.68rem; color: rgba(255,255,255,0.25);
                        font-family: 'SF Mono', 'Fira Code', monospace; letter-spacing: 0.03em;
                    }

                    .le-status-badge {
                        display: inline-flex; align-items: center; gap: 0.35rem;
                        font-size: 0.62rem; font-weight: 800; padding: 0.28rem 0.7rem;
                        border-radius: 100px; text-transform: uppercase; letter-spacing: 0.08em;
                        white-space: nowrap; flex-shrink: 0;
                    }
                    .le-status-dot {
                        width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
                    }
                    .le-status-dot--live { animation: pulse-live 1.2s ease infinite; }

                    .le-divider {
                        height: 1px; background: rgba(255,255,255,0.05); margin: 1rem 0;
                    }

                    .le-card-meta {
                        display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;
                    }
                    .le-meta-chip {
                        display: inline-flex; align-items: center; gap: 0.3rem;
                        padding: 0.2rem 0.6rem; border-radius: 7px; font-size: 0.68rem; font-weight: 600;
                    }
                    .le-meta-chip--type {
                        background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.45);
                        border: 1px solid rgba(255,255,255,0.06);
                    }
                    .le-meta-chip--time {
                        background: transparent; color: rgba(255,255,255,0.28);
                    }

                    .le-recording-banner {
                        display: flex; align-items: center; gap: 0.5rem;
                        padding: 0.5rem 0.75rem; margin-top: 0.75rem;
                        background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15);
                        border-radius: 8px; font-size: 0.7rem; color: #fca5a5;
                    }
                    .le-rec-pulse { animation: pulse-live 1s ease infinite; }

                    .le-recording-link {
                        display: inline-flex; align-items: center; gap: 0.4rem;
                        margin-top: 0.75rem; padding: 0.45rem 0.85rem;
                        background: rgba(96,165,250,0.07); border: 1px solid rgba(96,165,250,0.15);
                        border-radius: 8px; color: #93c5fd; font-size: 0.72rem; font-weight: 600;
                        text-decoration: none; transition: all 0.2s;
                    }
                    .le-recording-link:hover { background: rgba(96,165,250,0.13); color: #bfdbfe; }

                    /* ── Action Buttons ── */
                    .le-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.1rem; }

                    .le-btn {
                        display: inline-flex; align-items: center; gap: 0.35rem;
                        padding: 0.45rem 0.9rem; border-radius: 9px;
                        font-size: 0.72rem; font-weight: 700; cursor: pointer;
                        border: 1px solid; transition: all 0.2s; text-decoration: none;
                        white-space: nowrap; font-family: inherit; letter-spacing: 0.01em;
                    }
                    .le-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                    .le-btn--view {
                        background: rgba(212,168,83,0.07); border-color: rgba(212,168,83,0.2); color: #e8b95a;
                    }
                    .le-btn--view:hover { background: rgba(212,168,83,0.14); border-color: rgba(212,168,83,0.35); }

                    .le-btn--copy {
                        background: rgba(99,179,237,0.07); border-color: rgba(99,179,237,0.18); color: #90cdf4;
                    }
                    .le-btn--copy:hover { background: rgba(99,179,237,0.13); border-color: rgba(99,179,237,0.32); }

                    .le-btn--captions {
                        background: rgba(139,92,246,0.07); border-color: rgba(139,92,246,0.22); color: #c4b5fd;
                    }
                    .le-btn--captions:hover { background: rgba(139,92,246,0.14); border-color: rgba(139,92,246,0.38); }

                    .le-btn--record {
                        background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.2); color: #fca5a5;
                    }
                    .le-btn--record:hover:not(:disabled) { background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.35); }
                    .le-btn--record-stop {
                        background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.4); color: #f87171;
                    }

                    .le-btn--end {
                        background: transparent; border-color: rgba(255,255,255,0.09); color: rgba(255,255,255,0.35);
                    }
                    .le-btn--end:hover:not(:disabled) { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.25); color: #fca5a5; }

                    .le-btn--delete {
                        background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.18); color: rgba(239,68,68,0.6);
                    }
                    .le-btn--delete:hover:not(:disabled) { background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.4); color: #fca5a5; }
                    .le-btn--delete:disabled { opacity: 0.3; cursor: not-allowed; }

                    .le-btn--share {
                        background: rgba(52,211,153,0.06); border-color: rgba(52,211,153,0.18); color: #6ee7b7;
                    }
                    .le-btn--share:hover { background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.32); }

                    .le-participant-count {
                        display: inline-flex; align-items: center; gap: 4px;
                        font-size: 0.62rem; font-weight: 700;
                        color: rgba(52,211,153,0.8);
                        background: rgba(52,211,153,0.06);
                        border: 1px solid rgba(52,211,153,0.15);
                        padding: 2px 7px; border-radius: 100px;
                        white-space: nowrap;
                    }
                    /* ── Empty State ── */
                    .le-empty {
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        padding: 5rem 2rem; text-align: center;
                    }
                    .le-empty-orb {
                        width: 90px; height: 90px; border-radius: 50%;
                        background: radial-gradient(circle, rgba(212,168,83,0.12) 0%, rgba(212,168,83,0.03) 60%, transparent 100%);
                        border: 1px solid rgba(212,168,83,0.1);
                        display: flex; align-items: center; justify-content: center;
                        font-size: 2.2rem; margin-bottom: 1.5rem;
                        box-shadow: 0 0 40px rgba(212,168,83,0.08);
                    }
                    .le-empty-title { font-size: 1.15rem; font-weight: 800; color: rgba(255,255,255,0.7); margin: 0 0 0.5rem; letter-spacing: -0.02em; }
                    .le-empty-desc { font-size: 0.8rem; color: rgba(255,255,255,0.28); max-width: 300px; line-height: 1.6; }

                    /* ── Loading skeleton ── */
                    .le-skeleton {
                        background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite; border-radius: 8px;
                    }
                `}</style>

                <div className="le-page">

                    {/* ── Header ── */}
                    <div className="le-header">
                        <div>
                            <div className="le-eyebrow">Control Center</div>
                            <h1 className="le-title">Live <span>Events</span></h1>
                            <p className="le-subtitle">Create and manage real-time LiveKit rooms for auditions, Q&As, and broadcasts</p>
                        </div>
                        <button
                            id="admin-events-create-btn"
                            className={`le-create-btn${showForm ? ' active' : ''}`}
                            onClick={() => setShowForm(v => !v)}
                        >
                            {showForm ? (
                                <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Cancel</>
                            ) : (
                                <><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg> New Room</>
                            )}
                        </button>
                    </div>

                    {/* ── Stats ── */}
                    <div className="le-stats">
                        {[
                            { key: 'all', label: 'Total Rooms', count: events.length, color: '#d4a853', bg: 'rgba(212,168,83,0.1)', icon: '🌐' },
                            { key: 'live', label: 'Live Now', count: liveCount, color: '#34d399', bg: 'rgba(52,211,153,0.1)', icon: '🔴' },
                            { key: 'scheduled', label: 'Scheduled', count: scheduledCount, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', icon: '📅' },
                            { key: 'ended', label: 'Ended', count: endedCount, color: '#6b7280', bg: 'rgba(107,114,128,0.08)', icon: '⬜' },
                        ].map(stat => (
                            <div
                                key={stat.key}
                                className={`le-stat${filterStatus === stat.key ? ' active' : ''}`}
                                style={{ '--stat-color': stat.color } as React.CSSProperties}
                                onClick={() => setFilterStatus(stat.key)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="le-stat-icon" style={{ background: stat.bg }}>
                                    {stat.icon}
                                </div>
                                <div>
                                    <div className="le-stat-num" style={{ color: stat.color }}>{stat.count}</div>
                                    <div className="le-stat-label">{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Alerts ── */}
                    {error && (
                        <div className="le-alert le-alert--error" role="alert">
                            <span className="le-alert-icon">⚠️</span>
                            {error}
                            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: '0.85rem' }}>✕</button>
                        </div>
                    )}
                    {success && (
                        <div className="le-alert le-alert--success" role="status">
                            <span className="le-alert-icon">✓</span>
                            {success}
                        </div>
                    )}
                    {leftBanner && (
                        <div
                            className="le-alert"
                            role="status"
                            style={{
                                background: 'rgba(212,168,83,0.07)',
                                border: '1px solid rgba(212,168,83,0.2)',
                                color: '#e8b95a',
                                justifyContent: 'space-between',
                                animation: 'slide-down 0.3s ease',
                            }}
                        >
                            <span>👋 You left <strong style={{ fontFamily: 'monospace', fontSize: '0.88em' }}>{leftBanner}</strong></span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <a
                                    href={`/en/events/${leftBanner}`}
                                    style={{
                                        padding: '4px 12px', borderRadius: '7px', fontSize: '0.75rem',
                                        background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.3)',
                                        color: '#e8b95a', textDecoration: 'none', fontWeight: 700,
                                    }}
                                >
                                    Rejoin
                                </a>
                                <button
                                    onClick={() => setLeftBanner(null)}
                                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.5, fontSize: '0.85rem' }}
                                >✕</button>
                            </div>
                        </div>
                    )}

                    {/* ── Create Form ── */}
                    {showForm && (
                        <div className="le-form-wrap">
                            <div className="le-form-card">
                                <h2 className="le-form-title">Launch New Room</h2>
                                <p className="le-form-desc">Configure your live event — participants will join via the room link</p>
                                <form onSubmit={handleCreate}>
                                    {/* Event type picker */}
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div className="le-label" style={{ marginBottom: '0.6rem' }}>Event Type</div>
                                        <div className="le-type-grid">
                                            {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                                                <div
                                                    key={key}
                                                    className={`le-type-opt${form.eventType === key ? ' selected' : ''}`}
                                                    onClick={() => setForm(f => ({ ...f, eventType: key }))}
                                                    role="button" tabIndex={0}
                                                >
                                                    <span className="le-type-opt-icon">{cfg.icon}</span>
                                                    <span className="le-type-opt-label">{cfg.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="le-form-grid">
                                        <div className="le-field">
                                            <label className="le-label" htmlFor="le-event-title">Title <span>*</span></label>
                                            <input
                                                id="le-event-title" className="le-input"
                                                value={form.title} required
                                                placeholder="e.g. Live Audition — Lead Role"
                                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                            />
                                        </div>
                                        <div className="le-field">
                                            <label className="le-label" htmlFor="le-room-name">Room Slug <span>*</span></label>
                                            <div className="le-room-row">
                                                <input
                                                    id="le-room-name" className="le-input"
                                                    value={form.roomName} required pattern="[a-zA-Z0-9_-]+"
                                                    placeholder="auto-generated-slug"
                                                    onChange={e => setForm(f => ({ ...f, roomName: e.target.value }))}
                                                />
                                                <button type="button" className="le-auto-btn" onClick={generateRoomName}>Auto</button>
                                            </div>
                                        </div>
                                        <div className="le-field">
                                            <label className="le-label" htmlFor="le-project">Link to Project</label>
                                            <select id="le-project" className="le-select" value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                                                <option value="">— None —</option>
                                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                            </select>
                                        </div>
                                        {form.eventType === 'audition' && (
                                            <div className="le-field">
                                                <label className="le-label" htmlFor="le-casting">Casting Call</label>
                                                <select id="le-casting" className="le-select" value={form.castingCallId} onChange={e => setForm(f => ({ ...f, castingCallId: e.target.value }))}>
                                                    <option value="">— None —</option>
                                                    {castingCalls.map(cc => <option key={cc.id} value={cc.id}>{cc.roleName}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {/* Scheduled date/time */}
                                        <div className="le-field">
                                            <label className="le-label" htmlFor="le-scheduled-at">Scheduled For <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(optional)</span></label>
                                            <input
                                                id="le-scheduled-at" className="le-input"
                                                type="datetime-local"
                                                value={form.scheduledAt}
                                                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>

                                        {/* Watch Party specific options */}
                                        {form.eventType === 'watch_party' && (
                                            <div className="le-field" style={{ gridColumn: 'span 2' }}>
                                                <div className="le-label" style={{ marginBottom: '0.6rem' }}>Watch Party Options</div>
                                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={form.lobbyEnabled}
                                                            onChange={e => setForm(f => ({ ...f, lobbyEnabled: e.target.checked }))}
                                                            style={{ accentColor: '#d4a853', width: '16px', height: '16px' }}
                                                        />
                                                        Enable lobby (viewers wait for host)
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={form.replayEnabled}
                                                            onChange={e => setForm(f => ({ ...f, replayEnabled: e.target.checked }))}
                                                            style={{ accentColor: '#d4a853', width: '16px', height: '16px' }}
                                                        />
                                                        Allow replay after event ends
                                                    </label>
                                                </div>
                                                {!form.projectId && (
                                                    <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '8px' }}>
                                                        ⚠ Link a Project above so viewers have media to watch.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>{/* end le-form-grid */}
                                    <div className="le-form-actions">
                                        <button id="admin-events-submit-btn" type="submit" className="le-submit-btn" disabled={creating}>
                                            {creating ? '⏳ Launching…' : '🚀 Launch Room'}
                                        </button>
                                        <button type="button" className="le-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* ── Events Grid ── */}
                    {loading ? (
                        <div className="le-grid">
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '1.5rem' }}>
                                    <div className="le-skeleton" style={{ height: 18, width: '65%', marginBottom: '0.75rem' }} />
                                    <div className="le-skeleton" style={{ height: 12, width: '40%', marginBottom: '1.25rem' }} />
                                    <div className="le-skeleton" style={{ height: 10, width: '50%', marginBottom: '0.5rem' }} />
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem' }}>
                                        <div className="le-skeleton" style={{ height: 32, width: 90, borderRadius: 9 }} />
                                        <div className="le-skeleton" style={{ height: 32, width: 80, borderRadius: 9 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="le-empty">
                            <div className="le-empty-orb">📡</div>
                            <h3 className="le-empty-title">
                                {filterStatus === 'live' ? 'No rooms are live right now' :
                                 filterStatus === 'scheduled' ? 'Nothing scheduled yet' :
                                 filterStatus === 'ended' ? 'No ended rooms' :
                                 'No live events yet'}
                            </h3>
                            <p className="le-empty-desc">
                                {filterStatus === 'all'
                                    ? 'Click "New Room" to launch your first live event — auditions, Q&As, or watch parties.'
                                    : `No ${filterStatus} events to display. Try a different filter.`}
                            </p>
                        </div>
                    ) : (
                        <div className="le-grid">
                            {filteredEvents.map(event => {
                                const sc = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.ended
                                const tc = EVENT_TYPE_CONFIG[event.eventType]
                                const isLive = event.status === 'live'
                                const isEnded = event.status === 'ended'

                                return (
                                    <div
                                        key={event.id}
                                        className={`le-card${isLive ? ' le-card--live' : ''}`}
                                        style={{ '--corner-color': sc.glow } as React.CSSProperties}
                                        data-room={event.roomName}
                                    >
                                        <div className="le-card-corner" />

                                        <div className="le-card-top">
                                            <div style={{ minWidth: 0 }}>
                                                <h3 className="le-card-title">{event.title}</h3>
                                                <div className="le-card-room">{event.roomName}</div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                                                <span
                                                    className="le-status-badge"
                                                    style={{ background: sc.bg, border: `1px solid ${sc.glow}`, color: sc.color }}
                                                >
                                                    <span className={`le-status-dot${isLive ? ' le-status-dot--live' : ''}`} style={{ background: sc.color }} />
                                                    {sc.label}
                                                </span>
                                                {/* Participant count — visible only for live rooms */}
                                                {isLive && (
                                                    <span className="le-participant-count" title={`${event.participantCount} participant(s) in room`}>
                                                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><circle cx="4" cy="3" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1 9c0-1.66 1.34-3 3-3s3 1.34 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                                                        {event.participantCount > 0
                                                            ? `${event.participantCount} in room`
                                                            : 'No participants yet'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="le-card-meta">
                                            {tc && (
                                                <span className="le-meta-chip le-meta-chip--type">
                                                    {tc.icon} {tc.label}
                                                </span>
                                            )}
                                            {event.startedAt && (
                                                <span className="le-meta-chip le-meta-chip--time">
                                                    ▶ {new Date(event.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                            {event.endedAt && (
                                                <span className="le-meta-chip le-meta-chip--time">
                                                    ⏹ {new Date(event.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                            {!event.startedAt && (
                                                <span className="le-meta-chip le-meta-chip--time">
                                                    📅 {new Date(event.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>

                                        {event.egressId && isLive && (
                                            <div className="le-recording-banner">
                                                <span className="le-rec-pulse">⏺</span>
                                                Recording in progress
                                            </div>
                                        )}

                                        {event.recordingUrl && (
                                            <a href={event.recordingUrl} className="le-recording-link" target="_blank" rel="noopener noreferrer">
                                                🎞️ Recording ready — watch now
                                            </a>
                                        )}

                                        <div className="le-divider" />

                                        <div className="le-actions">
                                            {!isEnded && (
                                                <a
                                                    href={event.eventType === 'watch_party'
                                                        ? `/en/events/watch/${event.roomName}`
                                                        : `/en/events/${event.roomName}`}
                                                    className="le-btn le-btn--view"
                                                    target="_blank" rel="noopener noreferrer"
                                                    aria-label={`View room ${event.roomName}`}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 9L9 1M9 1H4M9 1V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                    {event.eventType === 'watch_party' ? '🎬 Watch Party' : 'View Room'}
                                                </a>
                                            )}
                                            {/* Copy participant link */}
                                            <button
                                                id={`ae-copy-link-${event.id}`}
                                                className="le-btn le-btn--copy"
                                                title={`Copy participant link`}
                                                onClick={() => {
                                                    const path = event.eventType === 'watch_party'
                                                        ? `/en/events/watch/${event.roomName}`
                                                        : `/en/events/${event.roomName}`
                                                    const url = `${window.location.origin}${path}`
                                                    navigator.clipboard.writeText(url).then(() => {
                                                        setCopied(event.id)
                                                        setTimeout(() => setCopied(null), 2000)
                                                    })
                                                }}
                                            >
                                                {copied === event.id ? (
                                                    <><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> Copied!</>
                                                ) : (
                                                    <><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 3V2a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Copy Link</>
                                                )}
                                            </button>
                                            {isLive && event.eventType !== 'watch_party' && (
                                                captionWorkerOk === false ? (
                                                    <button
                                                        id={`ae-captions-btn-${event.id}`}
                                                        className="le-btn le-btn--captions"
                                                        disabled
                                                        title="Caption worker not configured. Set CAPTION_WORKER_URL and WORKER_WEBHOOK_SECRET in your environment variables."
                                                        style={{ opacity: 0.35, cursor: 'not-allowed', position: 'relative' }}
                                                    >
                                                        ⚠ Captions
                                                    </button>
                                                ) : (
                                                    <button
                                                        id={`ae-captions-btn-${event.id}`}
                                                        className="le-btn le-btn--captions"
                                                        onClick={async () => {
                                                            try {
                                                                const res = await fetch('/api/livekit/captions/start', {
                                                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ roomName: event.roomName }),
                                                                })
                                                                const data = await res.json()
                                                                if (!res.ok) setError(data.error || 'Failed to start captions')
                                                                else showSuccess(`Captions started for ${event.roomName}`)
                                                            } catch { setError('Failed to reach caption worker') }
                                                        }}
                                                    >
                                                        ▶ Captions
                                                    </button>
                                                )
                                            )}
                                            {isLive && event.eventType !== 'watch_party' && (
                                                <button
                                                    id={`ae-record-btn-${event.id}`}
                                                    className={`le-btn ${event.egressId ? 'le-btn--record-stop' : 'le-btn--record'}`}
                                                    disabled={recording === event.roomName}
                                                    onClick={async () => {
                                                        setRecording(event.roomName); setError(null)
                                                        try {
                                                            if (event.egressId) {
                                                                const res = await fetch('/api/livekit/rooms/egress', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomName: event.roomName }) })
                                                                const data = await res.json()
                                                                if (!res.ok) setError(data.error || 'Failed to stop recording')
                                                                else showSuccess('Recording stopped — file will be ready shortly')
                                                            } else {
                                                                const res = await fetch('/api/livekit/rooms/egress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomName: event.roomName, outputType: 'mp4' }) })
                                                                const data = await res.json()
                                                                if (!res.ok) setError(data.error || 'Failed to start recording')
                                                                else showSuccess(`Recording started for ${event.roomName}`)
                                                            }
                                                            await fetchEvents()
                                                        } catch { setError('Recording request failed') }
                                                        finally { setRecording(null) }
                                                    }}
                                                >
                                                    {recording === event.roomName ? '⏳ …'
                                                        : event.egressId ? '⏹ Stop Rec'
                                                        : '⏺ Record'}
                                                </button>
                                            )}
                                            {/* Share button — all non-ended rooms */}
                                            {!isEnded && (
                                                <button
                                                    id={`ae-share-btn-${event.id}`}
                                                    className="le-btn le-btn--share"
                                                    onClick={() => {
                                                        setShareEventId(event.id)
                                                        setShareTarget('all')
                                                        setShareEmails('')
                                                        setShareResult(null)
                                                        setUserSearch('')
                                                        setUserResults([])
                                                        setSelectedUsers([])
                                                    }}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="7.5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="2" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3.4 4.2l2.7-1.6M3.4 5.8l2.7 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                                                    Share
                                                </button>
                                            )}
                                            {!isEnded && (
                                                <button
                                                    id={`ae-end-btn-${event.id}`}
                                                    className="le-btn le-btn--end"
                                                    disabled={ending === event.roomName}
                                                    onClick={() => handleEnd(event.roomName, event.title)}
                                                >
                                                    {ending === event.roomName ? '⏳ Ending…' : '⏹ End Room'}
                                                </button>
                                            )}
                                            {/* Delete — blocked on live rooms AND while ending */}
                                            <button
                                                id={`ae-delete-btn-${event.id}`}
                                                className="le-btn le-btn--delete"
                                                disabled={deleting === event.id || event.status === 'live' || ending === event.roomName}
                                                title={
                                                    event.status === 'live'
                                                        ? 'End the room first before deleting'
                                                        : ending === event.roomName
                                                            ? 'Waiting for room to end…'
                                                            : `Delete "${event.title}" permanently`
                                                }
                                                onClick={() => handleDelete(event.id, event.title, event.status)}
                                            >
                                                {deleting === event.id ? (
                                                    '⏳ Deleting…'
                                                ) : (
                                                    <>
                                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                            <path d="M1 2.5h8M3.5 2.5V1.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M2 2.5l.5 6a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l.5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                        Delete
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* ── Share Modal ── */}
                {shareEventId && shareEvent && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="share-modal-title"
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '1.5rem',
                        }}
                        onClick={e => { if (e.target === e.currentTarget) setShareEventId(null) }}
                        onKeyDown={e => { if (e.key === 'Escape') setShareEventId(null) }}
                    >
                        <div style={{
                            background: '#0f0f1c', border: '1px solid rgba(212,168,83,0.2)',
                            borderRadius: '20px', padding: '0', width: '100%', maxWidth: '480px',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                            overflow: 'hidden',
                        }}>
                            {/* Modal header */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(212,168,83,0.1), rgba(139,92,246,0.06))',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                padding: '1.25rem 1.5rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#d4a853', fontWeight: 700, marginBottom: '2px' }}>
                                        📨 Share Room Invite
                                    </div>
                                    <div id="share-modal-title" style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{shareEvent.title}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', marginTop: '2px' }}>{shareEvent.roomName}</div>
                                </div>
                                <button
                                    aria-label="Close share dialog"
                                    onClick={() => setShareEventId(null)}
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', width: 30, height: 30, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >✕</button>
                            </div>

                            <div style={{ padding: '1.5rem' }}>
                                {/* Audience selector — 3 tabs */}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '0.6rem' }}>Send to</div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {([
                                            { value: 'all',    label: '👥 All Users',      hint: 'respects prefs' },
                                            { value: 'users',  label: '👤 Specific Users',  hint: 'search & select' },
                                            { value: 'emails', label: '✉️ Custom Emails',   hint: 'external list' },
                                        ] as const).map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setShareTarget(opt.value)}
                                                style={{
                                                    flex: 1, padding: '0.7rem 0.4rem', borderRadius: '10px',
                                                    border: `1px solid ${shareTarget === opt.value ? 'rgba(212,168,83,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                                    background: shareTarget === opt.value ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.03)',
                                                    color: shareTarget === opt.value ? '#d4a853' : 'rgba(255,255,255,0.5)',
                                                    cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                                                    transition: 'all 0.15s', textAlign: 'center',
                                                }}
                                            >
                                                <div>{opt.label}</div>
                                                <div style={{ fontSize: '0.58rem', opacity: 0.6, fontWeight: 500, marginTop: '2px' }}>{opt.hint}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Specific user search-to-select */}
                                {shareTarget === 'users' && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '0.5rem' }}>
                                            Search users
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                autoFocus
                                                value={userSearch}
                                                onChange={e => setUserSearch(e.target.value)}
                                                placeholder="Name or email..."
                                                style={{
                                                    width: '100%', background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                                                    color: '#f0f0f5', padding: '0.65rem 0.85rem', fontSize: '0.82rem',
                                                    outline: 'none', boxSizing: 'border-box',
                                                }}
                                            />
                                            {searchingUsers && (
                                                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
                                                    searching…
                                                </span>
                                            )}
                                        </div>
                                        {/* Search results */}
                                        {userResults.length > 0 && (
                                            <div style={{
                                                marginTop: '4px', background: '#111', border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '10px', overflow: 'hidden', maxHeight: '180px', overflowY: 'auto',
                                            }}>
                                                {userResults.map(u => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => {
                                                            setSelectedUsers(prev => [...prev, u])
                                                            setUserSearch('')
                                                            setUserResults([])
                                                        }}
                                                        style={{
                                                            width: '100%', padding: '0.55rem 0.85rem', background: 'transparent',
                                                            border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            color: '#f0f0f5', textAlign: 'left', cursor: 'pointer',
                                                            display: 'flex', flexDirection: 'column', gap: '1px',
                                                            transition: 'background 0.1s',
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.06)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                    >
                                                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{u.name}</span>
                                                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>{u.email}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {/* Selected user chips */}
                                        {selectedUsers.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                                {selectedUsers.map(u => (
                                                    <div key={u.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '5px',
                                                        background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)',
                                                        borderRadius: '100px', padding: '3px 10px 3px 8px',
                                                        fontSize: '0.72rem', color: '#d4a853', fontWeight: 600,
                                                    }}>
                                                        <span>👤</span>
                                                        <span>{u.name}</span>
                                                        <button
                                                            onClick={() => setSelectedUsers(prev => prev.filter(x => x.id !== u.id))}
                                                            style={{ background: 'none', border: 'none', color: 'rgba(212,168,83,0.6)', cursor: 'pointer', padding: 0, fontSize: '0.75rem', lineHeight: 1 }}
                                                        >✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {selectedUsers.length === 0 && !userSearch && (
                                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
                                                Type a name or email to search platform users.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Custom emails textarea */}
                                {shareTarget === 'emails' && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '0.5rem' }}>Email addresses</div>
                                        <textarea
                                            value={shareEmails}
                                            onChange={e => setShareEmails(e.target.value)}
                                            placeholder={"john@example.com\njane@example.com"}
                                            rows={4}
                                            style={{
                                                width: '100%', background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                                                color: '#f0f0f5', padding: '0.75rem', fontSize: '0.8rem',
                                                resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6, outline: 'none',
                                            }}
                                        />
                                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>One email per line. Email will be sent in English.</div>
                                    </div>
                                )}

                                {/* Room link preview */}
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                }}>
                                    <span style={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 700, whiteSpace: 'nowrap' }}>🔗 Room link</span>
                                    <code style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', wordBreak: 'break-all' }}>
                                        {typeof window !== 'undefined' ? window.location.origin : 'https://impactaistudio.com'}/en/events/{shareEvent.roomName}
                                    </code>
                                </div>

                                {/* Translation note */}
                                <div style={{
                                    background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)',
                                    borderRadius: '8px', padding: '0.6rem 0.85rem', marginBottom: '1.25rem',
                                    fontSize: '0.68rem', color: 'rgba(52,211,153,0.8)', lineHeight: 1.5,
                                }}>
                                    🌐 Emails and notifications are automatically delivered in each user&apos;s preferred language (11 locales supported — no external API call).
                                </div>

                                {/* Result feedback */}
                                {shareResult && (
                                    <div style={{
                                        padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '1rem',
                                        background: shareResult.startsWith('✓') ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
                                        border: `1px solid ${shareResult.startsWith('✓') ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                        color: shareResult.startsWith('✓') ? '#34d399' : '#ef4444',
                                        fontSize: '0.8rem', fontWeight: 600,
                                    }}>
                                        {shareResult}
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                    <button
                                        id="ae-share-send-btn"
                                        onClick={handleShare}
                                        disabled={sharing || (shareTarget === 'emails' && !shareEmails.trim()) || (shareTarget === 'users' && selectedUsers.length === 0)}
                                        style={{
                                            flex: 1, padding: '0.75rem', borderRadius: '10px',
                                            background: sharing ? 'rgba(212,168,83,0.15)' : 'linear-gradient(135deg, #d4a853, #b8903f)',
                                            border: 'none', color: sharing ? '#d4a853' : '#000',
                                            fontWeight: 800, fontSize: '0.85rem', cursor: sharing ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {sharing ? '⏳ Sending…' : '📨 Send Invites'}
                                    </button>
                                    <button
                                        onClick={() => setShareEventId(null)}
                                        style={{
                                            padding: '0.75rem 1rem', borderRadius: '10px',
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                        }}
                                    >Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
