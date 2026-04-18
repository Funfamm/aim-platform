'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useIsMobile } from '@/hooks/useIsMobile'

interface HomeSponsor {
    id: string; name: string; logoUrl: string | null; bannerUrl: string | null
    website: string | null; tier: string; description: string | null
    bannerDurationHours: number
}

const TIER_CONFIG: Record<string, { label: string; color: string; glow: string; ring: string }> = {
    diamond: { label: '💎', color: 'rgba(185,242,255,0.9)', glow: 'rgba(185,242,255,0.12)', ring: 'rgba(185,242,255,0.35)' },
    gold:    { label: '🏆', color: 'var(--accent-gold)',    glow: 'rgba(212,168,83,0.12)',  ring: 'rgba(212,168,83,0.4)'  },
    silver:  { label: '🥈', color: 'rgba(192,192,210,0.9)', glow: 'rgba(192,192,210,0.08)', ring: 'rgba(192,192,210,0.3)' },
    bronze:  { label: '🥉', color: 'rgba(205,127,50,0.9)',  glow: 'rgba(205,127,50,0.08)', ring: 'rgba(205,127,50,0.3)'  },
}

// ── Individual sponsor card ──────────────────────────────────────────────────
function SponsorCard({ s, index, visible, isMobile }: { s: HomeSponsor; index: number; visible: boolean; isMobile: boolean }) {
    const [hovered, setHovered] = useState(false)
    const tier = TIER_CONFIG[s.tier?.toLowerCase()] ?? TIER_CONFIG.silver

    return (
        <a
            href={s.website || '#'}
            target={s.website ? '_blank' : undefined}
            rel="noopener noreferrer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'block',
                textDecoration: 'none',
                borderRadius: '20px',
                position: 'relative',
                overflow: 'hidden',
                cursor: s.website ? 'pointer' : 'default',
                // Staggered reveal
                opacity: visible ? 1 : 0,
                transform: visible
                    ? (hovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)')
                    : 'translateY(24px) scale(0.97)',
                boxShadow: hovered
                    ? `0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px ${tier.ring}, 0 0 40px ${tier.glow}`
                    : '0 4px 20px rgba(0,0,0,0.22)',
                transition: visible
                    ? `opacity 0.55s cubic-bezier(0.4,0,0.2,1) ${index * 80}ms,
                       transform 0.55s cubic-bezier(0.4,0,0.2,1) ${index * 80}ms,
                       box-shadow 0.4s cubic-bezier(0.4,0,0.2,1)`
                    : 'none',
            }}
        >
            {/* Border ring — brightens on hover */}
            <div style={{
                position: 'absolute', inset: 0, borderRadius: '20px', padding: '1px', zIndex: 2,
                pointerEvents: 'none',
                background: hovered
                    ? `linear-gradient(135deg, ${tier.ring}, transparent 45%, transparent 55%, ${tier.ring})`
                    : 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                transition: 'background 0.4s',
            }} />

            {/* One-shot shimmer sweep on reveal — desktop only (background-position repaints on mobile) */}
            {visible && !isMobile && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', borderRadius: '20px',
                    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%)',
                    backgroundSize: '200% 100%',
                    animation: `sponsorShimmer 0.9s cubic-bezier(0.4,0,0.2,1) ${index * 80 + 300}ms both`,
                }} />
            )}

            {/* Banner / hero image */}
            <div style={{
                height: '160px', position: 'relative', overflow: 'hidden',
                background: s.bannerUrl
                    ? 'transparent'
                    : `linear-gradient(135deg, rgba(30,35,50,0.95), rgba(20,22,30,0.95))`,
            }}>
                {s.bannerUrl && (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={s.bannerUrl}
                            alt={`${s.name} banner`}
                            style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                transform: hovered ? 'scale(1.08)' : 'scale(1)',
                                transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
                                filter: 'brightness(0.82)',
                            }}
                        />
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to top, rgba(10,12,18,0.95) 0%, rgba(10,12,18,0.35) 55%, transparent 100%)',
                        }} />
                    </>
                )}

                {/* No-banner: decorative radial + logo/initial */}
                {!s.bannerUrl && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `radial-gradient(circle at 20% 30%, ${tier.glow} 0%, transparent 55%),
                                          radial-gradient(circle at 80% 70%, rgba(255,255,255,0.02) 0%, transparent 50%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {s.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.logoUrl} alt={s.name} style={{
                                maxWidth: '120px', maxHeight: '80px', objectFit: 'contain',
                                opacity: 0.7, filter: 'brightness(1.2)',
                            }} />
                        ) : (
                            <span style={{
                                fontSize: '3rem', fontWeight: 900, opacity: 0.08,
                                fontFamily: 'var(--font-display)', color: tier.color,
                            }}>{s.name}</span>
                        )}
                    </div>
                )}

                {/* Tier badge — top-right */}
                <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: tier.color,
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                    border: `1px solid ${tier.ring}`,
                    padding: '3px 8px', borderRadius: '99px',
                }}>
                    {tier.label} {s.tier}
                </div>
            </div>

            {/* Info row — no backdropFilter on mobile (GPU paint cost) */}
            <div style={{
                padding: '16px 18px', position: 'relative',
                background: isMobile ? 'rgba(14,16,22,0.97)' : 'rgba(14,16,22,0.92)',
                backdropFilter: isMobile ? 'none' : 'blur(12px)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Logo chip */}
                    <div style={{
                        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                        background: s.logoUrl
                            ? `url(${s.logoUrl}) center/contain no-repeat, rgba(255,255,255,0.04)`
                            : `linear-gradient(135deg, ${tier.glow}, rgba(255,255,255,0.03))`,
                        border: `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'border-color 0.3s',
                    }}>
                        {!s.logoUrl && (
                            <span style={{
                                fontWeight: 800, fontSize: '0.9rem',
                                background: `linear-gradient(135deg, ${tier.color}, rgba(255,255,255,0.7))`,
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>{s.name.charAt(0)}</span>
                        )}
                    </div>

                    {/* Name + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{s.name}</div>
                        {s.description && (
                            <div style={{
                                fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                marginTop: '2px', lineHeight: 1.3,
                            }}>{s.description}</div>
                        )}
                    </div>

                    {/* Arrow */}
                    {s.website && (
                        <div style={{
                            opacity: hovered ? 1 : 0.2,
                            transform: hovered ? 'translateX(2px)' : 'translateX(-4px)',
                            transition: 'all 0.3s',
                            flexShrink: 0,
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke={tier.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        </a>
    )
}

// ── Section ──────────────────────────────────────────────────────────────────
export default function SponsorBannerSection({ sponsors }: { sponsors: HomeSponsor[] }) {
    const t = useTranslations('sponsorCta')
    const isMobile = useIsMobile()
    const gridRef = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)

    // Reveal the entire grid once it enters the viewport
    useEffect(() => {
        if (!gridRef.current) return
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
            { threshold: 0.08 }
        )
        observer.observe(gridRef.current)
        return () => observer.disconnect()
    }, [])

    const hasSponsors = sponsors.length > 0

    return (
        <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Ambient glow */}
            <div style={{
                position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
                width: '700px', height: '400px',
                background: 'radial-gradient(ellipse, rgba(212,168,83,0.03) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div className="container">
                {/* ── Sponsor grid ── */}
                {hasSponsors && (
                    <div style={{ marginBottom: '48px' }}>
                        {/* Section label */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            marginBottom: '24px',
                        }}>
                            <div style={{
                                width: '3px', height: '16px', borderRadius: '2px',
                                background: 'linear-gradient(to bottom, var(--accent-gold), transparent)',
                            }} />
                            <span style={{
                                fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.2em', color: 'var(--text-tertiary)',
                            }}>{t('supportedBy')}</span>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '18px', height: '18px', borderRadius: '5px',
                                background: 'rgba(212,168,83,0.08)', fontSize: '0.55rem',
                                fontWeight: 800, color: 'var(--accent-gold)',
                            }}>{sponsors.length}</div>
                        </div>

                        {/* Grid — responsive: 1 col mobile, auto-fill desktop */}
                        <div
                            ref={gridRef}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '16px',
                            }}
                        >
                            {sponsors.map((s, i) => (
                                <SponsorCard key={s.id} s={s} index={i} visible={visible} isMobile={isMobile} />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── CTA panel ── */}
                <div className="glass-panel" style={{
                    textAlign: 'center',
                    padding: 'var(--space-2xl) var(--space-xl)',
                    /* No backdropFilter on mobile — forces GPU composite layer = scroll jank */
                    backdropFilter: isMobile ? 'none' : 'blur(28px)',
                    WebkitBackdropFilter: isMobile ? 'none' : 'blur(28px)',
                    background: isMobile ? 'rgba(14,16,24,0.97)' : undefined,
                    border: '1px solid rgba(212,168,83,0.15)',
                    borderRadius: 'var(--radius-xl)',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                        background: 'linear-gradient(90deg, transparent 10%, rgba(212,168,83,0.3) 50%, transparent 90%)',
                    }} />
                    <div style={{
                        position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)',
                        width: '500px', height: '500px',
                        background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    <span className="text-label">{t('joinLabel')}</span>
                    <h2 style={{
                        marginTop: 'var(--space-sm)', marginBottom: 'var(--space-sm)',
                        fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
                    }}>
                        {t('joinTitle')}{' '}
                        <span style={{
                            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                            background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}>{t('joinAccent')}</span>
                    </h2>
                    <p style={{
                        maxWidth: '440px', margin: '0 auto var(--space-lg)',
                        fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                    }}>{t('joinDesc')}</p>
                    <div className="cta-button-row" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                        <Link href="/casting" className="btn btn-primary btn-lg">{t('viewRoles')}</Link>
                        <Link href="/upcoming" className="btn btn-secondary btn-lg">{t('exploreProjects')}</Link>
                        <Link href="/contact" className="btn btn-secondary btn-lg" style={{
                            background: 'rgba(212,168,83,0.08)',
                            border: '1px solid rgba(212,168,83,0.25)',
                            color: 'var(--accent-gold)',
                        }}>🤝 {t('becomeSponsor')}</Link>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes sponsorShimmer {
                    0%   { background-position: 200% 0; opacity: 0; }
                    15%  { opacity: 1; }
                    100% { background-position: -50% 0; opacity: 0; }
                }
            `}</style>
        </section>
    )
}
