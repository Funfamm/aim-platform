'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import ParticipantGrid from './ParticipantGrid'
import CaptionOverlay from './CaptionOverlay'
import LanguageSelector from './LanguageSelector'
import type { CaptionLang } from '@/lib/livekit/translation-adapter'
import type { LiveKitRole } from '@/lib/livekit/grants'

interface RoomShellProps {
    roomName: string
    role?: LiveKitRole
}

interface TokenData {
    token: string
    wsUrl: string
    role: LiveKitRole
    identity: string
}

const MAX_RECONNECT_ATTEMPTS = 4
const BASE_RECONNECT_DELAY_MS = 1_500
// Max retries the LiveKit SDK makes internally before firing onDisconnected.
// NOTE: ReconnectPolicy only exposes nextRetryDelayMs — return null to stop.
const SDK_MAX_RETRIES = 5

export default function RoomShell({ roomName, role = 'viewer' }: RoomShellProps) {
    const [tokenData, setTokenData]       = useState<TokenData | null>(null)
    const [captionLang, setCaptionLang]   = useState<CaptionLang>('en')
    const [loading, setLoading]           = useState(true)   // initial connect only
    const [error, setError]               = useState<string | null>(null)
    const [reconnecting, setReconnecting] = useState(false)  // non-destructive banner
    const reconnectAttempts = useRef(0)
    const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isMounted         = useRef(true)

    useEffect(() => {
        // Re-set to true on every effect run (needed in React 18 StrictMode:
        // the cleanup sets it to false, then the effect re-runs on the same instance).
        isMounted.current = true
        return () => {
            isMounted.current = false
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        }
    }, [])

    // ── Token fetch ──────────────────────────────────────────────────────────
    // silent=true  → skip setLoading(true) so LiveKitRoom stays mounted during
    //               reconnect token refreshes. Only the initial fetch shows the
    //               full loading screen.
    // captionLang intentionally excluded from deps — changing language only
    // affects CaptionOverlay and must never trigger a full remount.
    const fetchToken = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
        if (!isMounted.current) return
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
            // Only reset the loading screen if we showed it (non-silent path).
            if (isMounted.current && !silent) setLoading(false)
        }
    }, [roomName, role])

    useEffect(() => { fetchToken() }, [fetchToken])

    // ── Disconnect handler ────────────────────────────────────────────────────
    // Does NOT call setLoading(true) — that would unmount LiveKitRoom and flash
    // the loading screen for every transient disconnect.
    // Shows a lightweight amber banner instead, then fetches a new token silently
    // once the SDK has exhausted its own retry policy. The new token re-keys
    // LiveKitRoom (clean reconnect) without showing the full loading UI.
    const handleDisconnected = useCallback(() => {
        if (!isMounted.current) return
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
            if (!isMounted.current) return
            // silent=true: new token replaces key without triggering the loading screen
            await fetchToken({ silent: true })
            if (isMounted.current) setReconnecting(false)
        }, delay)
    }, [fetchToken])

    const handleConnected = useCallback(() => {
        reconnectAttempts.current = 0
        setReconnecting(false)
    }, [])

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
            </div>
        )
    }

    if (!tokenData) return null

    const canPublish = role !== 'viewer'

    return (
        <div className="room-shell" data-room={roomName}>
            <div className="room-shell-header">
                <span className="room-live-badge" aria-label="Live indicator">● LIVE</span>
                <span className="room-name-label">{roomName}</span>
                <LanguageSelector value={captionLang} onChange={setCaptionLang} />
            </div>

            {reconnecting && (
                <div className="room-reconnecting-banner" role="status" aria-live="polite">
                    <div className="room-reconnecting-spinner" />
                    Reconnecting… (attempt {reconnectAttempts.current}/{MAX_RECONNECT_ATTEMPTS})
                </div>
            )}

            {/*
              key={tokenData.token}: A new token (from silent retry) remounts LiveKitRoom
              cleanly. Normal transient disconnects are handled by the SDK's own reconnect
              policy and never change the token — so LiveKitRoom stays mounted, no flash.
            */}
            <LiveKitRoom
                key={tokenData.token}
                token={tokenData.token}
                serverUrl={tokenData.wsUrl}
                audio={canPublish}   // viewers receive only — don't publish audio
                video={canPublish}   // viewers receive only — don't publish video
                connect={true}
                onDisconnected={handleDisconnected}
                onConnected={handleConnected}
                options={{
                    reconnectPolicy: {
                        // Returning null signals the SDK to stop retrying and fire
                        // onDisconnected, handing control back to handleDisconnected.
                        // maxRetries is NOT a valid field on ReconnectPolicy — this is
                        // the correct way to cap SDK-level retries.
                        nextRetryDelayMs: (ctx) =>
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
