'use client'

import { useState, useCallback } from 'react'
import {
    useTracks,
    VideoTrack,
    useParticipants,
    useConnectionState,
    useLocalParticipant,
    isTrackReference,
} from '@livekit/components-react'
import { Track, ConnectionState } from 'livekit-client'
import type { LiveKitRole } from '@/lib/livekit/grants'

interface ParticipantGridProps {
    role?: LiveKitRole
}

export default function ParticipantGrid({ role = 'viewer' }: ParticipantGridProps) {
    const connectionState = useConnectionState()
    const { localParticipant } = useLocalParticipant()
    const tracks = useTracks(
        [
            { source: Track.Source.Camera,      withPlaceholder: true  },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    )
    const participants = useParticipants()
    const count = participants.length

    const canPublish = role !== 'viewer'

    // Local media toggle state — starts off (perms requested on demand, not on join)
    const [camOn,  setCamOn]  = useState(false)
    const [micOn,  setMicOn]  = useState(false)
    const [shareOn, setShareOn] = useState(false)
    const [mediaError, setMediaError] = useState<string | null>(null)

    const toggleCamera = useCallback(async () => {
        if (!localParticipant) return
        try {
            setMediaError(null)
            const next = !camOn
            await localParticipant.setCameraEnabled(next)
            setCamOn(next)
        } catch (e) {
            setMediaError('Camera unavailable — check browser permissions.')
            console.error('[ParticipantGrid] camera toggle failed', e)
        }
    }, [localParticipant, camOn])

    const toggleMic = useCallback(async () => {
        if (!localParticipant) return
        try {
            setMediaError(null)
            const next = !micOn
            await localParticipant.setMicrophoneEnabled(next)
            setMicOn(next)
        } catch (e) {
            setMediaError('Microphone unavailable — check browser permissions.')
            console.error('[ParticipantGrid] mic toggle failed', e)
        }
    }, [localParticipant, micOn])

    const toggleScreenShare = useCallback(async () => {
        if (!localParticipant) return
        try {
            setMediaError(null)
            const next = !shareOn
            await localParticipant.setScreenShareEnabled(next)
            setShareOn(next)
        } catch (e) {
            setMediaError('Screen share unavailable or cancelled.')
            console.error('[ParticipantGrid] screen share toggle failed', e)
        }
    }, [localParticipant, shareOn])

    if (connectionState === ConnectionState.Connecting) {
        return (
            <div className="participant-grid-empty">
                <div className="participant-grid-spinner" />
                <p>Joining room…</p>
            </div>
        )
    }

    if (connectionState === ConnectionState.Disconnected) {
        return (
            <div className="participant-grid-empty">
                <p>⚠ Disconnected from room</p>
            </div>
        )
    }

    const isViewer = role === 'viewer'
    const remoteTracks = isViewer
        ? tracks.filter(t => !t.participant.isLocal)
        : tracks

    const displayTracks = remoteTracks
    const gridSize = Math.min(Math.max(displayTracks.length, 1), 6)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
            {/* ── Video Grid ── */}
            <div
                className={`participant-grid participant-grid--${gridSize}`}
                aria-label={`${count} participant${count !== 1 ? 's' : ''} in room`}
                style={{ flex: 1 }}
            >
                {displayTracks.length === 0 ? (
                    <div className="participant-grid-empty" role="status">
                        <div className="participant-grid-waiting-icon">📡</div>
                        <p>
                            {isViewer
                                ? 'Waiting for the host to go live…'
                                : 'Enable your camera or mic below to go live'}
                        </p>
                        <p className="participant-grid-hint">
                            {isViewer
                                ? 'You will see video automatically when the host joins.'
                                : 'Share the room link so others can join.'}
                        </p>
                    </div>
                ) : (
                    displayTracks.map((trackRef) => {
                        const identity = trackRef.participant.identity
                        const name = trackRef.participant.name ?? identity
                        const isLocal = trackRef.participant.isLocal

                        return (
                            <div
                                key={`${identity}-${trackRef.source}`}
                                className={`participant-tile${isLocal ? ' participant-tile--local' : ''}`}
                                data-identity={identity}
                            >
                                {(trackRef.publication?.isSubscribed || isLocal) && isTrackReference(trackRef) ? (
                                    <VideoTrack
                                        trackRef={trackRef}
                                        className="participant-video"
                                    />
                                ) : (
                                    <div className="participant-avatar" aria-label={`${name} camera off`}>
                                        <span className="participant-avatar-initial">
                                            {name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="participant-name-tag">
                                    <span className="participant-name">
                                        {name}
                                        {isLocal && <span className="participant-you"> (You)</span>}
                                    </span>
                                    {trackRef.source === Track.Source.ScreenShare && (
                                        <span className="participant-badge participant-badge--screen">Screen</span>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* ── Media Controls — only for publishers ── */}
            {canPublish && (
                <div
                    className="media-controls-bar"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(8px)',
                        borderTop: '1px solid rgba(255,255,255,0.07)',
                        flexShrink: 0,
                    }}
                >
                    {/* Camera */}
                    <button
                        id="media-ctrl-camera"
                        onClick={toggleCamera}
                        title={camOn ? 'Turn camera off' : 'Turn camera on'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '99px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.78rem',
                            transition: 'all 0.2s',
                            background: camOn ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)',
                            color: camOn ? '#34d399' : 'rgba(255,255,255,0.6)',
                            outline: camOn ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        {camOn ? '📹' : '📷'} {camOn ? 'Cam On' : 'Camera'}
                    </button>

                    {/* Mic */}
                    <button
                        id="media-ctrl-mic"
                        onClick={toggleMic}
                        title={micOn ? 'Mute microphone' : 'Unmute microphone'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '99px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.78rem',
                            transition: 'all 0.2s',
                            background: micOn ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)',
                            color: micOn ? '#34d399' : 'rgba(255,255,255,0.6)',
                            outline: micOn ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        {micOn ? '🎙' : '🔇'} {micOn ? 'Mic On' : 'Mic'}
                    </button>

                    {/* Screen Share */}
                    <button
                        id="media-ctrl-screen"
                        onClick={toggleScreenShare}
                        title={shareOn ? 'Stop sharing screen' : 'Share screen'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '99px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.78rem',
                            transition: 'all 0.2s',
                            background: shareOn ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.08)',
                            color: shareOn ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                            outline: shareOn ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        🖥 {shareOn ? 'Sharing' : 'Share Screen'}
                    </button>

                    {/* Error toast */}
                    {mediaError && (
                        <span style={{
                            fontSize: '0.72rem',
                            color: '#f87171',
                            background: 'rgba(239,68,68,0.1)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239,68,68,0.2)',
                        }}>
                            {mediaError}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
