'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import HeroBackground from '@/components/HeroBackground'
import { useIsMobile } from '@/hooks/useIsMobile'

interface HomeHeroProps {
    completedCount: number
    upcomingCount: number
    openCastings: number
    castingEnabled: boolean
    rotatingWords?: string[]
    subHeadline?: string
    heroLabel?: string
    heroTitle?: string
    heroCta?: string
    heroCtaCasting?: string
    /** Server-detected mobile flag — prevents hydration flash in HeroBackground */
    isMobileHint?: boolean
}

export default function HomeHero({
    completedCount, upcomingCount, openCastings, castingEnabled,
    rotatingWords, subHeadline, heroLabel, heroTitle, heroCta, heroCtaCasting,
    isMobileHint = false,
}: HomeHeroProps) {
    const t = useTranslations('hero')
    const th = useTranslations('home')
    const isMobile = useIsMobile(isMobileHint)

    const ROTATING_WORDS = useMemo(() => {
        if (rotatingWords && rotatingWords.length > 0) return rotatingWords
        return [t('word1'), t('word2'), t('word3'), t('word4'), t('word5')]
    }, [rotatingWords, t])

    const [wordIdx, setWordIdx] = useState(0)
    const [wordFade, setWordFade] = useState(true)

    // Video dot state — driven by HeroBackground via callbacks
    const [videoDots, setVideoDots] = useState({ currentIdx: 0, total: 0 })
    const jumpToVideoRef = useRef<((idx: number) => void) | null>(null)

    const handleVideoChange = useCallback((currentIdx: number, total: number) => {
        setVideoDots({ currentIdx, total })
    }, [])

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

    // ── Shared: rotating word span (used in both mobile and desktop layouts) ──
    const renderRotatingWordsSpan = () => (
        <span style={{
            display: 'inline-grid',
            verticalAlign: 'baseline',
        }}>
            {ROTATING_WORDS.map((word: string, i: number) => (
                <span key={i} className={i === wordIdx && wordFade ? 'shimmer-gold-text' : ''} style={{
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
        </span>
    )

    // ── Shared: headline content (both layouts call this) ──
    const renderHeadline = (fontSize: string) => {
        const rawTitle = heroTitle || t('title')
        const prefix = t('titleAccentPrefix')
        if (rawTitle.includes('{accent}')) {
            const parts = rawTitle.split('{accent}')
            return (
                <h1 style={{ fontSize, fontWeight: 800, lineHeight: 1.15, margin: 0 }}>
                    {parts[0]}{renderRotatingWordsSpan()}{parts[1]}
                </h1>
            )
        }
        return (
            <h1 style={{ fontSize, fontWeight: 800, lineHeight: 1.15, margin: 0 }}>
                {rawTitle}
                <br />
                {prefix && <span style={{ fontWeight: 800, opacity: 1 }}>{prefix} </span>}
                {renderRotatingWordsSpan()}
            </h1>
        )
    }

    // ── Video navigation dots ──
    const renderVideoDots = () => videoDots.total > 1 ? (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginTop: 'var(--space-md)',
            width: '100%',
        }}>
            {Array.from({ length: videoDots.total }).map((_, i) => (
                <button
                    key={i}
                    onClick={() => jumpToVideoRef.current?.(i)}
                    style={{
                        width: videoDots.currentIdx === i ? '28px' : '6px',
                        height: '6px',
                        borderRadius: 'var(--radius-full)',
                        border: 'none',
                        background: videoDots.currentIdx === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.25)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        padding: 0,
                    }}
                    aria-label={`Play video ${i + 1}`}
                />
            ))}
        </div>
    ) : null

    // ══════════════════════════════════════════════════════
    // MOBILE — Contained cinematic card layout
    // Card uses position:relative so HeroBackground renders
    // absolute inside it instead of fixed over the viewport.
    // ══════════════════════════════════════════════════════
    if (isMobile) {
        return (
            <section
                aria-label="Hero"
                style={{
                    position: 'relative',
                    // Sits below the fixed navbar (~60px) with 4px gap, above the mobile tab bar (~80px)
                    // Height = viewport - navbar clearance - bottom nav clearance
                    height: 'calc(100dvh - 148px)',
                    minHeight: '460px',
                    maxHeight: '700px',
                    marginTop: '64px',
                    marginLeft: '12px',
                    marginRight: '12px',
                    marginBottom: '8px',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    background: '#0d0f14',
                    zIndex: 0,
                }}
            >
                {/* Media — absolute inside the card */}
                <HeroBackground
                    page="home"
                    isMobile={true}
                    cardMode={true}
                    onVideoChange={handleVideoChange}
                    jumpToVideoRef={jumpToVideoRef}
                />

                {/* Cinematic gradient — heavier at bottom for readability */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2,
                    background: 'linear-gradient(180deg, rgba(13,15,20,0.08) 0%, rgba(13,15,20,0.06) 30%, rgba(13,15,20,0.55) 60%, rgba(13,15,20,0.92) 85%, rgba(13,15,20,0.98) 100%)',
                    pointerEvents: 'none',
                }} />

                {/* Hero content — bottom of card */}
                <div style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    zIndex: 3,
                    padding: '0 20px 20px',
                }}>
                    {/* Eyebrow / label */}
                    <span className="text-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.65rem' }}>
                        {heroLabel || t('label')}
                    </span>

                    {/* Headline with rotating word */}
                    <div style={{ marginBottom: '10px' }}>
                        {renderHeadline('clamp(1.75rem, 6.5vw, 2.2rem)')}
                    </div>

                    {/* Sub-headline — shorter on mobile */}
                    <p style={{
                        fontSize: '0.82rem',
                        lineHeight: 1.55,
                        color: 'var(--text-secondary)',
                        marginBottom: '14px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}>
                        {subHeadline || t('description')}
                    </p>

                    {/* CTA row */}
                    <div className="hero-cta-row" style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                        <Link href="/works" prefetch={false} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '0.6rem 1rem' }}>
                            {heroCta || t('cta')}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </Link>
                        {castingEnabled && (
                            <Link href="/casting" prefetch={false} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '0.6rem 1rem' }}>
                                {heroCtaCasting || t('ctaCasting')}
                            </Link>
                        )}
                    </div>

                    {/* Stats pill — compact */}
                    <div className="hero-stats-pill" style={{
                        display: 'inline-flex',
                        gap: 'var(--space-md)',
                        padding: '0.45rem 1rem',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(12px)',
                        width: '100%',
                        justifyContent: 'center',
                    }}>
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{completedCount}</span>
                            <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '3px' }}>{th('films')}</span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{upcomingCount}</span>
                            <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '3px' }}>{th('upcomingStat')}</span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                        <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{openCastings}</span>
                            <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginLeft: '3px' }}>{th('castingStat')}</span>
                        </div>
                    </div>

                    {/* Video navigation dots */}
                    {renderVideoDots()}
                </div>
            </section>
        )
    }

    // ══════════════════════════════════════════════════════
    // DESKTOP — Original full-screen background layout
    // Unchanged from previous implementation.
    // ══════════════════════════════════════════════════════
    return (
        <>
            {/* ═══ BACKGROUND MEDIA (image or video, device-targeted) ═══ */}
            <HeroBackground
                page="home"
                isMobile={isMobileHint}
                onVideoChange={handleVideoChange}
                jumpToVideoRef={jumpToVideoRef}
            />

            {/* ═══ FIXED GRADIENT OVERLAY — covers the viewport over the media ═══ */}
            <div style={{
                position: 'fixed',
                inset: 0,
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
                        {heroLabel || t('label')}
                    </span>

                    <div className="animate-fade-in-up" style={{ marginBottom: 'var(--space-md)' }}>
                        {renderHeadline('clamp(2.2rem, 5vw, 3.5rem)')}
                    </div>

                    {/* Sub-headline */}
                    <p className="animate-fade-in-up delay-2" style={{
                        fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
                        lineHeight: 1.7,
                        color: 'var(--text-secondary)',
                        maxWidth: '580px',
                        marginBottom: 'var(--space-xl)',
                    }}>
                        {subHeadline || t('description')}
                    </p>

                    <div className="hero-actions hero-cta-row animate-fade-in-up delay-3" style={{ marginBottom: 'var(--space-xl)' }}>
                        <Link href="/works" prefetch={false} className="btn btn-primary btn-lg">
                            {heroCta || t('cta')}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </Link>
                        {castingEnabled && (
                            <Link href="/casting" prefetch={false} className="btn btn-secondary btn-lg">
                                {heroCtaCasting || t('ctaCasting')}
                            </Link>
                        )}
                    </div>

                    {/* Compact stats pill */}
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

                    {/* Video navigation dots — populated by HeroBackground via onVideoChange */}
                    {renderVideoDots()}
                </div>
            </section>
        </>
    )
}
