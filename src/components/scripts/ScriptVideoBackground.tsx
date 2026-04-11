'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface HeroVideoItem {
    id: string
    url: string
    duration: number
}

export default function ScriptVideoBackground() {
    const [heroVideos, setHeroVideos] = useState<HeroVideoItem[]>([])
    const [currentVideoIdx, setCurrentVideoIdx] = useState(0)
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Fetch hero videos for the scripts page
    useEffect(() => {
        fetch('/api/admin/media?type=hero-video&page=scripts')
            .then(r => r.json())
            .then((data: HeroVideoItem[]) => {
                if (Array.isArray(data) && data.length > 0) setHeroVideos(data)
            })
            .catch(() => { })
    }, [])

    // Start first video once loaded
    useEffect(() => {
        if (heroVideos.length === 0) return
        const videoA = videoARef.current
        if (!videoA) return
        videoA.src = heroVideos[0].url
        videoA.load()
        videoA.play().catch(() => { })
        setActiveSlot('A')
        const durationMs = (heroVideos[0].duration || 10) * 1000
        videoTimerRef.current = setTimeout(() => crossfadeToNext(0), durationMs)
        return () => { if (videoTimerRef.current) clearTimeout(videoTimerRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [heroVideos])

    const crossfadeToNext = useCallback((prevIdx: number) => {
        if (heroVideos.length <= 1) return
        const nextIdx = (prevIdx + 1) % heroVideos.length
        setCurrentVideoIdx(nextIdx)
        setActiveSlot(prev => {
            const nextSlot = prev === 'A' ? 'B' : 'A'
            const nextVideo = nextSlot === 'A' ? videoARef.current : videoBRef.current
            if (nextVideo) {
                nextVideo.src = heroVideos[nextIdx].url
                nextVideo.load()
                nextVideo.play().catch(() => { })
            }
            return nextSlot
        })
        const durationMs = (heroVideos[nextIdx].duration || 10) * 1000
        if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
        videoTimerRef.current = setTimeout(() => crossfadeToNext(nextIdx), durationMs)
    }, [heroVideos])

    const jumpToVideo = useCallback((idx: number) => {
        if (idx === currentVideoIdx) return
        setCurrentVideoIdx(idx)
        setActiveSlot(prev => {
            const nextSlot = prev === 'A' ? 'B' : 'A'
            const nextVideo = nextSlot === 'A' ? videoARef.current : videoBRef.current
            if (nextVideo) {
                nextVideo.src = heroVideos[idx].url
                nextVideo.load()
                nextVideo.play().catch(() => { })
            }
            return nextSlot
        })
        const durationMs = (heroVideos[idx].duration || 10) * 1000
        if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
        videoTimerRef.current = setTimeout(() => crossfadeToNext(idx), durationMs)
    }, [currentVideoIdx, heroVideos, crossfadeToNext])

    // No videos uploaded yet — render nothing (CinematicBackground shows through)
    if (heroVideos.length === 0) return null

    return (
        <>
            {/* Fixed video slots */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100dvh',
                zIndex: 0,
                background: '#0d0f14',
            }}>
                <video
                    ref={videoARef}
                    autoPlay muted playsInline loop
                    controlsList="nodownload"
                    onContextMenu={e => e.preventDefault()}
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        opacity: activeSlot === 'A' ? 1 : 0,
                        transition: 'opacity 1.2s ease-in-out',
                        zIndex: activeSlot === 'A' ? 1 : 0,
                    }}
                />
                <video
                    ref={videoBRef}
                    autoPlay muted playsInline loop
                    controlsList="nodownload"
                    onContextMenu={e => e.preventDefault()}
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        opacity: activeSlot === 'B' ? 1 : 0,
                        transition: 'opacity 1.2s ease-in-out',
                        zIndex: activeSlot === 'B' ? 1 : 0,
                    }}
                />
            </div>

            {/* Overlay gradient */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100dvh',
                zIndex: 0,
                background: 'linear-gradient(180deg, rgba(13,15,20,0.3) 0%, rgba(13,15,20,0.15) 25%, rgba(13,15,20,0.25) 50%, rgba(13,15,20,0.55) 75%, rgba(13,15,20,0.85) 100%)',
                pointerEvents: 'none',
            }} />

            {/* Video indicator dots */}
            {heroVideos.length > 1 && (
                <div style={{
                    position: 'fixed',
                    bottom: '28px', left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex', gap: '6px',
                    zIndex: 3,
                }}>
                    {heroVideos.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => jumpToVideo(i)}
                            style={{
                                width: currentVideoIdx === i ? '28px' : '6px',
                                height: '6px',
                                borderRadius: 'var(--radius-full)',
                                border: 'none',
                                background: currentVideoIdx === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.25)',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                padding: 0,
                            }}
                            aria-label={`Play video ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </>
    )
}
