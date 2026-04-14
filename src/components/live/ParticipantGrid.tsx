'use client'

import {
    useTracks,
    VideoTrack,
    useParticipants,
    useConnectionState,
} from '@livekit/components-react'
import { Track, ConnectionState } from 'livekit-client'
import type { LiveKitRole } from '@/lib/livekit/grants'

interface ParticipantGridProps {
    role?: LiveKitRole
}

export default function ParticipantGrid({ role = 'viewer' }: ParticipantGridProps) {
    const connectionState = useConnectionState()
    const tracks = useTracks(
        [
            { source: Track.Source.Camera,      withPlaceholder: true  },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    )
    const participants = useParticipants()
    const count = participants.length

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
        ? tracks.filter(t => !t.participant.isLocal) // viewers only see remote participants
        : tracks

    const displayTracks = remoteTracks
    const gridSize = Math.min(Math.max(displayTracks.length, 1), 6)

    return (
        <div
            className={`participant-grid participant-grid--${gridSize}`}
            aria-label={`${count} participant${count !== 1 ? 's' : ''} in room`}
        >
            {displayTracks.length === 0 ? (
                <div className="participant-grid-empty" role="status">
                    <div className="participant-grid-waiting-icon">📡</div>
                    <p>
                        {isViewer
                            ? 'Waiting for the host to go live…'
                            : 'Waiting for participants…'}
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
                            {trackRef.publication?.isSubscribed || isLocal ? (
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
    )
}
