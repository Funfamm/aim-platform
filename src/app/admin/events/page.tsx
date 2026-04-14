'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

interface LiveEvent {
    id: string
    title: string
    roomName: string
    status: string         // scheduled | live | ended
    eventType: string      // general | audition | q_and_a | watch_party
    hostUserId: string
    projectId: string | null
    castingCallId: string | null
    recordingUrl: string | null
    egressId: string | null
    startedAt: string | null
    endedAt: string | null
    createdAt: string
}

interface Project {
    id: string
    title: string
}

interface CastingCall {
    id: string
    roleName: string
    projectId: string
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    general: '📡 General',
    audition: '🎭 Audition',
    q_and_a: '💬 Q&A',
    watch_party: '🎬 Watch Party',
}

const STATUS_COLORS: Record<string, string> = {
    scheduled: '#f59e0b',
    live: '#22c55e',
    ended: '#6b7280',
}

export default function AdminEventsPage() {
    const [events, setEvents] = useState<LiveEvent[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [castingCalls, setCastingCalls] = useState<CastingCall[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [ending, setEnding] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [recording, setRecording] = useState<string | null>(null) // roomName being toggled

    const [form, setForm] = useState({
        title: '',
        roomName: '',
        eventType: 'general',
        projectId: '',
        castingCallId: '',
    })

    const fetchEvents = useCallback(async () => {
        try {
            const res = await fetch('/api/livekit/rooms')
            if (!res.ok) throw new Error('Failed to load events')
            const data = await res.json()
            setEvents(data.events || [])
        } catch {
            setError('Failed to load live events')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchEvents()
        // Load projects for the create form — /api/admin/projects returns a naked array
        fetch('/api/admin/projects')
            .then(r => r.json())
            .then((d: { id: string; title: string }[]) => setProjects(Array.isArray(d) ? d : []))
            .catch(() => {})
        // Load casting calls — /api/admin/casting returns a naked array
        fetch('/api/admin/casting')
            .then(r => r.json())
            .then((d: { id: string; roleName: string; projectId: string }[]) => setCastingCalls(Array.isArray(d) ? d : []))
            .catch(() => {})
    }, [fetchEvents])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        setError(null)

        try {
            const res = await fetch('/api/livekit/rooms/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title,
                    roomName: form.roomName,
                    eventType: form.eventType,
                    projectId: form.projectId || undefined,
                    castingCallId: form.castingCallId || undefined,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create room')

            setSuccess(`Room "${form.roomName}" created successfully`)
            setForm({ title: '', roomName: '', eventType: 'general', projectId: '', castingCallId: '' })
            setShowForm(false)
            await fetchEvents()
            setTimeout(() => setSuccess(null), 5000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create room')
        } finally {
            setCreating(false)
        }
    }

    const handleEnd = async (roomName: string, title: string) => {
        if (!confirm(`End room "${title}"? All participants will be disconnected.`)) return
        setEnding(roomName)
        setError(null)

        try {
            const res = await fetch('/api/livekit/rooms/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to end room')

            setSuccess(`Room "${roomName}" ended`)
            await fetchEvents()
            setTimeout(() => setSuccess(null), 4000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to end room')
        } finally {
            setEnding(null)
        }
    }

    const generateRoomName = () => {
        const slug = form.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 32)
        const suffix = Math.random().toString(36).slice(2, 6)
        setForm(f => ({ ...f, roomName: slug ? `${slug}-${suffix}` : `room-${suffix}` }))
    }

    const filteredEvents = filterStatus === 'all'
        ? events
        : events.filter(e => e.status === filterStatus)

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#080810' }}>
            <AdminSidebar />
            <main style={{ flex: 1, padding: '2rem', color: '#f0f0f5' }}>
                <style>{`
                    .ae-header {
                        display: flex; align-items: center; justify-content: space-between;
                        flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;
                    }
                    .ae-title {
                        font-size: 1.6rem; font-weight: 800;
                        color: #fff; letter-spacing: -0.02em; margin: 0;
                    }
                    .ae-subtitle { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin-top: 2px; }
                    .ae-create-btn {
                        display: inline-flex; align-items: center; gap: 0.4rem;
                        background: linear-gradient(135deg, #d4a853, #b8903f);
                        color: #000; padding: 0.6rem 1.25rem;
                        border: none; border-radius: 10px; font-weight: 700;
                        font-size: 0.85rem; cursor: pointer; transition: opacity 0.2s;
                    }
                    .ae-create-btn:hover { opacity: 0.88; }
                    .ae-alert {
                        padding: 0.75rem 1rem; border-radius: 10px;
                        font-size: 0.82rem; font-weight: 600; margin-bottom: 1rem;
                        display: flex; align-items: center; gap: 0.5rem;
                    }
                    .ae-alert--error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
                    .ae-alert--success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); color: #4ade80; }
                    .ae-form-card {
                        background: rgba(255,255,255,0.03);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;
                    }
                    .ae-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                    @media (max-width: 640px) { .ae-form-grid { grid-template-columns: 1fr; } }
                    .ae-label {
                        display: block; font-size: 0.72rem; font-weight: 700;
                        text-transform: uppercase; letter-spacing: 0.06em;
                        color: rgba(255,255,255,0.4); margin-bottom: 0.35rem;
                    }
                    .ae-input, .ae-select {
                        width: 100%; background: rgba(255,255,255,0.05);
                        border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
                        padding: 0.6rem 0.9rem; font-size: 0.85rem; color: #fff;
                        outline: none; transition: border-color 0.2s; box-sizing: border-box;
                    }
                    .ae-input:focus, .ae-select:focus { border-color: rgba(212,168,83,0.5); }
                    .ae-input::placeholder { color: rgba(255,255,255,0.2); }
                    .ae-room-gen {
                        display: flex; align-items: flex-end; gap: 0.5rem;
                    }
                    .ae-gen-btn {
                        padding: 0.6rem 0.85rem; font-size: 0.75rem; font-weight: 600;
                        background: rgba(212,168,83,0.1); border: 1px solid rgba(212,168,83,0.25);
                        border-radius: 8px; color: #d4a853; cursor: pointer; white-space: nowrap;
                        flex-shrink: 0; transition: background 0.2s;
                    }
                    .ae-gen-btn:hover { background: rgba(212,168,83,0.18); }
                    .ae-form-actions {
                        display: flex; align-items: center; gap: 0.75rem;
                        margin-top: 1.25rem; flex-wrap: wrap;
                    }
                    .ae-submit-btn {
                        padding: 0.65rem 1.75rem; background: #d4a853;
                        border: none; border-radius: 8px; color: #000;
                        font-weight: 700; font-size: 0.85rem; cursor: pointer;
                        transition: opacity 0.2s;
                    }
                    .ae-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                    .ae-cancel-btn {
                        padding: 0.65rem 1.25rem; background: transparent;
                        border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
                        color: rgba(255,255,255,0.5); font-size: 0.85rem; cursor: pointer;
                    }
                    .ae-filters {
                        display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;
                    }
                    .ae-filter-btn {
                        padding: 0.35rem 0.9rem; border-radius: 100px; font-size: 0.75rem;
                        font-weight: 600; cursor: pointer; border: 1px solid transparent;
                        transition: all 0.18s;
                    }
                    .ae-filter-btn--active {
                        background: rgba(212,168,83,0.15); border-color: rgba(212,168,83,0.35);
                        color: #d4a853;
                    }
                    .ae-filter-btn--inactive {
                        background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08);
                        color: rgba(255,255,255,0.4);
                    }
                    .ae-events-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
                        gap: 1rem;
                    }
                    .ae-event-card {
                        background: rgba(255,255,255,0.03);
                        border: 1px solid rgba(255,255,255,0.07);
                        border-radius: 14px; padding: 1.25rem;
                        transition: border-color 0.2s, transform 0.2s;
                    }
                    .ae-event-card:hover { border-color: rgba(255,255,255,0.13); transform: translateY(-2px); }
                    .ae-event-card--live { border-color: rgba(34,197,94,0.25); }
                    .ae-event-top {
                        display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;
                    }
                    .ae-event-title {
                        font-size: 1rem; font-weight: 700; color: #fff; margin: 0 0 0.2rem;
                        word-break: break-word;
                    }
                    .ae-event-room {
                        font-size: 0.7rem; color: rgba(255,255,255,0.35); font-family: monospace;
                    }
                    .ae-status-dot {
                        display: inline-flex; align-items: center; gap: 0.3rem;
                        font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.6rem;
                        border-radius: 100px; text-transform: uppercase; letter-spacing: 0.06em;
                        flex-shrink: 0;
                    }
                    .ae-event-meta {
                        display: flex; gap: 0.5rem; flex-wrap: wrap;
                        margin: 0.75rem 0; font-size: 0.72rem; color: rgba(255,255,255,0.4);
                    }
                    .ae-event-meta-badge {
                        background: rgba(255,255,255,0.05); border-radius: 6px; padding: 0.15rem 0.5rem;
                    }
                    .ae-event-actions {
                        display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;
                    }
                    .ae-view-btn {
                        padding: 0.4rem 0.9rem; background: rgba(212,168,83,0.08);
                        border: 1px solid rgba(212,168,83,0.2); border-radius: 7px;
                        color: #d4a853; font-size: 0.75rem; font-weight: 600;
                        cursor: pointer; text-decoration: none; transition: background 0.2s;
                        display: inline-flex; align-items: center; gap: 0.3rem;
                    }
                    .ae-view-btn:hover { background: rgba(212,168,83,0.15); }
                    .ae-end-btn {
                        padding: 0.4rem 0.9rem; background: rgba(239,68,68,0.08);
                        border: 1px solid rgba(239,68,68,0.25); border-radius: 7px;
                        color: #f87171; font-size: 0.75rem; font-weight: 600;
                        cursor: pointer; transition: background 0.2s;
                    }
                    .ae-end-btn:hover:not(:disabled) { background: rgba(239,68,68,0.16); }
                    .ae-end-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                    .ae-recording-link {
                        font-size: 0.7rem; color: rgba(96,165,250,0.8); text-decoration: none;
                        display: inline-flex; align-items: center; gap: 0.25rem;
                    }
                    .ae-recording-link:hover { color: #60a5fa; }
                    .ae-empty {
                        text-align: center; padding: 4rem 2rem;
                        color: rgba(255,255,255,0.3); font-size: 0.9rem;
                    }
                    .ae-empty-icon { font-size: 3rem; margin-bottom: 0.75rem; }
                `}</style>

                {/* Header */}
                <div className="ae-header">
                    <div>
                        <h1 className="ae-title">Live Events</h1>
                        <p className="ae-subtitle">Create and manage real-time LiveKit rooms</p>
                    </div>
                    <button
                        id="admin-events-create-btn"
                        className="ae-create-btn"
                        onClick={() => setShowForm(v => !v)}
                    >
                        {showForm ? '✕ Cancel' : '+ New Room'}
                    </button>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="ae-alert ae-alert--error" role="alert">⚠️ {error}</div>
                )}
                {success && (
                    <div className="ae-alert ae-alert--success" role="status">✓ {success}</div>
                )}

                {/* Create Form */}
                {showForm && (
                    <div className="ae-form-card">
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: '0 0 1.25rem' }}>
                            Create New Live Room
                        </h2>
                        <form onSubmit={handleCreate}>
                            <div className="ae-form-grid">
                                <div>
                                    <label className="ae-label" htmlFor="event-title">Event Title *</label>
                                    <input
                                        id="event-title"
                                        className="ae-input"
                                        value={form.title}
                                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="e.g. Live Audition — Lead Role"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="ae-label" htmlFor="event-type">Event Type</label>
                                    <select
                                        id="event-type"
                                        className="ae-select"
                                        value={form.eventType}
                                        onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}
                                    >
                                        <option value="general">General</option>
                                        <option value="audition">Audition</option>
                                        <option value="q_and_a">Q&amp;A</option>
                                        <option value="watch_party">Watch Party</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="ae-label" htmlFor="event-room-name">Room Name *</label>
                                    <div className="ae-room-gen">
                                        <input
                                            id="event-room-name"
                                            className="ae-input"
                                            value={form.roomName}
                                            onChange={e => setForm(f => ({ ...f, roomName: e.target.value }))}
                                            placeholder="alphanumeric-with-dashes"
                                            pattern="[a-zA-Z0-9_-]+"
                                            title="Letters, numbers, underscores, and hyphens only"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="ae-gen-btn"
                                            onClick={generateRoomName}
                                            title="Auto-generate from title"
                                        >
                                            Auto
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="ae-label" htmlFor="event-project">Link to Project (optional)</label>
                                    <select
                                        id="event-project"
                                        className="ae-select"
                                        value={form.projectId}
                                        onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                                    >
                                        <option value="">— None —</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                                {form.eventType === 'audition' && (
                                    <div style={{ gridColumn: '1/-1' }}>
                                        <label className="ae-label" htmlFor="event-casting-call">
                                            Link to Casting Call (private audition room)
                                        </label>
                                        <select
                                            id="event-casting-call"
                                            className="ae-select"
                                            value={form.castingCallId}
                                            onChange={e => setForm(f => ({ ...f, castingCallId: e.target.value }))}
                                        >
                                            <option value="">— None —</option>
                                            {castingCalls.map(cc => (
                                                <option key={cc.id} value={cc.id}>{cc.roleName}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="ae-form-actions">
                                <button
                                    id="admin-events-submit-btn"
                                    type="submit"
                                    className="ae-submit-btn"
                                    disabled={creating}
                                >
                                    {creating ? '⏳ Creating…' : '🚀 Create Room'}
                                </button>
                                <button
                                    type="button"
                                    className="ae-cancel-btn"
                                    onClick={() => setShowForm(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filter tabs */}
                <div className="ae-filters" role="group" aria-label="Filter events by status">
                    {['all', 'live', 'scheduled', 'ended'].map(status => (
                        <button
                            key={status}
                            id={`ae-filter-${status}`}
                            className={`ae-filter-btn ${filterStatus === status ? 'ae-filter-btn--active' : 'ae-filter-btn--inactive'}`}
                            onClick={() => setFilterStatus(status)}
                        >
                            {status === 'all' ? `All (${events.length})`
                                : status === 'live' ? `🔴 Live (${events.filter(e => e.status === 'live').length})`
                                : status === 'scheduled' ? `📅 Scheduled (${events.filter(e => e.status === 'scheduled').length})`
                                : `⬜ Ended (${events.filter(e => e.status === 'ended').length})`
                            }
                        </button>
                    ))}
                </div>

                {/* Events Grid */}
                {loading ? (
                    <div className="ae-empty">
                        <div className="ae-empty-icon">⏳</div>
                        <p>Loading events…</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="ae-empty">
                        <div className="ae-empty-icon">📡</div>
                        <p>No {filterStatus !== 'all' ? filterStatus : ''} live events yet.</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                            Create a room above to get started.
                        </p>
                    </div>
                ) : (
                    <div className="ae-events-grid">
                        {filteredEvents.map(event => {
                            const statusColor = STATUS_COLORS[event.status] ?? '#6b7280'
                            const isLive = event.status === 'live'
                            const isEnded = event.status === 'ended'

                            return (
                                <div
                                    key={event.id}
                                    className={`ae-event-card${isLive ? ' ae-event-card--live' : ''}`}
                                    data-room={event.roomName}
                                >
                                    <div className="ae-event-top">
                                        <div>
                                            <h3 className="ae-event-title">{event.title}</h3>
                                            <span className="ae-event-room">{event.roomName}</span>
                                        </div>
                                        <span
                                            className="ae-status-dot"
                                            style={{
                                                background: `${statusColor}18`,
                                                border: `1px solid ${statusColor}40`,
                                                color: statusColor,
                                            }}
                                        >
                                            {isLive && <span style={{ animation: 'pulse-red 1.5s infinite' }}>●</span>}
                                            {event.status}
                                        </span>
                                    </div>

                                    <div className="ae-event-meta">
                                        <span className="ae-event-meta-badge">
                                            {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                                        </span>
                                        {event.startedAt && (
                                            <span className="ae-event-meta-badge">
                                                Started {new Date(event.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                        {event.endedAt && (
                                            <span className="ae-event-meta-badge">
                                                Ended {new Date(event.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                        {!event.startedAt && (
                                            <span className="ae-event-meta-badge">
                                                Created {new Date(event.createdAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>

                                    {event.recordingUrl && (
                                        <a
                                            href={event.recordingUrl}
                                            className="ae-recording-link"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            🎞️ Recording available
                                        </a>
                                    )}

                                    <div className="ae-event-actions">
                                        {!isEnded && (
                                            <a
                                                href={`/en/events/${event.roomName}`}
                                                className="ae-view-btn"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`View room ${event.roomName}`}
                                            >
                                                🔗 View Room
                                            </a>
                                        )}
                                        {isLive && (
                                            <button
                                                id={`ae-captions-btn-${event.id}`}
                                                className="ae-view-btn"
                                                style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch('/api/livekit/captions/start', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ roomName: event.roomName }),
                                                        })
                                                        const data = await res.json()
                                                        if (!res.ok) setError(data.error || 'Failed to start captions')
                                                        else setSuccess(`Captions started for ${event.roomName}`)
                                                    } catch { setError('Failed to reach caption worker') }
                                                }}
                                            >
                                                ▶ Captions
                                            </button>
                                        )}
                                        {isLive && (
                                            <button
                                                id={`ae-record-btn-${event.id}`}
                                                className="ae-view-btn"
                                                disabled={recording === event.roomName}
                                                style={{
                                                    borderColor: event.egressId ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)',
                                                    color: event.egressId ? '#f87171' : 'rgba(239,68,68,0.7)',
                                                }}
                                                onClick={async () => {
                                                    setRecording(event.roomName)
                                                    setError(null)
                                                    try {
                                                        if (event.egressId) {
                                                            // Stop active recording
                                                            const res = await fetch('/api/livekit/rooms/egress', {
                                                                method: 'DELETE',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ roomName: event.roomName }),
                                                            })
                                                            const data = await res.json()
                                                            if (!res.ok) setError(data.error || 'Failed to stop recording')
                                                            else setSuccess(`Recording stopped — file will be ready shortly`)
                                                        } else {
                                                            // Start recording
                                                            const res = await fetch('/api/livekit/rooms/egress', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ roomName: event.roomName, outputType: 'mp4' }),
                                                            })
                                                            const data = await res.json()
                                                            if (!res.ok) setError(data.error || 'Failed to start recording')
                                                            else setSuccess(`Recording started for ${event.roomName}`)
                                                        }
                                                        await fetchEvents()
                                                    } catch { setError('Recording request failed') }
                                                    finally { setRecording(null) }
                                                }}
                                            >
                                                {recording === event.roomName ? '⏳…'
                                                    : event.egressId ? '⏹ Stop Rec'
                                                    : '⏺ Record'}
                                            </button>
                                        )}
                                        {!isEnded && (
                                            <button
                                                id={`ae-end-btn-${event.id}`}
                                                className="ae-end-btn"
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
            </main>
        </div>
    )
}
