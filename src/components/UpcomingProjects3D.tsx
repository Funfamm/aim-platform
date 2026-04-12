'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import Scene3D from '@/components/Scene3D'
import { useTranslations, useLocale } from 'next-intl'

interface UpcomingProject {
    id: string
    title: string
    slug: string
    genre: string | null
    tagline: string | null
    description: string
    status: string
    coverImage: string | null
    translations: string | null
    castingCalls: {
        id: string
        roleName: string
        status: string
    }[]
}

interface HeroVideo {
    id: string
    url: string
    duration: number
}

export default function UpcomingProjects3D({ projects }: { projects: UpcomingProject[] }) {
    const t = useTranslations('upcomingHero')
    const locale = useLocale()
    const [videos, setVideos] = useState<HeroVideo[]>([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
    const [mounted, setMounted] = useState(false)
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Page-entry fade-in
    useEffect(() => { setMounted(true) }, [])

    // Fetch videos from admin-controlled API
    useEffect(() => {
        fetch('/api/admin/media?type=hero-video&page=upcoming')
            .then(r => r.json())
            .then((data: HeroVideo[]) => {
                if (data.length > 0) setVideos(data)
            })
            .catch(() => { })
    }, [])

    // Video crossfade logic (same pattern as Works page)
    useEffect(() => {
        if (videos.length === 0) return
        const videoA = videoARef.current
        if (!videoA) return

        videoA.src = videos[0].url
        videoA.play().catch(() => { })

        const scheduleNext = (duration: number) => {
            if (timerRef.current) clearTimeout(timerRef.current)
            const switchTime = Math.max((duration - 1.5) * 1000, 3000)
            timerRef.current = setTimeout(() => {
                const nextIdx = (currentIdx + 1) % videos.length
                const nextSlot = activeSlot === 'A' ? 'B' : 'A'
                const nextRef = nextSlot === 'A' ? videoARef : videoBRef
                if (nextRef.current) {
                    nextRef.current.src = videos[nextIdx].url
                    nextRef.current.play().catch(() => { })
                }
                setActiveSlot(nextSlot)
                setCurrentIdx(nextIdx)
            }, switchTime)
        }

        videoA.onloadedmetadata = () => scheduleNext(videoA.duration)
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videos])

    useEffect(() => {
        if (videos.length <= 1) return
        const currentRef = activeSlot === 'A' ? videoARef : videoBRef
        const vid = currentRef.current
        if (!vid) return
        const scheduleNext = () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            const switchTime = Math.max((vid.duration - 1.5) * 1000, 3000)
            timerRef.current = setTimeout(() => {
                const nextIdx = (currentIdx + 1) % videos.length
                const nextSlot = activeSlot === 'A' ? 'B' : 'A'
                const nextRef = nextSlot === 'A' ? videoARef : videoBRef
                if (nextRef.current) {
                    nextRef.current.src = videos[nextIdx].url
                    nextRef.current.play().catch(() => { })
                }
                setActiveSlot(nextSlot)
                setCurrentIdx(nextIdx)
            }, switchTime)
        }
        vid.onloadedmetadata = () => scheduleNext()
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [activeSlot, currentIdx, videos])

    const jumpToVideo = useCallback((idx: number) => {
        if (idx === currentIdx) return
        const nextSlot = activeSlot === 'A' ? 'B' : 'A'
        const nextRef = nextSlot === 'A' ? videoARef : videoBRef
        if (nextRef.current) {
            nextRef.current.src = videos[idx].url
            nextRef.current.play().catch(() => { })
        }
        setActiveSlot(nextSlot)
        setCurrentIdx(idx)
    }, [activeSlot, currentIdx, videos])

    if (projects.length === 0) {
        return (
            <div style={{
                overflowX: 'hidden', width: '100%',
                opacity: mounted ? 1 : 0,
                transition: 'opacity 0.4s ease',
            }}>
                <Scene3D />

                {/* ═══ FIXED VIDEO BACKGROUND ═══ */}
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0,
                    width: '100%', height: '100dvh',
                    zIndex: 0,
                    background: '#0d0f14',
                }}>
                    <video
                        ref={videoARef}
                        autoPlay muted playsInline
                        controlsList="nodownload"
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%', objectFit: 'cover',
                            opacity: videos.length > 0 && activeSlot === 'A' ? 1 : 0,
                            transition: 'opacity 1.2s ease-in-out',
                        }}
                    />
                    <video
                        ref={videoBRef}
                        autoPlay muted playsInline
                        controlsList="nodownload"
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%', objectFit: 'cover',
                            opacity: videos.length > 0 && activeSlot === 'B' ? 1 : 0,
                            transition: 'opacity 1.2s ease-in-out',
                        }}
                    />
                </div>

                {/* ═══ GRADIENT OVERLAY ═══ */}
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0,
                    width: '100%', height: '100dvh',
                    zIndex: 0,
                    background: 'linear-gradient(180deg, rgba(13,15,20,0.25) 0%, rgba(13,15,20,0.1) 25%, rgba(13,15,20,0.2) 50%, rgba(13,15,20,0.5) 75%, rgba(13,15,20,0.8) 100%)',
                    pointerEvents: 'none',
                }} />

                {/* ═══ HERO WITH EMPTY STATE ═══ */}
                <section style={{
                    position: 'relative',
                    height: '100dvh',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        position: 'relative', zIndex: 1,
                        textAlign: 'center', padding: '0 var(--space-md)',
                        maxWidth: 'min(650px, 100%)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 'var(--space-md)',
                    }}>
                        <span className="text-label animate-fade-in-up" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                        }}>
                            <span style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: 'var(--accent-gold)',
                                animation: 'pulse-gold 2s infinite',
                            }} />
                            {t('label')}
                        </span>

                        <h1 className="upcoming-hero-title animate-fade-in-up delay-1" style={{
                            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                            fontWeight: 800,
                            lineHeight: 1.1,
                        }}>
                            {t('title')}{' '}
                            <span style={{
                                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                                background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>{t('titleAccent')}</span>
                        </h1>

                        <div className="animate-fade-in-up delay-2" style={{ fontSize: '3rem' }}>🎬</div>
                        <p className="animate-fade-in-up delay-2" style={{
                            fontSize: '0.95rem', maxWidth: '440px', margin: '0 auto',
                            lineHeight: 1.6, textAlign: 'center', color: 'var(--text-secondary)',
                        }}>{t('noProjects')}</p>

                        {/* Video indicator dots */}
                        {videos.length > 1 && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--space-xs)' }}>
                                {videos.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => jumpToVideo(i)}
                                        style={{
                                            width: currentIdx === i ? '24px' : '6px', height: '6px',
                                            borderRadius: 'var(--radius-full)', border: 'none', padding: 0,
                                            cursor: 'pointer',
                                            background: currentIdx === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.25)',
                                            transition: 'all 0.3s ease',
                                        }}
                                        aria-label={`Play video ${i + 1}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        )
    }

    return (
        <div style={{
            overflowX: 'hidden', width: '100%',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease',
        }}>
            <Scene3D />

            {/* ═══ FIXED VIDEO BACKGROUND — always rendered ═══ */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100dvh',
                zIndex: 0,
                background: '#0d0f14',
            }}>
                <video
                    ref={videoARef}
                    autoPlay muted playsInline
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%', objectFit: 'cover',
                        opacity: videos.length > 0 && activeSlot === 'A' ? 1 : 0,
                        transition: 'opacity 1.2s ease-in-out',
                    }}
                />
                <video
                    ref={videoBRef}
                    autoPlay muted playsInline
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%', objectFit: 'cover',
                        opacity: videos.length > 0 && activeSlot === 'B' ? 1 : 0,
                        transition: 'opacity 1.2s ease-in-out',
                    }}
                />
            </div>

            {/* ═══ SINGLE FIXED GRADIENT OVERLAY ═══ */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100dvh',
                zIndex: 0,
                background: 'linear-gradient(180deg, rgba(13,15,20,0.25) 0%, rgba(13,15,20,0.1) 25%, rgba(13,15,20,0.2) 50%, rgba(13,15,20,0.5) 75%, rgba(13,15,20,0.8) 100%)',
                pointerEvents: 'none',
            }} />

            {/* ═══ FULL-SCREEN HERO ═══ */}
            <section style={{
                position: 'relative',
                height: '100dvh',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {/* Decorative corner frames */}
                <div style={{
                    position: 'absolute', top: '80px', left: '20px', width: '60px', height: '60px',
                    borderTop: '2px solid rgba(228,185,90,0.2)', borderLeft: '2px solid rgba(228,185,90,0.2)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', top: '80px', right: '20px', width: '60px', height: '60px',
                    borderTop: '2px solid rgba(228,185,90,0.2)', borderRight: '2px solid rgba(228,185,90,0.2)',
                    pointerEvents: 'none',
                }} />

                {/* Radial glow */}
                <div style={{
                    position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                    width: '700px', height: '700px',
                    background: 'radial-gradient(circle, rgba(228,185,90,0.06), transparent 65%)',
                    pointerEvents: 'none',
                }} />

                {/* Hero content */}
                <div style={{
                    position: 'relative', zIndex: 1,
                    textAlign: 'center', padding: '0 var(--space-md)',
                    maxWidth: 'min(650px, 100%)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 'var(--space-md)',
                }}>
                    <span className="text-label animate-fade-in-up" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}>
                        <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: 'var(--accent-gold)',
                            animation: 'pulse-gold 2s infinite',
                        }} />
                        {t('label')}
                    </span>

                    <h1 className="upcoming-hero-title animate-fade-in-up delay-1" style={{
                        fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                        fontWeight: 800,
                        lineHeight: 1.1,
                    }}>
                        {t('title')}{' '}
                        <span style={{
                            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                            background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}>{t('titleAccent')}</span>
                    </h1>

                    {/* Stats pill — same style as Works landing page */}
                    <div className="animate-fade-in-up delay-2" style={{
                        display: 'inline-flex',
                        gap: 'var(--space-xl)',
                        marginTop: 'var(--space-lg)',
                        padding: '0.6rem 1.5rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-subtle)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                    }}>
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                {projects.length}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>
                                {t('inPipeline')}
                            </span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {projects.filter(p => p.status === 'in-production').length}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>
                                {t('inProduction')}
                            </span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                {projects.reduce((sum, p) => sum + p.castingCalls.length, 0)}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>
                                {t('openRoles')}
                            </span>
                        </div>
                    </div>

                    {/* Scroll CTA */}
                    <a href="#projects" className="btn btn-primary btn-lg animate-fade-in-up delay-3" style={{ marginTop: 'var(--space-sm)' }}>
                        {t('explore')}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12l7 7 7-7" />
                        </svg>
                    </a>

                    {/* Video indicator dots */}
                    {videos.length > 1 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--space-xs)' }}>
                            {videos.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => jumpToVideo(i)}
                                    style={{
                                        width: currentIdx === i ? '24px' : '6px', height: '6px',
                                        borderRadius: 'var(--radius-full)', border: 'none', padding: 0,
                                        cursor: 'pointer',
                                        background: currentIdx === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.25)',
                                        transition: 'all 0.3s ease',
                                    }}
                                    aria-label={`Play video ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ═══ PROJECTS SECTION — scrolls over the fixed video ═══ */}
            <section id="projects" style={{
                position: 'relative',
                zIndex: 2,
            }}>
                {/* Gradient fade into solid dark */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '200px',
                    background: 'linear-gradient(180deg, transparent 0%, rgba(13,15,20,0.7) 50%, var(--bg-primary) 100%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }} />
                <div style={{
                    position: 'absolute',
                    top: '200px', left: 0, right: 0, bottom: 0,
                    background: 'var(--bg-primary)',
                    zIndex: 0,
                }} />

                <div style={{ position: 'relative', zIndex: 1, paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-5xl)' }}>
                    {/* Subtle top glow */}
                    <div style={{
                        position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
                        width: '500px', height: '120px',
                        background: 'radial-gradient(ellipse, rgba(228,185,90,0.04) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    <div className="container">
                        {/* Section header */}
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <div style={{
                                    width: '40px', height: '2px',
                                    background: 'linear-gradient(90deg, var(--accent-gold-light), var(--accent-gold))',
                                    margin: '0 auto var(--space-sm)',
                                    borderRadius: '2px',
                                }} />
                                <span className="text-label" style={{ display: 'block', marginBottom: '6px' }}>{t('sectionLabel')}</span>
                                <h2 style={{
                                    fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                                    fontWeight: 800,
                                    marginBottom: 'var(--space-xs)',
                                }}>
                                    {t('sectionTitle')}{' '}
                                    <span style={{
                                        fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                                        background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}>{t('sectionAccent')}</span>
                                </h2>
                                <p style={{
                                    fontSize: '0.9rem', color: 'var(--text-secondary)',
                                    maxWidth: '420px', margin: '0 auto', lineHeight: 1.6,
                                }}>
                                    {t('sectionDesc')}
                                </p>
                            </div>
                        </ScrollReveal3D>

                        {/* Project cards */}
                        <div className="form-grid-2col">
                            {projects.map((project, index) => {
                                const ptr = (() => {
                                    if (locale === 'en' || !project.translations) return null
                                    try { return JSON.parse(project.translations)?.[locale] || null } catch { return null }
                                })()
                                const pTitle = ptr?.title || project.title
                                const pGenre = ptr?.genre || project.genre
                                const pTagline = ptr?.tagline || project.tagline
                                const pDesc = ptr?.description || project.description
                                return (
                                <ScrollReveal3D
                                    key={project.id}
                                    direction={index % 2 === 0 ? 'left' : 'right'}
                                    delay={index * 100}
                                    distance={40}
                                    rotate={5}
                                >
                                    <div>
                                        <div style={{
                                            position: 'relative',
                                            borderRadius: 'var(--radius-lg)',
                                            overflow: 'hidden',
                                            border: '1px solid rgba(228,185,90,0.08)',
                                            background: 'rgba(18, 21, 28, 0.6)',
                                            backdropFilter: 'blur(16px)',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                                        }}>
                                            {/* Cover Image */}
                                            <div style={{
                                                position: 'relative',
                                                height: '200px',
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    backgroundImage: project.coverImage
                                                        ? `url(${project.coverImage})`
                                                        : 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center 25%',
                                                    transition: 'transform 0.6s ease',
                                                    filter: 'brightness(0.85)',
                                                }} />
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    background: 'linear-gradient(180deg, transparent 30%, rgba(18,21,28,0.95) 100%)',
                                                }} />
                                                <div style={{ position: 'absolute', top: 'var(--space-sm)', right: 'var(--space-sm)' }}>
                                                    <span className={`badge ${project.status === 'in-production' ? 'badge-gold' : 'badge-blue'}`}
                                                        style={{ fontSize: '0.6rem', padding: '3px 10px' }}>
                                                        {project.status === 'in-production' ? `🎬 ${t('inProduction')}` : `✨ ${t('comingSoon')}`}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: 'var(--space-sm)',
                                                    left: 'var(--space-md)',
                                                    right: 'var(--space-md)',
                                                }}>
                                                    <span style={{
                                                        fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.14em',
                                                        textTransform: 'uppercase' as const, color: 'var(--accent-gold)', opacity: 0.9,
                                                    }}>{pGenre}</span>
                                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, lineHeight: 1.2, marginTop: '2px' }}>
                                                        {pTitle}
                                                    </h3>
                                                </div>
                                            </div>

                                            {/* Content body */}
                                            <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
                                                {pTagline && (
                                                    <p style={{
                                                        fontFamily: 'var(--font-serif)',
                                                        fontStyle: 'italic',
                                                        fontSize: '0.85rem',
                                                        color: 'var(--accent-gold)',
                                                        marginBottom: 'var(--space-xs)',
                                                        lineHeight: 1.5,
                                                    }}>
                                                        &ldquo;{pTagline}&rdquo;
                                                    </p>
                                                )}
                                                <p style={{
                                                    fontSize: '0.8rem',
                                                    lineHeight: 1.6,
                                                    color: 'var(--text-secondary)',
                                                    marginBottom: 'var(--space-sm)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                } as React.CSSProperties}>
                                                    {pDesc}
                                                </p>

                                                {/* Casting pills */}
                                                {project.castingCalls.length > 0 && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center',
                                                        gap: '6px', flexWrap: 'wrap',
                                                        marginBottom: 'var(--space-sm)',
                                                    }}>
                                                        <span style={{
                                                            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                                                            textTransform: 'uppercase' as const, color: 'var(--accent-gold)',
                                                        }}>🎭 {project.castingCalls.length} {t('roles')}</span>
                                                        {project.castingCalls.slice(0, 3).map((call) => (
                                                            <span key={call.id} style={{
                                                                fontSize: '0.6rem', padding: '2px 8px',
                                                                borderRadius: 'var(--radius-full)',
                                                                background: 'rgba(228,185,90,0.1)',
                                                                border: '1px solid rgba(228,185,90,0.2)',
                                                                color: 'var(--accent-gold)',
                                                            }}>{call.roleName}</span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', gap: 'var(--space-sm)', position: 'relative', zIndex: 20 }}>
                                                    <Link
                                                        href={`/works/${project.slug}`}
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', flex: 1, textAlign: 'center' }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {t('details')}
                                                    </Link>
                                                    {project.castingCalls.length > 0 && (
                                                        <Link
                                                            href="/casting"
                                                            className="btn btn-primary btn-sm"
                                                            style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', flex: 1, textAlign: 'center' }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {t('applyNow')}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ScrollReveal3D>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
