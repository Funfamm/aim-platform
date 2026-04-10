import { Metadata } from 'next'
import nextDynamic from 'next/dynamic'
import Footer from '@/components/Footer'
const Scene3D = nextDynamic(() => import('@/components/Scene3D'))
import CinematicBackground from '@/components/CinematicBackground'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { prisma } from '@/lib/db'
import type { Sponsor } from '@prisma/client'
import { redirect } from 'next/navigation'
import { getUserSession } from '@/lib/auth'
import { getTranslations, getLocale } from 'next-intl/server'

export const metadata: Metadata = {
    title: 'Sponsors & Partners | AIM Studio',
    description: 'Meet the sponsors and partners supporting AI-powered filmmaking at AIM Studio.',
}

export const dynamic = 'force-dynamic'

export default async function SponsorsPage() {
    const t = await getTranslations('sponsors')

    let settings = null
    try { settings = await prisma.siteSettings.findFirst() } catch { /* schema drift */ }

    if (settings && settings.sponsorsPageEnabled === false) {
        return (
            <>
                <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🤝</div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>Sponsors Page Unavailable</h1>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                            This page is currently not available. Please check back soon.
                        </p>
                    </div>
                </main>
                <Footer />
            </>
        )
    }

    if (settings?.requireLoginForSponsors) {
        const session = await getUserSession()
        const locale = await getLocale()
        if (!session) redirect(`/${locale}/login`)
    }

    const now = new Date()
    const sponsors: Sponsor[] = await prisma.sponsor.findMany({
        where: {
            active: true,
            displayOn: { in: ['sponsors', 'all'] },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    const tiers = {
        platinum: sponsors.filter(s => s.tier === 'platinum'),
        gold: sponsors.filter(s => s.tier === 'gold'),
        silver: sponsors.filter(s => s.tier === 'silver'),
        bronze: sponsors.filter(s => s.tier === 'bronze'),
    }

    const tierConfig = {
        platinum: {
            label: t('platinum'), emoji: '💎',
            color: '#e8eaed', accent: 'rgba(232,234,237,0.08)',
            border: 'rgba(232,234,237,0.18)', glow: '0 0 32px rgba(232,234,237,0.06)',
            badgeBg: 'rgba(232,234,237,0.08)', logoH: '56px', isPremium: true,
        },
        gold: {
            label: t('gold'), emoji: '🥇',
            color: '#D4A853', accent: 'rgba(212,168,83,0.08)',
            border: 'rgba(212,168,83,0.2)', glow: '0 0 32px rgba(212,168,83,0.08)',
            badgeBg: 'rgba(212,168,83,0.08)', logoH: '44px', isPremium: true,
        },
        silver: {
            label: t('silver'), emoji: '🥈',
            color: '#C0C0C0', accent: 'rgba(192,192,192,0.06)',
            border: 'rgba(192,192,192,0.15)', glow: 'none',
            badgeBg: 'rgba(192,192,192,0.06)', logoH: '36px', isPremium: false,
        },
        bronze: {
            label: t('bronze'), emoji: '🥉',
            color: '#CD7F32', accent: 'rgba(205,127,50,0.06)',
            border: 'rgba(205,127,50,0.14)', glow: 'none',
            badgeBg: 'rgba(205,127,50,0.06)', logoH: '30px', isPremium: false,
        },
    }

    const hasSponsor = sponsors.length > 0

    const benefits = [
        { icon: '🎬', title: 'Brand Visibility', desc: 'Your brand featured across our AI-powered film productions and global screenings.' },
        { icon: '🌍', title: 'Global Reach', desc: 'Connect with our international audience of filmmakers, artists, and cinema enthusiasts.' },
        { icon: '🤖', title: 'Innovation Partner', desc: 'Be at the forefront of AI cinema — the next frontier of creative storytelling.' },
        { icon: '⭐', title: 'Exclusive Access', desc: 'VIP invitations to premieres, behind-the-scenes events, and partner-only workshops.' },
    ]

    const tierShowcase = [
        { name: 'Platinum', emoji: '💎', color: '#e8eaed', perks: ['Logo on all productions', 'Premiere VIP seats', 'Co-branded content', 'Annual feature story'] },
        { name: 'Gold', emoji: '🥇', color: '#D4A853', perks: ['Logo on website & credits', 'Event invitations', 'Social media features', 'Quarterly newsletter'] },
        { name: 'Silver', emoji: '🥈', color: '#C0C0C0', perks: ['Logo on website', 'Event invitations', 'Social media mention'] },
        { name: 'Bronze', emoji: '🥉', color: '#CD7F32', perks: ['Name listed on website', 'Community recognition'] },
    ]

    return (
        <>
            <CinematicBackground variant="showcase" />
            <Scene3D />
            <style>{`
                /* ── Sponsor card ── */
                .sp-card {
                    display: flex;
                    border-radius: 16px;
                    overflow: hidden;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    position: relative;
                    background: var(--bg-glass-light);
                }
                .sp-card:hover { transform: translateY(-3px); }

                /* Banner thumbnail */
                .sp-thumb {
                    flex-shrink: 0;
                    background-size: cover;
                    background-position: center;
                    position: relative;
                    min-height: 110px;
                }
                .sp-thumb::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to right, transparent 55%, var(--bg-glass-light));
                }
                .sp-thumb-placeholder {
                    flex-shrink: 0;
                    min-height: 110px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.8rem;
                }

                /* Card body */
                .sp-body {
                    flex: 1;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0;
                }

                /* Tier badge strip */
                .sp-tier-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 28px;
                }
                .sp-tier-row::before,
                .sp-tier-row::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: var(--sp-line);
                }
                .sp-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 14px;
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                /* Benefit card hover */
                .sp-benefit:hover {
                    border-color: rgba(212,168,83,0.22) !important;
                    transform: translateY(-2px);
                }

                /* Mobile */
                @media (max-width: 600px) {
                    .sp-card { flex-direction: column; }
                    .sp-thumb {
                        width: 100% !important;
                        min-height: 150px;
                    }
                    .sp-thumb::after {
                        background: linear-gradient(to bottom, transparent 50%, var(--bg-glass-light));
                    }
                    .sp-thumb-placeholder { width: 100% !important; min-height: 100px; }
                    .sp-body { padding: 16px; }
                }
            `}</style>

            <main id="main-content">

                {/* ─── HERO ─── */}
                <section style={{ padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-4xl)', textAlign: 'center', position: 'relative' }}>
                    <div className="container" style={{ maxWidth: '800px' }}>
                        <ScrollReveal3D direction="up" distance={40}>
                            <span className="text-label">{t('label')}</span>
                            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 800, marginBottom: 'var(--space-md)', lineHeight: 1.15 }}>
                                {t('title')} <span style={{ color: 'var(--accent-gold)' }}>{t('titleAccent')}</span>
                            </h1>
                            <div className="divider divider-center" />
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
                                {t('description')}
                            </p>
                        </ScrollReveal3D>
                    </div>
                </section>

                {/* ─── SPONSOR TIERS ─── */}
                {hasSponsor && (
                    <section style={{ padding: '0 0 var(--space-4xl)' }}>
                        <div className="container" style={{ maxWidth: '900px' }}>
                            {Object.entries(tiers).map(([tier, list]) => {
                                if (list.length === 0) return null
                                const cfg = tierConfig[tier as keyof typeof tierConfig]
                                return (
                                    <div key={tier} style={{ marginBottom: 'var(--space-4xl)' }}>

                                        {/* Tier header */}
                                        <ScrollReveal3D direction="up" distance={15}>
                                            <div
                                                className="sp-tier-row"
                                                style={{ ['--sp-line' as string]: cfg.border } as React.CSSProperties}
                                            >
                                                <div className="sp-badge" style={{ background: cfg.badgeBg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                                                    {cfg.emoji} {cfg.label}
                                                </div>
                                            </div>
                                        </ScrollReveal3D>

                                        {/* Cards */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: cfg.isPremium ? '20px' : '14px' }}>
                                            {list.map((sponsor: Sponsor, i: number) => (
                                                <ScrollReveal3D key={sponsor.id} direction="up" delay={i * 80} distance={20}>
                                                    <div
                                                        className="sp-card"
                                                        style={{
                                                            border: `1px solid ${cfg.border}`,
                                                            boxShadow: cfg.isPremium ? cfg.glow : 'none',
                                                        }}
                                                    >
                                                        {/* Top accent line */}
                                                        <div style={{
                                                            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                                            background: `linear-gradient(90deg, ${cfg.color}70, transparent)`,
                                                            zIndex: 2,
                                                        }} />

                                                        {/* Banner thumbnail or placeholder */}
                                                        {sponsor.bannerUrl ? (
                                                            <div
                                                                className="sp-thumb"
                                                                style={{
                                                                    backgroundImage: `url(${sponsor.bannerUrl})`,
                                                                    width: cfg.isPremium ? '140px' : '110px',
                                                                }}
                                                            />
                                                        ) : (
                                                            <div
                                                                className="sp-thumb-placeholder"
                                                                style={{
                                                                    width: cfg.isPremium ? '140px' : '110px',
                                                                    background: cfg.accent,
                                                                    fontSize: cfg.isPremium ? '2rem' : '1.5rem',
                                                                }}
                                                            >
                                                                🏢
                                                            </div>
                                                        )}

                                                        {/* Body */}
                                                        <div className="sp-body">
                                                            {sponsor.logoUrl && (
                                                                <img
                                                                    src={sponsor.logoUrl}
                                                                    alt={sponsor.name}
                                                                    style={{ maxHeight: cfg.logoH, maxWidth: '160px', objectFit: 'contain', marginBottom: '10px' }}
                                                                />
                                                            )}
                                                            <div style={{
                                                                fontSize: cfg.isPremium ? '1rem' : '0.88rem',
                                                                fontWeight: 700,
                                                                color: 'var(--text-primary)',
                                                                marginBottom: '4px',
                                                                letterSpacing: '0.01em',
                                                            }}>
                                                                {sponsor.name}
                                                            </div>
                                                            {cfg.isPremium && sponsor.description && (
                                                                <p style={{
                                                                    fontSize: '0.77rem',
                                                                    color: 'var(--text-tertiary)',
                                                                    lineHeight: 1.6,
                                                                    margin: '0 0 12px',
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: 2,
                                                                    WebkitBoxOrient: 'vertical' as const,
                                                                    overflow: 'hidden',
                                                                }}>
                                                                    {sponsor.description}
                                                                </p>
                                                            )}
                                                            {sponsor.website && (
                                                                <a
                                                                    href={sponsor.website}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                        marginTop: 'auto',
                                                                        fontSize: '0.7rem', fontWeight: 600,
                                                                        color: cfg.color, textDecoration: 'none',
                                                                        padding: '5px 12px',
                                                                        borderRadius: '6px',
                                                                        background: cfg.badgeBg,
                                                                        border: `1px solid ${cfg.border}`,
                                                                        alignSelf: 'flex-start',
                                                                        transition: 'opacity 0.2s',
                                                                    }}
                                                                >
                                                                    🌐 {t('visitWebsite')}
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </ScrollReveal3D>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* ─── BENEFITS ─── */}
                <section style={{ padding: 'var(--space-4xl) 0' }}>
                    <div className="container" style={{ maxWidth: '960px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <span className="text-label">Why Partner With Us</span>
                                <h2 style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                                    The <span style={{ color: 'var(--accent-gold)' }}>Benefits</span> of Partnership
                                </h2>
                                <div className="divider divider-center" />
                            </div>
                        </ScrollReveal3D>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-lg)' }}>
                            {benefits.map((b, i) => (
                                <ScrollReveal3D key={i} direction="up" delay={i * 80} distance={20}>
                                    <div className="sp-benefit" style={{
                                        background: 'var(--bg-glass-light)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-xl)',
                                        padding: 'var(--space-xl) var(--space-lg)',
                                        textAlign: 'center',
                                        transition: 'all 0.3s ease',
                                        position: 'relative', overflow: 'hidden',
                                    }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)', opacity: 0.4 }} />
                                        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)', filter: 'drop-shadow(0 0 12px rgba(212,168,83,0.2))' }}>{b.icon}</div>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{b.title}</h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: 1.65, margin: 0 }}>{b.desc}</p>
                                    </div>
                                </ScrollReveal3D>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── TIER SHOWCASE ─── */}
                <section style={{ padding: 'var(--space-4xl) 0' }}>
                    <div className="container" style={{ maxWidth: '960px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <span className="text-label">Collaboration Tiers</span>
                                <h2 style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                                    Choose Your <span style={{ color: 'var(--accent-gold)' }}>Partnership</span> Level
                                </h2>
                                <div className="divider divider-center" />
                            </div>
                        </ScrollReveal3D>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                            {tierShowcase.map((ts, i) => (
                                <ScrollReveal3D key={ts.name} direction="up" delay={i * 100} distance={20}>
                                    <div style={{
                                        background: 'var(--bg-glass-light)',
                                        border: `1px solid ${ts.color}18`,
                                        borderRadius: 'var(--radius-xl)',
                                        padding: 'var(--space-xl) var(--space-lg)',
                                        textAlign: 'center',
                                        position: 'relative', overflow: 'hidden',
                                        transition: 'transform 0.3s ease',
                                    }}>
                                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60px', height: '2px', background: ts.color, borderRadius: '0 0 4px 4px', boxShadow: `0 0 12px ${ts.color}40` }} />
                                        <div style={{ fontSize: '1.8rem', marginBottom: '10px', filter: `drop-shadow(0 0 8px ${ts.color}30)` }}>{ts.emoji}</div>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: ts.color, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 'var(--space-md)' }}>{ts.name}</h3>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {ts.perks.map((perk, j) => (
                                                <li key={j} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                                    <span style={{ color: ts.color, fontSize: '0.6rem' }}>◆</span>
                                                    {perk}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </ScrollReveal3D>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── CTA ─── */}
                <section style={{ padding: '0 0 var(--space-5xl)' }}>
                    <div className="container" style={{ maxWidth: '700px' }}>
                        <ScrollReveal3D direction="up" delay={100}>
                            <div style={{
                                background: 'linear-gradient(145deg, rgba(212,168,83,0.06), var(--bg-glass-light))',
                                border: '1px solid rgba(212,168,83,0.12)',
                                borderRadius: 'var(--radius-2xl)',
                                padding: 'var(--space-3xl) var(--space-2xl)',
                                textAlign: 'center',
                                position: 'relative', overflow: 'hidden',
                            }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.3), transparent)' }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.15), transparent)' }} />
                                <div style={{ fontSize: '2.4rem', marginBottom: 'var(--space-md)' }}>🤝</div>
                                <h3 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontWeight: 800, marginBottom: 'var(--space-sm)', color: 'var(--text-primary)' }}>
                                    {hasSponsor ? t('ctaTitle') : t('becomePartner')}
                                </h3>
                                <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-xl)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
                                    {hasSponsor ? t('ctaDesc') : t('becomeDesc')}
                                </p>
                                <a
                                    href="/contact"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        padding: '12px 28px',
                                        background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dark))',
                                        color: 'var(--bg-primary)',
                                        borderRadius: 'var(--radius-full)',
                                        fontWeight: 700, fontSize: '0.85rem',
                                        textDecoration: 'none',
                                        letterSpacing: '0.02em',
                                        boxShadow: '0 4px 20px rgba(212,168,83,0.3), 0 0 40px rgba(212,168,83,0.08)',
                                        transition: 'all 0.3s ease',
                                    }}
                                >
                                    {hasSponsor ? t('ctaBtn') : t('getInTouch')}
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                </a>
                            </div>
                        </ScrollReveal3D>
                    </div>
                </section>

            </main>
            <Footer />
        </>
    )
}
