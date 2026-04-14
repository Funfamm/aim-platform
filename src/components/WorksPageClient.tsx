'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Scene3D from '@/components/Scene3D'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'
import dynamic from 'next/dynamic'
import type { ProjectCard } from '@/components/mobile/MovieCard'

// Mobile-only components — code-split so desktop never loads them
const SearchBar        = dynamic(() => import('@/components/mobile/SearchBar'),         { ssr: false })
const MovieRow         = dynamic(() => import('@/components/mobile/MovieRow'),           { ssr: false })
const HoverPreviewCard = dynamic(() => import('@/components/desktop/HoverPreviewCard'), { ssr: false })

interface Project {
    id: string
    title: string
    slug: string
    genre: string | null
    tagline: string | null
    status: string
    projectType: string
    year: string | null
    duration: string | null
    coverImage: string | null
    trailerUrl: string | null
    filmUrl: string | null
    episodeCount: number
    translations: string | null
    // Required by ProjectCard / HoverPreviewCard:
    featured: boolean
    viewCount: number
}

interface HeroVideo {
    id: string
    url: string
    duration: number
}

interface WorksPageClientProps {
    projects: Project[]
    completedCount: number
    inProdCount: number
    genres: string[]  // distinct genres from DB for mobile filter chips
}

// ── Detects mobile viewport after hydration (SSR-safe) ──────────────────────
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        const mq = window.matchMedia('(max-width: 767px)')
        mq.addEventListener('change', check)
        return () => mq.removeEventListener('change', check)
    }, [])
    return isMobile
}

// ── Mobile row definitions ───────────────────────────────────────────────────
const FIXED_ROWS: Array<{ id: string; icon: string; title: string; query: Record<string, string | boolean | number> }> = [
    { id: 'featured',  icon: '★', title: 'Staff Picks',   query: { featured: true } },
    { id: 'trending',  icon: '🔥', title: 'Trending',     query: { sort: 'trending' } },
    { id: 'newest',    icon: '🆕', title: 'New Releases', query: { sort: 'newest'   } },
    { id: 'completed', icon: '✅', title: 'Now Available', query: { status: 'completed', sort: 'newest' } },
]

export default function WorksPageClient({ projects, completedCount, inProdCount, genres }: WorksPageClientProps) {
    const t = useTranslations('works')
    const locale = useLocale()
    const isMobile = useIsMobile()

    // ── Desktop hover card state ─────────────────────────────────────────────
    const [hoverProject, setHoverProject] = useState<Project | null>(null)
    const [hoverAnchor, setHoverAnchor]   = useState<DOMRect | null>(null)
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleCardHover = useCallback((project: Project, rect: DOMRect) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        // 500ms delay — prevents accidental trigger on mouse-over
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverProject(project)
            setHoverAnchor(rect)
        }, 500)
    }, [])

    const handleCardHoverEnd = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        // Don't immediately close — give user time to move mouse to the hover card
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverProject(null)
            setHoverAnchor(null)
        }, 300)
    }, [])

    const handleHoverCardClose = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        setHoverProject(null)
        setHoverAnchor(null)
    }, [])

    useEffect(() => () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }, [])

    const [videos, setVideos] = useState<HeroVideo[]>([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
    const [mounted, setMounted] = useState(false)
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)


    // Page-entry fade-in
    useEffect(() => { setMounted(true) }, [])

    // Fetch videos from admin-controlled API
    useEffect(() => {
        fetch('/api/admin/media?type=hero-video&page=works')
            .then(r => r.json())
            .then((data: HeroVideo[]) => {
                if (data.length > 0) setVideos(data)
            })
            .catch(() => { })
    }, [])

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

    return (
        <main id="main-content" style={{
            overflowX: 'hidden', width: '100%',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease',
        }}>
            {/* 3D Particle Background */}
            <Scene3D />

            {/* ═══ FIXED VIDEO BACKGROUND — always rendered dark base + crossfading video slots ═══ */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100dvh',
                zIndex: 0,
                background: '#0d0f14',
            }}>
                {/* Static poster shown until first video loads */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'url(/images/works-bg.png)',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    opacity: videos.length === 0 ? 0.3 : 0,
                    transition: 'opacity 0.8s ease',
                }} />
                <video
                    ref={videoARef}
                    autoPlay muted playsInline loop
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    poster="/images/works-bg.png"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
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
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: videos.length > 0 && activeSlot === 'B' ? 1 : 0,
                        transition: 'opacity 1.2s ease-in-out',
                        zIndex: activeSlot === 'B' ? 1 : 0,
                    }}
                />
            </div>

            {/* ═══ SINGLE FIXED GRADIENT OVERLAY — covers the entire viewport over the video ═══ */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100dvh',
                zIndex: 0,
                background: 'linear-gradient(180deg, rgba(13,15,20,0.25) 0%, rgba(13,15,20,0.1) 25%, rgba(13,15,20,0.2) 50%, rgba(13,15,20,0.5) 75%, rgba(13,15,20,0.8) 100%)',
                pointerEvents: 'none',
            }} />

            {/* ═══ HERO CONTENT — scrolls away as user scrolls ═══ */}
            <section style={{
                position: 'relative',
                height: '100dvh',
                overflow: 'hidden',
                zIndex: 1,
            }}>
                {/* Content overlay — sits on top of the video */}
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 1,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 'var(--space-xl)',
                    paddingTop: '120px', paddingBottom: 'var(--space-3xl)',
                }}>

                    {/* Radial Glow */}
                    <div style={{
                        position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                        width: '700px', height: '700px',
                        background: 'radial-gradient(circle, rgba(228,185,90,0.06), transparent 65%)',
                        pointerEvents: 'none',
                    }} />

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

                    {/* Cinematic scan lines */}
                    <div style={{
                        position: 'absolute', top: '25%', left: 0, right: 0, height: '1px',
                        background: 'linear-gradient(90deg, transparent 5%, rgba(228,185,90,0.05) 30%, rgba(228,185,90,0.05) 70%, transparent 95%)',
                    }} />
                    <div style={{
                        position: 'absolute', top: '75%', left: 0, right: 0, height: '1px',
                        background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.03) 70%, transparent 95%)',
                    }} />

                    {/* Title & Subtitle */}
                    <div style={{
                        position: 'relative', zIndex: 1,
                        textAlign: 'center',
                        maxWidth: 'min(700px, 100%)',
                        padding: '0 var(--space-md)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span className="text-label animate-fade-in-up" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            marginBottom: 'var(--space-sm)',
                        }}>
                            <span style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: 'var(--accent-gold)',
                                animation: 'pulse-gold 2s infinite',
                            }} />
                            {t('label')}
                        </span>

                        <h1 className="animate-fade-in-up delay-1" style={{
                            fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)',
                            fontWeight: 800,
                            marginBottom: 'var(--space-sm)',
                            lineHeight: 1.15,
                        }}>
                            {t('title')}{' '}
                            <span style={{
                                fontFamily: 'var(--font-serif)',
                                fontStyle: 'italic',
                                background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>{t('titleAccent')}</span>
                        </h1>

                        {/* Compact stats pill */}
                        <div className="hero-stats-pill animate-fade-in-up delay-2" style={{
                            display: 'inline-flex',
                            gap: 'var(--space-xl)',
                            marginTop: 'var(--space-lg)',
                            padding: '0.6rem 1.5rem',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-subtle)',
                            backdropFilter: 'blur(12px)',
                        }}>
                            <div>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{projects.length}</span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{t('all')}</span>
                            </div>
                            <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                            <div>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{completedCount}</span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{t('completed')}</span>
                            </div>
                            <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                            <div>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{inProdCount}</span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{t('inProd')}</span>
                            </div>
                        </div>
                    </div>

                    {/* CTA + Video Dots */}
                    <div style={{
                        position: 'relative', zIndex: 1,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 'var(--space-md)',
                    }}>
                        <a href="#projects" className="btn btn-primary btn-lg animate-fade-in-up delay-3">
                            {t('viewDetails')}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12l7 7 7-7" />
                            </svg>
                        </a>

                        {videos.length > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
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
                </div>
            </section>

            {/* ═══ PROJECTS GALLERY — scrolls over the video ═══ */}
            <section id="projects" style={{
                position: 'relative',
                zIndex: 2,
                marginTop: '-30px',
            }}>
                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    paddingTop: 'var(--space-3xl)',
                    paddingBottom: 'var(--space-3xl)',
                }}>
                    <div className="container">
                        {/* Section Header */}
                        <div style={{
                            textAlign: 'center',
                            marginBottom: 'var(--space-xl)',
                            position: 'relative',
                        }}>
                            <div style={{
                                width: '40px',
                                height: '2px',
                                background: 'linear-gradient(90deg, var(--accent-gold-light), var(--accent-gold))',
                                margin: '0 auto var(--space-sm)',
                                borderRadius: '2px',
                            }} />
                            <span className="text-label" style={{ display: 'block', marginBottom: '6px' }}>{t('label')}</span>
                            <h2 style={{
                                fontSize: 'clamp(1.8rem, 4.5vw, 2.6rem)',
                                fontWeight: 800,
                                marginBottom: 'var(--space-xs)',
                            }}>
                                {t('title')}{' '}
                                <span style={{
                                    fontFamily: 'var(--font-serif)',
                                    fontStyle: 'italic',
                                    background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}>{t('titleAccent')}</span>
                            </h2>
                            <p style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-secondary)',
                                maxWidth: '420px',
                                margin: '0 auto',
                                lineHeight: 1.6,
                            }}>
                                {t('description')}
                            </p>
                        </div>

                        {projects.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-4xl) 0' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🎬</div>
                                <h3 style={{ marginBottom: 'var(--space-sm)' }}>{t('title')}</h3>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem', maxWidth: '440px', margin: '0 auto', lineHeight: 1.6, textAlign: 'center' }}>
                                    {t('description')}
                                </p>
                            </div>
                        ) : isMobile ? (
                            // ═══ MOBILE — Netflix-style categorized rows ═══
                            <div>
                                <SearchBar />

                                {/* Fixed rows: Featured, Trending, New, Completed */}
                                {FIXED_ROWS.map(row => (
                                    <MovieRow
                                        key={row.id}
                                        title={row.title}
                                        icon={row.icon}
                                        query={row.query}
                                        locale={locale}
                                    />
                                ))}

                                {/* Dynamic genre rows — one per distinct genre */}
                                {genres.map(genre => (
                                    <MovieRow
                                        key={genre}
                                        title={genre}
                                        icon="🎭"
                                        query={{ genre, sort: 'trending' }}
                                        locale={locale}
                                    />
                                ))}
                            </div>
                        ) : (
                            // ═══ DESKTOP — existing grid with hover preview ═══
                            <div className="works-grid">
                                {projects.map((project, index) => {
                                    const loc = getLocalizedProject(project, locale)
                                    return (
                                    <ScrollReveal3D key={project.id} direction="up" delay={index * 120} distance={40}>
                                        <div
                                            className="project-card"
                                            onMouseEnter={e => handleCardHover(project, e.currentTarget.getBoundingClientRect())}
                                            onMouseLeave={handleCardHoverEnd}
                                            style={{
                                                aspectRatio: '16/10',
                                                borderRadius: 'var(--radius-lg)',
                                                position: 'relative',
                                                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            }}
                                        >
                                            {/* Clickable image area -> project detail */}
                                            <Link
                                                href={`/works/${project.slug}`}
                                                aria-label={`View project ${loc.title}`}
                                                style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                                            >
                                                <div
                                                    className="project-card-image"
                                                    style={{
                                                        backgroundImage: project.coverImage
                                                            ? `url(${project.coverImage})`
                                                            : 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                                                    }}
                                                />
                                                <div className="project-card-overlay" />
                                            </Link>

                                            {/* Content overlay */}
                                            <div className="project-card-content" style={{ padding: 'var(--space-sm) var(--space-md)', zIndex: 2, pointerEvents: 'none' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                    <span style={{
                                                        fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.14em',
                                                        textTransform: 'uppercase' as const, color: 'var(--accent-gold)',
                                                    }}>{loc.genre}</span>
                                                    {project.status === 'completed' && (
                                                        <span style={{
                                                            fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em',
                                                            textTransform: 'uppercase' as const,
                                                            color: 'var(--color-success)',
                                                            background: 'rgba(52,211,153,0.1)',
                                                            padding: '1px 5px',
                                                            borderRadius: 'var(--radius-full)',
                                                            border: '1px solid rgba(52,211,153,0.2)',
                                                        }}>{t('completed')}</span>
                                                    )}
                                                    {project.status === 'in-production' && (
                                                        <span style={{
                                                            fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em',
                                                            textTransform: 'uppercase' as const,
                                                            color: 'var(--accent-gold)',
                                                            background: 'rgba(212,168,83,0.1)',
                                                            padding: '1px 5px',
                                                            borderRadius: 'var(--radius-full)',
                                                            border: '1px solid rgba(212,168,83,0.2)',
                                                        }}>{t('inProduction')}</span>
                                                    )}
                                                    {project.status === 'upcoming' && (
                                                        <span style={{
                                                            fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em',
                                                            textTransform: 'uppercase' as const,
                                                            color: 'var(--color-info)',
                                                            background: 'rgba(96,165,250,0.1)',
                                                            padding: '1px 5px',
                                                            borderRadius: 'var(--radius-full)',
                                                            border: '1px solid rgba(96,165,250,0.2)',
                                                        }}>{t('upcoming')}</span>
                                                    )}
                                                    {project.projectType === 'series' && (
                                                        <span style={{
                                                            fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em',
                                                            textTransform: 'uppercase' as const,
                                                            color: 'var(--color-info)',
                                                            background: 'rgba(96,165,250,0.1)',
                                                            padding: '1px 5px',
                                                            borderRadius: 'var(--radius-full)',
                                                            border: '1px solid rgba(96,165,250,0.2)',
                                                        }}>{t('series')}</span>
                                                    )}
                                                </div>
                                                <h3 style={{ fontSize: '0.95rem', marginBottom: '1px', fontWeight: 700 }}>{loc.title}</h3>
                                                <p style={{ fontSize: '0.7rem', lineHeight: 1.3 }}>{loc.tagline}</p>
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '3px', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                                    {project.year && <span>{project.year}</span>}
                                                    {project.duration && <span>• {project.duration}</span>}
                                                </div>

                                                {/* ── Media Action Buttons ── */}
                                                <div style={{
                                                    display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px',
                                                    pointerEvents: 'auto',
                                                }}>
                                                    {project.trailerUrl && (
                                                        <Link
                                                            href={`/works/${project.slug}#trailer`}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px',
                                                                borderRadius: 'var(--radius-full)',
                                                                background: 'rgba(212,168,83,0.15)',
                                                                border: '1px solid rgba(212,168,83,0.3)',
                                                                color: 'var(--accent-gold)',
                                                                textDecoration: 'none',
                                                                transition: 'all 0.2s',
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.3)' }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.15)' }}
                                                        >
                                                            ▶ {t('watchTrailer')}
                                                        </Link>
                                                    )}
                                                    {project.filmUrl && (
                                                        <Link
                                                            href={`/works/${project.slug}#watch`}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px',
                                                                borderRadius: 'var(--radius-full)',
                                                                background: 'rgba(52,211,153,0.12)',
                                                                border: '1px solid rgba(52,211,153,0.25)',
                                                                color: 'var(--color-success)',
                                                                textDecoration: 'none',
                                                                transition: 'all 0.2s',
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.25)' }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.12)' }}
                                                        >
                                                            🎬 {t('watchNow')}
                                                        </Link>
                                                    )}
                                                    {project.projectType === 'series' && project.episodeCount > 0 && (
                                                        <Link
                                                            href={`/works/${project.slug}#episodes`}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px',
                                                                borderRadius: 'var(--radius-full)',
                                                                background: 'rgba(96,165,250,0.12)',
                                                                border: '1px solid rgba(96,165,250,0.25)',
                                                                color: 'var(--color-info)',
                                                                textDecoration: 'none',
                                                                transition: 'all 0.2s',
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)' }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.12)' }}
                                                        >
                                                            📺 {project.episodeCount} {t('episodes')}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollReveal3D>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ═══ COMPACT CTA ═══ */}
            <ScrollReveal3D direction="up" distance={50} rotate={5}>
                <section style={{ position: 'relative', zIndex: 2, padding: '0 0 var(--space-3xl)' }}>
                    <div className="container">
                        <div className="works-cta-bar" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-lg) var(--space-2xl)',
                            background: 'rgba(212,168,83,0.03)',
                            border: '1px solid rgba(212,168,83,0.08)',
                            borderRadius: 'var(--radius-lg)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px',
                                background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.2), transparent)',
                            }} />
                            <div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)' }}>
                                    {t('label')}
                                </span>
                                <h3 style={{ fontSize: '1.1rem', marginTop: '2px' }}>
                                    {t('viewDetails')} <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{t('film')}</span>
                                </h3>
                            </div>
                            <Link href="/casting" className="btn btn-primary btn-sm">
                                {t('viewDetails')} →
                            </Link>
                        </div>
                    </div>
                </section>
            </ScrollReveal3D>

            {/* ═══ DESKTOP HOVER PREVIEW CARD — Portal ═══ */}
            {hoverProject && hoverAnchor && !isMobile && (
                <HoverPreviewCard
                    project={hoverProject as unknown as ProjectCard}
                    anchor={hoverAnchor}
                    locale={locale}
                    onClose={handleHoverCardClose}
                />
            )}
        </main>
    )
}
