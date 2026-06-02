'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import NextImage from 'next/image'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useCanPlayVideo } from '@/hooks/useCanPlayVideo'

interface HeroVideo {
    id: string
    url: string
    duration: number
    target?: string  // 'all' | 'desktop' | 'mobile'
}

interface HeroBackgroundProps {
    /** Which page to fetch media for (e.g. 'home', 'works', 'upcoming', 'casting', 'training', 'scripts') */
    page: string
    /** Whether the current viewport is mobile */
    isMobile: boolean
    /** When true, renders position:absolute instead of position:fixed so the media
        is contained within a parent element (e.g. a mobile cinematic card) */
    cardMode?: boolean
    /** Static poster/fallback shown immediately before the media API returns.
        Eliminates the blank dark screen gap on first load. */
    poster?: string
    /** Optional className for the outer container */
    className?: string
    /** Returns the current video index and total count so parent can render dots */
    onVideoChange?: (currentIdx: number, total: number) => void
    /** Expose jumpToVideo function to parent */
    jumpToVideoRef?: React.RefObject<((idx: number) => void) | null>
    /** Page-level opt-in for mobile video.
     *  Default is FALSE — mobile gets image-only fallback.
     *  When TRUE, mobile video is allowed only if the connection is strong
     *  (4g+, no Save-Data, device memory ≥4 GB). */
    allowMobileVideo?: boolean
    /** Extra image URLs (e.g. featured project covers) injected at the front
     *  of the image rotation alongside admin-assigned Media Manager images. */
    extraImages?: string[]
}

/** Filter media items by device target */
function matchesTarget(target: string | undefined, isMobile: boolean): boolean {
    if (!target || target === 'all') return true
    return isMobile ? target === 'mobile' : target === 'desktop'
}

// Video gating moved to useCanPlayVideo hook — checks effectiveType,
// saveData, and deviceMemory reactively. No longer hard-skips all mobile.

/**
 * Safely call video.play() and suppress AbortError / NotAllowedError.
 * These are expected when play is interrupted by pause, unmount, or browser policy —
 * they must not surface as unhandled rejections in error reporters.
 */
function safePlay(video: HTMLVideoElement): void {
    const p = video.play()
    if (p) p.catch(() => {})
}

export default function HeroBackground({
    page, isMobile, cardMode = false, poster, className, onVideoChange, jumpToVideoRef,
    allowMobileVideo = false, extraImages,
}: HeroBackgroundProps) {
    const pos = cardMode ? 'absolute' : 'fixed'

    // Detect mobile internally so the fetch effect always uses the correct
    // device state — avoids the timing gap where the prop was still `false`
    // on the first render while useIsMobile had not yet fired in the parent.
    const isMobileDevice = useIsMobile(isMobile)

    // Connection-quality video guard — checks effectiveType, saveData, deviceMemory.
    // Returns true when the device/network can handle background video.
    const canPlayVideo = useCanPlayVideo()

    // Combined decision: skip video when:
    //  - Connection/device too weak (canPlayVideo = false), OR
    //  - On mobile AND the page has NOT opted in via allowMobileVideo.
    // Desktop: only skips when canPlayVideo is false (saveData / slow connection).
    const skipVideo = !canPlayVideo || (isMobileDevice && !allowMobileVideo)

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
    // imgVisible gates the CSS opacity transition on API images.
    // Images mount at opacity:0 (imgVisible=false), then a RAF on the next
    // frame flips it to true → the browser sees a genuine 0→1 change on an
    // already-mounted element → CSS transition fires smoothly.
    const [imgVisible, setImgVisible] = useState(false)
    // Raw (unfiltered) media stored so we can re-filter without re-fetching
    const rawImagesRef = useRef<{ url: string; target?: string; sortOrder?: number }[]>([])
    const rawVideosRef = useRef<HeroVideo[]>([])
    // Stable ref for caller-injected covers (featured project posters)
    const extraImagesRef = useRef<string[]>([])
    // Keep ref in sync — use a joined string as dep key so array identity changes
    // don't trigger unnecessary re-renders when the URLs haven't actually changed
    const extraImagesKey = (extraImages ?? []).filter(Boolean).join('|')
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        extraImagesRef.current = (extraImages ?? []).filter(Boolean)
        // If raw API images are already loaded, rebuild the list immediately
        if (rawImagesRef.current.length > 0) {
            const filtered = rawImagesRef.current.filter(m => matchesTarget(m.target, isMobileDevice))
            setBgImages([...extraImagesRef.current, ...filtered.map(m => m.url)])
            setCurrentBg(0)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extraImagesKey])

    // ── Video state ──
    const [videos, setVideos] = useState<HeroVideo[]>([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
    // videoReady: true once the first video frame is available → video fades in
    // over the poster/image rather than snapping abruptly.
    const [videoReady, setVideoReady] = useState(false)
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Fetch ALL media for this page in a single request ──
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
                // Featured project covers lead the rotation; admin images follow
                setBgImages([...extraImagesRef.current, ...filteredImages.map(m => m.url)])
                setCurrentBg(0)

                const videoItems: HeroVideo[] = data
                    .filter(m => m.type === 'hero-video')
                    .map(m => ({ id: m.id, url: m.url, duration: m.duration || 10, target: m.target }))
                rawVideosRef.current = videoItems
                const filteredVideos = videoItems.filter(m => matchesTarget(m.target, mobile))
                setVideos(filteredVideos)
            })
            .catch(() => {})
    }, [page]) // ← ONLY re-fetch when page changes, NOT when isMobileDevice changes

    // ── Re-filter already-fetched media when device type changes ──
    useEffect(() => {
        if (rawImagesRef.current.length > 0) {
            const filtered = rawImagesRef.current.filter(m => matchesTarget(m.target, isMobileDevice))
            setBgImages([...extraImagesRef.current, ...filtered.map(m => m.url)])
            setCurrentBg(0)
        }
        if (rawVideosRef.current.length > 0) {
            const filtered = rawVideosRef.current.filter(m => matchesTarget(m.target, isMobileDevice))
            setVideos(filtered)
        }
    }, [isMobileDevice])

    // ── Smooth image fade-in ──
    // Runs after paint (useEffect guarantee). When bgImages count increases from
    // zero, the image divs are already in the DOM at opacity:0. The RAF fires one
    // frame later → setImgVisible(true) → CSS transition 0→1 over 0.8s.
    // When count drops to zero (no images for page), reset so next arrival fades in.
    useEffect(() => {
        if (bgImages.length > 0) {
            const id = requestAnimationFrame(() => setImgVisible(true))
            return () => cancelAnimationFrame(id)
        } else {
            setImgVisible(false)
        }
    }, [bgImages.length])

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
                safePlay(nextVideo)
            }
            return nextSlot
        })

        const durationMs = (videos[nextIdx].duration || 10) * 1000
        if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
        videoTimerRef.current = setTimeout(() => crossfadeToNext(nextIdx), durationMs)
    }, [videos])

    // Start first video (only when no images, only on desktop/fast connection)
    useEffect(() => {
        if (bgImages.length > 0) return // images take priority
        if (videos.length === 0) return
        // 4G safety: skip background video on slow connections / Save-Data / low-memory
        if (skipVideo) return

        const videoA = videoARef.current
        if (!videoA) return

        videoA.src = videos[0].url
        videoA.load()
        safePlay(videoA)
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
    }, [videos, bgImages, skipVideo])

    // Notify parent of video index changes
    useEffect(() => {
        if (bgImages.length === 0 && videos.length > 0) {
            // If video is being skipped (mobile/Save-Data/slow), tell parent
            // there are 0 videos so it doesn't render navigation dots.
            if (skipVideo) {
                onVideoChange?.(0, 0)
            } else {
                onVideoChange?.(currentIdx, videos.length)
            }
        }
    }, [currentIdx, videos.length, bgImages.length, onVideoChange, skipVideo])

    // Expose jumpToVideo to parent
    const jumpToVideo = useCallback((idx: number) => {
        if (idx === currentIdx || bgImages.length > 0) return
        // 4G safety: don't allow manual video loading when video is suppressed
        if (skipVideo) return
        setCurrentIdx(idx)

        setActiveSlot(prev => {
            const nextSlot = prev === 'A' ? 'B' : 'A'
            const nextVideo = nextSlot === 'A' ? videoARef.current : videoBRef.current
            if (nextVideo) {
                nextVideo.src = videos[idx].url
                nextVideo.load()
                safePlay(nextVideo)
            }
            return nextSlot
        })

        if (videos.length > 1) {
            const durationMs = (videos[idx].duration || 10) * 1000
            if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
            videoTimerRef.current = setTimeout(() => crossfadeToNext(idx), durationMs)
        }
    }, [currentIdx, videos, crossfadeToNext, bgImages.length, skipVideo])

    useEffect(() => {
        if (jumpToVideoRef) jumpToVideoRef.current = jumpToVideo
    }, [jumpToVideo, jumpToVideoRef])

    // ═══════════════════════════════════════════════════════════════════════
    // UNIFIED RENDER
    // One container — always the same DOM node, never conditionally swapped.
    // Switching between the old image-path and video-path caused abrupt snaps
    // because CSS transitions don't fire on newly-mounted elements.
    //
    // Layer stack (bottom → top):
    //   Base  — premium cinematic gradient (never a flat dark screen)
    //   [1]   — static poster/fallback (immediate, no API wait)
    //   [2-3] — video slots A & B (desktop only, fade in via videoReady)
    //   [4+]  — API images (mount at opacity:0, fade to 1 via imgVisible RAF)
    //   [top] — dark overlay gradient for text readability
    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className={className} style={{
            position: pos,
            top: 0, left: 0,
            width: '100%', maxWidth: '100vw',
            height: cardMode ? '100%' : '100dvh',
            overflow: 'hidden',
            zIndex: 0,
            // Premium cinematic gradient base — visible during API load and
            // on pages with no assigned media. Never a flat empty dark screen.
            background: 'linear-gradient(135deg, #0a0c10 0%, #0d0f14 60%, #0f1118 100%)',
        }}>

            {/* ── [1] Immediate poster / static fallback ── */}
            {/* Shown before the API returns — eliminates the blank dark gap. */}
            {poster && (
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${poster})`,
                    backgroundSize: 'cover',
                    backgroundPosition: isMobile ? 'center top' : 'center center',
                    filter: 'brightness(0.75)',
                }} />
            )}

            {/* ── [2] Video slot A ── */}
            {/* preload="none": no bytes fetched until .load() is called explicitly */}
            <video
                ref={videoARef}
                autoPlay muted playsInline loop
                preload="none"
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                onCanPlay={() => setVideoReady(true)}
                poster={poster}
                style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    // Gate on videoReady → video fades in over poster, never snaps
                    opacity: videos.length > 0 && activeSlot === 'A' && videoReady ? 1 : 0,
                    transition: 'opacity 1.2s ease-in-out',
                    zIndex: 1,
                }}
            />

            {/* ── [3] Video slot B (crossfade target) ── */}
            <video
                ref={videoBRef}
                autoPlay muted playsInline loop
                preload="none"
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    opacity: videos.length > 0 && activeSlot === 'B' && videoReady ? 1 : 0,
                    transition: 'opacity 1.2s ease-in-out',
                    zIndex: activeSlot === 'B' ? 2 : 0,
                }}
            />

            {/* ── [4+] API images ── */}
            {/* All images remain in DOM simultaneously; only currentBg is visible. */}
            {/* imgVisible starts false → images mount at opacity:0 → RAF fires →  */}
            {/* imgVisible becomes true → CSS transition 0→1 (0.8s) fires smoothly. */}
            {bgImages.map((src, i) => (
                <div key={src} style={{
                    position: 'absolute', inset: 0,
                    maxWidth: '100vw', overflow: 'hidden',
                    zIndex: 3,
                    opacity: imgVisible && currentBg === i ? 1 : 0,
                    transition: 'opacity 0.8s ease-in-out',
                }}>
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

            {/* ── [top] Dark overlay gradient for text readability ── */}
            <div style={{
                position: 'absolute', inset: 0,
                zIndex: 4,
                maxWidth: '100vw', overflow: 'hidden',
                background: 'linear-gradient(to bottom, rgba(13,15,20,0.05) 0%, rgba(13,15,20,0.2) 50%, rgba(13,15,20,0.55) 100%)',
                pointerEvents: 'none',
            }} />
        </div>
    )
}
