'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

export interface CastMember {
    id: string
    name: string
    jobTitle: string
    character: string | null
    bio: string | null
    photoUrl: string | null
    instagramUrl: string | null
    bioTranslations: string | null  // JSON: Record<lang,{bio,character}>
    sortOrder: number
}

interface CastShowcaseProps {
    cast: CastMember[]
    castingHref?: string
    projectTitle?: string
}

export default function CastShowcase({ cast, castingHref, projectTitle }: CastShowcaseProps) {
    const t = useTranslations('castShowcase')
    const locale = useLocale()

    // Helper: resolve bio/character in current locale with English fallback
    const resolve = (member: CastMember) => {
        if (locale === 'en' || !member.bioTranslations) {
            return { bio: member.bio, character: member.character }
        }
        try {
            const map = JSON.parse(member.bioTranslations) as Record<string, { bio: string; character: string }>
            const tr = map[locale]
            if (tr) return {
                bio: tr.bio || member.bio,
                character: tr.character || member.character,
            }
        } catch { /* malformed JSON — fall through */ }
        return { bio: member.bio, character: member.character }
    }

    // Tier 1: translate predefined jobTitle string via locale keys
    const tJobTitle = (raw: string) => {
        try { return t(`jobTitles.${raw as 'Actor'}`) } catch { return raw }
    }

    const [selectedMember, setSelectedMember] = useState<CastMember | null>(null)
    const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set())
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
    const [parallax, setParallax] = useState<Record<number, { x: number; y: number }>>({})
    const stripRef = useRef<HTMLDivElement>(null)
    const cardRefs = useRef<(HTMLDivElement | null)[]>([])

    // Staggered entrance via IntersectionObserver
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const idx = Number((entry.target as HTMLElement).dataset.idx)
                        setVisibleCards((prev) => new Set([...prev, idx]))
                        observer.unobserve(entry.target)
                    }
                })
            },
            { threshold: 0.2 }
        )
        cardRefs.current.forEach((el) => { if (el) observer.observe(el) })
        return () => observer.disconnect()
    }, [cast.length])

    // Rec 4: reset parallax map when cast list changes to avoid stale index accumulation
    useEffect(() => {
        setParallax({})
    }, [cast.length])

    // Close modal on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedMember(null) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const scrollStrip = (dir: 'left' | 'right') => {
        stripRef.current?.scrollBy({ left: dir === 'right' ? 340 : -340, behavior: 'smooth' })
    }

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>, idx: number) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        setParallax((prev) => ({ ...prev, [idx]: { x, y } }))
    }, [])

    const handleMouseLeave = useCallback((idx: number) => {
        setHoveredIdx(null)
        setParallax((prev) => ({ ...prev, [idx]: { x: 0, y: 0 } }))
    }, [])

    if (cast.length === 0 && !castingHref) return null

    // Rec 3: trim stale refs so disconnected elements don't linger in the array
    cardRefs.current = cardRefs.current.slice(0, cast.length + 1)

    return (
        <>
            {/* ── Inject keyframes + mobile styles ── */}
            <style>{`
                @keyframes castCardIn {
                    from { opacity: 0; transform: translateY(36px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0)    scale(1);    }
                }
                @keyframes goldSpin {
                    from { transform: rotate(0deg);   }
                    to   { transform: rotate(360deg); }
                }
                @keyframes ctaPulse {
                    0%, 100% { box-shadow: 0 0 24px rgba(212,168,83,0.15), inset 0 0 0 1px rgba(212,168,83,0.3); }
                    50%      { box-shadow: 0 0 48px rgba(212,168,83,0.40), inset 0 0 0 1px rgba(212,168,83,0.6); }
                }
                @keyframes modalIn {
                    from { opacity: 0; transform: translateY(28px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)     scale(1);    }
                }
                @keyframes overlayIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes shimmerLine {
                    0%   { background-position: -200% center; }
                    100% { background-position:  200% center; }
                }
                .cast-strip::-webkit-scrollbar { display: none; }
                .cast-strip {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                    -webkit-overflow-scrolling: touch;
                }
                .cast-card-img { transition: transform 0.5s cubic-bezier(0.22,1,0.36,1); }
                .cast-card:hover .cast-card-img { transform: scale(1.08); }

                /* ── Mobile ≤ 640px ── */
                @media (max-width: 640px) {
                    .cast-section-header {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 10px !important;
                    }
                    /* About modal: stack portrait on top, info below */
                    .cast-modal-body {
                        flex-direction: column !important;
                        min-height: unset !important;
                    }
                    .cast-modal-portrait {
                        width: 100% !important;
                        height: 200px !important;
                        flex-shrink: 0 !important;
                    }
                    .cast-modal-portrait > div:last-child {
                        /* Change side-gradient to bottom-gradient for stacked layout */
                        background: linear-gradient(to bottom, transparent 60%, rgba(12,12,20,0.85)) !important;
                    }
                    .cast-modal-info {
                        padding: 20px 18px !important;
                    }
                    .cast-modal-info h3 {
                        font-size: 1.25rem !important;
                    }
                    /* Full-width CTA card on mobile strip */
                    .cast-cta-card {
                        width: 160px !important;
                    }
                }

                /* ── Very small phones ≤ 390px ── */
                @media (max-width: 390px) {
                    .cast-modal-portrait { height: 160px !important; }
                    .cast-modal-overlay { padding: 12px !important; }
                    .cast-modal-info { padding: 16px 14px !important; }
                }
            `}</style>

            <section style={{
                padding: 'clamp(var(--space-xl), 5vw, var(--space-2xl)) 0',
                borderTop: '1px solid var(--border-subtle)',
            }}>
                <div className="container" style={{ maxWidth: '1200px', padding: '0 clamp(16px, 4vw, var(--space-lg))' }}>

                    {/* ── Section header ── */}
                    <div className="cast-section-header" style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-xl)',
                    }}>
                        <div>
                            <div style={{
                                fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.2em',
                                textTransform: 'uppercase', color: 'var(--accent-gold)',
                                marginBottom: '6px',
                            }}>
                                ✦ {t('studio')}
                            </div>
                            <h2 style={{
                                fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                                fontWeight: 900, letterSpacing: '-0.02em',
                                margin: 0,
                                background: 'linear-gradient(135deg, #fff 40%, rgba(212,168,83,0.8))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                {t('sectionTitle')}
                            </h2>
                        </div>

                        {/* Scroll arrows — on mobile show when > 2 cards, desktop > 4 */}
                        {cast.length > 2 && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {(['left', 'right'] as const).map(dir => (
                                    <button
                                        key={dir}
                                        onClick={() => scrollStrip(dir)}
                                        style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            background: 'rgba(212,168,83,0.1)',
                                            border: '1px solid rgba(212,168,83,0.3)',
                                            color: 'var(--accent-gold)', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s', fontSize: '1rem',
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(212,168,83,0.2)'
                                            e.currentTarget.style.transform = 'scale(1.1)'
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(212,168,83,0.1)'
                                            e.currentTarget.style.transform = 'scale(1)'
                                        }}
                                    >
                                        {dir === 'left' ? '←' : '→'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Decorative divider */}
                    <div style={{
                        height: '1px', marginBottom: 'var(--space-xl)',
                        background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)',
                        animation: 'shimmerLine 3s linear infinite',
                        backgroundSize: '200% auto',
                    }} />

                    {/* ── Horizontal strip ── */}
                    <div
                        ref={stripRef}
                        className="cast-strip"
                        style={{
                            display: 'flex', gap: 'clamp(12px, 2vw, 20px)', overflowX: 'auto',
                            paddingBottom: '12px', paddingTop: '8px',
                        }}
                    >
                        {cast.map((member, idx) => {
                            const par = parallax[idx] || { x: 0, y: 0 }
                            const isHovered = hoveredIdx === idx
                            const isVisible = visibleCards.has(idx)

                            return (
                                <div
                                    key={member.id}
                                    ref={el => { cardRefs.current[idx] = el }}
                                    data-idx={idx}
                                    className="cast-card"
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${t('aboutButton')} ${member.name}`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            setSelectedMember(member)
                                        }
                                    }}
                                    onMouseMove={(e) => { setHoveredIdx(idx); handleMouseMove(e, idx) }}
                                    onMouseLeave={() => handleMouseLeave(idx)}
                                    style={{
                                        flexShrink: 0,
                                        width: '180px',
                                        borderRadius: '14px',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        // Staggered entrance animation
                                        opacity: isVisible ? 1 : 0,
                                        animation: isVisible
                                            ? `castCardIn 0.6s cubic-bezier(0.22,1,0.36,1) ${idx * 80}ms both`
                                            : 'none',
                                        // Gold border on hover
                                        boxShadow: isHovered
                                            ? '0 0 0 1.5px rgba(212,168,83,0.6), 0 20px 60px rgba(0,0,0,0.5)'
                                            : '0 4px 24px rgba(0,0,0,0.3)',
                                        transition: 'box-shadow 0.3s ease, transform 0.3s ease',
                                        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                                    }}
                                >
                                    {/* Portrait image — CSS background (protected, no <img>) */}
                                    <div
                                        style={{
                                            width: '180px',
                                            height: '240px',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                        }}
                                    >
                                        {member.photoUrl ? (
                                            <div
                                                className="cast-card-img"
                                                style={{
                                                    position: 'absolute', inset: '-6%',
                                                    backgroundImage: `url(${member.photoUrl})`,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: `${50 + par.x * -12}% ${50 + par.y * -12}%`,
                                                    transition: 'background-position 0.1s linear',
                                                    userSelect: 'none',
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                position: 'absolute', inset: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '3.5rem', opacity: 0.3,
                                            }}>🎭</div>
                                        )}

                                        {/* Transparent protection overlay — blocks right-click & drag */}
                                        <div
                                            style={{
                                                position: 'absolute', inset: 0,
                                                zIndex: 2,
                                                userSelect: 'none',
                                            }}
                                            onContextMenu={e => e.preventDefault()}
                                            draggable={false}
                                        />

                                        {/* Top gradient fade */}
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, height: '60px',
                                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
                                            zIndex: 3,
                                        }} />

                                        {/* Hover overlay with About button */}
                                        <div style={{
                                            position: 'absolute', inset: 0, zIndex: 4,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                                            display: 'flex', flexDirection: 'column',
                                            justifyContent: 'flex-end', padding: '14px 12px',
                                            opacity: isHovered ? 1 : 0,
                                            transition: 'opacity 0.25s ease',
                                        }}>
                                            <button
                                                onClick={() => setSelectedMember(member)}
                                                style={{
                                                    background: 'rgba(212,168,83,0.15)',
                                                    border: '1px solid rgba(212,168,83,0.6)',
                                                    borderRadius: '6px',
                                                    color: 'var(--accent-gold)',
                                                    fontSize: '0.7rem', fontWeight: 700,
                                                    letterSpacing: '0.08em',
                                                    padding: '6px 10px',
                                                    cursor: 'pointer', width: '100%',
                                                    backdropFilter: 'blur(4px)',
                                                    transition: 'background 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.3)' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.15)' }}
                                            >
                                                {t('aboutButton')} ›
                                            </button>
                                        </div>
                                    </div>

                                    {/* Name plate */}
                                    <div style={{
                                        background: 'rgba(10,10,16,0.97)',
                                        padding: '10px 12px 12px',
                                        borderTop: '1px solid rgba(212,168,83,0.15)',
                                    }}>
                                        <div style={{
                                            fontSize: '0.82rem', fontWeight: 700,
                                            color: '#fff', marginBottom: '2px',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>{member.name}</div>
                                        <div style={{
                                            fontSize: '0.65rem', fontWeight: 600,
                                            color: 'var(--accent-gold)', textTransform: 'uppercase',
                                            letterSpacing: '0.08em',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>{member.character || tJobTitle(member.jobTitle)}</div>
                                    </div>
                                </div>
                            )
                        })}

                        {/* ── CTA Card — "Be in the next film" ── */}
                        {castingHref && (
                            <Link
                                href={castingHref}
                                style={{ flexShrink: 0, textDecoration: 'none' }}
                                ref={(el) => { cardRefs.current[cast.length] = el as HTMLDivElement | null }}
                                data-idx={cast.length}
                            >
                                <div style={{
                                    width: '180px', height: '288px',
                                    borderRadius: '14px',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    gap: '12px',
                                    background: 'linear-gradient(135deg, rgba(212,168,83,0.06), rgba(212,168,83,0.02))',
                                    animation: `ctaPulse 2.8s ease-in-out infinite`,
                                    cursor: 'pointer',
                                    transition: 'transform 0.3s ease',
                                    opacity: visibleCards.has(cast.length) ? 1 : 0,
                                    animationDelay: `${cast.length * 80}ms`,
                                    padding: '24px 16px',
                                    textAlign: 'center',
                                }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px) scale(1.02)' }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)' }}
                                >
                                    <div style={{
                                        width: '56px', height: '56px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))',
                                        border: '1.5px solid rgba(212,168,83,0.4)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.6rem',
                                    }}>🎬</div>
                                    <div>
                                        <div style={{
                                            fontSize: '0.85rem', fontWeight: 800,
                                            color: '#fff', marginBottom: '4px', lineHeight: 1.3,
                                        }}>
                                            {t('ctaHeading')}
                                        </div>
                                        <div style={{
                                            fontSize: '0.68rem', color: 'var(--text-tertiary)',
                                            lineHeight: 1.5,
                                        }}>
                                            {projectTitle ? t('ctaSubtext', { title: projectTitle }) : t('ctaSubtextFallback')}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '7px 16px', borderRadius: '20px',
                                        background: 'linear-gradient(135deg, var(--accent-gold), #c99a2e)',
                                        color: '#000', fontSize: '0.7rem', fontWeight: 800,
                                        letterSpacing: '0.08em', textTransform: 'uppercase',
                                    }}>
                                        {t('ctaButton')} →
                                    </div>
                                </div>
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            {/* ── About Modal ── */}
            {selectedMember && (
                <div
                    className="cast-modal-overlay"
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 1200,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                        animation: 'overlayIn 0.25s ease',
                        overflowY: 'auto',  // allow scroll if modal taller than viewport
                    }}
                    onClick={e => { if (e.target === e.currentTarget) setSelectedMember(null) }}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(18,18,28,0.99), rgba(12,12,20,0.99))',
                        border: '1px solid rgba(212,168,83,0.25)',
                        borderRadius: '20px',
                        width: '100%', maxWidth: '620px',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,168,83,0.1)',
                        animation: 'modalIn 0.35s cubic-bezier(0.22,1,0.36,1)',
                        overflow: 'hidden',
                        margin: 'auto',  // centers correctly when overflowY auto is active
                    }}>
                        <div className="cast-modal-body" style={{ display: 'flex', minHeight: '340px' }}>
                            {/* Portrait side */}
                            <div className="cast-modal-portrait" style={{
                                width: '220px', flexShrink: 0,
                                position: 'relative',
                                background: 'linear-gradient(135deg, #1a1a2e, #0d0d1a)',
                            }}>
                                {selectedMember.photoUrl ? (
                                    <>
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            backgroundImage: `url(${selectedMember.photoUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center top',
                                            userSelect: 'none',
                                        }} />
                                        {/* Protection overlay */}
                                        <div
                                            style={{ position: 'absolute', inset: 0, zIndex: 2 }}
                                            onContextMenu={e => e.preventDefault()}
                                            draggable={false}
                                        />
                                    </>
                                ) : (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '5rem', opacity: 0.2,
                                    }}>🎭</div>
                                )}
                                {/* Gradient overlay on portrait */}
                                <div style={{
                                    position: 'absolute', inset: 0, zIndex: 3,
                                    background: 'linear-gradient(to right, transparent 60%, rgba(12,12,20,0.8))',
                                }} />
                            </div>

                            {/* Info side */}
                            <div className="cast-modal-info" style={{ flex: 1, padding: '28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                {/* Gold accent line */}
                                <div style={{
                                    width: '32px', height: '2px', marginBottom: '16px',
                                    background: 'linear-gradient(90deg, var(--accent-gold), transparent)',
                                }} />

                                <div style={{
                                    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em',
                                    textTransform: 'uppercase', color: 'var(--accent-gold)',
                                    marginBottom: '6px',
                                }}>{tJobTitle(selectedMember.jobTitle)}</div>

                                <h3 style={{
                                    fontSize: '1.5rem', fontWeight: 900, margin: '0 0 4px',
                                    letterSpacing: '-0.02em', lineHeight: 1.15,
                                }}>{selectedMember.name}</h3>

                                {(() => {
                                    const resolved = resolve(selectedMember)
                                    return (<>
                                        {resolved.character && (
                                            <div style={{
                                                fontSize: '0.78rem', color: 'var(--text-tertiary)',
                                                marginBottom: '16px', fontStyle: 'italic',
                                            }}>{t('character', { character: resolved.character })}</div>
                                        )}
                                        {resolved.bio && (
                                            <>
                                                <div style={{
                                                    width: '100%', height: '1px', marginBottom: '14px',
                                                    background: 'rgba(212,168,83,0.15)',
                                                }} />
                                                <p style={{
                                                    fontSize: '0.8rem', lineHeight: 1.75,
                                                    color: 'var(--text-secondary)', margin: 0,
                                                    overflow: 'hidden',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 6,
                                                    WebkitBoxOrient: 'vertical' as const,
                                                }}>{resolved.bio}</p>
                                            </>
                                        )}
                                    </>)
                                })()}

                                {selectedMember.instagramUrl && (
                                    <a
                                        href={selectedMember.instagramUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            marginTop: '18px', fontSize: '0.72rem', fontWeight: 600,
                                            color: 'var(--text-tertiary)', textDecoration: 'none',
                                            transition: 'color 0.2s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-gold)' }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                                        </svg>
                                        {t('instagram')}
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid rgba(212,168,83,0.12)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'rgba(0,0,0,0.2)',
                        }}>
                            {castingHref ? (
                                <Link
                                    href={castingHref}
                                    style={{
                                        fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold)',
                                        textDecoration: 'none', letterSpacing: '0.05em',
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                    }}
                                >
                                    🎬 {t('modalCta')} →
                                </Link>
                            ) : <span />}
                            <button
                                onClick={() => setSelectedMember(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '6px', color: 'var(--text-tertiary)',
                                    fontSize: '0.72rem', padding: '5px 14px', cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                            >
                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
