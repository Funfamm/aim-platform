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

export default function RoomShell({ roomName, role = 'viewer' }: RoomShellProps) {
    const [tokenData, setTokenData]   = useState<TokenData | null>(null)
    const [captionLang, setCaptionLang] = useState<CaptionLang>('en')
    const [loading, setLoading]         = useState(true)   // initial token fetch only
    const [error, setError]             = useState<string | null>(null)
    const [reconnecting, setReconnecting] = useState(false) // overlay — doesn't unmount LiveKitRoom
    const reconnectAttempts = useRef(0)
    const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isMounted         = useRef(true)

    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        }
    }, [])

    // ── Token fetch ──────────────────────────────────────────────────────────
    // NOTE: captionLang is intentionally NOT in deps.
    // Changing caption language only affects the client-side CaptionOverlay —
    // it does NOT require a new token / LiveKitRoom remount.
    const fetchToken = useCallback(async () => {
        if (!isMounted.current) return
        setError(null)
        setLoading(true)
        try {
            const res = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName,
                    role,
                    preferredCaptionLang: 'en', // static default — user preference stored client-side
                }),
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
            if (isMounted.current) setLoading(false)
        }
    }, [roomName, role]) // captionLang intentionally omitted

    useEffect(() => { fetchToken() }, [fetchToken])

    // ── LiveKit disconnect handler ────────────────────────────────────────────
    // IMPORTANT: We do NOT call setLoading(true) here.
    // That would unmount <LiveKitRoom> and cause the flash.
    // Instead we show a non-destructive reconnecting banner while LiveKit SDK
    // retries internally. Only after exhausting retries do we fetch a new token.
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
            // Fetch a fresh token → React will re-key <LiveKitRoom> with new token
            await fetchToken()
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
              key={tokenData.token}: A fresh token (from retry) creates a new LiveKitRoom instance.
              Normal disconnects handled internally by SDK — no remount, no flash.
            */}
            <LiveKitRoom
                key={tokenData.token}
                token={tokenData.token}
                serverUrl={tokenData.wsUrl}
                audio={canPublish}   // viewers don't need to publish audio
                video={canPublish}   // viewers only receive, not send
                connect={true}
                onDisconnected={handleDisconnected}
                onConnected={handleConnected}
                options={{
                    // Reconnect automatically before giving up
                    reconnectPolicy: {
                        maxRetries: 5,
                        nextRetryDelayMs: (context) =>
                            Math.min(1_000 * 2 ** context.retryCount, 30_000),
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
