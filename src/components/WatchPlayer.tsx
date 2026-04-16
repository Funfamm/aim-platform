'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { TranscriptSegment } from '@/lib/transcribe-client'
import { LANGUAGE_NAMES, SUBTITLE_TARGET_LANGS } from '@/config/subtitles'
import FallbackNotice from '@/components/player/FallbackNotice'

interface Episode {
    id: string
    title: string
    number: number
    season: number
    videoUrl: string | null
    duration: string | null
}

interface WatchProject {
    id: string
    title: string
    slug: string
    tagline: string
    description: string
    genre: string | null
    year: string | null
    duration: string | null
    coverImage: string | null
    filmUrl: string | null
    trailerUrl: string | null
    projectType: string
    status: string
    episodes: Episode[]
}

export default function WatchPlayer({
    project,
    userPreferredLang = 'en',
}: {
    project: WatchProject
    userPreferredLang?: string
}) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [totalDuration, setTotalDuration] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const [activeEpisode, setActiveEpisode] = useState<Episode | null>(
        project.projectType === 'series' && project.episodes.length > 0
            ? project.episodes[0]
            : null
    )
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // ── Resume playback state ──
    const [resumePct, setResumePct] = useState<number | null>(null)
    const [showResumeBanner, setShowResumeBanner] = useState(false)
    const resumeDismissedRef = useRef(false)

    const isSeries = project.projectType === 'series' && project.episodes.length > 0
    const currentVideoUrl = activeEpisode?.videoUrl || project.filmUrl

    // ── Subtitle state ──
    const [ccEnabled, setCcEnabled] = useState(false)
    const [showLangMenu, setShowLangMenu] = useState(false)
    const [ccSegments, setCcSegments] = useState<TranscriptSegment[]>([])
    const [ccLang, setCcLang] = useState('en')
    const [ccAvailable, setCcAvailable] = useState<string[]>([])
    const [ccLoading, setCcLoading] = useState(false)
    const [ccStatusText, setCcStatusText] = useState('')
    const [ccChecked, setCcChecked] = useState(false)
    const [showFallbackNotice, setShowFallbackNotice] = useState(false)
    // Native <track> for iOS Safari fullscreen — blob URL avoids CORS on the video element
    const [activeTrackUrl, setActiveTrackUrl] = useState<string | null>(null)
    // Cleanup blob URL when it changes (prevents memory leak)
    const prevTrackUrl = useRef<string | null>(null)
    useEffect(() => {
        if (prevTrackUrl.current && prevTrackUrl.current !== activeTrackUrl) {
            URL.revokeObjectURL(prevTrackUrl.current)
        }
        prevTrackUrl.current = activeTrackUrl
        return () => {
            if (prevTrackUrl.current) URL.revokeObjectURL(prevTrackUrl.current)
        }
    }, [activeTrackUrl])
    // Hide native track rendering on desktop — custom overlay handles it.
    // iOS Safari native fullscreen reads <track> directly from DOM regardless of mode.
    useEffect(() => {
        const vid = videoRef.current
        if (!vid || !activeTrackUrl) return
        const t = setTimeout(() => {
            for (let i = 0; i < vid.textTracks.length; i++) {
                vid.textTracks[i].mode = ccEnabled ? 'hidden' : 'disabled'
            }
        }, 150)
        return () => clearTimeout(t)
    }, [activeTrackUrl, ccEnabled])
    // Derive current subtitle based on video time (no effect/setState needed)
    const activeSubtitle = useMemo(() => {
        if (!ccEnabled || ccSegments.length === 0) return ''
        return ccSegments.find(s => currentTime >= s.start && currentTime <= s.end)?.text || ''
    }, [currentTime, ccEnabled, ccSegments])

    // Fetch subtitle availability from DB on mount / episode change
    useEffect(() => {
        const resetCC = () => {
            setCcChecked(false)
            setCcAvailable([])
            setCcEnabled(false)
            setCcSegments([])
            setActiveTrackUrl(null)
            setShowFallbackNotice(false)
        }
        resetCC()
        const episodeId = activeEpisode?.id || ''
        const url = `/api/subtitles/${project.id}?lang=en${episodeId ? `&episodeId=${episodeId}` : ''}`
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.available && data.available.length > 0) {
                    setCcAvailable(data.available)
                    if (data.segments && data.segments.length > 0) {
                        setCcSegments(data.segments)
                        setCcLang('en')
                    }
                    // Auto-select user's preferred language if available
                    const safePref = (SUBTITLE_TARGET_LANGS as readonly string[]).includes(userPreferredLang) || userPreferredLang === 'en'
                        ? userPreferredLang : 'en'
                    if (safePref !== 'en' && data.available.includes(safePref)) {
                        // Load preferred lang silently
                        loadSubtitles(safePref).catch(() => {})
                    } else if (safePref !== 'en' && !data.available.includes(safePref) && data.available.length > 0) {
                        // Preferred lang not available — auto-load English + show notice
                        setShowFallbackNotice(true)
                    }
                }
            })
            .catch(() => {})
            .finally(() => setCcChecked(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id, activeEpisode, userPreferredLang])

    // ── Lock orientation to landscape on mobile immediately on mount ──
    // Note: screen.orientation.lock() only works when in fullscreen on most browsers.
    // We do NOT auto-lock here — orientation is locked only when user explicitly taps fullscreen.

    // ── Resume playback: fetch saved position on mount (movie only, not series) ──
    useEffect(() => {
        if (isSeries) return  // series resume handled per-episode
        fetch(`/api/watch/progress?projectId=${project.id}`)
            .then(r => r.json())
            .then((data: { completePct: number | null }) => {
                if (data.completePct && data.completePct > 0.01) {
                    setResumePct(data.completePct)
                    setShowResumeBanner(true)
                    // Auto-dismiss after 8 seconds if user ignores
                    setTimeout(() => {
                        if (!resumeDismissedRef.current) setShowResumeBanner(false)
                    }, 8000)
                }
            })
            .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id])

    // Load subtitles for a specific language
    const loadSubtitles = useCallback(async (lang: string) => {
        const episodeId = activeEpisode?.id || ''
        const baseUrl = `/api/subtitles/${project.id}?lang=${lang}${episodeId ? `&episodeId=${episodeId}` : ''}`

        // If English is already pre-loaded for the custom overlay, skip the JSON fetch
        // but still fetch VTT for iOS native track
        if (lang === 'en' && ccSegments.length > 0 && ccLang === 'en') {
            setCcEnabled(true)
            setShowLangMenu(false)
            // Fetch VTT for native iOS track
            try {
                const vttText = await fetch(`${baseUrl}&format=vtt`).then(r => r.text())
                const blob = new Blob([vttText], { type: 'text/vtt' })
                setActiveTrackUrl(URL.createObjectURL(blob))
            } catch { /* non-critical */ }
            return
        }

        setCcLoading(true)
        setCcStatusText(`Loading ${LANGUAGE_NAMES[lang] || lang}...`)
        try {
            // Fetch JSON segments (for custom desktop overlay) and VTT (for iOS native track) in parallel
            const [jsonRes, vttRes] = await Promise.all([
                fetch(baseUrl),
                fetch(`${baseUrl}&format=vtt`),
            ])
            const data = await jsonRes.json()

            if (data.segments && data.segments.length > 0) {
                setCcSegments(data.segments)
                setCcLang(lang)
                setCcEnabled(true)
                setShowLangMenu(false)
                setCcStatusText('')

                // Set blob URL for native <track> (iOS Safari fullscreen)
                const vttText = await vttRes.text()
                const blob = new Blob([vttText], { type: 'text/vtt' })
                setActiveTrackUrl(URL.createObjectURL(blob))
            } else {
                setCcStatusText('No subtitles for this language')
                setTimeout(() => setCcStatusText(''), 2500)
            }
        } catch {
            setCcStatusText('Failed to load subtitles')
            setTimeout(() => setCcStatusText(''), 2000)
        }
        setCcLoading(false)
    }, [project.id, activeEpisode, ccSegments, ccLang])

    // Toggle CC — if subtitles are pre-loaded (English), toggle directly.
    // Otherwise show language picker.
    const toggleCC = useCallback(() => {
        if (ccEnabled) {
            setCcEnabled(false)
            setShowLangMenu(false)
            return
        }
        if (!ccChecked) return // still loading availability info
        if (ccAvailable.length === 0) {
            // No subtitles exist — show a brief message
            setCcStatusText('No subtitles available for this film')
            setTimeout(() => setCcStatusText(''), 2500)
            return
        }
        // Rec 2 fix: delegate to loadSubtitles even for pre-loaded English.
        // loadSubtitles fast-paths the JSON (skips re-fetch) but still fetches VTT
        // so iOS Safari native fullscreen gets a <track> blob URL.
        if (ccSegments.length > 0) {
            loadSubtitles('en').catch(() => {})
            return
        }
        // Otherwise show language picker
        setShowLangMenu(m => !m)
    }, [ccEnabled, ccChecked, ccAvailable, ccSegments, loadSubtitles])



    // Auto-hide controls after 3s of inactivity
    const resetControlsTimer = () => {
        setShowControls(true)
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
        controlsTimerRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false)
        }, 3000)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowControls(true)
        const t = setTimeout(() => { if (isPlaying) setShowControls(false) }, 3000)
        return () => clearTimeout(t)
    }, [isPlaying])

    // ── Session-end beacon — fires on video end and component unmount ──
    const sendSessionEnd = useCallback(() => {
        if (!currentVideoUrl) return
        const payload = JSON.stringify({
            projectId: project.id,
            episodeId: activeEpisode?.id ?? null,
            subtitleLang: ccEnabled ? ccLang : null,
            audioLang: 'en',
            captionsOn: ccEnabled,
            completePct: totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0,
        })
        navigator.sendBeacon('/api/watch/session-end', new Blob([payload], { type: 'application/json' }))
    }, [project.id, activeEpisode, ccEnabled, ccLang, currentTime, totalDuration, currentVideoUrl])

    const togglePlay = () => {
        const vid = videoRef.current
        if (!vid) return
        if (vid.paused) {
            vid.play().catch(() => { })
            setIsPlaying(true)
        } else {
            vid.pause()
            setIsPlaying(false)
        }
    }

    // Fire beacon on unmount (tab close / navigation)
    useEffect(() => {
        return () => { sendSessionEnd() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const toggleFullscreen = async () => {
        const el = containerRef.current
        if (!el) return
        if (document.fullscreenElement) {
            // Unlock orientation before exiting fullscreen
            try { screen.orientation?.unlock?.() } catch { /* unsupported */ }
            document.exitFullscreen()
            setIsFullscreen(false)
        } else {
            try {
                await el.requestFullscreen()
                setIsFullscreen(true)
                // Lock to landscape on mobile for immersive viewing
                try { await (screen.orientation as any)?.lock?.('landscape') } catch { /* unsupported */ }
            } catch { /* fullscreen not supported or denied */ }
        }
    }

    // Sync fullscreen state when user exits via browser controls (Escape key, swipe, etc.)
    useEffect(() => {
        const onFsChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false)
                try { screen.orientation?.unlock?.() } catch { /* unsupported */ }
            }
        }
        document.addEventListener('fullscreenchange', onFsChange)
        return () => document.removeEventListener('fullscreenchange', onFsChange)
    }, [])

    // NOTE: Auto-fullscreen on mount removed — it triggered the native mobile player
    // instead of our custom player. Users tap the fullscreen button explicitly.

    const handleTimeUpdate = () => {
        const vid = videoRef.current
        if (vid) setCurrentTime(vid.currentTime)
    }

    const handleLoadedMetadata = () => {
        const vid = videoRef.current
        if (vid) setTotalDuration(vid.duration)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vid = videoRef.current
        if (vid) {
            vid.currentTime = Number(e.target.value)
            setCurrentTime(vid.currentTime)
        }
    }

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60)
        const secs = Math.floor(s % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const playEpisode = (ep: Episode) => {
        setActiveEpisode(ep)
        setIsPlaying(false)
        setCurrentTime(0)
        setTimeout(() => {
            const vid = videoRef.current
            if (vid && ep.videoUrl) {
                vid.src = ep.videoUrl
                vid.load()
                vid.play().catch(() => { })
                setIsPlaying(true)
            }
        }, 100)
    }

    const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '80px' }}>
            <div className="container" style={{ maxWidth: '1200px', padding: '0 var(--space-lg)' }}>

                {/* Back button */}
                <Link
                    href={`/works/${project.slug}`}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        fontSize: '0.85rem', color: 'var(--text-tertiary)',
                        marginBottom: 'var(--space-lg)', transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to {project.title}
                </Link>

                {/* ── Resume Banner ── */}
                {showResumeBanner && resumePct !== null && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '10px',
                        background: 'linear-gradient(135deg, rgba(212,168,83,0.12), rgba(212,168,83,0.06))',
                        border: '1px solid rgba(212,168,83,0.3)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        marginBottom: '12px',
                        animation: 'fadeSlideIn 0.3s ease',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.1rem' }}>▶</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Continue from <strong style={{ color: 'var(--accent-gold)' }}>
                                    {totalDuration > 0
                                        ? (() => {
                                            const secs = Math.floor(resumePct * totalDuration)
                                            const m = Math.floor(secs / 60)
                                            const s = secs % 60
                                            return `${m}:${String(s).padStart(2, '0')}`
                                        })()
                                        : `${Math.round(resumePct * 100)}%`
                                    }
                                </strong>?
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    resumeDismissedRef.current = true
                                    setShowResumeBanner(false)
                                    // Seek once video metadata is loaded
                                    const seekAfterLoad = () => {
                                        const vid = videoRef.current
                                        if (!vid) return
                                        const seekTo = resumePct! * vid.duration
                                        if (isFinite(seekTo) && seekTo > 0) {
                                            vid.currentTime = seekTo
                                            setCurrentTime(seekTo)
                                        }
                                        vid.play().catch(() => {})
                                        setIsPlaying(true)
                                    }
                                    const vid = videoRef.current
                                    if (vid && vid.readyState >= 1) {
                                        seekAfterLoad()
                                    } else if (vid) {
                                        vid.addEventListener('loadedmetadata', seekAfterLoad, { once: true })
                                    }
                                }}
                                style={{
                                    padding: '5px 14px', borderRadius: '6px', fontSize: '0.78rem',
                                    fontWeight: 700, cursor: 'pointer',
                                    background: 'var(--accent-gold)', border: 'none', color: '#000',
                                }}
                            >
                                Resume
                            </button>
                            <button
                                onClick={() => { resumeDismissedRef.current = true; setShowResumeBanner(false) }}
                                style={{
                                    padding: '5px 12px', borderRadius: '6px', fontSize: '0.78rem',
                                    fontWeight: 600, cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-tertiary)',
                                }}
                            >
                                Start over
                            </button>
                        </div>
                    </div>
                )}

                {/* Video Player */}
                <div

                    ref={containerRef}
                    onMouseMove={resetControlsTimer}
                    onClick={togglePlay}
                    style={{
                        position: 'relative',
                        aspectRatio: '16/9',
                        background: '#000',
                        borderRadius: isFullscreen ? 0 : 'var(--radius-xl)',
                        overflow: 'hidden',
                        cursor: showControls ? 'default' : 'none',
                        border: isFullscreen ? 'none' : '1px solid var(--border-subtle)',
                    }}
                >
                    {currentVideoUrl ? (
                        <video
                            ref={videoRef}
                            src={currentVideoUrl}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={() => { setIsPlaying(false); sendSessionEnd() }}
                            controlsList="nodownload"
                            onContextMenu={(e) => e.preventDefault()}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            playsInline
                        >
                            {/* Native subtitle track for iOS Safari fullscreen.
                                Blob URL avoids needing crossOrigin on the video element.
                                key forces React to recreate the track on language change.
                                mode is set to 'hidden' by useEffect so desktop doesn't
                                double-render — iOS native fullscreen reads it anyway. */}
                            {activeTrackUrl && ccEnabled && (
                                <track
                                    key={activeTrackUrl}
                                    kind="subtitles"
                                    src={activeTrackUrl}
                                    srcLang={ccLang}
                                    label={LANGUAGE_NAMES[ccLang] || ccLang}
                                    default
                                />
                            )}
                        </video>
                    ) : (
                        <div style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            height: '100%', color: 'var(--text-tertiary)',
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', opacity: 0.3 }}>🎬</div>
                            <p>Video not available</p>
                        </div>
                    )}

                    {/* Fallback notice: shown when preferredLang is unavailable */}
                    {showFallbackNotice && (
                        <FallbackNotice
                            lang={userPreferredLang}
                            langName={LANGUAGE_NAMES[userPreferredLang] || userPreferredLang}
                        />
                    )}
                    {!isPlaying && currentVideoUrl && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.4)',
                            pointerEvents: 'none',
                        }}>
                            <div style={{
                                width: '70px', height: '70px',
                                borderRadius: '50%',
                                background: 'rgba(212,168,83,0.9)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 30px rgba(212,168,83,0.3)',
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="#000">
                                    <polygon points="8,5 19,12 8,19" />
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* Subtitle overlay — uses textContent (never innerHTML) to prevent XSS */}
                    {ccEnabled && (
                        <div style={{
                            position: 'absolute', bottom: '80px', left: '10%', right: '10%',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            pointerEvents: 'none', zIndex: 5, gap: '6px',
                        }}>
                            {ccLoading && ccStatusText && (
                                <div style={{
                                    background: 'rgba(0,0,0,0.75)', borderRadius: '8px',
                                    padding: '8px 16px', fontSize: '0.8rem',
                                    color: 'var(--accent-gold)', textAlign: 'center',
                                }}>
                                    ⏳ {ccStatusText}
                                </div>
                            )}
                            {activeSubtitle && (
                                <div style={{
                                    background: 'rgba(0,0,0,0.8)', borderRadius: '6px',
                                    padding: '6px 18px', fontSize: 'clamp(0.9rem, 2vw, 1.15rem)',
                                    color: '#fff', textAlign: 'center', lineHeight: 1.5,
                                    maxWidth: '80%', textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                    overflow: 'hidden',
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                                }}>
                                    {activeSubtitle.length > 120 ? activeSubtitle.slice(0, 120) + '...' : activeSubtitle}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Controls bar */}
                    {currentVideoUrl && (
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                                padding: 'var(--space-xl) var(--space-lg) var(--space-md)',
                                opacity: showControls ? 1 : 0,
                                transition: 'opacity 0.3s',
                                pointerEvents: showControls ? 'auto' : 'none',
                            }}
                        >
                            {/* Progress bar */}
                            <div style={{ position: 'relative', marginBottom: 'var(--space-sm)' }}>
                                <div style={{
                                    height: '4px', background: 'rgba(255,255,255,0.15)',
                                    borderRadius: '2px', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%', width: `${progress}%`,
                                        background: 'var(--accent-gold)',
                                        borderRadius: '2px',
                                        transition: 'width 0.1s linear',
                                    }} />
                                </div>
                                <input
                                    type="range" min="0" max={totalDuration || 0}
                                    value={currentTime} onChange={handleSeek}
                                    style={{
                                        position: 'absolute', top: '-6px', left: 0,
                                        width: '100%', height: '16px',
                                        opacity: 0, cursor: 'pointer',
                                    }}
                                />
                            </div>

                            {/* Controls row */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <button onClick={togglePlay} style={{
                                        background: 'none', border: 'none', color: 'white',
                                        cursor: 'pointer', padding: '4px',
                                    }}>
                                        {isPlaying ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="6" y="4" width="4" height="16" />
                                                <rect x="14" y="4" width="4" height="16" />
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <polygon points="8,5 19,12 8,19" />
                                            </svg>
                                        )}
                                    </button>
                                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono, monospace)' }}>
                                        {formatTime(currentTime)} / {formatTime(totalDuration)}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em',
                                        textTransform: 'uppercase',
                                        color: 'var(--accent-gold)',
                                        opacity: 0.7,
                                    }}>AIM Studio</span>
                                    {/* CC Button + Language Menu — always rendered when video exists */}
                                    {currentVideoUrl && ccChecked && (
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleCC() }}
                                            title={
                                                ccAvailable.length === 0
                                                    ? 'No subtitles available'
                                                    : ccEnabled
                                                        ? `Subtitles on (${(LANGUAGE_NAMES[ccLang] || ccLang)}) — click to turn off`
                                                        : 'Turn on subtitles'
                                            }
                                            style={{
                                                background: ccEnabled
                                                    ? 'rgba(212,168,83,0.25)'
                                                    : ccAvailable.length === 0
                                                        ? 'transparent'
                                                        : 'rgba(255,255,255,0.08)',
                                                border: ccEnabled
                                                    ? '1px solid rgba(212,168,83,0.5)'
                                                    : ccAvailable.length === 0
                                                        ? '1px solid rgba(255,255,255,0.15)'
                                                        : '1px solid rgba(255,255,255,0.25)',
                                                color: ccEnabled
                                                    ? 'var(--accent-gold)'
                                                    : ccAvailable.length === 0
                                                        ? 'rgba(255,255,255,0.3)'
                                                        : 'white',
                                                cursor: 'pointer', padding: '3px 8px',
                                                borderRadius: '4px', fontSize: '0.7rem',
                                                fontWeight: 700, letterSpacing: '0.05em',
                                                transition: 'all 0.2s',
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                            }}
                                        >
                                            {ccLoading ? '⏳' : 'CC'}
                                            {ccEnabled && ccLang !== 'en' && ` (${ccLang.toUpperCase()})`}
                                            {ccAvailable.length > 1 && !ccEnabled && (
                                                <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>▾</span>
                                            )}
                                        </button>
                                        {/* Status toast — shown for errors and no-subtitle messages */}
                                        {ccStatusText && !ccLoading && (
                                            <div style={{
                                                position: 'absolute', bottom: '120%', right: 0,
                                                background: 'rgba(13,15,20,0.95)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: '6px', padding: '5px 10px',
                                                fontSize: '0.72rem', color: 'var(--text-secondary)',
                                                whiteSpace: 'nowrap', pointerEvents: 'none',
                                                backdropFilter: 'blur(10px)',
                                            }}>
                                                {ccStatusText}
                                            </div>
                                        )}
                                        {/* Language dropdown */}
                                        {showLangMenu && ccAvailable.length > 0 && (
                                            <div style={{
                                                position: 'absolute', bottom: '100%', right: 0,
                                                marginBottom: '8px', background: 'rgba(13,15,20,0.95)',
                                                border: '1px solid rgba(212,168,83,0.3)',
                                                borderRadius: '8px', padding: '4px',
                                                minWidth: '140px', backdropFilter: 'blur(10px)',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                            }}>
                                                <div style={{
                                                    fontSize: '0.6rem', fontWeight: 600,
                                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                                    color: 'var(--accent-gold)', padding: '6px 10px 4px',
                                                }}>Subtitles</div>
                                                {ccAvailable.map(lang => (
                                                    <button
                                                        key={lang}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            loadSubtitles(lang)
                                                            setShowLangMenu(false)
                                                        }}
                                                        style={{
                                                            display: 'block', width: '100%',
                                                            padding: '6px 10px', textAlign: 'left',
                                                            background: ccLang === lang && ccEnabled ? 'rgba(212,168,83,0.15)' : 'transparent',
                                                            border: 'none', borderRadius: '4px',
                                                            color: ccLang === lang && ccEnabled ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                            fontSize: '0.8rem', cursor: 'pointer',
                                                            transition: 'background 0.15s',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = ccLang === lang && ccEnabled ? 'rgba(212,168,83,0.15)' : 'transparent' }}
                                                    >
                                                        {LANGUAGE_NAMES[lang] || lang}
                                                        {ccLang === lang && ccEnabled && ' ✓'}
                                                    </button>
                                                ))}
                                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 6px' }} />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setCcEnabled(false)
                                                        setShowLangMenu(false)
                                                    }}
                                                    style={{
                                                        display: 'block', width: '100%',
                                                        padding: '6px 10px', textAlign: 'left',
                                                        background: !ccEnabled ? 'rgba(255,255,255,0.06)' : 'transparent',
                                                        border: 'none', borderRadius: '4px',
                                                        color: 'var(--text-tertiary)', fontSize: '0.8rem', cursor: 'pointer',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                                >
                                                    Off
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    )}
                                    <button onClick={toggleFullscreen} style={{
                                        background: 'none', border: 'none', color: 'white',
                                        cursor: 'pointer', padding: '4px',
                                    }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {isFullscreen ? (
                                                <>
                                                    <polyline points="4 14 10 14 10 20" />
                                                    <polyline points="20 10 14 10 14 4" />
                                                    <line x1="14" y1="10" x2="21" y2="3" />
                                                    <line x1="3" y1="21" x2="10" y2="14" />
                                                </>
                                            ) : (
                                                <>
                                                    <polyline points="15 3 21 3 21 9" />
                                                    <polyline points="9 21 3 21 3 15" />
                                                    <line x1="21" y1="3" x2="14" y2="10" />
                                                    <line x1="3" y1="21" x2="10" y2="14" />
                                                </>
                                            )}
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Project Info + Episodes */}
                <div style={{
                    display: 'flex', gap: 'var(--space-2xl)',
                    marginTop: 'var(--space-xl)',
                    marginBottom: 'var(--space-2xl)',
                    flexWrap: 'wrap',
                }}>
                    {/* Info */}
                    <div style={{ flex: '1 1 400px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                            {project.genre && (
                                <span style={{
                                    fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em',
                                    textTransform: 'uppercase', color: 'var(--accent-gold)',
                                }}>{project.genre}</span>
                            )}
                            {project.year && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>• {project.year}</span>
                            )}
                            {project.duration && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>• {project.duration}</span>
                            )}
                        </div>
                        <h1 style={{
                            fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                            fontWeight: 800,
                            marginBottom: 'var(--space-xs)',
                        }}>
                            {activeEpisode
                                ? `${project.title} — S${activeEpisode.season}E${activeEpisode.number}: ${activeEpisode.title}`
                                : project.title}
                        </h1>
                        {project.tagline && (
                            <p style={{
                                fontSize: '0.95rem', fontStyle: 'italic',
                                color: 'var(--text-secondary)', marginBottom: 'var(--space-md)',
                            }}>{project.tagline}</p>
                        )}
                        <p style={{
                            fontSize: '0.85rem', lineHeight: 1.7,
                            color: 'var(--text-tertiary)',
                        }}>{project.description}</p>
                    </div>

                    {/* Episode list (series only) */}
                    {isSeries && (
                        <div style={{
                            flex: '0 0 280px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-subtle)',
                            padding: 'var(--space-lg)',
                            maxHeight: '400px',
                            overflowY: 'auto',
                        }}>
                            <h3 style={{
                                fontSize: '0.75rem', fontWeight: 600,
                                textTransform: 'uppercase', letterSpacing: '0.1em',
                                color: 'var(--accent-gold)',
                                marginBottom: 'var(--space-md)',
                            }}>Episodes</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {project.episodes.map(ep => (
                                    <button
                                        key={ep.id}
                                        onClick={() => playEpisode(ep)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                            padding: '0.6rem 0.8rem',
                                            background: activeEpisode?.id === ep.id ? 'var(--accent-gold-glow)' : 'transparent',
                                            border: activeEpisode?.id === ep.id ? '1px solid rgba(212,168,83,0.3)' : '1px solid transparent',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: ep.videoUrl ? 'pointer' : 'not-allowed',
                                            opacity: ep.videoUrl ? 1 : 0.4,
                                            textAlign: 'left',
                                            width: '100%',
                                            transition: 'all 0.2s',
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 700,
                                            color: activeEpisode?.id === ep.id ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                            minWidth: '28px',
                                        }}>E{ep.number}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: '0.8rem', fontWeight: 600,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>{ep.title}</div>
                                            {ep.duration && (
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{ep.duration}</div>
                                            )}
                                        </div>
                                        {activeEpisode?.id === ep.id && (
                                            <div style={{
                                                width: '6px', height: '6px',
                                                borderRadius: '50%',
                                                background: 'var(--accent-gold)',
                                            }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
