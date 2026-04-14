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
import SponsorInquiryForm from '@/components/SponsorInquiryForm'

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
                <main style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                    <div>
                        <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🤝</div>
                        <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, marginBottom: '12px' }}>{t('unavailableTitle')}</h1>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.7 }}>
                            {t('unavailableDesc')}
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
            color: '#e8eaed', accent: 'rgba(232,234,237,0.05)',
            border: 'rgba(232,234,237,0.15)', glow: '0 8px 40px rgba(232,234,237,0.06)',
            gradStart: 'rgba(232,234,237,0.08)', logoH: '52px', isPremium: true,
        },
        gold: {
            label: t('gold'), emoji: '🥇',
            color: '#D4A853', accent: 'rgba(212,168,83,0.06)',
            border: 'rgba(212,168,83,0.18)', glow: '0 8px 40px rgba(212,168,83,0.10)',
            gradStart: 'rgba(212,168,83,0.07)', logoH: '42px', isPremium: true,
        },
        silver: {
            label: t('silver'), emoji: '🥈',
            color: '#C0C0C0', accent: 'rgba(192,192,192,0.04)',
            border: 'rgba(192,192,192,0.12)', glow: 'none',
            gradStart: 'rgba(192,192,192,0.04)', logoH: '34px', isPremium: false,
        },
        bronze: {
            label: t('bronze'), emoji: '🥉',
            color: '#CD7F32', accent: 'rgba(205,127,50,0.04)',
            border: 'rgba(205,127,50,0.12)', glow: 'none',
            gradStart: 'rgba(205,127,50,0.04)', logoH: '28px', isPremium: false,
        },
    }

    const hasSponsor = sponsors.length > 0

    const benefits = [
        { icon: '🎬', titleKey: 'benefit1Title', descKey: 'benefit1Desc' },
        { icon: '🌍', titleKey: 'benefit2Title', descKey: 'benefit2Desc' },
        { icon: '🤖', titleKey: 'benefit3Title', descKey: 'benefit3Desc' },
        { icon: '⭐', titleKey: 'benefit4Title', descKey: 'benefit4Desc' },
    ]

    const tierShowcase = [
        {
            nameKey: 'platinumName', emoji: '💎', color: '#e8eaed',
            perks: ['perk_plat_1', 'perk_plat_2', 'perk_plat_3', 'perk_plat_4'],
        },
        {
            nameKey: 'goldName', emoji: '🥇', color: '#D4A853',
            perks: ['perk_gold_1', 'perk_gold_2', 'perk_gold_3', 'perk_gold_4'],
        },
        {
            nameKey: 'silverName', emoji: '🥈', color: '#C0C0C0',
            perks: ['perk_silv_1', 'perk_silv_2', 'perk_silv_3'],
        },
        {
            nameKey: 'bronzeName', emoji: '🥉', color: '#CD7F32',
            perks: ['perk_brnz_1', 'perk_brnz_2'],
        },
    ]

    return (
        <>
            <CinematicBackground variant="showcase" />
            <Scene3D />
            <style>{`
                /* ── Sponsor Card — Horizontal on desktop, stacked on mobile ── */
                .sp-card {
                    display: grid;
                    grid-template-columns: 180px 1fr;
                    border-radius: 20px;
                    overflow: hidden;
                    transition: transform 0.35s cubic-bezier(0.4,0,0.2,1), box-shadow 0.35s ease;
                    position: relative;
                    background: var(--bg-glass-light);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                }
                .sp-card:hover { transform: translateY(-4px); }

                /* Thumbnail column */
                .sp-thumb {
                    background-size: cover;
                    background-position: center;
                    position: relative;
                    min-height: 130px;
                }
                .sp-thumb::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to right, transparent 40%, var(--bg-glass-light) 100%);
                }
                .sp-thumb-placeholder {
                    min-height: 130px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.4rem;
                }

                /* Body column */
                .sp-body {
                    padding: 24px 28px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 10px;
                    min-width: 0;
                }

                /* Tier divider row */
                .sp-tier-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 32px;
                }
                .sp-tier-row::before,
                .sp-tier-row::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: var(--sp-line);
                    opacity: 0.6;
                }
                .sp-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    padding: 6px 18px;
                    border-radius: 999px;
                    font-size: 0.68rem;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                /* Benefit card */
                .sp-benefit {
                    background: var(--bg-glass-light);
                    border: 1px solid var(--border-subtle);
                    border-radius: 20px;
                    padding: var(--space-xl) var(--space-lg);
                    text-align: center;
                    transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }
                .sp-benefit:hover {
                    border-color: rgba(212,168,83,0.25);
                    transform: translateY(-3px);
                    box-shadow: 0 12px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(212,168,83,0.05);
                }
                .sp-benefit-icon {
                    font-size: 2.2rem;
                    margin-bottom: 14px;
                    filter: drop-shadow(0 0 12px rgba(212,168,83,0.18));
                    display: block;
                }

                /* Tier showcase card */
                .sp-tier-card {
                    background: var(--bg-glass-light);
                    border-radius: 20px;
                    padding: var(--space-xl) var(--space-lg);
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .sp-tier-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 16px 40px rgba(0,0,0,0.2);
                }

                /* Mobile */
                @media (max-width: 640px) {
                    .sp-card {
                        grid-template-columns: 1fr;
                    }
                    .sp-thumb {
                        min-height: 160px;
                        width: 100%;
                    }
                    .sp-thumb::after {
                        background: linear-gradient(to bottom, transparent 40%, var(--bg-glass-light) 100%);
                    }
                    .sp-thumb-placeholder {
                        min-height: 110px;
                        width: 100%;
                    }
                    .sp-body {
                        padding: 18px 20px;
                    }
                }

                @media (max-width: 480px) {
                    .sp-tier-row { margin-bottom: 20px; }
                    .sp-badge { font-size: 0.6rem; padding: 5px 14px; }
                }
            `}</style>

            <main id="main-content">

                {/* ─── HERO ─── */}
                <section style={{ padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-4xl)', textAlign: 'center', position: 'relative' }}>
                    <div className="container" style={{ maxWidth: '800px' }}>
                        <ScrollReveal3D direction="up" distance={40}>
                            <span className="text-label">{t('label')}</span>
                            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)', fontWeight: 800, marginBottom: 'var(--space-md)', lineHeight: 1.12, letterSpacing: '-0.02em' }}>
                                {t('title')} <span style={{ color: 'var(--accent-gold)' }}>{t('titleAccent')}</span>
                            </h1>
                            <div className="divider divider-center" />
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.75 }}>
                                {t('description')}
                            </p>
                        </ScrollReveal3D>
                    </div>
                </section>

                {/* ─── ACTIVE SPONSOR TIERS ─── */}
                {hasSponsor && (
                    <section style={{ padding: '0 0 var(--space-5xl)' }}>
                        <div className="container" style={{ maxWidth: '960px' }}>
                            {Object.entries(tiers).map(([tier, list]) => {
                                if (list.length === 0) return null
                                const cfg = tierConfig[tier as keyof typeof tierConfig]
                                return (
                                    <div key={tier} style={{ marginBottom: 'calc(var(--space-4xl) + 8px)' }}>

                                        {/* Tier badge divider */}
                                        <ScrollReveal3D direction="up" distance={15}>
                                            <div
                                                className="sp-tier-row"
                                                style={{ ['--sp-line' as string]: cfg.border } as React.CSSProperties}
                                            >
                                                <div className="sp-badge" style={{ background: cfg.gradStart, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                                                    {cfg.emoji} {cfg.label}
                                                </div>
                                            </div>
                                        </ScrollReveal3D>

                                        {/* Sponsor cards */}
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
                                                        {/* Accent line */}
                                                        <div style={{
                                                            position: 'absolute', top: 0, left: 0, right: 0, height: '2px', zIndex: 2,
                                                            background: `linear-gradient(90deg, ${cfg.color}80, transparent 70%)`,
                                                        }} />

                                                        {/* Thumbnail */}
                                                        {sponsor.bannerUrl ? (
                                                            <div className="sp-thumb" style={{ backgroundImage: `url(${sponsor.bannerUrl})` }} />
                                                        ) : (
                                                            <div className="sp-thumb-placeholder" style={{ background: cfg.accent, fontSize: cfg.isPremium ? '2.4rem' : '1.8rem' }}>
                                                                🏢
                                                            </div>
                                                        )}

                                                        {/* Body */}
                                                        <div className="sp-body">
                                                            {sponsor.logoUrl && (
                                                                <img
                                                                    src={sponsor.logoUrl}
                                                                    alt={sponsor.name}
                                                                    style={{ maxHeight: cfg.logoH, maxWidth: '180px', objectFit: 'contain' }}
                                                                />
                                                            )}
                                                            <div style={{ fontSize: cfg.isPremium ? '1.05rem' : '0.9rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                                                                {sponsor.name}
                                                            </div>
                                                            {cfg.isPremium && sponsor.description && (
                                                                <p style={{
                                                                    fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: 1.65, margin: 0,
                                                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
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
                                                                        fontSize: '0.72rem', fontWeight: 700,
                                                                        color: cfg.color, textDecoration: 'none',
                                                                        padding: '6px 14px',
                                                                        borderRadius: '99px',
                                                                        background: cfg.gradStart,
                                                                        border: `1px solid ${cfg.border}`,
                                                                        alignSelf: 'flex-start',
                                                                        transition: 'opacity 0.2s',
                                                                        letterSpacing: '0.04em',
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
                <section style={{ padding: 'var(--space-4xl) 0', background: 'rgba(212,168,83,0.015)' }}>
                    <div className="container" style={{ maxWidth: '1000px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <span className="text-label">{t('benefitsLabel')}</span>
                                <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', fontWeight: 800, marginBottom: 'var(--space-sm)', letterSpacing: '-0.01em' }}>
                                    {t('benefitsTitle')} <span style={{ color: 'var(--accent-gold)' }}>{t('benefitsTitleAccent')}</span>
                                </h2>
                                <div className="divider divider-center" />
                            </div>
                        </ScrollReveal3D>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)' }}>
                            {benefits.map((b, i) => (
                                <ScrollReveal3D key={i} direction="up" delay={i * 80} distance={20}>
                                    <div className="sp-benefit">
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)', opacity: 0.35 }} />
                                        <span className="sp-benefit-icon">{b.icon}</span>
                                        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                                            {t(b.titleKey as Parameters<typeof t>[0])}
                                        </h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: 1.7, margin: 0 }}>
                                            {t(b.descKey as Parameters<typeof t>[0])}
                                        </p>
                                    </div>
                                </ScrollReveal3D>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── TIER SHOWCASE ─── */}
                <section style={{ padding: 'var(--space-4xl) 0' }}>
                    <div className="container" style={{ maxWidth: '1000px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <span className="text-label">{t('tiersLabel')}</span>
                                <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', fontWeight: 800, marginBottom: 'var(--space-sm)', letterSpacing: '-0.01em' }}>
                                    {t('tiersTitle')} <span style={{ color: 'var(--accent-gold)' }}>{t('tiersTitleAccent')}</span>
                                </h2>
                                <div className="divider divider-center" />
                            </div>
                        </ScrollReveal3D>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-md)' }}>
                            {tierShowcase.map((ts, i) => (
                                <ScrollReveal3D key={ts.nameKey} direction="up" delay={i * 100} distance={20}>
                                    <div
                                        className="sp-tier-card"
                                        style={{ border: `1px solid ${ts.color}22` }}
                                    >
                                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '64px', height: '3px', background: ts.color, borderRadius: '0 0 6px 6px', boxShadow: `0 0 14px ${ts.color}50` }} />
                                        <div style={{ fontSize: '2rem', marginBottom: '12px', filter: `drop-shadow(0 0 10px ${ts.color}40)` }}>{ts.emoji}</div>
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: ts.color, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 'var(--space-lg)' }}>
                                            {t(ts.nameKey as Parameters<typeof t>[0])}
                                        </h3>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {ts.perks.map((perk, j) => (
                                                <li key={j} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '7px', textAlign: 'left' }}>
                                                    <span style={{ color: ts.color, fontSize: '0.55rem', marginTop: '4px', flexShrink: 0 }}>◆</span>
                                                    {t(perk as Parameters<typeof t>[0])}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </ScrollReveal3D>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── SPONSOR INQUIRY FORM ─── */}
                <section style={{ padding: '0 0 var(--space-5xl)' }}>
                    <div className="container" style={{ maxWidth: '720px' }}>
                        <ScrollReveal3D direction="up" delay={100}>
                            <SponsorInquiryForm hasSponsor={hasSponsor} />
                        </ScrollReveal3D>
                    </div>
                </section>

            </main>
            <Footer />
        </>
    )
}
