'use client'

import {
    useState, useRef, useEffect, useCallback, useMemo,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { TranscriptSegment } from '@/lib/transcribe-client'
import { LANGUAGE_NAMES, SUBTITLE_TARGET_LANGS } from '@/config/subtitles'
import FallbackNotice from '@/components/player/FallbackNotice'

/* ─────────────────────────── Types ─────────────────────────── */
interface Episode {
    id: string; title: string; number: number
    season: number; videoUrl: string | null; duration: string | null
}
interface WatchProject {
    id: string; title: string; slug: string; tagline: string
    description: string; genre: string | null; year: string | null
    duration: string | null; coverImage: string | null
    filmUrl: string | null; trailerUrl: string | null
    projectType: string; status: string; episodes: Episode[]
}

/* ─────────────────────────── Helpers ─────────────────────────── */
const fmt = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
        : `${m}:${String(sec).padStart(2, '0')}`
}
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

/* ══════════════════════════ COMPONENT ══════════════════════════ */
export default function WatchPlayer({
    project,
    userPreferredLang = 'en',
}: {
    project: WatchProject
    userPreferredLang?: string
}) {
    const tPlayer = useTranslations('watchPlayer')

    /* ── Refs ── */
    const videoRef    = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevTrackUrl = useRef<string | null>(null)
    const resumeDismissedRef = useRef(false)
    const volumeBeforeMute = useRef(1)
    // Ref for live playback position — avoids stale closure in unmount beacon
    const liveProgressRef = useRef({ currentTime: 0, totalDuration: 0 })

    /* ── Derived ── */
    const isSeries = project.projectType === 'series' && project.episodes.length > 0

    /* ── Playback state ── */
    const [activeEpisode, setActiveEpisode] = useState<Episode | null>(
        isSeries ? project.episodes[0] : null
    )
    const currentVideoUrl = activeEpisode?.videoUrl || project.filmUrl

    const [isPlaying, setIsPlaying]       = useState(false)
    const [currentTime, setCurrentTime]   = useState(0)
    const [totalDuration, setTotalDuration] = useState(0)
    const [buffered, setBuffered]         = useState(0)
    const [volume, setVolume]             = useState(1)
    const [isMuted, setIsMuted]           = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [isLoading, setIsLoading]       = useState(false)

    /* ── UI state ── */
    const [isFullscreen, setIsFullscreen]   = useState(false)
    const [isPseudoFS, setIsPseudoFS]       = useState(false)  // fallback fullscreen
    const [showControls, setShowControls]   = useState(true)
    const [showSettings, setShowSettings]   = useState(false)
    const [showSpeedMenu, setShowSpeedMenu] = useState(false)
    const [showVolumeSlider, setShowVolumeSlider] = useState(false)
    const [isSeeking, setIsSeeking]         = useState(false)
    const [seekPreview, setSeekPreview]     = useState<{ pct: number; time: number } | null>(null)

    /* ── Resume state ── */
    const [resumePct, setResumePct]           = useState<number | null>(null)
    const [showResumeBanner, setShowResumeBanner] = useState(false)

    /* ── Subtitle state ── */
    const [ccEnabled, setCcEnabled]         = useState(false)
    const [showLangMenu, setShowLangMenu]   = useState(false)
    const [ccSegments, setCcSegments]       = useState<TranscriptSegment[]>([])
    const [ccLang, setCcLang]               = useState('en')
    const [ccAvailable, setCcAvailable]     = useState<string[]>([])
    const [ccLoading, setCcLoading]         = useState(false)
    const [ccStatusText, setCcStatusText]   = useState('')
    const [ccChecked, setCcChecked]         = useState(false)
    const [showFallbackNotice, setShowFallbackNotice] = useState(false)
    const [activeTrackUrl, setActiveTrackUrl] = useState<string | null>(null)
    /* Detect mobile once — used for bottom-sheet vs dropdown */
    const [isMobile, setIsMobile]           = useState(false)

    /* ── Progress ── */
    const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

    /* ══════════ Effects ══════════ */

    /* Detect mobile breakpoint */
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px)')
        setIsMobile(mq.matches)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    /* Lock body scroll when mobile lang sheet is open */
    useEffect(() => {
        if (isMobile && showLangMenu) {
            const prev = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = prev }
        }
    }, [isMobile, showLangMenu])

    /* Cleanup blob URLs */
    useEffect(() => {
        if (prevTrackUrl.current && prevTrackUrl.current !== activeTrackUrl) {
            URL.revokeObjectURL(prevTrackUrl.current)
        }
        prevTrackUrl.current = activeTrackUrl
        return () => { if (prevTrackUrl.current) URL.revokeObjectURL(prevTrackUrl.current) }
    }, [activeTrackUrl])

    /* Hide native tracks on desktop */
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

    /* Active subtitle */
    const activeSubtitle = useMemo(() => {
        if (!ccEnabled || ccSegments.length === 0) return ''
        return ccSegments.find(s => currentTime >= s.start && currentTime <= s.end)?.text || ''
    }, [currentTime, ccEnabled, ccSegments])

    /* Fetch CC availability */
    useEffect(() => {
        const reset = () => {
            setCcChecked(false); setCcAvailable([]); setCcEnabled(false)
            setCcSegments([]); setActiveTrackUrl(null); setShowFallbackNotice(false)
        }
        reset()
        const epId = activeEpisode?.id || ''
        const url = `/api/subtitles/${project.id}?lang=en${epId ? `&episodeId=${epId}` : ''}`
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.available?.length > 0) {
                    setCcAvailable(data.available)
                    if (data.segments?.length > 0) { setCcSegments(data.segments); setCcLang('en') }
                    const safe = (SUBTITLE_TARGET_LANGS as readonly string[]).includes(userPreferredLang) || userPreferredLang === 'en'
                        ? userPreferredLang : 'en'
                    if (safe !== 'en' && data.available.includes(safe)) {
                        loadSubtitles(safe).catch(() => {})
                    } else if (safe !== 'en' && !data.available.includes(safe) && data.available.length > 0) {
                        setShowFallbackNotice(true)
                    }
                }
            })
            .catch(() => {})
            .finally(() => setCcChecked(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id, activeEpisode, userPreferredLang])

    /* Resume playback fetch */
    useEffect(() => {
        if (isSeries) return
        fetch(`/api/watch/progress?projectId=${project.id}`)
            .then(r => r.json())
            .then((data: { completePct: number | null }) => {
                if (data.completePct && data.completePct > 0.01) {
                    setResumePct(data.completePct)
                    setShowResumeBanner(true)
                    setTimeout(() => { if (!resumeDismissedRef.current) setShowResumeBanner(false) }, 8000)
                }
            })
            .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id])

    /* Controls auto-hide */
    const resetControlsTimer = useCallback(() => {
        setShowControls(true)
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
        controlsTimerRef.current = setTimeout(() => { if (isPlaying) setShowControls(false) }, 3000)
    }, [isPlaying])

    useEffect(() => {
        resetControlsTimer()
    }, [isPlaying, resetControlsTimer])

    /* ── Pseudo-fullscreen helpers ──
     * Used as fallback when requestFullscreen() is denied (common on iOS).
     * Adds a class to <html> that hides the navbar/tab-bar via CSS and
     * makes the player container fill the viewport with position:fixed. */
    const enablePseudoFS = useCallback(() => {
        document.documentElement.classList.add('aim-player-fs')
        document.body.classList.add('aim-player-fs')
        setIsPseudoFS(true)
        // Try landscape lock (best-effort)
        try { (screen.orientation as any)?.lock?.('landscape') } catch { /* no-op */ }
    }, [])

    const disablePseudoFS = useCallback(() => {
        document.documentElement.classList.remove('aim-player-fs')
        document.body.classList.remove('aim-player-fs')
        setIsPseudoFS(false)
        try { screen.orientation?.unlock?.() } catch { /* no-op */ }
    }, [])

    /* Sync real-fullscreen state + clean up pseudo-FS when real FS exits */
    useEffect(() => {
        const onChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false)
                disablePseudoFS()  // also clean up if pseudo-FS was active
                try { screen.orientation?.unlock?.() } catch { /* no-op */ }
            } else {
                setIsFullscreen(true)
            }
        }
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [disablePseudoFS])

    /* Orientation change → auto pseudo-fullscreen when rotating to landscape during playback */
    useEffect(() => {
        const isLandscape = () => window.matchMedia('(orientation: landscape)').matches
        const handle = () => {
            if (isLandscape() && isPlaying && !document.fullscreenElement) {
                enablePseudoFS()
            }
            if (!isLandscape() && isPseudoFS && !document.fullscreenElement) {
                disablePseudoFS()
            }
        }
        window.addEventListener('resize', handle)
        screen.orientation?.addEventListener?.('change', handle)
        return () => {
            window.removeEventListener('resize', handle)
            screen.orientation?.removeEventListener?.('change', handle)
        }
    }, [isPlaying, isPseudoFS, enablePseudoFS, disablePseudoFS])

    /* Always clean up pseudo-FS on unmount */
    useEffect(() => () => disablePseudoFS(), [disablePseudoFS])

    /* Keyboard shortcuts */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            const vid = videoRef.current
            if (!vid) return
            switch (e.key) {
                case ' ': case 'k': e.preventDefault(); togglePlay(); break
                case 'ArrowRight': e.preventDefault(); vid.currentTime = Math.min(vid.duration, vid.currentTime + 10); break
                case 'ArrowLeft':  e.preventDefault(); vid.currentTime = Math.max(0, vid.currentTime - 10); break
                case 'ArrowUp':    e.preventDefault(); changeVolume(Math.min(1, volume + 0.1)); break
                case 'ArrowDown':  e.preventDefault(); changeVolume(Math.max(0, volume - 0.1)); break
                case 'f': e.preventDefault(); toggleFullscreen(); break
                case 'm': e.preventDefault(); toggleMute(); break
                case 'Escape': setShowSettings(false); setShowLangMenu(false); setShowSpeedMenu(false); break
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [volume, isPlaying])

    /* Session-end beacon
     * Uses liveProgressRef so the unmount cleanup always has the latest time,
     * avoiding the stale-closure bug where useEffect(()=>,[]) captures time=0. */
    const sendSessionEnd = useCallback(() => {
        if (!currentVideoUrl) return
        const { currentTime: ct, totalDuration: td } = liveProgressRef.current
        const payload = JSON.stringify({
            projectId: project.id,
            episodeId: activeEpisode?.id ?? null,
            subtitleLang: ccEnabled ? ccLang : null,
            audioLang: 'en',
            captionsOn: ccEnabled,
            completePct: td > 0 ? Math.min(1, ct / td) : 0,
        })
        navigator.sendBeacon('/api/watch/session-end', new Blob([payload], { type: 'application/json' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id, activeEpisode, ccEnabled, ccLang, currentVideoUrl])

    useEffect(() => { return () => { sendSessionEnd() } }, []) // eslint-disable-line react-hooks/exhaustive-deps

    /* ══════════ Actions ══════════ */

    const togglePlay = () => {
        const vid = videoRef.current
        if (!vid) return
        if (vid.paused) { vid.play().catch(() => {}); setIsPlaying(true) }
        else { vid.pause(); setIsPlaying(false) }
    }

    /* Three-level fullscreen:
     * 1. requestFullscreen() on the player container — works on Android Chrome
     * 2. video.webkitEnterFullscreen() — fallback for older iOS Safari
     * 3. enablePseudoFS() — CSS-based fallback when both above are denied */
    const toggleFullscreen = async () => {
        const el  = containerRef.current
        const vid = videoRef.current
        if (!el) return

        // Exiting
        const inRealFS = !!document.fullscreenElement
        if (inRealFS || isPseudoFS) {
            if (inRealFS) {
                try { screen.orientation?.unlock?.() } catch { /* no-op */ }
                await document.exitFullscreen().catch(() => {})
            }
            disablePseudoFS()
            return
        }

        // Entering: try real fullscreen first
        try {
            await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions)
            // Orientation lock after entering fullscreen
            try { await (screen.orientation as any)?.lock?.('landscape') } catch { /* ignore */ }
        } catch {
            // iOS Safari: try native video fullscreen
            try {
                const v = vid as any
                if (v?.webkitEnterFullscreen) {
                    v.webkitEnterFullscreen()
                    return
                }
            } catch { /* ignore */ }
            // Ultimate fallback: CSS pseudo-fullscreen
            enablePseudoFS()
        }
    }

    const toggleMute = () => {
        const vid = videoRef.current
        if (!vid) return
        if (isMuted) {
            vid.volume = volumeBeforeMute.current
            vid.muted = false
            setVolume(volumeBeforeMute.current)
            setIsMuted(false)
        } else {
            volumeBeforeMute.current = volume
            vid.muted = true
            setIsMuted(true)
        }
    }

    const changeVolume = (v: number) => {
        const vid = videoRef.current
        if (!vid) return
        vid.volume = v
        vid.muted = v === 0
        setVolume(v)
        setIsMuted(v === 0)
    }

    const changeSpeed = (rate: number) => {
        const vid = videoRef.current
        if (!vid) return
        vid.playbackRate = rate
        setPlaybackRate(rate)
        setShowSpeedMenu(false)
        setShowSettings(false)
    }

    const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vid = videoRef.current
        if (!vid) return
        const t = Number(e.target.value)
        vid.currentTime = t
        setCurrentTime(t)
    }

    const skip = (secs: number) => {
        const vid = videoRef.current
        if (!vid) return
        vid.currentTime = Math.max(0, Math.min(vid.duration, vid.currentTime + secs))
    }

    const toggleCC = () => {
        if (!ccEnabled && ccAvailable.length > 0) {
            if (ccSegments.length > 0) {
                setCcEnabled(true)
            } else {
                loadSubtitles(ccLang || 'en')
            }
        } else if (ccEnabled && ccAvailable.length > 1) {
            setShowLangMenu(prev => !prev)
        } else {
            setCcEnabled(false); setCcStatusText('')
        }
    }

    const loadSubtitles = useCallback(async (lang: string) => {
        const epId = activeEpisode?.id || ''
        const base = `/api/subtitles/${project.id}?lang=${lang}${epId ? `&episodeId=${epId}` : ''}`
        if (lang === 'en' && ccSegments.length > 0 && ccLang === 'en') {
            setCcEnabled(true); setShowLangMenu(false)
            try {
                const vtt = await fetch(`${base}&format=vtt`).then(r => r.text())
                const blob = new Blob([vtt], { type: 'text/vtt' })
                setActiveTrackUrl(URL.createObjectURL(blob))
            } catch { /* non-critical */ }
            return
        }
        setCcLoading(true)
        setCcStatusText(`Loading ${LANGUAGE_NAMES[lang] || lang}...`)
        try {
            const data = await fetch(base).then(r => r.json())
            if (data.segments?.length > 0) {
                setCcSegments(data.segments); setCcLang(lang)
                setCcEnabled(true); setShowLangMenu(false); setCcStatusText('')
                try {
                    const vtt = await fetch(`${base}&format=vtt`).then(r => r.text())
                    const blob = new Blob([vtt], { type: 'text/vtt' })
                    setActiveTrackUrl(URL.createObjectURL(blob))
                } catch { /* non-critical */ }
            } else {
                setCcStatusText(`No subtitles for ${LANGUAGE_NAMES[lang] || lang}`)
                setTimeout(() => setCcStatusText(''), 3000)
            }
        } catch {
            setCcStatusText('Failed to load subtitles')
            setTimeout(() => setCcStatusText(''), 3000)
        } finally {
            setCcLoading(false)
        }
    }, [activeEpisode, project.id, ccSegments, ccLang])

    const playEpisode = (ep: Episode) => {
        const vid = videoRef.current
        if (!ep.videoUrl || !vid) return
        setActiveEpisode(ep)
        vid.src = ep.videoUrl
        vid.play().catch(() => {})
        setIsPlaying(true)
        setCcEnabled(false); setCcSegments([]); setActiveTrackUrl(null)
    }

    /* ══════════ Video event handlers ══════════ */

    const handleTimeUpdate = () => {
        const vid = videoRef.current
        if (!vid) return
        setCurrentTime(vid.currentTime)
        liveProgressRef.current.currentTime = vid.currentTime
        if (vid.buffered.length > 0) {
            setBuffered(vid.buffered.end(vid.buffered.length - 1))
        }
    }
    const handleLoadedMetadata = () => {
        const vid = videoRef.current
        if (!vid) return
        setTotalDuration(vid.duration)
        liveProgressRef.current.totalDuration = vid.duration
    }

    /* ══════════ JSX ══════════ */
    const volumeIcon = () => {
        if (isMuted || volume === 0) return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
            </svg>
        )
        if (volume < 0.5) return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
        )
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
        )
    }

    return (
        <div className="aim-watch-wrapper" style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '80px' }}>
            <style>{`
                .aim-player-container { font-family: inherit; padding: 0 var(--space-lg); }
                .aim-ctrl-btn {
                    background: none; border: none; color: white;
                    cursor: pointer; padding: 6px; border-radius: 6px;
                    display: flex; align-items: center; justify-content: center;
                    transition: background 0.15s, color 0.15s;
                    -webkit-tap-highlight-color: transparent;
                    min-width: 36px; min-height: 36px;
                }
                .aim-ctrl-btn:hover { background: rgba(255,255,255,0.12); }
                .aim-ctrl-btn:active { background: rgba(255,255,255,0.2); }
                /* Skip buttons: hidden on desktop, shown on mobile via media query */
                .aim-skip-btn { display: none; }
                .aim-progress-thumb::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none;
                    width: 14px; height: 14px; border-radius: 50%;
                    background: var(--accent-gold); cursor: pointer;
                    box-shadow: 0 0 6px rgba(212,168,83,0.5);
                }
                .aim-progress-thumb::-moz-range-thumb {
                    width: 14px; height: 14px; border-radius: 50%; border: none;
                    background: var(--accent-gold); cursor: pointer;
                }
                .aim-volume-thumb::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none;
                    width: 12px; height: 12px; border-radius: 50%;
                    background: white; cursor: pointer;
                }
                .aim-volume-thumb::-moz-range-thumb {
                    width: 12px; height: 12px; border-radius: 50%; border: none;
                    background: white; cursor: pointer;
                }
                @keyframes aimFadeIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes aimSpinner {
                    to { transform: rotate(360deg); }
                }
                @keyframes aimSheetIn {
                    from { transform: translateY(100%); }
                    to   { transform: translateY(0); }
                }
                @media (max-width: 640px) {
                    .aim-desktop-only { display: none !important; }
                }

                /* ── Mobile: Full-width sticky player experience ── */
                @media (max-width: 640px) {
                    /* Reduce outer top padding to mobile navbar height */
                    .aim-watch-wrapper { padding-top: 56px !important; padding-bottom: 0 !important; min-height: 0 !important; }

                    /* Full-bleed: the container contributes no horizontal padding on mobile */
                    .aim-player-container { padding-left: 0 !important; padding-right: 0 !important; }

                    /* Back link: give it breathing room inside the (now unpadded) container */
                    .aim-back-link {
                        font-size: 0.78rem;
                        margin-bottom: 8px !important;
                        padding: 4px 16px 0;
                        display: inline-flex;
                    }

                    /* Sticky full-bleed player zone */
                    .aim-sticky-player-zone {
                        position: sticky;
                        top: 56px;
                        z-index: 50;
                        width: 100%;
                        background: #000;
                    }

                    /* Remove rounded corners and border — full-bleed on mobile */
                    .aim-sticky-player-zone .aim-pseudo-fs-shell {
                        border-radius: 0 !important;
                        border: none !important;
                    }

                    /* Hide the inner rounded box clip on mobile too */
                    .aim-sticky-player-zone .aim-video-container {
                        border-radius: 0 !important;
                    }

                    /* Thicker seek bar — easier to grab with a thumb */
                    .aim-progress-track-inner { height: 6px !important; }

                    /* Show skip ±10s buttons on mobile */
                    .aim-skip-btn { display: flex !important; }

                    /* Resume banner: restore its padding */
                    .aim-resume-banner {
                        margin: 0 16px 8px !important;
                        border-radius: 10px !important;
                    }

                    /* Subtitle overlay: pull it closer to the bottom on mobile
                     * so it clears the controls bar and sits near the video bottom */
                    .aim-subtitle-overlay {
                        bottom: 52px !important;
                    }
                }

                /* ── Pseudo-fullscreen: hide nav + tab bar, fill viewport ── */
                html.aim-player-fs body,
                body.aim-player-fs {
                    overflow: hidden;
                }
                /* Hide navbar, mobile tab bar, any footer */
                html.aim-player-fs .navbar,
                html.aim-player-fs .mobile-tab-bar,
                html.aim-player-fs footer {
                    display: none !important;
                }
                /* Pseudo-FS player wrapper fills the whole screen */
                html.aim-player-fs .aim-pseudo-fs-shell {
                    position: fixed !important;
                    inset: 0 !important;
                    width: 100vw !important;
                    height: 100dvh !important;
                    z-index: 999999 !important;
                    background: #000 !important;
                    padding:
                        env(safe-area-inset-top)
                        env(safe-area-inset-right)
                        env(safe-area-inset-bottom)
                        env(safe-area-inset-left) !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                html.aim-player-fs .aim-pseudo-fs-shell video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: contain !important;
                }

                /* ── Real :fullscreen styling ── */
                .aim-video-container:fullscreen,
                .aim-video-container:-webkit-full-screen {
                    width: 100vw;
                    height: 100dvh;
                    background: #000;
                    border-radius: 0 !important;
                }
                .aim-video-container:fullscreen video,
                .aim-video-container:-webkit-full-screen video {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
            `}</style>

            <div className="container aim-player-container" style={{ maxWidth: '1440px' }}>

                {/* ── Back button ── */}
                <Link
                    href={`/works/${project.slug}`}
                    className="aim-back-link"
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
                    {tPlayer('backTo', { title: project.title })}
                </Link>

                {/* ── Resume Banner ── */}
                {showResumeBanner && resumePct !== null && (
                    <div className="aim-resume-banner" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '10px',
                        background: 'linear-gradient(135deg, rgba(212,168,83,0.12), rgba(212,168,83,0.06))',
                        border: '1px solid rgba(212,168,83,0.3)', borderRadius: '10px',
                        padding: '12px 16px', marginBottom: '12px',
                        animation: 'aimFadeIn 0.3s ease',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>▶</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {tPlayer('continueFrom')} <strong style={{ color: 'var(--accent-gold)' }}>
                                    {totalDuration > 0
                                        ? fmt(Math.floor(resumePct * totalDuration))
                                        : `${Math.round(resumePct * 100)}%`
                                    }
                                </strong>?
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    resumeDismissedRef.current = true; setShowResumeBanner(false)
                                    const doSeek = () => {
                                        const vid = videoRef.current; if (!vid) return
                                        const t = resumePct! * vid.duration
                                        if (isFinite(t) && t > 0) { vid.currentTime = t; setCurrentTime(t) }
                                        vid.play().catch(() => {}); setIsPlaying(true)
                                    }
                                    const vid = videoRef.current
                                    if (vid && vid.readyState >= 1) doSeek()
                                    else vid?.addEventListener('loadedmetadata', doSeek, { once: true })
                                }}
                                style={{
                                    padding: '5px 14px', borderRadius: '6px', fontSize: '0.78rem',
                                    fontWeight: 700, cursor: 'pointer',
                                    background: 'var(--accent-gold)', border: 'none', color: '#000',
                                }}
                            >{tPlayer('resume')}</button>
                            <button
                                onClick={() => { resumeDismissedRef.current = true; setShowResumeBanner(false) }}
                                style={{
                                    padding: '5px 12px', borderRadius: '6px', fontSize: '0.78rem',
                                    fontWeight: 600, cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-tertiary)',
                                }}
                            >{tPlayer('startOver')}</button>
                        </div>
                    </div>
                )}

                {/* ══════════════ VIDEO PLAYER ══════════════ */}
                {/* aim-sticky-player-zone: on mobile this becomes position:sticky + full-bleed */}
                <div className="aim-sticky-player-zone">
                {/*
                  * ARCHITECTURE: Two-layer container.
                  * Outer (containerRef): position:relative, NO overflow:hidden
                  *   → allows speed/CC dropdown menus to escape upward
                  *   → receives fullscreen/touch events
                  * Inner (.aim-video-box): overflow:hidden + border-radius
                  *   → clips the video and overlays to rounded corners
                  *   → does NOT affect absolute-positioned controls/dropdowns
                  */}
                {/* aim-pseudo-fs-shell: targeted by CSS when html.aim-player-fs is active */}
                <div
                    className="aim-pseudo-fs-shell"
                    ref={containerRef}
                    onMouseMove={resetControlsTimer}
                    onTouchStart={resetControlsTimer}
                    style={{
                        position: 'relative',
                        // In pseudo-FS, aspect ratio is removed — CSS takes over completely
                        aspectRatio: (isFullscreen || isPseudoFS) ? undefined : '16/9',
                        background: '#000',
                        borderRadius: (isFullscreen || isPseudoFS) ? 0 : 'var(--radius-xl)',
                        border: (isFullscreen || isPseudoFS) ? 'none' : '1px solid var(--border-subtle)',
                        userSelect: 'none',
                        // NO overflow:hidden here — dropdowns must be able to escape
                    }}
                >
                    {/* Inner video box — overflow:hidden clips video corners only */}
                    <div
                        className="aim-video-container"
                        style={{
                            position: 'absolute', inset: 0,
                            borderRadius: (isFullscreen || isPseudoFS) ? 0 : 'var(--radius-xl)',
                            overflow: 'hidden',
                            background: '#000',
                        }}
                    >
                    {/* ── Video element ── */}
                    {currentVideoUrl ? (
                        <video
                            ref={videoRef}
                            src={currentVideoUrl}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={() => { setIsPlaying(false); sendSessionEnd() }}
                            onWaiting={() => setIsLoading(true)}
                            onCanPlay={() => setIsLoading(false)}
                            onSeeked={() => setIsLoading(false)}
                            controlsList="nodownload"
                            onContextMenu={e => e.preventDefault()}
                            onClick={togglePlay}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                            playsInline
                        >
                            {activeTrackUrl && ccEnabled && (
                                <track key={activeTrackUrl} kind="subtitles"
                                    src={activeTrackUrl} srcLang={ccLang}
                                    label={LANGUAGE_NAMES[ccLang] || ccLang} default />
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

                    {/* ── Spinner ── */}
                    {isLoading && currentVideoUrl && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            pointerEvents: 'none',
                        }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                border: '3px solid rgba(255,255,255,0.15)',
                                borderTopColor: 'var(--accent-gold)',
                                animation: 'aimSpinner 0.8s linear infinite',
                            }} />
                        </div>
                    )}

                    {/* ── Big play/pause overlay ── */}
                    {!isPlaying && !isLoading && currentVideoUrl && (
                        <div
                            onClick={togglePlay}
                            style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.35)', cursor: 'pointer',
                            }}
                        >
                            <div style={{
                                width: '72px', height: '72px', borderRadius: '50%',
                                background: 'rgba(212,168,83,0.9)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 40px rgba(212,168,83,0.4)',
                                transition: 'transform 0.15s',
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="#000">
                                    <polygon points="8,5 19,12 8,19" />
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* ── Subtitle overlay ── */}
                    {ccEnabled && (
                        <div
                            className="aim-subtitle-overlay"
                            style={{
                                position: 'absolute', bottom: '72px', left: '5%', right: '5%',
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                pointerEvents: 'none', zIndex: 5, gap: '6px',
                            }}
                        >
                            {ccLoading && ccStatusText && (
                                <div style={{
                                    background: 'rgba(0,0,0,0.75)', borderRadius: '8px',
                                    padding: '8px 16px', fontSize: '0.8rem',
                                    color: 'var(--accent-gold)', textAlign: 'center',
                                }}>⏳ {ccStatusText}</div>
                            )}
                            {activeSubtitle && (
                                <div style={{
                                    background: 'rgba(0,0,0,0.82)', borderRadius: '6px',
                                    padding: '6px 18px',
                                    fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)',
                                    color: '#fff', textAlign: 'center', lineHeight: 1.5,
                                    maxWidth: '90%', textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                                }}>
                                    {activeSubtitle.length > 120 ? activeSubtitle.slice(0, 120) + '…' : activeSubtitle}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Fallback notice ── */}
                    {showFallbackNotice && (
                        <FallbackNotice
                            lang={userPreferredLang}
                            langName={LANGUAGE_NAMES[userPreferredLang] || userPreferredLang}
                        />
                    )}

                    </div>{/* /inner video box */}

                    {/* ══════════ CONTROLS BAR ══════════
                     * Lives OUTSIDE the inner overflow:hidden box so that
                     * speed/CC dropdown menus can extend above the player. */}
                    {currentVideoUrl && (
                        <div
                            style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                                padding: 'var(--space-2xl) var(--space-md) var(--space-sm)',
                                opacity: showControls ? 1 : 0,
                                transition: 'opacity 0.3s',
                                pointerEvents: showControls ? 'auto' : 'none',
                                zIndex: 10,
                                borderRadius: isFullscreen ? 0 : '0 0 var(--radius-xl) var(--radius-xl)',
                            }}
                        >
                            {/* ── Seek bar ── */}
                            <div
                                style={{ position: 'relative', marginBottom: '10px', cursor: 'pointer' }}
                                onMouseMove={e => {
                                    if (!totalDuration) return
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                                    setSeekPreview({ pct, time: pct * totalDuration })
                                }}
                                onMouseLeave={() => setSeekPreview(null)}
                            >
                                {/* Track */}
                                <div style={{
                                    height: '4px', background: 'rgba(255,255,255,0.15)',
                                    borderRadius: '2px', overflow: 'visible', position: 'relative',
                                }}>
                                    {/* Buffered */}
                                    <div style={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0,
                                        width: `${totalDuration > 0 ? (buffered / totalDuration) * 100 : 0}%`,
                                        background: 'rgba(255,255,255,0.2)', borderRadius: '2px',
                                    }} />
                                    {/* Progress */}
                                    <div style={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0,
                                        width: `${progress}%`,
                                        background: 'var(--accent-gold)', borderRadius: '2px',
                                        transition: isSeeking ? 'none' : 'width 0.1s linear',
                                    }} />
                                    {/* Thumb dot */}
                                    <div style={{
                                        position: 'absolute', top: '50%', left: `${progress}%`,
                                        transform: 'translate(-50%, -50%)',
                                        width: '12px', height: '12px', borderRadius: '50%',
                                        background: 'var(--accent-gold)',
                                        boxShadow: '0 0 6px rgba(212,168,83,0.6)',
                                        transition: isSeeking ? 'none' : 'left 0.1s linear',
                                    }} />
                                </div>
                                {/* Seek preview tooltip */}
                                {seekPreview && (
                                    <div style={{
                                        position: 'absolute', bottom: '18px',
                                        left: `${seekPreview.pct * 100}%`,
                                        transform: 'translateX(-50%)',
                                        background: 'rgba(0,0,0,0.9)',
                                        border: '1px solid rgba(212,168,83,0.3)',
                                        borderRadius: '4px', padding: '2px 7px',
                                        fontSize: '0.7rem', color: '#fff', whiteSpace: 'nowrap',
                                        pointerEvents: 'none',
                                    }}>
                                        {fmt(seekPreview.time)}
                                    </div>
                                )}
                                {/* Invisible scrubber input — touch-action:none enables drag on mobile */}
                                <input
                                    type="range" className="aim-progress-thumb"
                                    min="0" max={totalDuration || 0}
                                    value={currentTime}
                                    onMouseDown={() => setIsSeeking(true)}
                                    onMouseUp={() => setIsSeeking(false)}
                                    onTouchStart={() => setIsSeeking(true)}
                                    onTouchEnd={() => setIsSeeking(false)}
                                    onChange={seek}
                                    style={{
                                        position: 'absolute', top: '-10px', left: 0,
                                        width: '100%', height: '28px',
                                        opacity: 0, cursor: 'pointer',
                                        WebkitAppearance: 'none',
                                        touchAction: 'none',
                                    }}
                                />
                            </div>

                            {/* ── Controls row ── */}
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', gap: '4px',
                            }}>
                                {/* LEFT: play, skip, volume, time */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    {/* Play/Pause */}
                                    <button className="aim-ctrl-btn" onClick={togglePlay} title={isPlaying ? 'Pause (k)' : 'Play (k)'}>
                                        {isPlaying ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <polygon points="8,5 19,12 8,19" />
                                            </svg>
                                        )}
                                    </button>
                                    {/* Skip -10 — visible on mobile too (aim-skip-btn) */}
                                    <button className="aim-ctrl-btn aim-skip-btn" onClick={() => skip(-10)} title="Rewind 10s (←)">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 .49-3.78" />
                                            <text x="8" y="15" fontSize="5" fill="currentColor" stroke="none">10</text>
                                        </svg>
                                    </button>
                                    {/* Skip +10 */}
                                    <button className="aim-ctrl-btn aim-skip-btn" onClick={() => skip(10)} title="Forward 10s (→)">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-.49-3.78" />
                                            <text x="8" y="15" fontSize="5" fill="currentColor" stroke="none">10</text>
                                        </svg>
                                    </button>
                                    {/* Volume */}
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                                        onMouseEnter={() => setShowVolumeSlider(true)}
                                        onMouseLeave={() => setShowVolumeSlider(false)}
                                    >
                                        <button className="aim-ctrl-btn" onClick={toggleMute} title={isMuted ? 'Unmute (m)' : 'Mute (m)'}>
                                            {volumeIcon()}
                                        </button>
                                        {/* Volume slider — appears on hover */}
                                        <div style={{
                                            width: showVolumeSlider ? '80px' : '0px',
                                            overflow: 'hidden',
                                            transition: 'width 0.2s ease',
                                            display: 'flex', alignItems: 'center',
                                        }}>
                                            <input
                                                type="range" className="aim-volume-thumb"
                                                min="0" max="1" step="0.05"
                                                value={isMuted ? 0 : volume}
                                                onChange={e => changeVolume(Number(e.target.value))}
                                                style={{
                                                    width: '72px', height: '4px', cursor: 'pointer',
                                                    accentColor: 'white', WebkitAppearance: 'none',
                                                    background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%)`,
                                                    borderRadius: '2px',
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {/* Time */}
                                    <span style={{
                                        fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)',
                                        fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap',
                                        paddingLeft: '4px',
                                    }}>
                                        {fmt(currentTime)} / {fmt(totalDuration)}
                                    </span>
                                    {/* Watch Full / Continue button */}
                                    {currentVideoUrl && (
                                        <button
                                            className="aim-ctrl-btn"
                                            onClick={() => {
                                                const vid = videoRef.current;
                                                if (!vid) return;
                                                // If we have a saved resume point, jump to it
                                                if (resumePct && totalDuration) {
                                                    const t = resumePct * vid.duration;
                                                    if (isFinite(t) && t > 0) {
                                                        vid.currentTime = t;
                                                        setCurrentTime(t);
                                                    }
                                                }
                                                vid.play().catch(() => {});
                                                setIsPlaying(true);
                                            }}
                                            title={resumePct && resumePct > 0 ? 'Continue watching' : 'Watch full film'}
                                            style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                minWidth: '80px',
                                                background: resumePct && resumePct > 0 ? 'rgba(212,168,83,0.2)' : undefined,
                                                color: resumePct && resumePct > 0 ? 'var(--accent-gold)' : undefined,
                                                border: resumePct && resumePct > 0 ? '1px solid rgba(212,168,83,0.4)' : undefined,
                                            }}
                                        >
                                            {resumePct && resumePct > 0 ? 'Continue' : 'Watch full'}
                                        </button>
                                    )}
                                </div>

                                {/* RIGHT: branding, CC, speed, fullscreen */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
                                        textTransform: 'uppercase', color: 'var(--accent-gold)', opacity: 0.7,
                                    }} className="aim-desktop-only">AIM Studio</span>

                                    {/* Speed control */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            className="aim-ctrl-btn"
                                            onClick={e => { e.stopPropagation(); setShowSpeedMenu(p => !p); setShowLangMenu(false) }}
                                            title="Playback speed"
                                            style={{ fontSize: '0.68rem', fontWeight: 700, minWidth: '38px' }}
                                        >
                                            {playbackRate === 1 ? '1×' : `${playbackRate}×`}
                                        </button>
                                        {showSpeedMenu && (
                                            <div
                                                onClick={e => e.stopPropagation()}
                                                style={{
                                                    position: 'absolute', bottom: '110%', right: 0,
                                                    marginBottom: '6px', background: 'rgba(13,15,20,0.97)',
                                                    border: '1px solid rgba(212,168,83,0.3)',
                                                    borderRadius: '8px', padding: '4px',
                                                    minWidth: '90px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                                    animation: 'aimFadeIn 0.15s ease', backdropFilter: 'blur(10px)',
                                                }}
                                            >
                                                <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', padding: '5px 10px 4px' }}>{tPlayer('speed')}</div>
                                                {SPEEDS.map(s => (
                                                    <button key={s} onClick={() => changeSpeed(s)} style={{
                                                        display: 'block', width: '100%', padding: '5px 10px',
                                                        textAlign: 'left', background: playbackRate === s ? 'rgba(212,168,83,0.15)' : 'transparent',
                                                        border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer',
                                                        color: playbackRate === s ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                    }}>
                                                        {s === 1 ? tPlayer('speedNormal') : `${s}×`} {playbackRate === s && '✓'}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* CC Button */}
                                    {ccChecked && (
                                        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                            <button
                                                className="aim-ctrl-btn"
                                                onClick={() => { setShowLangMenu(prev => !prev); setShowSpeedMenu(false) }}
                                                title={ccEnabled ? `Subtitles on (${LANGUAGE_NAMES[ccLang] || ccLang})` : 'Subtitles'}
                                                style={{
                                                    fontSize: '0.68rem', fontWeight: 700, minWidth: '38px',
                                                    background: ccEnabled ? 'rgba(212,168,83,0.2)' : undefined,
                                                    color: ccEnabled ? 'var(--accent-gold)' : undefined,
                                                    border: ccEnabled ? '1px solid rgba(212,168,83,0.4)' : '1px solid transparent',
                                                }}
                                            >
                                                {ccLoading ? '⏳' : 'CC'}
                                                {ccEnabled && ccLang !== 'en' && <span style={{ fontSize: '0.55rem', marginLeft: '2px' }}>{ccLang.toUpperCase()}</span>}
                                            </button>
                                            {/* Status toast */}
                                            {ccStatusText && !ccLoading && (
                                                <div style={{
                                                    position: 'absolute', bottom: '120%', right: 0,
                                                    background: 'rgba(13,15,20,0.95)',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: '6px', padding: '5px 10px',
                                                    fontSize: '0.72rem', color: 'var(--text-secondary)',
                                                    whiteSpace: 'nowrap', pointerEvents: 'none',
                                                    animation: 'aimFadeIn 0.2s ease',
                                                }}>{ccStatusText}</div>
                                            )}
                                            {/* ── Language picker: bottom-sheet on mobile, dropdown on desktop ── */}
                                            {showLangMenu && !isMobile && (
                                                /* Desktop dropdown */
                                                <div style={{
                                                    position: 'absolute', bottom: '110%', right: 0,
                                                    marginBottom: '6px', background: 'rgba(13,15,20,0.97)',
                                                    border: '1px solid rgba(212,168,83,0.3)',
                                                    borderRadius: '8px', padding: '4px',
                                                    minWidth: '150px', backdropFilter: 'blur(10px)',
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                                    animation: 'aimFadeIn 0.15s ease',
                                                }}>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', padding: '6px 10px 4px' }}>{tPlayer('subtitles')}</div>
                                                    {ccAvailable.length === 0 && (
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', padding: '6px 10px' }}>{tPlayer('noSubtitles')}</div>
                                                    )}
                                                    {ccAvailable.map(lang => (
                                                        <button key={lang}
                                                            onClick={() => { loadSubtitles(lang); setShowLangMenu(false) }}
                                                            style={{
                                                                display: 'block', width: '100%', padding: '6px 10px', textAlign: 'left',
                                                                background: ccLang === lang && ccEnabled ? 'rgba(212,168,83,0.15)' : 'transparent',
                                                                border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer',
                                                                color: ccLang === lang && ccEnabled ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                            }}>
                                                            {LANGUAGE_NAMES[lang] || lang} {ccLang === lang && ccEnabled && '✓'}
                                                        </button>
                                                    ))}
                                                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 6px' }} />
                                                    <button
                                                        onClick={() => { setCcEnabled(false); setShowLangMenu(false) }}
                                                        style={{
                                                            display: 'block', width: '100%', padding: '6px 10px', textAlign: 'left',
                                                            background: !ccEnabled ? 'rgba(255,255,255,0.06)' : 'transparent',
                                                            border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer',
                                                            color: 'var(--text-tertiary)',
                                                        }}>{tPlayer('subtitlesOff')}</button>
                                                </div>
                                            )}
                                            {/* Mobile bottom sheet — rendered via portal so it's never clipped */}
                                            {showLangMenu && isMobile && typeof document !== 'undefined' && createPortal(
                                                <>
                                                    {/* Backdrop */}
                                                    <div
                                                        onClick={() => setShowLangMenu(false)}
                                                        style={{
                                                            position: 'fixed', inset: 0,
                                                            background: 'rgba(0,0,0,0.6)',
                                                            backdropFilter: 'blur(4px)',
                                                            zIndex: 99998,
                                                        }}
                                                    />
                                                    {/* Sheet */}
                                                    <div style={{
                                                        position: 'fixed', bottom: 0, left: 0, right: 0,
                                                        background: 'rgba(13,15,20,0.98)',
                                                        borderTop: '1px solid rgba(212,168,83,0.25)',
                                                        borderRadius: '20px 20px 0 0',
                                                        zIndex: 99999,
                                                        maxHeight: '65dvh',
                                                        overflowY: 'auto',
                                                        paddingBottom: 'env(safe-area-inset-bottom)',
                                                        animation: 'aimSheetIn 0.25s cubic-bezier(0.32,0.72,0,1)',
                                                    }}>
                                                        {/* Handle */}
                                                        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '4px' }}>
                                                            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
                                                        </div>
                                                        {/* Title */}
                                                        <div style={{
                                                            fontSize: '0.78rem', fontWeight: 700,
                                                            textTransform: 'uppercase', letterSpacing: '0.08em',
                                                            color: 'var(--accent-gold)', padding: '8px 20px 12px',
                                                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                                                        }}>{tPlayer('subtitles')}</div>
                                                        {/* Rows — 44px min-height for touch targets */}
                                                        <div style={{ padding: '8px 12px' }}>
                                                            {ccAvailable.map(lang => (
                                                                <button key={lang}
                                                                    onClick={() => { loadSubtitles(lang); setShowLangMenu(false) }}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        width: '100%', minHeight: '44px', padding: '8px 12px',
                                                                        background: ccLang === lang && ccEnabled ? 'rgba(212,168,83,0.1)' : 'transparent',
                                                                        border: 'none', borderRadius: '10px',
                                                                        fontSize: '1rem', cursor: 'pointer',
                                                                        color: ccLang === lang && ccEnabled ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                                        fontFamily: 'inherit',
                                                                        WebkitTapHighlightColor: 'transparent',
                                                                    }}>
                                                                    <span>{LANGUAGE_NAMES[lang] || lang}</span>
                                                                    {ccLang === lang && ccEnabled && (
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                            <polyline points="20 6 9 17 4 12" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                            ))}
                                                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '8px 4px' }} />
                                                            <button
                                                                onClick={() => { setCcEnabled(false); setShowLangMenu(false) }}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center',
                                                                    width: '100%', minHeight: '44px', padding: '8px 12px',
                                                                    background: !ccEnabled ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                                    border: 'none', borderRadius: '10px',
                                                                    fontSize: '1rem', cursor: 'pointer',
                                                                    color: 'var(--text-tertiary)', fontFamily: 'inherit',
                                                                    WebkitTapHighlightColor: 'transparent',
                                                                }}>
                                                                {tPlayer('subtitlesOff')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>,
                                                document.body
                                            )}
                                        </div>
                                    )}

                                    {/* Fullscreen */}
                                    <button
                                        className="aim-ctrl-btn"
                                        onClick={e => { e.stopPropagation(); toggleFullscreen() }}
                                        title={isFullscreen ? 'Exit fullscreen (f)' : 'Fullscreen (f)'}
                                    >
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

                            {/* ── Keyboard hint (desktop only) ── */}
                            <div className="aim-desktop-only" style={{
                                marginTop: '4px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)',
                                display: 'flex', gap: '12px', justifyContent: 'center',
                            }}>
                                <span>Space/K: play</span><span>← →: ±10s</span>
                                <span>↑ ↓: volume</span><span>M: mute</span><span>F: fullscreen</span>
                            </div>
                        </div>
                    )}
                </div>
                </div>{/* /aim-sticky-player-zone */}

                {/* ── Episodes panel (series only) ── */}
                {isSeries && (
                    <div style={{
                        marginTop: 'var(--space-lg)', marginBottom: 'var(--space-xl)',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)',
                        padding: 'var(--space-lg)',
                        maxHeight: '400px', overflowY: 'auto',
                    }}>
                        <h3 style={{
                            fontSize: '0.75rem', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            color: 'var(--accent-gold)', marginBottom: 'var(--space-md)',
                        }}>Episodes</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {project.episodes.map(ep => (
                                <button key={ep.id} onClick={() => playEpisode(ep)} style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                    padding: '0.6rem 0.8rem',
                                    background: activeEpisode?.id === ep.id ? 'var(--accent-gold-glow)' : 'transparent',
                                    border: activeEpisode?.id === ep.id ? '1px solid rgba(212,168,83,0.3)' : '1px solid transparent',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: ep.videoUrl ? 'pointer' : 'not-allowed',
                                    opacity: ep.videoUrl ? 1 : 0.4,
                                    textAlign: 'left', width: '100%',
                                    transition: 'all 0.2s', color: 'var(--text-primary)',
                                }}>
                                    <span style={{
                                        fontSize: '0.7rem', fontWeight: 700,
                                        color: activeEpisode?.id === ep.id ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                        minWidth: '28px',
                                    }}>E{ep.number}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</div>
                                        {ep.duration && <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{ep.duration}</div>}
                                    </div>
                                    {activeEpisode?.id === ep.id && (
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-gold)' }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
