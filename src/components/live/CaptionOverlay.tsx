'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'
import { CAPTION_TOPICS, type CaptionLang } from '@/lib/livekit/translation-adapter'

interface CaptionLine {
    id: string
    text: string
    speakerName: string
    ts: number
}

interface CaptionOverlayProps {
    lang: CaptionLang
    maxLines?: number
    fadeAfterMs?: number
}

export default function CaptionOverlay({
    lang,
    maxLines = 3,
    fadeAfterMs = 6000,
}: CaptionOverlayProps) {
    const room = useRoomContext()
    const [lines, setLines] = useState<CaptionLine[]>([])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const topic = CAPTION_TOPICS[lang]

    const handleData = useCallback(
        (payload: Uint8Array, participant?: { name?: string; identity?: string }) => {
            try {
                const text = new TextDecoder().decode(payload)
                const line: CaptionLine = {
                    id: `${Date.now()}-${Math.random()}`,
                    text,
                    speakerName: participant?.name ?? participant?.identity ?? 'Speaker',
                    ts: Date.now(),
                }

                setLines((prev) => {
                    const next = [...prev, line]
                    return next.slice(-maxLines)
                })

                // Auto-clear after fadeAfterMs
                if (timerRef.current) clearTimeout(timerRef.current)
                timerRef.current = setTimeout(() => {
                    setLines((prev) => prev.filter((l) => Date.now() - l.ts < fadeAfterMs))
                }, fadeAfterMs)
            } catch {
                // Silently ignore malformed caption packets
            }
        },
        [maxLines, fadeAfterMs],
    )

    useEffect(() => {
        if (!room) return

        // Subscribe to data events that match our caption topic
        const onDataReceived = (
            payload: Uint8Array,
            participant?: { name?: string; identity?: string },
            _kind?: number,
            incomingTopic?: string,
        ) => {
            if (incomingTopic === topic) {
                handleData(payload, participant)
            }
        }

        room.on(RoomEvent.DataReceived, onDataReceived)
        return () => {
            room.off(RoomEvent.DataReceived, onDataReceived)
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [room, topic, handleData])

    // Clear lines when language switches
    useEffect(() => {
        setLines([])
    }, [lang])

    if (lines.length === 0) return null

    return (
        <div
            className="caption-overlay"
            role="status"
            aria-live="polite"
            aria-atomic="false"
            aria-label={`Live captions in ${lang}`}
        >
            {lines.map((line) => (
                <div key={line.id} className="caption-line">
                    <span className="caption-speaker">{line.speakerName}: </span>
                    <span className="caption-text">{line.text}</span>
                </div>
            ))}
        </div>
    )
}
