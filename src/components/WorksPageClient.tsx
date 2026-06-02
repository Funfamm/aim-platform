'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react'
import HeroBackground from '@/components/HeroBackground'
import { Link } from '@/i18n/navigation'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import dynamic from 'next/dynamic'
import type { ProjectCard } from '@/components/mobile/MovieCard'
import MobileCardCarousel from '@/components/MobileCardCarousel'
import MobileFeaturedWorkCard from '@/components/MobileFeaturedWorkCard'

// Code-split heavy/desktop-only components so mobile never downloads them
const Scene3D          = dynamic(() => import('@/components/Scene3D'),                  { ssr: false, loading: () => null })
const SearchBar        = dynamic(() => import('@/components/mobile/SearchBar'),         { ssr: false })
const RollRow          = dynamic(() => import('@/components/mobile/RollRow'),            { ssr: false })
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
    featuredWorks: boolean
    viewCount: number
    castingCalls?: { id: string }[]
}

interface WorksPageClientProps {
    projects: Project[]
    completedCount: number
    inProdCount: number
    genres: string[]  // distinct genres from DB for mobile filter chips
    rolls?: Array<{
        id: string
        title: string
        titleI18n: string | null
        icon: string
        slug: string
        projects: Project[]
    }>
    overrides?: string | null
}


// ── Detects mobile viewport after hydration (SSR-safe) ──────────────────────



export default function WorksPageClient({ projects, completedCount, inProdCount, rolls = [], overrides }: WorksPageClientProps) {
    const t = useTranslations('works')
    const locale = useLocale()

    // Parse overrides
    const wpd = (() => {
        if (!overrides) return null
        try {
            const data = JSON.parse(overrides)
            // Handle translations
            if (locale !== 'en' && data.translations?.[locale]) {
                return { ...data, ...data.translations[locale] }
            }
            return data
        } catch { return null }
    })()

    const isMobile = useIsMobile()
    useScrollRestoration('works')

    // FIXED_ROWS removed — mobile shows only admin-curated rolls

    // ── Featured project cover URLs for the desktop hero rotation ───────────
    // Projects from server props are stable — useMemo with empty deps is safe here.
    // featuredWorks covers appear at the front of HeroBackground's image slideshow.
    const featuredWorkCovers = useMemo(
        () => projects.filter(p => p.featuredWorks && p.coverImage).map(p => p.coverImage as string),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    // ── Desktop hover card state ─────────────────────────────────────────────
    const [hoverProject, setHoverProject] = useState<Project | null>(null)
    const [hoverAnchor, setHoverAnchor]   = useState<DOMRect | null>(null)
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleCardHover = useCallback((project: Project, rect: DOMRect) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        // 300ms delay — fast enough to feel responsive, slow enough to prevent accidental trigger
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverProject(project)
            setHoverAnchor(rect)
        }, 300)
    }, [])

    const handleCardHoverEnd = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        // 1200ms grace — plenty of time to move cursor into the expanded preview card.
        // The bridge overlay's onMouseEnter will cancel this if cursor arrives in time.
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverProject(null)
            setHoverAnchor(null)
        }, 1200)
    }, [])

    // Called when cursor enters the bridge div of HoverPreviewCard —
    // immediately cancels any pending close timer so the preview stays alive.
    const handleHoverKeepAlive = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
        }
    }, [])

    const handleHoverCardClose = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        setHoverProject(null)
        setHoverAnchor(null)
    }, [])

    useEffect(() => () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }, [])

    // Page-entry fade-in — useSyncExternalStore gives a stable client-only boolean
    // without calling setState inside an effect (avoids react-hooks/set-state-in-effect).
    const mounted = useSyncExternalStore(
        () => () => {},           // no-op subscribe
        () => true,               // client snapshot  → true
        () => false,              // server snapshot  → false
    )

    // HeroBackground state — drives the video dots
    const [currentIdx, setCurrentIdx] = useState(0)
    const [videoCount, setVideoCount] = useState(0)
    const jumpToVideoRef = useRef<((idx: number) => void) | null>(null)

    // Per-roll strip refs for desktop scroll buttons (keyed by roll.id)
    const rollStripRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const scrollRoll = useCallback((rollId: string, dir: 'left' | 'right') => {
        const el = rollStripRefs.current.get(rollId)
        if (el) el.scrollBy({ left: dir === 'right' ? 296 : -296, behavior: 'smooth' })
    }, [])

    const handleVideoChange = useCallback((idx: number, total: number) => {
        setCurrentIdx(idx)
        setVideoCount(total)
    }, [])

    return (
        <main id="main-content" style={{
            // Mobile: render immediately — PageTransition handles the visual
            // entrance; adding a second opacity fade creates a double-flash.
            // Desktop: gentle 0.15s entrance fade (no PageTransition crossfade).
            opacity: (isMobile || mounted) ? 1 : 0,
            transition: isMobile ? 'none' : 'opacity 0.15s ease',
            // Mobile containment: opaque background prevents any layer
            // (e.g. desktop HeroBackground at position:fixed, z-index:0)
            // from bleeding through during the useIsMobile hydration window.
            // isolation creates a stacking context so internal z-index values
            // don't escape the Works page container.
            ...(isMobile ? {
                background: 'var(--bg-primary, #0d0f14)',
                isolation: 'isolate' as const,
            } : {}),
        }}>
            {/* 3D Particle Background */}
            <Scene3D />

            {/* ═══ HERO — mobile: contained card | desktop: full-screen fixed ═══ */}
            {/*
              * CSS guard: .wpc-desktop-only is hidden on touch devices via the media
              * query below. This prevents the desktop HeroBackground (position:fixed)
              * from flashing during the useIsMobile() hydration window on mobile.
              */}
            <style>{`
                @media (hover: none) and (pointer: coarse) {
                    .wpc-desktop-only { display: none !important; }
                    /* Opaque containment from first paint — prevents project cards
                       from flashing through transparent layers before JS hydrates
                       and useIsMobile() resolves. */
                    #main-content {
                        background: var(--bg-primary, #0d0f14) !important;
                        isolation: isolate;
                    }
                }
            `}</style>

            {isMobile ? (
                (() => {
                    const heroProjects = projects.filter(p => p.featuredWorks).slice(0, 6)
                    const carouselProjects = heroProjects.length > 0 ? heroProjects : projects.slice(0, 4)
                    const cardStyle: React.CSSProperties = {
                        position: 'relative',
                        height: 'calc(100dvh - 148px)',
                        minHeight: '420px', maxHeight: '700px',
                        marginTop: '64px', marginLeft: '12px', marginRight: '12px', marginBottom: '8px',
                        borderRadius: '20px', overflow: 'hidden', background: '#0d0f14',
                    }
                    if (carouselProjects.length > 0) {
                        return (
                            // Carousel: project covers fill the card — no extra HeroBackground fetch
                            // so no secondary fade-in animation fires inside an already-animating card.
                            <section aria-label="Hero" style={cardStyle}>
                                <MobileCardCarousel autoRotateMs={5000}>
                                    {carouselProjects.map((project, i) => (
                                        <MobileFeaturedWorkCard
                                            key={project.id}
                                            work={{
                                                title: project.title,
                                                slug: project.slug,
                                                genre: project.genre,
                                                year: project.year,
                                                status: project.status,
                                                coverImage: project.coverImage,
                                                trailerUrl: project.trailerUrl,
                                                filmUrl: project.filmUrl,
                                                translations: project.translations,
                                                castingCalls: project.castingCalls ?? [],
                                            }}
                                            priority={i === 0}
                                        />
                                    ))}
                                </MobileCardCarousel>
                            </section>
                        )
                    }
                    // Fallback: no projects — branded hero with admin background
                    return (
                        <section aria-label="Hero" style={cardStyle}>
                            <HeroBackground page="works" isMobile={true} cardMode={true}
                                poster="/images/works-bg.png" className="works-video-bg"
                                allowMobileVideo={true}
                                onVideoChange={handleVideoChange} jumpToVideoRef={jumpToVideoRef} />
                            <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                                background: 'linear-gradient(180deg, rgba(13,15,20,0.08) 0%, rgba(13,15,20,0.05) 30%, rgba(13,15,20,0.55) 60%, rgba(13,15,20,0.92) 85%, rgba(13,15,20,0.98) 100%)' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 6, padding: '0 20px 20px' }}>
                                <span className="text-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '8px', fontSize: '0.62rem' }}>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-gold)' }} />
                                    {wpd?.heroLabel || t('label')}
                                </span>
                                <h1 style={{ fontSize: 'clamp(1.7rem, 6vw, 2.2rem)', fontWeight: 800, lineHeight: 1.15, margin: '0 0 8px' }}>
                                    {wpd?.heroTitle || t('title')}{' '}
                                    <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                                        background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                        {wpd?.heroAccent || t('titleAccent')}
                                    </span>
                                </h1>
                                <a href="#films-grid" className="btn btn-primary" style={{ display: 'inline-flex', justifyContent: 'center', fontSize: '0.82rem', padding: '0.6rem 1rem' }}>
                                    {wpd?.heroCta || t('watchNow')}
                                </a>
                            </div>
                        </section>
                    )
                })()
            ) : (
                /* ── Desktop: full-screen fixed background + hero section ── */
                /* wpc-desktop-only: CSS hides this on touch devices (see style above) */
                <div className="wpc-desktop-only">
                    <HeroBackground page="works" isMobile={isMobile} poster="/images/works-bg.png"
                        className="works-video-bg" allowMobileVideo={true}
                        extraImages={featuredWorkCovers}
                        onVideoChange={handleVideoChange} jumpToVideoRef={jumpToVideoRef} />
                    <section style={{ position: 'relative', height: '100dvh', zIndex: 1 }}>
                        <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xl)', paddingTop: '120px', paddingBottom: 'var(--space-3xl)' }}>
                            <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(228,185,90,0.06), transparent 65%)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', top: '80px', left: '20px', width: '60px', height: '60px', borderTop: '2px solid rgba(228,185,90,0.2)', borderLeft: '2px solid rgba(228,185,90,0.2)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', top: '80px', right: '20px', width: '60px', height: '60px', borderTop: '2px solid rgba(228,185,90,0.2)', borderRight: '2px solid rgba(228,185,90,0.2)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 5%, rgba(228,185,90,0.05) 30%, rgba(228,185,90,0.05) 70%, transparent 95%)' }} />
                            <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.03) 70%, transparent 95%)' }} />
                            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 'min(700px, 100%)', padding: '0 var(--space-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="text-label animate-fade-in-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-sm)' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-gold)', animation: 'pulse-gold 2s infinite' }} />
                                    {wpd?.heroLabel || t('label')}
                                </span>
                                <h1 className="animate-fade-in-up delay-1" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, textAlign: 'center', marginBottom: 'var(--space-sm)', lineHeight: 1.15 }}>
                                    {wpd?.heroTitle || t('title')}{' '}
                                    <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{wpd?.heroAccent || t('titleAccent')}</span>
                                </h1>
                                <p className="animate-fade-in-up delay-2" style={{ fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)', lineHeight: 1.7, color: 'var(--text-secondary)', maxWidth: '480px', textAlign: 'center', marginBottom: 'var(--space-sm)' }}>{wpd?.heroDesc || t('description')}</p>
                                <div className="hero-stats-pill animate-fade-in-up delay-2" style={{ display: 'inline-flex', gap: 'var(--space-xl)', marginTop: 'var(--space-lg)', padding: '0.6rem 1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
                                    <div><span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{projects.length}</span><span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{t('all')}</span></div>
                                    <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                                    <div><span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{completedCount}</span><span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{t('completed')}</span></div>
                                    <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                                    <div><span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{inProdCount}</span><span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>{t('inProd')}</span></div>
                                </div>
                            </div>
                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <a href="#films-grid" className="btn btn-primary btn-lg animate-fade-in-up delay-3">
                                    {wpd?.heroCta || t('watchNow')}
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
                                </a>
                                {videoCount > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                        {Array.from({ length: videoCount }, (_, i) => (
                                            <button key={i} onClick={() => jumpToVideoRef.current?.(i)} aria-label={`Play video ${i + 1}`}
                                                style={{ width: currentIdx === i ? '28px' : '6px', height: '6px', borderRadius: 'var(--radius-full)', border: 'none', background: currentIdx === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.25)', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {/* ═══ PROJECTS GALLERY — scrolls over the video (desktop) or below card (mobile) ═══ */}
            <section id="films-grid" style={{
                position: 'relative',
                zIndex: 2,
                marginTop: isMobile ? '0px' : '-30px',
            }}>
                {/* Dark overlay behind cards — full-bleed, connects into footer */}
                {/* NOTE: do NOT set both left AND right here — RTL mode overrides `left` to auto
                    when all three (left, right, width) are set, shifting the overlay off-screen.
                    Use only left:50% + width:100dvw + translateX(-50%) to centre in both directions.
                    dvw (dynamic viewport width) re-evaluates after orientation change on mobile;
                    plain vw can be stale and keep landscape width after rotating back to portrait. */}
                <div style={{
                    position: 'absolute',
                    top: 0, bottom: 0,
                    left: '50%',
                    width: '100dvw',
                    transform: 'translateX(-50%)',
                    // Mobile: start fully opaque so project cards never flash through
                    // the transparent gap at the top of the overlay during first paint.
                    // Desktop: keep the cinematic transparent→dark gradient for the
                    // scroll-over-hero parallax effect.
                    background: isMobile
                        ? 'linear-gradient(180deg, rgba(13,15,20,0.97) 0%, var(--bg-primary) 15%)'
                        : 'linear-gradient(180deg, transparent 0%, rgba(13,15,20,0.7) 6%, rgba(13,15,20,0.92) 15%, rgba(13,15,20,0.97) 30%, var(--bg-primary) 50%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }} />
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
                                {wpd?.heroDesc || t('description')}
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
                            // ═══ MOBILE — admin-curated rolls only ═══
                            <div>
                                <SearchBar />

                                {rolls.length > 0 ? (
                                    rolls.map(roll => (
                                        <RollRow
                                            key={roll.id}
                                            title={roll.title}
                                            titleI18n={roll.titleI18n}
                                            icon={roll.icon}
                                            projects={roll.projects as unknown as import('@/components/mobile/MovieCard').ProjectCard[]}
                                            locale={locale}
                                            onCardHover={handleCardHover as unknown as (p: import('@/components/mobile/MovieCard').ProjectCard, r: DOMRect) => void}
                                            onCardHoverEnd={handleCardHoverEnd}
                                        />
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', padding: 'var(--space-4xl) 0', color: 'var(--text-tertiary)' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>🎬</div>
                                        <p style={{ fontSize: '0.9rem' }}>No collections yet - check back soon.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // ═══ DESKTOP — roll-organized horizontal rows + flat grid fallback ═══
                            <>
                                <div style={{ maxWidth: '400px', marginLeft: 'auto', marginBottom: 'var(--space-lg)' }}>
                                    <SearchBar />
                                </div>

                                {rolls.length > 0 ? (
                                    /* ── Roll-organized view: each roll = named labeled horizontal scroll row ── */
                                    rolls.map((roll) => {
                                        // Resolve localized roll title
                                        let rollTitle = roll.title
                                        if (roll.titleI18n) {
                                            try {
                                                const parsed = JSON.parse(roll.titleI18n) as Record<string, string>
                                                rollTitle = parsed[locale] || parsed['en'] || roll.title
                                            } catch { /* keep original */ }
                                        }
                                        return (
                                            <section key={roll.id} style={{ marginBottom: '52px' }}>
                                                {/* Roll name header with scroll arrows */}
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    marginBottom: '20px',
                                                    paddingBottom: '14px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                }}>
                                                    <div style={{ width: '3px', height: '20px', background: 'var(--accent-gold)', borderRadius: '2px', flexShrink: 0 }} />
                                                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                                                        {roll.icon} {rollTitle}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.58rem', fontWeight: 700,
                                                        color: 'var(--accent-gold)',
                                                        background: 'rgba(212,168,83,0.08)',
                                                        border: '1px solid rgba(212,168,83,0.18)',
                                                        padding: '2px 8px', borderRadius: '99px',
                                                    }}>
                                                        {t('titlesCount', { count: roll.projects.length })}
                                                    </span>

                                                    {/* Scroll arrows — pushed to the right */}
                                                    {roll.projects.length > 3 && (
                                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                                            {(['left', 'right'] as const).map(dir => (
                                                                <button
                                                                    key={dir}
                                                                    onClick={() => scrollRoll(roll.id, dir)}
                                                                    aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
                                                                    style={{
                                                                        width: '32px', height: '32px',
                                                                        borderRadius: '50%',
                                                                        background: 'rgba(212,168,83,0.08)',
                                                                        border: '1px solid rgba(212,168,83,0.2)',
                                                                        color: 'var(--accent-gold)',
                                                                        cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        fontSize: '1rem', lineHeight: 1,
                                                                        transition: 'background 0.2s, transform 0.15s',
                                                                        flexShrink: 0,
                                                                    }}
                                                                    onMouseEnter={e => {
                                                                        e.currentTarget.style.background = 'rgba(212,168,83,0.22)'
                                                                        e.currentTarget.style.transform = 'scale(1.1)'
                                                                    }}
                                                                    onMouseLeave={e => {
                                                                        e.currentTarget.style.background = 'rgba(212,168,83,0.08)'
                                                                        e.currentTarget.style.transform = 'scale(1)'
                                                                    }}
                                                                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
                                                                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
                                                                >
                                                                    {dir === 'left'
                                                                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                                                                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                                                                    }
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Horizontal scroll strip — same card design, 280px fixed width */}
                                                <div
                                                    ref={el => {
                                                        if (el) rollStripRefs.current.set(roll.id, el)
                                                        else rollStripRefs.current.delete(roll.id)
                                                    }}
                                                    style={{
                                                        display: 'flex',
                                                        gap: '16px',
                                                        overflowX: 'auto',
                                                        overflowY: 'hidden',
                                                        scrollSnapType: 'x mandatory',
                                                        overscrollBehaviorX: 'contain',
                                                        touchAction: 'pan-x pan-y',
                                                        paddingBottom: '12px',
                                                        scrollbarWidth: 'none',
                                                        msOverflowStyle: 'none',
                                                    }}
                                                >
                                                    {roll.projects.map((project) => {
                                                        const loc = getLocalizedProject(project, locale)
                                                        return (
                                                            <div
                                                                key={project.id}
                                                                className="project-card"
                                                                onMouseEnter={e => handleCardHover(project, e.currentTarget.getBoundingClientRect())}
                                                                onMouseLeave={handleCardHoverEnd}
                                                                style={{
                                                                    width: '280px',
                                                                    flexShrink: 0,
                                                                    scrollSnapAlign: 'start',
                                                                    aspectRatio: '16/10',
                                                                    borderRadius: 'var(--radius-lg)',
                                                                    position: 'relative',
                                                                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                                                }}
                                                            >
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
                                                                <div className="project-card-content" style={{ padding: 'var(--space-sm) var(--space-md)', zIndex: 2, pointerEvents: 'none' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                                        <span style={{ fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)' }}>
                                                                            {loc.genre ? loc.genre.split(',').map(g => g.trim()).filter(Boolean).join(' · ') : ''}
                                                                        </span>
                                                                        {project.status === 'completed' && <span style={{ fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--color-success)', background: 'rgba(52,211,153,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(52,211,153,0.2)' }}>{t('completed')}</span>}
                                                                        {project.status === 'in-production' && <span style={{ fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)', background: 'rgba(212,168,83,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(212,168,83,0.2)' }}>{t('inProduction')}</span>}
                                                                        {project.status === 'upcoming' && <span style={{ fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--color-info)', background: 'rgba(96,165,250,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(96,165,250,0.2)' }}>{t('upcoming')}</span>}
                                                                        {project.projectType === 'series' && <span style={{ fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--color-info)', background: 'rgba(96,165,250,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(96,165,250,0.2)' }}>{t('series')}</span>}
                                                                    </div>
                                                                    <h3 style={{ fontSize: '0.95rem', marginBottom: '1px', fontWeight: 700 }}>{loc.title}</h3>
                                                                    <p style={{ fontSize: '0.7rem', lineHeight: 1.3 }}>{loc.tagline}</p>
                                                                    <div style={{ display: 'flex', gap: '6px', marginTop: '3px', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                                                        {project.year && <span>{project.year}</span>}
                                                                        {project.duration && <span>• {project.duration}</span>}
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px', pointerEvents: 'auto' }}>
                                                                        {project.trailerUrl && (
                                                                            <Link href={`/works/${project.slug}#trailer`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--accent-gold)', textDecoration: 'none', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.3)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.15)' }}>
                                                                                ▶ {t('watchTrailer')}
                                                                            </Link>
                                                                        )}
                                                                        {project.filmUrl && (
                                                                            <Link href={`/works/${project.slug}#watch`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: 'var(--color-success)', textDecoration: 'none', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.25)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.12)' }}>
                                                                                🎬 {t('watchNow')}
                                                                            </Link>
                                                                        )}
                                                                        {project.projectType === 'series' && project.episodeCount > 0 && (
                                                                            <Link href={`/works/${project.slug}#episodes`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: 'var(--color-info)', textDecoration: 'none', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.12)' }}>
                                                                                📺 {project.episodeCount} {t('episodes')}
                                                                            </Link>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </section>
                                        )
                                    })
                                ) : (
                                    /* ── Flat grid fallback when no rolls assigned ── */
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
                                                <div className="project-card-content" style={{ padding: 'var(--space-sm) var(--space-md)', zIndex: 2, pointerEvents: 'none' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                        <span style={{ fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)' }}>{loc.genre ? loc.genre.split(',').map(g => g.trim()).filter(Boolean).join(' · ') : ''}</span>
                                                        {project.status === 'completed' && <span style={{ fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--color-success)', background: 'rgba(52,211,153,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(52,211,153,0.2)' }}>{t('completed')}</span>}
                                                        {project.status === 'in-production' && <span style={{ fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)', background: 'rgba(212,168,83,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(212,168,83,0.2)' }}>{t('inProduction')}</span>}
                                                        {project.status === 'upcoming' && <span style={{ fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--color-info)', background: 'rgba(96,165,250,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(96,165,250,0.2)' }}>{t('upcoming')}</span>}
                                                        {project.projectType === 'series' && <span style={{ fontSize: '0.45rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--color-info)', background: 'rgba(96,165,250,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(96,165,250,0.2)' }}>{t('series')}</span>}
                                                    </div>
                                                    <h3 style={{ fontSize: '0.95rem', marginBottom: '1px', fontWeight: 700 }}>{loc.title}</h3>
                                                    <p style={{ fontSize: '0.7rem', lineHeight: 1.3 }}>{loc.tagline}</p>
                                                    <div style={{ display: 'flex', gap: '6px', marginTop: '3px', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                                        {project.year && <span>{project.year}</span>}
                                                        {project.duration && <span>• {project.duration}</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px', pointerEvents: 'auto' }}>
                                                        {project.trailerUrl && (
                                                            <Link href={`/works/${project.slug}#trailer`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--accent-gold)', textDecoration: 'none', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.3)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.15)' }}>
                                                                ▶ {t('watchTrailer')}
                                                            </Link>
                                                        )}
                                                        {project.filmUrl && (
                                                            <Link href={`/works/${project.slug}#watch`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: 'var(--color-success)', textDecoration: 'none', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.25)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.12)' }}>
                                                                🎬 {t('watchNow')}
                                                            </Link>
                                                        )}
                                                        {project.projectType === 'series' && project.episodeCount > 0 && (
                                                            <Link href={`/works/${project.slug}#episodes`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: 'var(--color-info)', textDecoration: 'none', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.12)' }}>
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
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ═══ COMPACT CTA ═══ */}
            <ScrollReveal3D direction="up" distance={50} rotate={5}>
                <section style={{ position: 'relative', zIndex: 2, padding: '0 0 var(--space-3xl)', background: 'var(--bg-primary)' }}>
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
                    onKeepAlive={handleHoverKeepAlive}
                />
            )}
        </main>
    )
}
