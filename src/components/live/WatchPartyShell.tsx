'use client'

/**
 * WatchPartyShell — Synchronized Cinema Client Component
 * --------------------------------------------------------------------------
 * SSE-driven state machine: lobby → playing ↔ paused → ended
 *
 * All viewers stay synchronized via Redis Pub/Sub → SSE fan-out.
 * Host's play/pause/seek commands are relayed to all viewers within ~1s.
 *
 * Drift correction: if |localTime - serverTime| > 2s on any sync event → seek.
 * Heartbeat: POST /api/watch-party/heartbeat every 20s for presence + viewer count.
 * Reconnect: EventSource auto-reconnects; on each connect the server sends
 *   an initial `sync` event from the Redis state hash — no missed messages needed.
 */

import {
    useState, useRef, useEffect, useCallback,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import WatchPartyChat from '@/components/live/WatchPartyChat'
import ReactionOverlay from '@/components/live/ReactionOverlay'

/* ── Types ───────────────────────────────────────────────────────────────── */
type RoomStatus = 'lobby' | 'playing' | 'paused' | 'ended'

interface WatchPartyShellProps {
    roomName:          string
    locale:            string
    eventId:           string
    title:             string
    mediaTitle:        string
    mediaUrl:          string | null
    coverImage:        string | null
    status:            'scheduled' | 'live' | 'ended'
    lobbyEnabled:      boolean
    replayEnabled:     boolean
    isReplay:          boolean
    lastCheckpointSec: number
    canControl:        boolean
    userPreferredLang: string
    subtitleProjectId: string | null
    scheduledAt:       string | null
    projectSlug:       string | null
}

const DRIFT_THRESHOLD_SEC  = 1.5
const HEARTBEAT_INTERVAL   = 20_000
const PING_INTERVAL        = 25_000
// How often the host silently reports their current seek position to Redis.
// Keeps viewers from drifting against a stale timestamp.
const HOST_SYNC_INTERVAL   = 5_000

const fmt = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
        : `${m}:${String(sec).padStart(2, '0')}`
}

const LANG_NAMES: Record<string, string> = {
    en: 'English', fr: 'Français', es: 'Español', pt: 'Português',
    de: 'Deutsch', it: 'Italiano', ja: '日本語', zh: '中文',
    ko: '한국어', ar: 'العربية', ru: 'Русский', hi: 'हिन्दी',
}

// ── Module-level analytics helper ─────────────────────────────────────────
// Plain async function (not a hook) so it can be called in event listeners,
// useEffect cleanup, and pagehide / sendBeacon paths without needing a ref.
async function logWatchPartyAnalytic(
    roomName: string,
    name: string,
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        await fetch('/api/watch-party/analytic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName, name, metadata }),
        })
    } catch { /* fire-and-forget — never block UX */ }
}

/* ══════════════════════════════ COMPONENT ══════════════════════════════════ */
export default function WatchPartyShell({
    roomName, locale, eventId, title, mediaTitle, mediaUrl,
    coverImage, status: initialStatus, lobbyEnabled, replayEnabled, isReplay,
    lastCheckpointSec, canControl, userPreferredLang,
    subtitleProjectId, scheduledAt, projectSlug,
}: WatchPartyShellProps) {

    const t = useTranslations('watchParty')

    /* ── State machine ───────────────────────────────────────────────────── */
    const [roomStatus, setRoomStatus] = useState<RoomStatus>(() => {
        if (isReplay) return 'playing'
        if (initialStatus === 'ended') return 'ended'
        if (initialStatus === 'live') return 'playing'
        return lobbyEnabled ? 'lobby' : 'playing'
    })

    const [isPlaying, setIsPlaying]     = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration]       = useState(0)
    const [isLoading, setIsLoading]     = useState(true)
    const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([])
    const [viewerCount, setViewerCount] = useState(0)
    const [hasInteracted, setHasInteracted] = useState(false)
    const [autoplayFailed, setAutoplayFailed] = useState(false)
    const [controlError, setControlError] = useState<string | null>(null)
    const [showControls, setShowControls] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)

    /* ── Subtitle state ──────────────────────────────────────────────────── */
    const [ccEnabled, setCcEnabled]     = useState(false)
    const [ccLang, setCcLang]           = useState(userPreferredLang)
    const [showLangMenu, setShowLangMenu] = useState(false)
    const [availableLangs, setAvailableLangs] = useState<string[]>([])
    const [ccTrackUrl, setCcTrackUrl]   = useState<string | null>(null)

    /* ── Host control state ──────────────────────────────────────────────── */
    const [controlLoading, setControlLoading] = useState(false)

    /* ── Chat & reactions ────────────────────────────────────────────────── */
    const [showChat, setShowChat] = useState(true)

    /* ── Mobile breakpoint (for CC bottom-sheet vs dropdown) ─────────────── */
    const [isMobile, setIsMobile] = useState(false)

    /* ── Refs ────────────────────────────────────────────────────────────── */
    const videoRef       = useRef<HTMLVideoElement>(null)
    const containerRef   = useRef<HTMLDivElement>(null)
    const controlsTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
    const sseRef         = useRef<EventSource | null>(null)
    const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
    const pingTimer      = useRef<ReturnType<typeof setInterval> | null>(null)
    const hostSyncTimer  = useRef<ReturnType<typeof setInterval> | null>(null)
    const isMounted      = useRef(true)

    /* ── Detect mobile breakpoint ────────────────────────────────────────── */
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px)')
        setIsMobile(mq.matches)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    /* ── Body scroll lock when mobile CC sheet is open ───────────────────── */
    useEffect(() => {
        if (isMobile && showLangMenu) {
            const prev = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = prev }
        }
    }, [isMobile, showLangMenu])

    /* ── Analytics tracking refs ─────────────────────────────────────────── */
    // milestonesFired   — Set of analytic names already sent (no double-fires)
    // hasEnteredPlayback — true after first entered_playback is sent
    // hasJoinedOnce     — true after first SSE sync received (used for rejoin)
    const milestonesFired    = useRef<Set<string>>(new Set())
    const hasEnteredPlayback = useRef(false)
    const hasJoinedOnce      = useRef(false)

    /* ── SSE connection ──────────────────────────────────────────────────── */
    const connectSSE = useCallback(() => {
        if (isReplay) return // Replay: no SSE needed, play freely
        if (sseRef.current) {
            sseRef.current.close()
            sseRef.current = null
        }

        const es = new EventSource(`/api/watch-party/subscribe/${roomName}`)
        sseRef.current = es

        // isFirstSync: true for the very first message after each SSE connect.
        // The server always sends the current Redis state immediately on connect,
        // so we can detect reconnects by checking if we've joined before.
        let isFirstSync = true

        const handleSync = (e: MessageEvent) => {
            if (!isMounted.current) return
            try {
                const data = JSON.parse(e.data) as {
                    playing: boolean
                    currentTimeSec: number
                    status: RoomStatus
                    lastUpdatedAt?: string
                }
                const vid = videoRef.current
                if (!isMounted.current) return

                // ── Rejoin detection ───────────────────────────────────────────
                if (isFirstSync) {
                    isFirstSync = false
                    if (hasJoinedOnce.current) {
                        void logWatchPartyAnalytic(roomName, 'rejoined')
                    }
                    hasJoinedOnce.current = true
                }

                setRoomStatus(data.status)

                if (data.status === 'playing' || data.status === 'paused') {
                    if (vid) {
                        // ── Drift correction ─────────────────────────────────────────────
                        // The stored `currentTimeSec` is a snapshot from when the host last
                        // sent a control command. Compute where the video *should* be now by
                        // adding elapsed wall-clock time (only when the event says playing).
                        // This prevents constant backward-seeks when Redis has a stale time.
                        //
                        // The HOST is the source of truth — skip drift correction for them.
                        if (!canControl) {
                            const lastUpdated = data.lastUpdatedAt
                                ? new Date(data.lastUpdatedAt as string).getTime()
                                : Date.now()
                            const elapsedSec = data.playing
                                ? Math.max(0, (Date.now() - lastUpdated) / 1000)
                                : 0
                            const expectedTimeSec = (data.currentTimeSec as number) + elapsedSec
                            const diff = Math.abs(vid.currentTime - expectedTimeSec)
                            if (diff > DRIFT_THRESHOLD_SEC) {
                                vid.currentTime = expectedTimeSec
                            }
                        }

                        if (data.playing && (vid.paused || vid.ended)) {
                            vid.play().catch((err) => {
                                console.warn('[WatchPartyShell] Playback blocked by browser:', err)
                                setAutoplayFailed(true)
                            })
                            setIsPlaying(true)
                        } else if (!data.playing && !vid.paused) {
                            vid.pause()
                            setIsPlaying(false)
                        }
                    }
                }
            } catch { /* malformed event */ }
        }

        es.addEventListener('sync', handleSync)
        es.addEventListener('lobby', () => {
            if (isMounted.current) setRoomStatus('lobby')
        })
        es.addEventListener('paused', handleSync)
        es.addEventListener('ended', () => {
            if (isMounted.current) {
                setRoomStatus('ended')
                videoRef.current?.pause()
                setIsPlaying(false)
            }
        })
        es.addEventListener('chat', () => { /* handled in WatchPartyChat */ })
        es.addEventListener('reaction', (e: MessageEvent) => {
            if (!isMounted.current) return
            try {
                const data = JSON.parse(e.data) as { emoji: string }
                const newReaction = {
                    id:    Math.random().toString(36).slice(2),
                    emoji: data.emoji,
                    x:     10 + Math.random() * 80,
                }
                setReactions(prev => [...prev, newReaction])
                setTimeout(() => {
                    setReactions(prev => prev.filter(r => r.id !== newReaction.id))
                }, 3500)
            } catch { /* ignore */ }
        })

        es.onerror = () => {
            // EventSource will auto-reconnect
            if (isMounted.current) {
                setTimeout(connectSSE, 2000)
            }
        }
    }, [roomName, isReplay, canControl])

    /* ── Heartbeat ───────────────────────────────────────────────────────── */
    const sendHeartbeat = useCallback(async () => {
        try {
            const res = await fetch('/api/watch-party/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName }),
            })
            const data = await res.json() as { count: number }
            if (isMounted.current) setViewerCount(data.count)
        } catch { /* non-critical */ }
    }, [roomName])

    /* ── Mount effects ───────────────────────────────────────────────────── */
    useEffect(() => {
        isMounted.current = true
        connectSSE()
        sendHeartbeat()
        heartbeatTimer.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

        // ── Host position reporter ─────────────────────────────────────────
        // Every HOST_SYNC_INTERVAL ms, the host silently writes their current
        // video time to Redis so viewers drift-correct to a live position.
        // Only started when canControl===true and not in replay mode.
        if (canControl && !isReplay) {
            hostSyncTimer.current = setInterval(() => {
                const vid = videoRef.current
                if (!vid || vid.paused || vid.ended) return
                // Fire-and-forget — silent background position checkpoint
                fetch('/api/watch-party/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomName, action: 'seek', currentTimeSec: vid.currentTime }),
                }).catch(() => { /* non-critical */ })
            }, HOST_SYNC_INTERVAL)
        }

        return () => {
            isMounted.current = false
            sseRef.current?.close()
            if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
            if (pingTimer.current) clearInterval(pingTimer.current)
            if (hostSyncTimer.current) clearInterval(hostSyncTimer.current)
            if (controlsTimer.current) clearTimeout(controlsTimer.current)
        }
    }, [connectSSE, sendHeartbeat, canControl, isReplay, roomName])

    /* ── Analytics: viewer-side event tracking ─────────────────────────── */
    // 1. Fire joined_lobby or entered_playback (whichever is initial state on mount)
    //    Also register the pagehide handler for left_early via sendBeacon.
    useEffect(() => {
        if (isReplay) {
            void logWatchPartyAnalytic(roomName, 'replay_started')
        } else if (roomStatus === 'lobby') {
            void logWatchPartyAnalytic(roomName, 'joined_lobby')
        } else if (roomStatus === 'playing' || roomStatus === 'paused') {
            // User joined while event was already live
            hasEnteredPlayback.current = true
            void logWatchPartyAnalytic(roomName, 'entered_playback')
        }

        // left_early via sendBeacon so it fires even during hard navigations / tab close.
        // Blob wrapping sets Content-Type to application/json for the server.
        const handlePageHide = () => {
            const blob = new Blob(
                [JSON.stringify({ roomName, name: 'left_early' })],
                { type: 'application/json' },
            )
            navigator.sendBeacon('/api/watch-party/analytic', blob)
        }
        window.addEventListener('pagehide', handlePageHide)
        return () => window.removeEventListener('pagehide', handlePageHide)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 2. Fire entered_playback when event transitions from lobby → playing.
    //    Guard with hasEnteredPlayback to avoid double-firing if already sent above.
    useEffect(() => {
        if (roomStatus === 'playing' && !hasEnteredPlayback.current) {
            hasEnteredPlayback.current = true
            void logWatchPartyAnalytic(roomName, 'entered_playback')
        }
    // roomName is stable — only roomStatus triggers this
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomStatus])

    // 3. Playback milestone tracking: 25 │ 50 │ 90 │ completed.
    //    Runs on every currentTime update; Set-guard prevents duplicate fires.
    //    Skipped in replay mode (user controls their own playback).
    useEffect(() => {
        if (!duration || duration === 0 || isReplay || roomStatus !== 'playing') return
        const pct = (currentTime / duration) * 100
        const checkpoints: Array<[number, string]> = [
            [25, 'playback_25'],
            [50, 'playback_50'],
            [90, 'playback_90'],
            [99, 'completed'],
        ]
        for (const [threshold, name] of checkpoints) {
            if (pct >= threshold && !milestonesFired.current.has(name)) {
                milestonesFired.current.add(name)
                void logWatchPartyAnalytic(roomName, name, { pct: Math.floor(pct) })
            }
        }
    // currentTime changes frequently — this effect is intentionally lightweight
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTime, duration])

    /* ── Replay: seek to saved position ──────────────────────────────────── */
    useEffect(() => {
        if (!isReplay || !lastCheckpointSec) return
        const vid = videoRef.current
        if (!vid) return
        const doSeek = () => { if (vid.readyState >= 1) vid.currentTime = lastCheckpointSec }
        if (vid.readyState >= 1) doSeek()
        else vid.addEventListener('loadedmetadata', doSeek, { once: true })
    }, [isReplay, lastCheckpointSec])

    /* ── Controls auto-hide ──────────────────────────────────────────────── */
    const resetControlsTimer = useCallback(() => {
        setShowControls(true)
        if (controlsTimer.current) clearTimeout(controlsTimer.current)
        controlsTimer.current = setTimeout(() => {
            if (isPlaying) setShowControls(false)
        }, 3000)
    }, [isPlaying])

    /* ── Fullscreen ──────────────────────────────────────────────────────── */
    const toggleFullscreen = async () => {
        const el = containerRef.current
        if (!el) return
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {})
        } else {
            await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {})
        }
    }

    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])

    /* ── Host controls ───────────────────────────────────────────────────── */
    const sendControl = useCallback(async (
        action: 'play' | 'pause' | 'seek' | 'end' | 'lobby',
        currentTimeSec?: number,
    ) => {
        setControlLoading(true)
        setControlError(null)
        
        const prevStatus  = roomStatus
        const prevPlaying = isPlaying
        
        try {
            const vid = videoRef.current
            const targetTime = currentTimeSec ?? vid?.currentTime ?? 0
            
            // Optimistic update + Immediate local playback control
            // We call play/pause synchronously here to satisfy browser autoplay requirements
            if (action === 'play') {
                setRoomStatus('playing')
                setIsPlaying(true)
                vid?.play().catch(err => console.warn('[WatchPartyShell] Local play failed:', err))
            }
            else if (action === 'pause') {
                setIsPlaying(false)
                vid?.pause()
            }
            else if (action === 'end') { setRoomStatus('ended'); setIsPlaying(false); vid?.pause() }
            else if (action === 'lobby') { setRoomStatus('lobby'); setIsPlaying(false); vid?.pause() }

            const res = await fetch('/api/watch-party/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName,
                    action,
                    currentTimeSec: targetTime,
                }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to send control command')
            }
        } catch (err: any) {
            console.error('[WatchPartyShell] control error:', err)
            setControlError(t('startError'))
            // Rollback
            setRoomStatus(prevStatus)
            setIsPlaying(prevPlaying)
        } finally {
            setControlLoading(false)
        }
    }, [roomName, roomStatus, isPlaying, t])

    /* ── Subtitle fetch ─────────────────────────────────────────────────── */
    useEffect(() => {
        if (!subtitleProjectId) return
        fetch(`/api/subtitles/${subtitleProjectId}?lang=en`)
            .then(r => r.json())
            .then((data: { available?: string[] }) => {
                if (data.available?.length) setAvailableLangs(data.available)
            })
            .catch(() => {})
    }, [subtitleProjectId])

    const loadSubtitles = useCallback(async (lang: string) => {
        if (!subtitleProjectId) return
        try {
            const res  = await fetch(`/api/subtitles/${subtitleProjectId}?lang=${lang}&format=vtt`)
            const text = await res.text()
            const blob = new Blob([text], { type: 'text/vtt' })
            setCcTrackUrl(URL.createObjectURL(blob))
            setCcLang(lang)
            setCcEnabled(true)
        } catch { /* non-critical */ }
    }, [subtitleProjectId])

    /* ── Progress ──────────────────────────────────────────────────────── */
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    /* ═══════════════════════════════ JSX ════════════════════════════════════ */

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            paddingTop: '72px',
            fontFamily: 'inherit',
        }}>
            <style>{`
                .wp-container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
                .wp-layout { display: grid; grid-template-columns: 1fr; gap: 20px; }
                @media (min-width: 1024px) {
                    .wp-layout { grid-template-columns: 1fr 340px; }
                }
                .wp-ctrl-btn {
                    background: none; border: none; color: white; cursor: pointer;
                    padding: 6px; border-radius: 6px; display: flex;
                    align-items: center; justify-content: center;
                    transition: background 0.15s;
                    min-width: 36px; min-height: 36px;
                    -webkit-tap-highlight-color: transparent;
                }
                .wp-ctrl-btn:hover { background: rgba(255,255,255,0.12); }
                .wp-ctrl-btn:active { background: rgba(255,255,255,0.2); }
                .wp-host-btn {
                    display: flex; align-items: center; gap: 8px;
                    padding: 10px 20px; border-radius: 10px; border: none;
                    font-weight: 700; font-size: 0.9rem;
                    cursor: pointer; transition: all 0.2s;
                    font-family: inherit;
                }
                .wp-host-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .wp-progress-thumb::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none;
                    width: 14px; height: 14px; border-radius: 50%;
                    background: var(--accent-gold); cursor: pointer;
                    box-shadow: 0 0 6px rgba(212,168,83,0.5);
                }
                .wp-progress-thumb::-moz-range-thumb {
                    width: 14px; height: 14px; border-radius: 50%; border: none;
                    background: var(--accent-gold); cursor: pointer;
                }
                @keyframes wp-fadein { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
                @keyframes wp-spin { to { transform: rotate(360deg); } }
                @keyframes wp-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .wp-anim { animation: wp-fadein 0.4s ease both; }
                .wp-video-container:fullscreen,
                .wp-video-container:-webkit-full-screen {
                    width: 100vw; height: 100dvh; background: #000; border-radius: 0 !important;
                }
                .wp-video-container:fullscreen video,
                .wp-video-container:-webkit-full-screen video {
                    width: 100%; height: 100%; object-fit: contain;
                }
                /* ── Mobile layout ── */
                @media (max-width: 640px) {
                    .wp-container { padding: 0 !important; }
                    .wp-header { padding: 0 16px; margin-bottom: 8px !important; }
                    .wp-video-sticky {
                        position: sticky;
                        top: 56px;
                        z-index: 40;
                        background: #000;
                        width: 100vw;
                        margin-left: calc(-50vw + 50%);
                    }
                    .wp-video-container {
                        border-radius: 0 !important;
                        border: none !important;
                        width: 100vw !important;
                        max-width: 100vw !important;
                    }
                    .wp-progress-thumb::-webkit-slider-thumb { width: 18px !important; height: 18px !important; }
                    .wp-back-link { padding-left: 16px; }
                    .wp-layout { gap: 12px !important; }
                    .wp-lobby-screen { border-radius: 0 !important; border: none !important; width: 100vw !important; max-width: 100vw !important; }
                }
            `}</style>

            <div className="wp-container">

                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="wp-header" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '16px', flexWrap: 'wrap', gap: '8px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Back link — admins return to the admin events dashboard;
                            regular viewers return to the film's public page. */}
                        {canControl ? (
                            <Link
                                href="/admin/events"
                                className="wp-back-link"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    color: 'var(--text-tertiary)', textDecoration: 'none',
                                    fontSize: '0.85rem', transition: 'color 0.2s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-gold)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                                Admin Events
                            </Link>
                        ) : projectSlug ? (
                            <Link
                                href={`/${locale}/works/${projectSlug}`}
                                className="wp-back-link"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    color: 'var(--text-tertiary)', textDecoration: 'none',
                                    fontSize: '0.85rem', transition: 'color 0.2s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-gold)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                                Back
                            </Link>
                        ) : null}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                background: 'rgba(212,168,83,0.15)', color: 'var(--accent-gold)',
                                border: '1px solid rgba(212,168,83,0.3)',
                                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                                padding: '3px 8px', borderRadius: '4px',
                            }}>🍿 WATCH PARTY</span>
                            {roomStatus === 'playing' && (
                                <span style={{
                                    background: 'rgba(220,38,38,0.15)', color: '#f87171',
                                    border: '1px solid rgba(220,38,38,0.3)',
                                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                                    padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px',
                                }}>
                                    <span style={{
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: '#f87171', animation: 'wp-spin 1.5s linear infinite',
                                        display: 'inline-block',
                                    }} />
                                    LIVE
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {viewerCount > 0 && (
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                                👥 {t('viewerCount', { count: viewerCount })}
                            </span>
                        )}
                        {isReplay && (
                            <span style={{
                                fontSize: '0.75rem', color: 'var(--text-tertiary)',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '3px 10px', borderRadius: '4px',
                            }}>{t('replayLabel')}</span>
                        )}
                    </div>
                </div>

                <div className="wp-layout">

                    {/* ── Left: Video + Controls ───────────────────────────── */}
                    <div>
                        {/* ── Lobby Screen ───────────────────────────────── */}
                        {roomStatus === 'lobby' && !canControl && (
                            <div className="wp-anim wp-lobby-screen wp-video-sticky" style={{
                                position: 'relative',
                                aspectRatio: '16/9',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                background: '#000',
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexDirection: 'column', gap: '16px',
                            }}>
                                {coverImage && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: `url(${coverImage}) center/cover no-repeat`,
                                        filter: 'blur(20px) brightness(0.3)',
                                    }} />
                                )}
                                <div style={{ position: 'relative', textAlign: 'center', padding: '0 20px' }}>
                                    {!hasInteracted ? (
                                        <>
                                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🍿</div>
                                            <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
                                                {t('joinScreening')}
                                            </h2>
                                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '24px', maxWidth: '300px', marginInline: 'auto' }}>
                                                {t('theaterInstructions')}
                                            </p>
                                            <button
                                                onClick={() => {
                                                    const v = videoRef.current
                                                    if (v) {
                                                        v.play().then(() => v.pause()).catch(() => {})
                                                    }
                                                    setHasInteracted(true)
                                                }}
                                                style={{
                                                    background: 'linear-gradient(135deg, var(--accent-gold), #c9951b)',
                                                    color: '#000', border: 'none', padding: '12px 32px',
                                                    borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
                                                    fontSize: '1rem',
                                                }}
                                            >
                                                {t('joinScreening')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎬</div>
                                            <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
                                                {title}
                                            </h2>
                                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
                                                {t('lobbyDesc')}
                                            </p>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                justifyContent: 'center', marginTop: '20px',
                                                color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem',
                                            }}>
                                                <div style={{
                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                    background: 'rgba(212,168,83,0.7)',
                                                    animation: 'wp-spin 1.2s linear infinite',
                                                }}/>
                                                {t('waitingForHost')}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Ended Screen ───────────────────────────────── */}
                        {roomStatus === 'ended' && (
                            <div className="wp-anim wp-lobby-screen" style={{
                                position: 'relative',
                                aspectRatio: '16/9',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                background: '#000',
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexDirection: 'column', gap: '20px',
                            }}>
                                {coverImage && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: `url(${coverImage}) center/cover no-repeat`,
                                        filter: 'blur(20px) brightness(0.2)',
                                    }} />
                                )}
                                <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px' }}>
                                    <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🎞️</div>
                                    <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
                                        {t('screeningEnded')}
                                    </h2>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
                                        {t('thankYou')} — <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{title}</strong>
                                    </p>
                                    {replayEnabled && mediaUrl && (
                                        <Link
                                            href={`/${locale}/events/watch/${roomName}?replay=1`}
                                            style={{
                                                display: 'inline-block', padding: '10px 24px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, var(--accent-gold), #c9951b)',
                                                color: '#000', fontWeight: 700, textDecoration: 'none',
                                                fontSize: '0.9rem',
                                            }}
                                        >
                                            🎬 {t('watchReplay')}
                                        </Link>
                                    )}
                                    {canControl && (
                                        <p style={{
                                            marginTop: '20px',
                                            fontSize: '0.78rem',
                                            color: 'rgba(212,168,83,0.6)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M12 5v14M5 12l7 7 7-7"/>
                                            </svg>
                                            Host controls below
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Video Player ────────────────────────────────── */}
                        {(roomStatus === 'playing' || roomStatus === 'paused' || (roomStatus === 'lobby' && canControl) || isReplay) && (
                            <div
                                className={`wp-video-container wp-video-sticky`}
                                ref={containerRef}
                                onMouseMove={resetControlsTimer}
                                onTouchStart={resetControlsTimer}
                                style={{
                                    position: 'relative',
                                    aspectRatio: isFullscreen ? undefined : '16/9',
                                    borderRadius: isFullscreen ? 0 : '16px',
                                    background: '#000',
                                    border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                    overflow: 'hidden',
                                    userSelect: 'none',
                                }}
                            >
                                {/* Video element */}
                                {mediaUrl ? (
                                    <video
                                        ref={videoRef}
                                        src={mediaUrl}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                                        playsInline
                                        controlsList="nodownload"
                                        onContextMenu={e => e.preventDefault()}
                                        onTimeUpdate={() => {
                                            const v = videoRef.current
                                            if (v) setCurrentTime(v.currentTime)
                                        }}
                                        onLoadedMetadata={() => {
                                            const v = videoRef.current
                                            if (v) { setDuration(v.duration); setIsLoading(false) }
                                        }}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onWaiting={() => setIsLoading(true)}
                                        onCanPlay={() => setIsLoading(false)}
                                        onClick={() => {
                                            if (isReplay) {
                                                const v = videoRef.current
                                                if (!v) return
                                                if (v.paused) { v.play().catch(() => {}); setIsPlaying(true) }
                                                else { v.pause(); setIsPlaying(false) }
                                            }
                                        }}
                                    >
                                        {ccEnabled && ccTrackUrl && (
                                            <track
                                                key={ccTrackUrl}
                                                kind="subtitles"
                                                src={ccTrackUrl}
                                                srcLang={ccLang}
                                                label={LANG_NAMES[ccLang] ?? ccLang}
                                                default
                                            />
                                        )}
                                    </video>
                                ) : (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        height: '100%', color: 'rgba(255,255,255,0.4)',
                                        flexDirection: 'column', gap: '12px',
                                    }}>
                                        <div style={{ fontSize: '3rem', opacity: 0.3 }}>🎬</div>
                                        <p style={{ fontSize: '0.9rem' }}>{t('errorStream')}</p>
                                    </div>
                                )}

                                {/* Spinner */}
                                {isLoading && mediaUrl && (
                                    <div style={{
                                        position: 'absolute', inset: 0, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                                    }}>
                                        <div style={{
                                            width: '44px', height: '44px', borderRadius: '50%',
                                            border: '3px solid rgba(255,255,255,0.15)',
                                            borderTopColor: 'var(--accent-gold)',
                                            animation: 'wp-spin 0.8s linear infinite',
                                        }}/>
                                    </div>
                                )}

                                {/* Reaction overlay */}
                                <ReactionOverlay reactions={reactions} />

                                {/* Autoplay Failure Fallback Overlay */}
                                {autoplayFailed && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'rgba(0,0,0,0.85)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexDirection: 'column', gap: '16px', zIndex: 100,
                                        animation: 'wp-fadein 0.3s ease',
                                    }}>
                                        <div style={{ fontSize: '2.5rem' }}>🔈</div>
                                        <p style={{ color: 'white', fontWeight: 600 }}>{t('tapToJoin')}</p>
                                        <button
                                            onClick={() => {
                                                const v = videoRef.current
                                                if (v) v.play().catch(() => {})
                                                setAutoplayFailed(false)
                                            }}
                                            style={{
                                                background: 'var(--accent-gold)', color: '#000',
                                                border: 'none', padding: '10px 24px', borderRadius: '10px',
                                                fontWeight: 700, cursor: 'pointer',
                                            }}
                                        >
                                            ▶ {t('joinScreening')}
                                        </button>
                                    </div>
                                )}

                                {/* Controls overlay */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: showControls ? 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%)' : 'transparent',
                                    transition: 'background 0.3s, opacity 0.3s',
                                    opacity: showControls ? 1 : 0,
                                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                                }}>
                                    {/* Progress bar (replay/host only) */}
                                    {(isReplay || canControl) && duration > 0 && (
                                        <div style={{ padding: '0 16px 4px' }}>
                                            <input
                                                type="range" min={0} max={duration}
                                                value={currentTime} step={0.5}
                                                className="wp-progress-thumb"
                                                onChange={e => {
                                                     const seekTime = Number(e.target.value)
                                                     const v = videoRef.current
                                                     if (v) v.currentTime = seekTime
                                                     setCurrentTime(seekTime)
                                                     if (canControl && !isReplay) {
                                                         sendControl('seek', seekTime)
                                                     }
                                                 }}
                                                style={{
                                                    width: '100%', height: '4px', appearance: 'none',
                                                    background: `linear-gradient(to right, var(--accent-gold) ${progress}%, rgba(255,255,255,0.2) ${progress}%)`,
                                                    borderRadius: '2px', cursor: 'pointer', outline: 'none',
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Bottom controls row */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '8px 12px 12px',
                                    }}>
                                        {/* Time */}
                                        <span style={{
                                            fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)',
                                            fontVariantNumeric: 'tabular-nums', minWidth: '80px',
                                        }}>
                                            {fmt(currentTime)} / {fmt(duration)}
                                        </span>

                                        <div style={{ flex: 1 }} />

                                        {/* ── CC language selector ────────────────────────────────────── */}
                                        {availableLangs.length > 0 && (
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    className="wp-ctrl-btn"
                                                    onClick={() => setShowLangMenu(p => !p)}
                                                    title="Subtitles"
                                                    style={{ color: ccEnabled ? 'var(--accent-gold)' : 'white' }}
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="2" y="5" width="20" height="14" rx="2"/>
                                                        <path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>
                                                    </svg>
                                                </button>

                                                {/* Desktop dropdown */}
                                                {showLangMenu && !isMobile && (
                                                    <div style={{
                                                        position: 'absolute', bottom: '44px', right: 0,
                                                        background: 'rgba(20,20,25,0.97)',
                                                        border: '1px solid rgba(255,255,255,0.12)',
                                                        borderRadius: '10px', padding: '8px',
                                                        minWidth: '160px', zIndex: 10,
                                                        animation: 'wp-fadein 0.15s ease',
                                                    }}>
                                                        <button
                                                            onClick={() => { setCcEnabled(false); setShowLangMenu(false) }}
                                                            style={{
                                                                display: 'block', width: '100%',
                                                                padding: '7px 12px', textAlign: 'left',
                                                                background: !ccEnabled ? 'rgba(212,168,83,0.12)' : 'none',
                                                                border: 'none', color: 'white', cursor: 'pointer',
                                                                borderRadius: '6px', fontSize: '0.85rem',
                                                            }}
                                                        >{t('subtitlesOff')}</button>
                                                        {availableLangs.map(lang => (
                                                            <button
                                                                key={lang}
                                                                onClick={() => { loadSubtitles(lang); setShowLangMenu(false) }}
                                                                style={{
                                                                    display: 'block', width: '100%',
                                                                    padding: '7px 12px', textAlign: 'left',
                                                                    background: ccEnabled && ccLang === lang ? 'rgba(212,168,83,0.12)' : 'none',
                                                                    border: 'none', color: 'white', cursor: 'pointer',
                                                                    borderRadius: '6px', fontSize: '0.85rem',
                                                                }}
                                                            >
                                                                {LANG_NAMES[lang] ?? lang}
                                                                {ccEnabled && ccLang === lang && ' ✓'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Mobile bottom-sheet portal */}
                                                {showLangMenu && isMobile && typeof document !== 'undefined' && createPortal(
                                                    <>
                                                        {/* Backdrop */}
                                                        <div
                                                            onClick={() => setShowLangMenu(false)}
                                                            style={{
                                                                position: 'fixed', inset: 0,
                                                                background: 'rgba(0,0,0,0.55)',
                                                                zIndex: 99998,
                                                            }}
                                                        />
                                                        {/* Sheet */}
                                                        <div style={{
                                                            position: 'fixed', bottom: 0, left: 0, right: 0,
                                                            background: 'rgba(14,14,18,0.98)',
                                                            borderTop: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '20px 20px 0 0',
                                                            zIndex: 99999,
                                                            paddingBottom: 'env(safe-area-inset-bottom, 16px)',
                                                            animation: 'wp-sheet-in 0.28s cubic-bezier(0.32,0.72,0,1)',
                                                        }}>
                                                            {/* Pill handle */}
                                                            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
                                                                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.18)' }} />
                                                            </div>
                                                            {/* Title */}
                                                            <div style={{
                                                                textAlign: 'center', fontSize: '0.78rem',
                                                                fontWeight: 700, letterSpacing: '0.04em',
                                                                color: 'var(--accent-gold)', padding: '4px 0 12px',
                                                                textTransform: 'uppercase',
                                                            }}>Subtitles</div>
                                                            {/* Options */}
                                                            <button
                                                                onClick={() => { setCcEnabled(false); setShowLangMenu(false) }}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                    width: '100%', padding: '14px 24px',
                                                                    background: !ccEnabled ? 'rgba(212,168,83,0.08)' : 'none',
                                                                    border: 'none', color: 'white', cursor: 'pointer',
                                                                    fontSize: '1rem', fontFamily: 'inherit',
                                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                                }}
                                                            >
                                                                <span>Off</span>
                                                                {!ccEnabled && <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>✓</span>}
                                                            </button>
                                                            {availableLangs.map(lang => (
                                                                <button
                                                                    key={lang}
                                                                    onClick={() => { loadSubtitles(lang); setShowLangMenu(false) }}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        width: '100%', padding: '14px 24px',
                                                                        background: ccEnabled && ccLang === lang ? 'rgba(212,168,83,0.08)' : 'none',
                                                                        border: 'none', color: 'white', cursor: 'pointer',
                                                                        fontSize: '1rem', fontFamily: 'inherit',
                                                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                                    }}
                                                                >
                                                                    <span>{LANG_NAMES[lang] ?? lang}</span>
                                                                    {ccEnabled && ccLang === lang && <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>✓</span>}
                                                                </button>
                                                            ))}
                                                            <div style={{ height: '8px' }} />
                                                        </div>
                                                    </>,
                                                    document.body
                                                )}
                                            </div>
                                        )}

                                        {/* Fullscreen */}
                                        <button className="wp-ctrl-btn" onClick={toggleFullscreen} title="Fullscreen">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                {isFullscreen
                                                    ? <><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></>
                                                    : <><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></>
                                                }
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Host Control Panel ───────────────────────────── */}
                        {canControl && (
                            <>
                                {controlError && (
                                    <div style={{
                                        marginTop: '16px', padding: '10px 16px',
                                        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)',
                                        borderRadius: '10px', color: '#f87171', fontSize: '0.85rem',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                        </svg>
                                        {controlError}
                                    </div>
                                )}
                                <div style={{
                                    marginTop: '16px',
                                    padding: '16px 20px',
                                    background: 'linear-gradient(135deg, rgba(212,168,83,0.07), rgba(212,168,83,0.03))',
                                    border: '1px solid rgba(212,168,83,0.2)',
                                    borderRadius: '14px',
                                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                                }}>
                                    <span style={{
                                        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
                                        color: 'var(--accent-gold)', opacity: 0.8,
                                        marginRight: '4px',
                                    }}>{t('hostBadge')}</span>

                                    {roomStatus === 'ended' && (
                                        <button
                                            className="wp-host-btn"
                                            disabled={controlLoading}
                                            onClick={() => sendControl('lobby', 0)}
                                            style={{
                                                background: 'rgba(212,168,83,0.12)',
                                                color: 'var(--accent-gold)',
                                                border: '1px solid rgba(212,168,83,0.4)',
                                                boxShadow: '0 0 12px rgba(212,168,83,0.1)',
                                            }}
                                        >
                                            {controlLoading ? '...' : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                                                    </svg>
                                                    {t('resetToLobby')}
                                                </div>
                                            )}
                                        </button>
                                    )}

                                    {roomStatus === 'lobby' && (
                                        <button
                                            className="wp-host-btn"
                                            disabled={controlLoading}
                                            onClick={() => sendControl('play', 0)}
                                            style={{
                                                background: 'linear-gradient(135deg, var(--accent-gold), #c9951b)',
                                                color: '#000',
                                            }}
                                        >
                                            ▶ {controlLoading ? t('syncing') : t('startScreening')}
                                        </button>
                                    )}
                                    {(roomStatus === 'paused' || roomStatus === 'playing') && (
                                        <>
                                            {!isPlaying ? (
                                                <button
                                                    className="wp-host-btn"
                                                    disabled={controlLoading}
                                                    onClick={() => sendControl('play', videoRef.current?.currentTime ?? 0)}
                                                    style={{ background: 'rgba(212,168,83,0.15)', color: 'var(--accent-gold)', border: '1px solid rgba(212,168,83,0.3)' }}
                                                >
                                                    ▶ {t('resumeScreening')}
                                                </button>
                                            ) : (
                                                <button
                                                    className="wp-host-btn"
                                                    disabled={controlLoading}
                                                    onClick={() => sendControl('pause', videoRef.current?.currentTime ?? 0)}
                                                    style={{ background: 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
                                                >
                                                    ⏸ {t('pauseScreening')}
                                                </button>
                                            )}
                                            <button
                                                className="wp-host-btn"
                                                disabled={controlLoading}
                                                onClick={() => {
                                                    if (confirm(t('confirmEnd'))) {
                                                        sendControl('end', videoRef.current?.currentTime ?? 0)
                                                    }
                                                }}
                                                style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }}
                                            >
                                                ⏹ {t('endParty')}
                                            </button>
                                        </>
                                    )}
                                    {controlLoading && (
                                        <div style={{
                                            width: '16px', height: '16px', borderRadius: '50%',
                                            border: '2px solid rgba(212,168,83,0.3)',
                                            borderTopColor: 'var(--accent-gold)',
                                            animation: 'wp-spin 0.7s linear infinite',
                                        }}/>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ── Title + scheduled info ───────────────────────── */}
                        <div style={{ marginTop: '16px' }}>
                            <h1 style={{
                                fontSize: '1.25rem', fontWeight: 700,
                                color: 'var(--text-primary)', marginBottom: '4px',
                            }}>{mediaTitle}</h1>
                            {roomStatus === 'lobby' && scheduledAt && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                    {t('scheduledFor', { date: new Date(scheduledAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Chat ──────────────────────────────────────── */}
                    {showChat ? (
                        <WatchPartyChat
                            roomName={roomName}
                            eventId={eventId}
                            locale={locale}
                            disabled={roomStatus === 'lobby' && !canControl}
                            onReaction={(emoji) => {
                                // Optimistic local reaction
                                const r = {
                                    id:    Math.random().toString(36).slice(2),
                                    emoji,
                                    x:     10 + Math.random() * 80,
                                }
                                setReactions(prev => [...prev, r])
                                setTimeout(() => setReactions(prev => prev.filter(x => x.id !== r.id)), 3500)
                            }}
                        />
                    ) : (
                        <button
                            onClick={() => setShowChat(true)}
                            style={{
                                alignSelf: 'flex-start',
                                padding: '8px 16px', borderRadius: '10px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-secondary)', cursor: 'pointer',
                                fontSize: '0.85rem', fontFamily: 'inherit',
                            }}
                        >
                            💬 {t('showChat')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
