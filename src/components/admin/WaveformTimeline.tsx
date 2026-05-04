'use client'

/**
 * WaveformTimeline
 *
 * Renders a full static audio waveform for the video using WaveSurfer.js.
 * - Fetches audio separately from the video URL (no Web Audio interception)
 * - Overlays colored regions for each subtitle cue
 * - Syncs a cursor to the video's currentTime
 * - Click anywhere to seek the video
 */

import { useEffect, useRef, useState, RefObject } from 'react'

interface Cue { start: number; end: number }

interface Props {
    filmUrl: string
    videoRef: RefObject<HTMLVideoElement | null>
    cues: Cue[]
    activeCue: number
}

export default function WaveformTimeline({ filmUrl, videoRef, cues, activeCue }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wsRef = useRef<any>(null)
    const [ready, setReady] = useState(false)
    const [loadError, setLoadError] = useState(false)
    // cursor position 0..1
    const [progress, setProgress] = useState(0)

    // ── Mount WaveSurfer ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current || !filmUrl) return
        let ws: any // eslint-disable-line @typescript-eslint/no-explicit-any

        import('wavesurfer.js').then(({ default: WaveSurfer }) => {
            if (!containerRef.current) return
            ws = WaveSurfer.create({
                container:     containerRef.current,
                waveColor:     'rgba(52,211,153,0.35)',
                progressColor: 'rgba(52,211,153,0.75)',
                cursorColor:   'rgba(212,168,83,0.0)', // hide built-in cursor; we draw our own
                cursorWidth:   0,
                height:        56,
                barWidth:      2,
                barGap:        1,
                barRadius:     2,
                normalize:     true,
                interact:      false,  // seeking handled via onClick overlay
                url:           filmUrl,
                backend:       'WebAudio',  // decode only — does NOT touch the video element
            })
            ws.on('ready',   () => setReady(true))
            ws.on('error',   () => setLoadError(true))
            wsRef.current = ws
        }).catch(() => setLoadError(true))

        return () => {
            ws?.destroy()
            wsRef.current = null
            setReady(false)
            setLoadError(false)
            setProgress(0)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filmUrl])

    // ── Sync cursor with video timeupdate ──────────────────────────────────────
    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return
        const onTime = () => {
            const dur = vid.duration
            if (!dur || isNaN(dur) || dur === 0) return
            setProgress(vid.currentTime / dur)
        }
        vid.addEventListener('timeupdate', onTime)
        return () => vid.removeEventListener('timeupdate', onTime)
    }, [videoRef])

    // ── Click to seek ──────────────────────────────────────────────────────────
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const vid = videoRef.current
        const el  = containerRef.current
        if (!vid || !el) return
        const rect  = el.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const dur   = vid.duration
        if (dur && !isNaN(dur)) vid.currentTime = ratio * dur
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '56px', background: 'rgba(0,0,0,0.5)', flexShrink: 0 }}>

            {/* Loading state */}
            {!ready && !loadError && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                }}>
                    Decoding audio…
                </div>
            )}

            {/* Error state */}
            {loadError && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.55rem', color: 'rgba(239,68,68,0.6)',
                }}>
                    Could not load waveform
                </div>
            )}

            {/* WaveSurfer canvas mount point */}
            <div
                ref={containerRef}
                style={{ width: '100%', height: '56px', opacity: ready ? 1 : 0, transition: 'opacity 0.4s' }}
            />

            {/* Cue region overlays */}
            {ready && cues.map((cue, i) => {
                const dur = videoRef.current?.duration
                if (!dur || isNaN(dur)) return null
                const left  = (cue.start / dur) * 100
                const width = Math.max(0.1, ((cue.end - cue.start) / dur) * 100)
                const isActive = i === activeCue
                return (
                    <div key={i} style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left:    `${left}%`,
                        width:   `${width}%`,
                        background: isActive ? 'rgba(212,168,83,0.18)' : 'rgba(255,255,255,0.04)',
                        borderLeft: `1px solid ${isActive ? 'rgba(212,168,83,0.7)' : 'rgba(255,255,255,0.12)'}`,
                        pointerEvents: 'none',
                        zIndex: 2,
                    }} />
                )
            })}

            {/* Custom playhead cursor */}
            {ready && (
                <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left:   `${progress * 100}%`,
                    width:  '2px',
                    background: 'rgba(212,168,83,0.9)',
                    boxShadow: '0 0 4px rgba(212,168,83,0.6)',
                    pointerEvents: 'none',
                    zIndex: 3,
                    transform: 'translateX(-1px)',
                }} />
            )}

            {/* Click capture overlay */}
            {ready && (
                <div
                    onClick={handleClick}
                    style={{
                        position: 'absolute', inset: 0,
                        cursor: 'crosshair',
                        zIndex: 4,
                        background: 'transparent',
                    }}
                    title="Click to seek"
                />
            )}
        </div>
    )
}
