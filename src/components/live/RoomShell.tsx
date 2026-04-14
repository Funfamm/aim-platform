'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import type { ReconnectContext } from 'livekit-client'
import ParticipantGrid from './ParticipantGrid'
import CaptionOverlay from './CaptionOverlay'
import LanguageSelector from './LanguageSelector'
import type { CaptionLang } from '@/lib/livekit/translation-adapter'
import type { LiveKitRole } from '@/lib/livekit/grants'

interface RoomShellProps {
    roomName: string
    role?: LiveKitRole
    /** Called when admin clicks "End Event" — optional, only shown to hosts/admins */
    onEndEvent?: () => Promise<void>
    /** Where to navigate after leaving (default: router.back()) */
    exitPath?: string
}

interface TokenData {
    token: string
    wsUrl: string
    role: LiveKitRole
    identity: string
}

const MAX_RECONNECT_ATTEMPTS = 4
const BASE_RECONNECT_DELAY_MS = 1_500
const SDK_MAX_RETRIES = 5

export default function RoomShell({
    roomName,
    role = 'viewer',
    onEndEvent,
    exitPath,
}: RoomShellProps) {
    const router = useRouter()

    const [tokenData, setTokenData]       = useState<TokenData | null>(null)
    const [captionLang, setCaptionLang]   = useState<CaptionLang>('en')
    const [loading, setLoading]           = useState(true)
    const [error, setError]               = useState<string | null>(null)
    const [reconnecting, setReconnecting] = useState(false)
    const [endingEvent, setEndingEvent]   = useState(false)

    // ── Refs that NEVER go stale in closures ─────────────────────────────────
    const isMounted         = useRef(true)
    const tokenFetched      = useRef(false)   // StrictMode double-invoke guard
    const leftRoomRef       = useRef(false)   // deliberate leave flag (ref = no stale closure)
    const reconnectAttempts = useRef(0)
    const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        }
    }, [])

    // ── Token fetch ───────────────────────────────────────────────────────────
    // leftRoom removed from deps — we read leftRoomRef.current instead,
    // which always has the current value without stale-closure risk.
    const fetchToken = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
        if (!isMounted.current) return
        if (leftRoomRef.current) return          // deliberate leave — never reconnect
        setError(null)
        if (!silent) setLoading(true)
        try {
            const res = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName, role, preferredCaptionLang: 'en' }),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                throw new Error(d.error || `Token request failed (${res.status})`)
            }
            const data: TokenData = await res.json()
            if (!isMounted.current) return
            reconnectAttempts.current = 0
            setTokenData(data)
        } catch (err) {
            if (!isMounted.current) return
            setError(err instanceof Error ? err.message : 'Connection failed')
        } finally {
            if (isMounted.current && !silent) {
                setLoading(false)
                tokenFetched.current = true
            }
        }
    }, [roomName, role])   // leftRoom NOT in deps — read via ref

    // StrictMode guard: run exactly once on first true mount
    useEffect(() => {
        if (!tokenFetched.current) {
            tokenFetched.current = true
            fetchToken()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Disconnect handler ────────────────────────────────────────────────────
    const handleDisconnected = useCallback(() => {
        if (!isMounted.current || leftRoomRef.current) return
        reconnectAttempts.current += 1

        if (reconnectAttempts.current > MAX_RECONNECT_ATTEMPTS) {
            setError(`Connection lost after ${MAX_RECONNECT_ATTEMPTS} attempts. Please refresh.`)
            return
        }

        setReconnecting(true)

        const delay = Math.min(
            BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts.current,
            30_000,
        )

        reconnectTimer.current = setTimeout(async () => {
            if (!isMounted.current || leftRoomRef.current) return
            await fetchToken({ silent: true })
            if (isMounted.current) setReconnecting(false)
        }, delay)
    }, [fetchToken])   // leftRoom NOT in deps — read via ref

    const handleConnected = useCallback(() => {
        reconnectAttempts.current = 0
        setReconnecting(false)
    }, [])

    // ── Leave room ────────────────────────────────────────────────────────────
    const handleLeave = useCallback(() => {
        leftRoomRef.current = true   // set ref first — prevents any in-flight reconnect
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        if (exitPath) {
            router.push(exitPath)
        } else {
            router.back()
        }
    }, [exitPath, router])

    // ── End event (admin/host only) ───────────────────────────────────────────
    const handleEndEvent = useCallback(async () => {
        if (!onEndEvent) return
        // SSR-safe confirm — component is client-only but guard prevents any edge case
        const confirmed = typeof window !== 'undefined'
            ? window.confirm('End the event for all participants? This cannot be undone.')
            : false
        if (!confirmed) return
        setEndingEvent(true)
        try {
            await onEndEvent()
            handleLeave()
        } catch (err) {
            console.error('[RoomShell] End event failed:', err)
            setEndingEvent(false)
        }
    }, [onEndEvent, handleLeave])

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="room-shell-loading" aria-live="polite">
                <div className="room-shell-spinner" />
                <p>Connecting to room…</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="room-shell-error" role="alert">
                <p>{error}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
                    <button
                        id="room-shell-retry-btn"
                        className="room-shell-retry-btn"
                        onClick={() => {
                            reconnectAttempts.current = 0
                            fetchToken()
                        }}
                    >
                        Retry
                    </button>
                    <button
                        id="room-shell-leave-btn"
                        className="room-shell-leave-btn"
                        onClick={handleLeave}
                    >
                        Leave
                    </button>
                </div>
            </div>
        )
    }

    if (!tokenData) return null

    const canPublish = role !== 'viewer'
    const isHost     = role === 'host' || role === 'admin'

    return (
        <div className="room-shell" data-room={roomName}>
            <div className="room-shell-header">
                <span className="room-live-badge" aria-label="Live indicator">● LIVE</span>
                <span className="room-name-label">{roomName}</span>
                <LanguageSelector value={captionLang} onChange={setCaptionLang} />

                <div className="room-shell-actions">
                    {/* End Event — admin/host only, SSR-safe confirm */}
                    {isHost && onEndEvent && (
                        <button
                            id="room-shell-end-event-btn"
                            className="room-shell-end-btn"
                            onClick={handleEndEvent}
                            disabled={endingEvent}
                            title="End event for all participants"
                        >
                            {endingEvent ? 'Ending…' : '⏹ End Event'}
                        </button>
                    )}

                    {/* Leave / Exit — always visible */}
                    <button
                        id="room-shell-leave-btn"
                        className="room-shell-leave-btn"
                        onClick={handleLeave}
                        title="Leave the room"
                    >
                        ✕ Leave
                    </button>
                </div>
            </div>

            {reconnecting && (
                <div className="room-reconnecting-banner" role="status" aria-live="polite">
                    <div className="room-reconnecting-spinner" />
                    Reconnecting… (attempt {reconnectAttempts.current}/{MAX_RECONNECT_ATTEMPTS})
                </div>
            )}

            {/*
              key={tokenData.token}: a new token from silent retry triggers a clean
              LiveKitRoom remount. SDK handles transient disconnects internally via
              reconnectPolicy — so no flash on normal network hiccups.
            */}
            <LiveKitRoom
                key={tokenData.token}
                token={tokenData.token}
                serverUrl={tokenData.wsUrl}
                audio={canPublish}
                video={canPublish}
                connect={true}
                onDisconnected={handleDisconnected}
                onConnected={handleConnected}
                options={{
                    reconnectPolicy: {
                        nextRetryDelayInMs: (ctx: ReconnectContext) =>
                            ctx.retryCount >= SDK_MAX_RETRIES
                                ? null
                                : Math.min(1_000 * 2 ** ctx.retryCount, 30_000),
                    },
                }}
            >
                <RoomAudioRenderer />
                <div className="room-shell-video-area">
                    <ParticipantGrid role={role} />
                    <CaptionOverlay lang={captionLang} />
                </div>
            </LiveKitRoom>
        </div>
    )
}
