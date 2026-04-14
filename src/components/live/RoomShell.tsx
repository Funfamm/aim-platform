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

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1_000

export default function RoomShell({ roomName, role = 'viewer' }: RoomShellProps) {
    const [tokenData, setTokenData] = useState<TokenData | null>(null)
    const [captionLang, setCaptionLang] = useState<CaptionLang>('en')
    const [error, setError] = useState<string | null>(null)
    const [connecting, setConnecting] = useState(true)
    const reconnectAttempts = useRef(0)
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchToken = useCallback(async () => {
        try {
            setError(null)
            const res = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName, role, preferredCaptionLang: captionLang }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to get room token')
            }

            const data: TokenData = await res.json()
            reconnectAttempts.current = 0  // reset on success
            setTokenData(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed')
        } finally {
            setConnecting(false)
        }
    }, [roomName, role, captionLang])

    // Handles LiveKit disconnect events with exponential backoff and a hard retry cap.
    // Prevents hammering /api/livekit/token under network flaps or when a room ends.
    const handleDisconnected = useCallback(() => {
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
            setError(`Connection lost after ${MAX_RECONNECT_ATTEMPTS} attempts. Please refresh the page.`)
            return
        }

        reconnectAttempts.current += 1
        const delay = Math.min(
            BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts.current,
            30_000, // cap at 30 s
        )

        reconnectTimer.current = setTimeout(() => {
            setConnecting(true)
            fetchToken()
        }, delay)
    }, [fetchToken])

    useEffect(() => {
        fetchToken()
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        }
    }, [fetchToken])

    if (connecting) {
        return (
            <div className="room-shell-loading" aria-live="polite">
                <div className="room-shell-spinner" />
                <p>
                    {reconnectAttempts.current > 0
                        ? `Reconnecting… (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`
                        : 'Connecting to room…'}
                </p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="room-shell-error" role="alert">
                <p>{error}</p>
                <button
                    id="room-shell-retry-btn"
                    onClick={() => {
                        reconnectAttempts.current = 0
                        setConnecting(true)
                        fetchToken()
                    }}
                    className="room-shell-retry-btn"
                >
                    Retry
                </button>
            </div>
        )
    }

    if (!tokenData) return null

    return (
        <div className="room-shell" data-room={roomName}>
            <div className="room-shell-header">
                <span className="room-live-badge" aria-label="Live indicator">● LIVE</span>
                <span className="room-name-label">{roomName}</span>
                <LanguageSelector
                    value={captionLang}
                    onChange={setCaptionLang}
                />
            </div>

            <LiveKitRoom
                token={tokenData.token}
                serverUrl={tokenData.wsUrl}
                audio
                video={tokenData.role !== 'viewer'}
                connect
                onDisconnected={handleDisconnected}
            >
                <RoomAudioRenderer />
                <div className="room-shell-video-area">
                    <ParticipantGrid />
                    <CaptionOverlay lang={captionLang} />
                </div>
            </LiveKitRoom>
        </div>
    )
}
