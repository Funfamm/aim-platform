'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface HeroVideo {
    id: string
    url: string
    duration: number
}

interface HomeHeroProps {
    completedCount: number
    upcomingCount: number
    openCastings: number
    castingEnabled: boolean
}

export default function HomeHero({ completedCount, upcomingCount, openCastings, castingEnabled }: HomeHeroProps) {
    const t = useTranslations('hero')
    const th = useTranslations('home')
    const ROTATING_WORDS = useMemo(() => [t('word1'), t('word2'), t('word3'), t('word4'), t('word5')], [t])
    const [videos, setVideos] = useState<HeroVideo[]>([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
    const [wordIdx, setWordIdx] = useState(0)
    const [wordFade, setWordFade] = useState(true)
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)


    useEffect(() => {
        fetch('/api/admin/media?type=hero-video&page=home')
            .then(r => r.json())
            .then((data: HeroVideo[]) => {
                if (data.length > 0) setVideos(data);
            })
            .catch(() => { });
    }, []);

    // Start the first video once loaded
    useEffect(() => {
        if (videos.length === 0) return
        const videoA = videoARef.current
        if (!videoA) return

        videoA.src = videos[0].url
        videoA.load()
        videoA.play().catch(() => { })
        setActiveSlot('A')

        // Schedule crossfade to next video (if multiple)
        if (videos.length > 1) {
            const durationMs = (videos[0].duration || 10) * 1000
            videoTimerRef.current = setTimeout(() => crossfadeToNext(0), durationMs)
        }

        return () => {
            if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videos])

    // Crossfade: preload next video in inactive slot, then swap
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


    // Manual dot click
    const jumpToVideo = useCallback((idx: number) => {
        if (idx === currentIdx) return
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

        // Reschedule auto-rotation from this video
        if (videos.length > 1) {
            const durationMs = (videos[idx].duration || 10) * 1000
            if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
            videoTimerRef.current = setTimeout(() => crossfadeToNext(idx), durationMs)
        }
    }, [currentIdx, videos, crossfadeToNext])

    // Rotate highlight word every 3s
    useEffect(() => {
        const interval = setInterval(() => {
            setWordFade(false)
            setTimeout(() => {
                setWordIdx(prev => (prev + 1) % ROTATING_WORDS.length)
                setWordFade(true)
            }, 400)
        }, 3000)
        return () => clearInterval(interval)
    }, [ROTATING_WORDS])

    return (
        <>
            {/* ═══ FIXED VIDEO BACKGROUND — always rendered ═══ */}
            <div style={{
                position: 'fixed',
                inset: 0,  /* immune to dvh reflow — fixes iOS Safari address-bar shake */
                zIndex: 0,
                background: '#0d0f14',
                height: '100dvh',
            }}>
                <video
                    ref={videoARef}
                    autoPlay muted playsInline loop
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: videos.length > 0 && activeSlot === 'A' ? 0.85 : 0,
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
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: videos.length > 0 && activeSlot === 'B' ? 0.85 : 0,
                        transition: 'opacity 1.2s ease-in-out',
                        zIndex: activeSlot === 'B' ? 1 : 0,
                    }}
                />
            </div>

            {/* ═══ FIXED GRADIENT OVERLAY — covers the viewport over the video ═══ */}
            <div style={{
                position: 'fixed',
                inset: 0,  /* immune to dvh reflow — fixes iOS Safari address-bar shake */
                zIndex: 0,
                height: '100dvh',
                background: 'linear-gradient(180deg, rgba(13,15,20,0.05) 0%, rgba(13,15,20,0.1) 40%, rgba(13,15,20,0.35) 70%, rgba(13,15,20,0.85) 100%)',
                pointerEvents: 'none',
            }} />

            {/* ═══ HERO CONTENT — scrolls away as user scrolls ═══ */}
            <section style={{
                position: 'relative',
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                zIndex: 1,
            }}>
                {/* Fallback hero-bg for when no videos exist (keeps existing particles/glow) */}
                {videos.length === 0 && (
                    <div className="hero-bg">
                        <div className="hero-bg-overlay" />
                        <div className="hero-bg-glow" />
                    </div>
                )}

                {/* Floating ambient particles — desktop only (infinite animation + box-shadow = GPU heat on mobile) */}
                <div className="desktop-only" aria-hidden="true">
                    <div style={{
                        position: 'absolute', top: '15%', right: '20%',
                        width: '3px', height: '3px',
                        background: 'var(--accent-gold)', borderRadius: '50%',
                        opacity: 0.4, animation: 'float 6s ease-in-out infinite',
                        boxShadow: '0 0 20px rgba(212,168,83,0.3)',
                    }} />
                    <div style={{
                        position: 'absolute', top: '40%', right: '10%',
                        width: '2px', height: '2px',
                        background: 'var(--accent-gold)', borderRadius: '50%',
                        opacity: 0.25, animation: 'float 8s ease-in-out infinite 1s',
                        boxShadow: '0 0 15px rgba(212,168,83,0.2)',
                    }} />
                    <div style={{
                        position: 'absolute', top: '60%', right: '35%',
                        width: '2px', height: '2px',
                        background: 'var(--accent-gold)', borderRadius: '50%',
                        opacity: 0.2, animation: 'float 10s ease-in-out infinite 2s',
                        boxShadow: '0 0 12px rgba(212,168,83,0.15)',
                    }} />
                </div>

                <div className="hero-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <span className="text-label animate-fade-in-up" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
                        {t('label')}
                    </span>

                    <h1 className="animate-fade-in-up delay-1" style={{
                        fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
                        marginBottom: 'var(--space-sm)',
                        fontWeight: 800,
                        lineHeight: 1.15,
                    }}>
                        {t('title', { accent: '' })}{' '}
                        <span style={{
                            display: 'inline-grid',
                            verticalAlign: 'baseline',
                        }}>
                            {/* All words in same grid cell — container sizes to widest */}
                            {ROTATING_WORDS.map((word: string, i: number) => (
                                <span key={i} style={{
                                    gridRow: 1,
                                    gridColumn: 1,
                                    fontFamily: 'var(--font-serif)',
                                    fontStyle: 'italic',
                                    whiteSpace: 'nowrap',
                                    background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    opacity: i === wordIdx && wordFade ? 1 : 0,
                                    transform: i === wordIdx && wordFade ? 'translateY(0)' : 'translateY(8px)',
                                    transition: 'opacity 0.4s ease, transform 0.4s ease',
                                }}>{word}</span>
                            ))}
                        </span>{' '}
                        <br />
                        {t('titleSuffix')}
                    </h1>

                    <div className="hero-actions hero-cta-row animate-fade-in-up delay-2" style={{ marginBottom: 'var(--space-xl)' }}>
                        <Link href="/works" prefetch={false} className="btn btn-primary btn-lg">
                            {t('cta')}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </Link>
                        {castingEnabled && (
                            <Link href="/casting" prefetch={false} className="btn btn-secondary btn-lg">
                                {t('ctaCasting')}
                            </Link>
                        )}
                    </div>

                    {/* Compact stats pill — matches Works page */}
                    <div className="hero-stats-pill animate-fade-in-up delay-4" style={{
                        display: 'inline-flex',
                        gap: 'var(--space-xl)',
                        padding: '0.6rem 1.5rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-subtle)',
                        backdropFilter: 'blur(12px)',
                    }}>
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{completedCount}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{th('films')}</span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{upcomingCount}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{th('upcomingStat')}</span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{openCastings}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{th('castingStat')}</span>
                        </div>
                    </div>

                    {/* Video navigation dots */}
                    {videos.length > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '6px',
                            marginTop: 'var(--space-md)',
                            width: '100%',
                        }}>
                            {videos.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => jumpToVideo(i)}
                                    style={{
                                        width: currentIdx === i ? '28px' : '6px',
                                        height: '6px',
                                        borderRadius: 'var(--radius-full)',
                                        border: 'none',
                                        background: currentIdx === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.25)',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        padding: 0,
                                    }}
                                    aria-label={`Play video ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </>
    )
}
