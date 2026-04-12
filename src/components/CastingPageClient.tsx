'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Scene3D from '@/components/Scene3D'
import CastingRoleCard from '@/components/casting/CastingRoleCard'
import EncouragementSection from '@/components/casting/EncouragementSection'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'

interface HeroVideoItem {
    id: string
    url: string
    duration: number
}

interface CastingCall {
    id: string
    roleName: string
    roleType: string
    roleDescription: string
    ageRange: string | null
    gender: string | null
    deadline: string | null
    compensation: string | null
    requirements: string
    project: {
        id: string
        title: string
        slug: string
        genre: string | null
        year: string | null
        coverImage: string | null
        translations: string | null
    }
    _count?: {
        applications: number
    }
    maxApplications?: number
    translations: string | null
}

export default function CastingPageClient({ castingCalls, appliedMap = {} }: { castingCalls: CastingCall[]; appliedMap?: Record<string, string> }) {
    // Hero videos — dual-slot crossfade
    const [heroVideos, setHeroVideos] = useState<HeroVideoItem[]>([])
    const [currentVideoIdx, setCurrentVideoIdx] = useState(0)
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
    const [mounted, setMounted] = useState(false)
    const videoARef = useRef<HTMLVideoElement>(null)
    const videoBRef = useRef<HTMLVideoElement>(null)
    const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const t = useTranslations('casting')
    const locale = useLocale()

    // Page-entry fade-in
    useEffect(() => { setMounted(true) }, [])


    // Fetch hero videos
    useEffect(() => {
        fetch('/api/admin/media?type=hero-video&page=casting')
            .then(r => r.json())
            .then((data: HeroVideoItem[]) => {
                if (data.length > 0) setHeroVideos(data)
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

        return () => {
            if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [heroVideos])

    // Crossfade: preload next video in inactive slot, then swap
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

    // Manual dot click
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

    // Group by project
    const grouped = castingCalls.reduce((acc, call) => {
        const loc = getLocalizedProject(call.project, locale)
        const projectTitle = loc.title
        if (!acc[projectTitle]) {
            acc[projectTitle] = {
                project: call.project,
                localized: loc,
                calls: [],
            }
        }
        acc[projectTitle].calls.push(call)
        return acc
    }, {} as Record<string, { project: CastingCall['project']; localized: ReturnType<typeof getLocalizedProject>; calls: CastingCall[] }>)

    return (
        <main id="main-content" style={{
            overflowX: 'hidden', width: '100%',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease',
        }}>
            {/* 3D Particle Background */}
            <Scene3D />

            {/* ═══ FIXED VIDEO BACKGROUND — always rendered, dark base + crossfading video slots ═══ */}
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
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: heroVideos.length > 0 && activeSlot === 'A' ? 1 : 0,
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
                        opacity: heroVideos.length > 0 && activeSlot === 'B' ? 1 : 0,
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
            <section className="casting-hero" style={{
                position: 'relative',
                height: '100dvh',
                overflow: 'hidden',
                zIndex: 1,
            }}>

                {/* Content overlay — sits on top of the video */}
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 1,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'space-between',
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

                    {/* Hero Content — single centered column like Works page */}
                    <div style={{
                        position: 'relative', zIndex: 1,
                        textAlign: 'center',
                        maxWidth: 'min(700px, 100%)',
                        padding: '0 var(--space-md)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 'var(--space-md)',
                        flex: 1,
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

                        <h1 className="animate-fade-in-up delay-1" style={{
                            fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)',
                            fontWeight: 800,
                            lineHeight: 1.15,
                            margin: 0,
                        }}>
                            {t('title', { accent: '' })}{' '}
                            <span style={{
                                fontFamily: 'var(--font-serif)',
                                fontStyle: 'italic',
                                background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>{t('accent')}</span>
                        </h1>

                        {/* Stats pill — same style as Works / Upcoming pages */}
                        <div className="animate-fade-in-up delay-2" style={{
                            display: 'inline-flex',
                            gap: 'var(--space-xl)',
                            padding: '0.6rem 1.5rem',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-subtle)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            flexWrap: 'wrap' as const,
                            justifyContent: 'center',
                        }}>
                            <div>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                    {castingCalls.length}
                                </span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>
                                    {t('openRoles')}
                                </span>
                            </div>
                            <div style={{ width: '1px', background: 'var(--border-subtle)', alignSelf: 'stretch' }} />
                            <div>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {Object.keys(castingCalls.reduce((acc, c) => ({ ...acc, [c.project.id]: true }), {} as Record<string, boolean>)).length}
                                </span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>
                                    {t('projects')}
                                </span>
                            </div>
                            <div style={{ width: '1px', background: 'var(--border-subtle)', alignSelf: 'stretch' }} />
                            <div>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                    {[...new Set(castingCalls.map(c => c.roleType))].length}
                                </span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '4px' }}>
                                    {t('roleTypes')}
                                </span>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <a href="#roles" className="btn btn-primary btn-lg animate-fade-in-up delay-3">
                            {t('cta')}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12l7 7 7-7" />
                            </svg>
                        </a>

                        {/* Video indicator dots */}
                        {heroVideos.length > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
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
                    </div>
                </div>
            </section>

            {/* ═══ OPEN ROLES — scrolls over the video ═══ */}
            <section id="roles" style={{
                position: 'relative',
                zIndex: 2,
            }}>


                {/* Content */}
                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    paddingTop: 'var(--space-3xl)',
                    paddingBottom: 'var(--space-3xl)',
                }}>
                    <div className="container">
                        {/* Section Header — clean, no frame */}
                        <div className="glass-panel" style={{
                            textAlign: 'center',
                            marginBottom: 'var(--space-xl)',
                            position: 'relative',
                            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                            borderRadius: 'var(--radius-xl)',
                            padding: 'var(--space-xl)',
                        }}>
                            {/* Decorative gold accent line */}
                            <div style={{
                                width: '40px',
                                height: '2px',
                                background: 'linear-gradient(90deg, var(--accent-gold-light), var(--accent-gold))',
                                margin: '0 auto var(--space-sm)',
                                borderRadius: '2px',
                            }} />
                            <span className="text-label" style={{ display: 'block', marginBottom: '6px' }}>{t('openRoles')}</span>
                            <h2 style={{
                                fontSize: 'clamp(1.8rem, 4.5vw, 2.6rem)',
                                fontWeight: 800,
                                marginBottom: 'var(--space-xs)',
                            }}>
                                {t('findRole', { accent: '' })}{' '}
                                <span style={{
                                    fontFamily: 'var(--font-serif)',
                                    fontStyle: 'italic',
                                    background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}>{t('roleAccent')}</span>
                            </h2>
                            <p style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-secondary)',
                                maxWidth: '420px',
                                margin: '0 auto',
                                lineHeight: 1.6,
                            }}>
                                {t('roleIntro')}
                            </p>
                        </div>

                        {Object.keys(grouped).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-4xl) 0' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🎭</div>
                                <h3 style={{ marginBottom: 'var(--space-sm)' }}>{t('stayTuned')}</h3>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem', maxWidth: '440px', margin: '0 auto', lineHeight: 1.6, textAlign: 'center' }}>
                                    {t('noOpenCasting')}
                                </p>
                                <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)', fontSize: '0.9rem', textAlign: 'center', margin: 'var(--space-sm) auto 0' }}>
                                    {t('followSocial')}
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
                                {Object.entries(grouped).map(([projectTitle, { project, localized, calls }]) => (
                                    <div key={project.id}>
                                        {/* Project Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: 'var(--radius-md)',
                                                backgroundImage: project.coverImage ? `url(${project.coverImage})` : 'none',
                                                backgroundColor: 'var(--bg-tertiary)',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                flexShrink: 0,
                                            }} />
                                            <div>
                                                <Link href={`/works/${project.slug}`} style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                                                    {projectTitle}
                                                </Link>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                    {localized.genre} • {project.year || t('tbd')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Roles Grid — compact cards */}
                                        <div className="grid-auto-fill">
                                            {calls.map((call, callIdx) => (
                                                <CastingRoleCard
                                                    key={call.id}
                                                    call={call}
                                                    index={callIdx}
                                                    hasApplied={!!appliedMap[call.id]}
                                                    applicationStatus={appliedMap[call.id]}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <EncouragementSection />

            {/* Responsive styles */}
            <style>{`
                @keyframes kenburns {
                    0% { transform: scale(1) translate(0, 0); }
                    100% { transform: scale(1.1) translate(-1%, -1%); }
                }
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.25), 0 0 0 rgba(212,168,83,0); }
                    50%      { box-shadow: 0 4px 20px rgba(0,0,0,0.25), 0 0 20px rgba(212,168,83,0.08); }
                }
                @media (max-width: 768px) {
                    .casting-strip-items {
                        flex-direction: column !important;
                        gap: var(--space-xs) !important;
                        padding: var(--space-xs) var(--space-md) !important;
                    }
                }
            `}</style>
        </main>
    )
}
