'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import NextImage from 'next/image'
import { useIsMobile } from '@/hooks/useIsMobile'

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
    // Detect mobile internally so the fetch effect always uses the correct
    // device state — avoids the timing gap where the prop was still `false`
    // on the first render while useIsMobile had not yet fired in the parent.
    const isMobileDevice = useIsMobile(isMobile)

    // Keep a ref that always reflects the latest isMobileDevice value.
    // The fetch effect's async .then() callback would otherwise capture a
    // stale closure value — if useIsMobile resolves to `true` before the
    // fetch completes, the callback still used the old `false`, causing
    // desktop videos to show on mobile instead of the assigned mobile images.
    const isMobileRef = useRef(isMobileDevice)
    useEffect(() => { isMobileRef.current = isMobileDevice }, [isMobileDevice])

    // ── Image state ──
    const [bgImages, setBgImages] = useState<string[]>([])
    const [currentBg, setCurrentBg] = useState(0)
    // Raw (unfiltered) media stored so we can re-filter without re-fetching
    const rawImagesRef = useRef<{ url: string; target?: string; sortOrder?: number }[]>([])
    const rawVideosRef = useRef<HeroVideo[]>([])

    // ── Video state ──
    const [videos, setVideos] = useState<HeroVideo[]>([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
    // videoReady: true once the first video frame is available → disables the
    // initial opacity transition so the video snaps in without a black fade.
    const [videoReady, setVideoReady] = useState(false)
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Fetch ALL media for this page in a single request ──
    // Previously fired 3 separate API calls (background, hero-image, hero-video)
    // creating a ~600ms waterfall. Now one call, split client-side.
    useEffect(() => {
        fetch(`/api/admin/media?page=${page}`)
            .then(r => r.json())
            .then((data: { id: string; url: string; type: string; duration?: number; target?: string; sortOrder?: number }[]) => {
                if (!Array.isArray(data)) return
                const mobile = isMobileRef.current

                // Split by type
                const imageItems = data
                    .filter(m => m.type === 'background' || m.type === 'hero-image')
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                rawImagesRef.current = imageItems
                const filteredImages = imageItems.filter(m => matchesTarget(m.target, mobile))
                setBgImages(filteredImages.map(m => m.url))
                setCurrentBg(0)

                const videoItems: HeroVideo[] = data
                    .filter(m => m.type === 'hero-video')
                    .map(m => ({ id: m.id, url: m.url, duration: m.duration || 10, target: m.target }))
                rawVideosRef.current = videoItems
                const filteredVideos = videoItems.filter(m => matchesTarget(m.target, mobile))
                setVideos(filteredVideos)
            })
            .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]) // ← ONLY re-fetch when page changes, NOT when isMobileDevice changes

    // ── Re-filter already-fetched media when device type changes ──
    useEffect(() => {
        if (rawImagesRef.current.length > 0) {
            const filtered = rawImagesRef.current.filter(m => matchesTarget(m.target, isMobileDevice))
            setBgImages(filtered.map(m => m.url))
            setCurrentBg(0)
        }
        if (rawVideosRef.current.length > 0) {
            const filtered = rawVideosRef.current.filter(m => matchesTarget(m.target, isMobileDevice))
            setVideos(filtered)
        }
    }, [isMobileDevice])

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
                    // Wrapper must be position:fixed for <Image fill> to work correctly.
                    // overflow:hidden + maxWidth:100vw prevent the fixed layer from causing
                    // a horizontal scrollbar on mobile portrait viewports.
                    <div key={src} className={className} style={{
                        position: 'fixed', inset: 0, zIndex: 0,
                        maxWidth: '100vw', overflow: 'hidden',
                        opacity: currentBg === i ? 1 : 0,
                        transition: 'opacity 1.5s ease-in-out',
                    }}>
                        {/* Route through Next.js image optimizer → AVIF/WebP, correct srcset,
                            immutable Cache-Control. Raw R2 PNG (~950 KB) becomes ~90–150 KB AVIF.
                            On mobile portrait, objectPosition:'center top' keeps the subject of
                            landscape images visible instead of cropping to the middle. */}
                        <NextImage
                            src={src}
                            alt=""
                            fill
                            priority={i === 0}
                            loading={i === 0 ? undefined : 'eager'}
                            sizes="100vw"
                            quality={80}
                            style={{
                                objectFit: 'cover',
                                objectPosition: isMobile ? 'center top' : 'center center',
                                filter: 'brightness(0.85)',
                            }}
                        />
                    </div>
                ))}
                {/* Dark overlay for text readability */}
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1,
                    maxWidth: '100vw', overflow: 'hidden',
                    background: 'linear-gradient(to bottom, rgba(13,15,20,0.05) 0%, rgba(13,15,20,0.2) 50%, rgba(13,15,20,0.55) 100%)',
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
            width: '100%', maxWidth: '100vw', height: '100dvh',
            overflow: 'hidden',
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
                onCanPlay={() => setVideoReady(true)}
                poster={poster}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    opacity: videos.length > 0 && activeSlot === 'A' ? 1 : 0,
                    // No transition on first appearance — prevents fade-from-black.
                    // Once videoReady, crossfades between slots use smooth 1.2s.
                    transition: videoReady ? 'opacity 1.2s ease-in-out' : 'none',
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
