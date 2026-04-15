'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface HeroVideo {
    id: string
    url: string
    duration: number
    target?: string  // 'all' | 'desktop' | 'mobile'
}

interface BgImage {
    url: string
    target?: string  // 'all' | 'desktop' | 'mobile'
}

interface HeroBackgroundProps {
    /** Which page to fetch media for (e.g. 'home', 'works', 'upcoming', 'casting', 'training', 'scripts') */
    page: string
    /** Whether the current viewport is mobile */
    isMobile: boolean
    /** Optional poster image shown before video loads */
    poster?: string
    /** Optional className for the outer container */
    className?: string
    /** Returns the current video index and total count so parent can render dots */
    onVideoChange?: (currentIdx: number, total: number) => void
    /** Expose jumpToVideo function to parent */
    jumpToVideoRef?: React.MutableRefObject<((idx: number) => void) | null>
}

/** Filter media items by device target */
function matchesTarget(target: string | undefined, isMobile: boolean): boolean {
    if (!target || target === 'all') return true
    return isMobile ? target === 'mobile' : target === 'desktop'
}

export default function HeroBackground({ page, isMobile, poster, className, onVideoChange, jumpToVideoRef }: HeroBackgroundProps) {
    // ── Image state ──
    const [bgImages, setBgImages] = useState<string[]>([])
    const [currentBg, setCurrentBg] = useState(0)

    // ── Video state ──
    const [videos, setVideos] = useState<HeroVideo[]>([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Fetch both images and videos, filtered by device target ──
    useEffect(() => {
        // Fetch background images
        fetch(`/api/admin/media?type=background&page=${page}`)
            .then(r => r.json())
            .then((data: BgImage[]) => {
                if (Array.isArray(data)) {
                    const filtered = data.filter(m => matchesTarget(m.target, isMobile))
                    setBgImages(filtered.map(m => m.url))
                }
            })
            .catch(() => { })

        // Fetch hero videos
        fetch(`/api/admin/media?type=hero-video&page=${page}`)
            .then(r => r.json())
            .then((data: HeroVideo[]) => {
                if (Array.isArray(data)) {
                    const filtered = data.filter(m => matchesTarget(m.target, isMobile))
                    setVideos(filtered)
                }
            })
            .catch(() => { })
    }, [page, isMobile])

    // ── Image slideshow timer ──
    useEffect(() => {
        if (bgImages.length <= 1) return
        const timer = setInterval(() => setCurrentBg(p => (p + 1) % bgImages.length), 6000)
        return () => clearInterval(timer)
    }, [bgImages])

    // ── Video crossfade logic (only runs when NO images exist) ──
    const crossfadeToNext = useCallback((prevIdx: number) => {
        if (videos.length <= 1) return
        const nextIdx = (prevIdx + 1) % videos.length
        setCurrentIdx(nextIdx)

        setActiveSlot(prev => {
            const nextSlot = prev === 'A' ? 'B' : 'A'
            const nextVideo = nextSlot === 'A' ? videoARef.current : videoBRef.current
            if (nextVideo) {
                nextVideo.src = videos[nextIdx].url
                nextVideo.load()
                nextVideo.play().catch(() => { })
            }
            return nextSlot
        })

        const durationMs = (videos[nextIdx].duration || 10) * 1000
        if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
        videoTimerRef.current = setTimeout(() => crossfadeToNext(nextIdx), durationMs)
    }, [videos])

    // Start first video (only when no images)
    useEffect(() => {
        if (bgImages.length > 0) return // images take priority
        if (videos.length === 0) return

        const videoA = videoARef.current
        if (!videoA) return

        videoA.src = videos[0].url
        videoA.load()
        videoA.play().catch(() => { })
        setActiveSlot('A')
        onVideoChange?.(0, videos.length)

        if (videos.length > 1) {
            const durationMs = (videos[0].duration || 10) * 1000
            videoTimerRef.current = setTimeout(() => crossfadeToNext(0), durationMs)
        }

        return () => {
            if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videos, bgImages])

    // Notify parent of video index changes
    useEffect(() => {
        if (bgImages.length === 0 && videos.length > 0) {
            onVideoChange?.(currentIdx, videos.length)
        }
    }, [currentIdx, videos.length, bgImages.length, onVideoChange])

    // Expose jumpToVideo to parent
    const jumpToVideo = useCallback((idx: number) => {
        if (idx === currentIdx || bgImages.length > 0) return
        setCurrentIdx(idx)

        setActiveSlot(prev => {
            const nextSlot = prev === 'A' ? 'B' : 'A'
            const nextVideo = nextSlot === 'A' ? videoARef.current : videoBRef.current
            if (nextVideo) {
                nextVideo.src = videos[idx].url
                nextVideo.load()
                nextVideo.play().catch(() => { })
            }
            return nextSlot
        })

        if (videos.length > 1) {
            const durationMs = (videos[idx].duration || 10) * 1000
            if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
            videoTimerRef.current = setTimeout(() => crossfadeToNext(idx), durationMs)
        }
    }, [currentIdx, videos, crossfadeToNext, bgImages.length])

    useEffect(() => {
        if (jumpToVideoRef) jumpToVideoRef.current = jumpToVideo
    }, [jumpToVideo, jumpToVideoRef])

    // ═══ RENDER: IMAGES (priority) ═══
    if (bgImages.length > 0) {
        return (
            <>
                {bgImages.map((src, i) => (
                    <div key={src} className={className} style={{
                        position: 'fixed', inset: 0, zIndex: 0,
                        backgroundImage: `url(${src})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        filter: 'brightness(0.6) saturate(0.85)',
                        opacity: currentBg === i ? 1 : 0,
                        transition: 'opacity 1.5s ease-in-out',
                    }} />
                ))}
                {/* Dark overlay for text readability */}
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1,
                    background: 'linear-gradient(to bottom, rgba(13,15,20,0.2) 0%, rgba(13,15,20,0.45) 50%, rgba(13,15,20,0.7) 100%)',
                    pointerEvents: 'none',
                }} />
            </>
        )
    }

    // ═══ RENDER: VIDEOS (fallback) ═══
    return (
        <div className={className} style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100%', height: '100dvh',
            zIndex: 0,
            background: '#0d0f14',
        }}>
            {/* Static poster shown until first video loads */}
            {poster && (
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${poster})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    opacity: videos.length === 0 ? 0.3 : 0,
                    transition: 'opacity 0.8s ease',
                }} />
            )}
            <video
                ref={videoARef}
                autoPlay muted playsInline loop
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                poster={poster}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    opacity: videos.length > 0 && activeSlot === 'A' ? 1 : 0,
                    transition: 'opacity 1.2s ease-in-out',
                    zIndex: activeSlot === 'A' ? 1 : 0,
                }}
            />
            <video
                ref={videoBRef}
                autoPlay muted playsInline loop
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    opacity: videos.length > 0 && activeSlot === 'B' ? 1 : 0,
                    transition: 'opacity 1.2s ease-in-out',
                    zIndex: activeSlot === 'B' ? 1 : 0,
                }}
            />
            {/* Cinematic overlay */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 2,
                background: 'linear-gradient(180deg, rgba(13,15,20,0.15) 0%, rgba(13,15,20,0.25) 40%, rgba(13,15,20,0.5) 80%, rgba(13,15,20,0.85) 100%)',
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
            }} />
        </div>
    )
}
