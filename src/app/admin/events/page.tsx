'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
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
    const [error, setError]             = useState<string | null>(null)
    const [success, setSuccess]         = useState<string | null>(null)
    const [showForm, setShowForm]       = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [recording, setRecording]     = useState<string | null>(null)
    const [copied, setCopied]           = useState<string | null>(null)

    const [form, setForm] = useState({
        title: '', roomName: '', eventType: 'general', projectId: '', castingCallId: '',
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
    }, [fetchEvents])

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 5000) }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true); setError(null)
        try {
            const res = await fetch('/api/livekit/rooms/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: form.title, roomName: form.roomName, eventType: form.eventType, projectId: form.projectId || undefined, castingCallId: form.castingCallId || undefined }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create room')
            showSuccess(`Room "${form.roomName}" created`)
            setForm({ title: '', roomName: '', eventType: 'general', projectId: '', castingCallId: '' })
            setShowForm(false)
            await fetchEvents()
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create room') }
        finally { setCreating(false) }
    }

    const handleEnd = async (roomName: string, title: string) => {
        if (!confirm(`End "${title}"? All participants will be disconnected.`)) return
        setEnding(roomName); setError(null)
        try {
            const res = await fetch('/api/livekit/rooms/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomName }) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to end room')
            showSuccess(`Room "${roomName}" ended`)
            await fetchEvents()
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to end room') }
        finally { setEnding(null) }
    }

    const generateRoomName = () => {
        const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
        const suffix = Math.random().toString(36).slice(2, 6)
        setForm(f => ({ ...f, roomName: slug ? `${slug}-${suffix}` : `room-${suffix}` }))
    }

    const filteredEvents = filterStatus === 'all' ? events : events.filter(e => e.status === filterStatus)
    const liveCount = events.filter(e => e.status === 'live').length
    const scheduledCount = events.filter(e => e.status === 'scheduled').length
    const endedCount = events.filter(e => e.status === 'ended').length

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#06060f' }}>
            <AdminSidebar />
            <main style={{ flex: 1, padding: '2rem 2.5rem', color: '#f0f0f5', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden' }}>
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
                                    </div>
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
                                            <span
                                                className="le-status-badge"
                                                style={{ background: sc.bg, border: `1px solid ${sc.glow}`, color: sc.color }}
                                            >
                                                <span className={`le-status-dot${isLive ? ' le-status-dot--live' : ''}`} style={{ background: sc.color }} />
                                                {sc.label}
                                            </span>
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
                                                    href={`/en/events/${event.roomName}`}
                                                    className="le-btn le-btn--view"
                                                    target="_blank" rel="noopener noreferrer"
                                                    aria-label={`View room ${event.roomName}`}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 9L9 1M9 1H4M9 1V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                    View Room
                                                </a>
                                            )}
                                            {/* Copy participant link */}
                                            <button
                                                id={`ae-copy-link-${event.id}`}
                                                className="le-btn le-btn--copy"
                                                title={`Copy participant link: ${typeof window !== 'undefined' ? window.location.origin : ''}/en/events/${event.roomName}`}
                                                onClick={() => {
                                                    const url = `${window.location.origin}/en/events/${event.roomName}`
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
                                            {isLive && (
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
                                            )}
                                            {isLive && (
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
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
