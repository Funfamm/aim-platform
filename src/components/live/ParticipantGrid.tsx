'use client'

import {
    useTracks,
    VideoTrack,
    useParticipants,
} from '@livekit/components-react'
import { Track } from 'livekit-client'

export default function ParticipantGrid() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    )

    const participants = useParticipants()
    const count = participants.length

    return (
        // Use tracks.length for grid layout — a participant with both camera + screenshare
        // creates 2 tiles and the grid must accommodate the actual tile count, not just headcount.
        <div
            className={`participant-grid participant-grid--${Math.min(tracks.length, 6)}`}
            aria-label={`${count} participant${count !== 1 ? 's' : ''} in room`}
        >
            {tracks.map((trackRef) => {
                const identity = trackRef.participant.identity
                const name = trackRef.participant.name ?? identity

                return (
                    <div
                        key={`${identity}-${trackRef.source}`}
                        className="participant-tile"
                        data-identity={identity}
                    >
                        {trackRef.publication?.isSubscribed ? (
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
                            <span className="participant-name">{name}</span>
                            {trackRef.source === Track.Source.ScreenShare && (
                                <span className="participant-badge participant-badge--screen">
                                    Screen
                                </span>
                            )}
                        </div>
                    </div>
                )
            })}

            {tracks.length === 0 && (
                <div className="participant-grid-empty" role="status">
                    <p>Waiting for participants to join…</p>
                </div>
            )}
        </div>
    )
}
