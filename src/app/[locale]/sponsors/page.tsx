import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Footer from '@/components/Footer'
const Scene3D = dynamic(() => import('@/components/Scene3D'))
import CinematicBackground from '@/components/CinematicBackground'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { prisma } from '@/lib/db'
import type { Sponsor } from '@prisma/client'
import { redirect } from 'next/navigation'
import { getUserSession } from '@/lib/auth'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
    title: 'Sponsors & Partners | AIM Studio',
    description: 'Meet the sponsors and partners supporting AI-powered filmmaking at AIM Studio.',
}

export const revalidate = 120

export default async function SponsorsPage() {
    const t = await getTranslations('sponsors')

    const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } })

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
        if (!session) redirect('/login')
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
        platinum: { label: `💎 ${t('platinum')}`, color: '#e5e7eb', borderColor: 'rgba(229,231,235,0.25)', glow: 'rgba(229,231,235,0.08)', cardSize: '300px', logoH: '80px' },
        gold: { label: `🥇 ${t('gold')}`, color: '#D4A853', borderColor: 'rgba(212,168,83,0.25)', glow: 'rgba(212,168,83,0.06)', cardSize: '260px', logoH: '65px' },
        silver: { label: `🥈 ${t('silver')}`, color: '#C0C0C0', borderColor: 'rgba(192,192,192,0.2)', glow: 'rgba(192,192,192,0.05)', cardSize: '220px', logoH: '50px' },
        bronze: { label: `🥉 ${t('bronze')}`, color: '#CD7F32', borderColor: 'rgba(205,127,50,0.2)', glow: 'rgba(205,127,50,0.04)', cardSize: '180px', logoH: '40px' },
    }

    const hasSponsor = sponsors.length > 0

    // Benefits data
    const benefits = [
        {
            icon: '🎬',
            title: 'Brand Visibility',
            desc: 'Your brand featured across our AI-powered film productions and global screenings.',
        },
        {
            icon: '🌍',
            title: 'Global Reach',
            desc: 'Connect with our international audience of filmmakers, artists, and cinema enthusiasts.',
        },
        {
            icon: '🤖',
            title: 'Innovation Partner',
            desc: 'Be at the forefront of AI cinema — the next frontier of creative storytelling.',
        },
        {
            icon: '⭐',
            title: 'Exclusive Access',
            desc: 'VIP invitations to premieres, behind-the-scenes events, and partner-only workshops.',
        },
    ]

    // Partnership tiers overview
    const tierShowcase = [
        { name: 'Platinum', emoji: '💎', color: '#e5e7eb', perks: ['Logo on all productions', 'Premiere VIP seats', 'Co-branded content', 'Annual feature story'] },
        { name: 'Gold', emoji: '🥇', color: '#D4A853', perks: ['Logo on website & credits', 'Event invitations', 'Social media features', 'Quarterly newsletter'] },
        { name: 'Silver', emoji: '🥈', color: '#C0C0C0', perks: ['Logo on website', 'Event invitations', 'Social media mention'] },
        { name: 'Bronze', emoji: '🥉', color: '#CD7F32', perks: ['Name listed on website', 'Community recognition'] },
    ]

    return (
        <>
            <CinematicBackground variant="showcase" />
            <Scene3D />
            <main id="main-content">
                {/* ═══ HERO ═══ */}
                <section style={{
                    padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-4xl)',
                    textAlign: 'center',
                    position: 'relative',
                }}>
                    <div className="container" style={{ maxWidth: '800px' }}>
                        <ScrollReveal3D direction="up" distance={40}>
                            <span className="text-label">{t('label')}</span>
                            <h1 style={{
                                fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                                fontWeight: 800,
                                marginBottom: 'var(--space-md)',
                                lineHeight: 1.15,
                            }}>
                                {t('title')} <span style={{ color: 'var(--accent-gold)' }}>{t('titleAccent')}</span>
                            </h1>
                            <div className="divider divider-center" />
                            <p style={{
                                color: 'var(--text-tertiary)',
                                fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
                                maxWidth: '560px',
                                margin: '0 auto',
                                lineHeight: 1.7,
                            }}>
                                {t('description')}
                            </p>
                        </ScrollReveal3D>
                    </div>
                </section>

                {/* ═══ SPONSOR TIERS ═══ */}
                {hasSponsor && (
                    <section style={{ padding: '0 0 var(--space-4xl)' }}>
                        <div className="container" style={{ maxWidth: '960px' }}>
                            {Object.entries(tiers).map(([tier, list]) => {
                                if (list.length === 0) return null
                                const config = tierConfig[tier as keyof typeof tierConfig]
                                const isPremium = tier === 'platinum' || tier === 'gold'
                                return (
                                    <div key={tier} style={{ marginBottom: 'var(--space-3xl)' }}>
                                        <ScrollReveal3D direction="up" distance={20}>
                                            <h2 style={{
                                                fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.14em',
                                                textTransform: 'uppercase' as const, color: config.color,
                                                textAlign: 'center', marginBottom: 'var(--space-xl)',
                                            }}>
                                                {config.label}
                                            </h2>
                                        </ScrollReveal3D>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(auto-fill, minmax(${config.cardSize}, 1fr))`,
                                            gap: 'var(--space-lg)',
                                        }}>
                                            {list.map((sponsor: Sponsor, i: number) => (
                                                <ScrollReveal3D key={sponsor.id} direction="up" delay={i * 100} distance={25}>
                                                    <div style={{
                                                        display: 'flex', flexDirection: 'column',
                                                        background: `linear-gradient(145deg, ${config.glow}, var(--bg-glass-light))`,
                                                        border: `1px solid ${config.borderColor}`,
                                                        borderRadius: 'var(--radius-xl)',
                                                        overflow: 'hidden',
                                                        transition: 'transform 0.3s ease, border-color 0.3s, box-shadow 0.3s',
                                                    }}>
                                                        {isPremium && sponsor.bannerUrl && (
                                                            <div style={{
                                                                height: tier === 'platinum' ? '120px' : '90px',
                                                                backgroundImage: `url(${sponsor.bannerUrl})`,
                                                                backgroundSize: 'cover', backgroundPosition: 'center',
                                                            }} />
                                                        )}
                                                        <div style={{
                                                            padding: isPremium ? 'var(--space-xl)' : 'var(--space-lg)',
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                            textAlign: 'center', flex: 1,
                                                        }}>
                                                            {sponsor.logoUrl ? (
                                                                <img
                                                                    src={sponsor.logoUrl}
                                                                    alt={sponsor.name}
                                                                    style={{
                                                                        maxHeight: config.logoH, maxWidth: '180px',
                                                                        objectFit: 'contain', marginBottom: 'var(--space-sm)',
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div style={{ fontSize: isPremium ? '2.2rem' : '1.6rem', marginBottom: 'var(--space-sm)' }}>🏢</div>
                                                            )}
                                                            <span style={{
                                                                fontSize: isPremium ? '1.05rem' : '0.92rem',
                                                                fontWeight: 700, color: 'var(--text-primary)',
                                                                marginBottom: '6px',
                                                            }}>
                                                                {sponsor.name}
                                                            </span>
                                                            {isPremium && sponsor.description && (
                                                                <p style={{
                                                                    fontSize: '0.78rem', color: 'var(--text-tertiary)',
                                                                    lineHeight: 1.6, marginBottom: 'var(--space-sm)',
                                                                    maxHeight: '52px', overflow: 'hidden',
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
                                                                        marginTop: 'auto', paddingTop: 'var(--space-sm)',
                                                                        fontSize: '0.72rem', fontWeight: 600,
                                                                        color: config.color, textDecoration: 'none',
                                                                        padding: '6px 16px', borderRadius: '8px',
                                                                        background: `${config.color}10`,
                                                                        border: `1px solid ${config.borderColor}`,
                                                                        transition: 'all 0.25s ease',
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

                {/* ═══ WHY PARTNER — BENEFITS GRID ═══ */}
                <section style={{ padding: 'var(--space-4xl) 0' }}>
                    <div className="container" style={{ maxWidth: '960px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <span className="text-label">Why Partner With Us</span>
                                <h2 style={{
                                    fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
                                    fontWeight: 800,
                                    marginBottom: 'var(--space-sm)',
                                }}>
                                    The <span style={{ color: 'var(--accent-gold)' }}>Benefits</span> of Partnership
                                </h2>
                                <div className="divider divider-center" />
                            </div>
                        </ScrollReveal3D>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 'var(--space-lg)',
                        }}>
                            {benefits.map((b, i) => (
                                <ScrollReveal3D key={i} direction="up" delay={i * 80} distance={20}>
                                    <div style={{
                                        background: 'var(--bg-glass-light)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-xl)',
                                        padding: 'var(--space-xl) var(--space-lg)',
                                        textAlign: 'center',
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                            background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)',
                                            opacity: 0.4,
                                        }} />
                                        <div style={{
                                            fontSize: '2rem',
                                            marginBottom: 'var(--space-md)',
                                            filter: 'drop-shadow(0 0 12px rgba(212,168,83,0.2))',
                                        }}>
                                            {b.icon}
                                        </div>
                                        <h3 style={{
                                            fontSize: '0.95rem', fontWeight: 700,
                                            marginBottom: '8px', color: 'var(--text-primary)',
                                        }}>
                                            {b.title}
                                        </h3>
                                        <p style={{
                                            fontSize: '0.8rem', color: 'var(--text-tertiary)',
                                            lineHeight: 1.65, margin: 0,
                                        }}>
                                            {b.desc}
                                        </p>
                                    </div>
                                </ScrollReveal3D>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══ PARTNERSHIP TIERS SHOWCASE ═══ */}
                <section style={{ padding: 'var(--space-4xl) 0' }}>
                    <div className="container" style={{ maxWidth: '960px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <span className="text-label">Collaboration Tiers</span>
                                <h2 style={{
                                    fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
                                    fontWeight: 800,
                                    marginBottom: 'var(--space-sm)',
                                }}>
                                    Choose Your <span style={{ color: 'var(--accent-gold)' }}>Partnership</span> Level
                                </h2>
                                <div className="divider divider-center" />
                            </div>
                        </ScrollReveal3D>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 'var(--space-md)',
                        }}>
                            {tierShowcase.map((t, i) => (
                                <ScrollReveal3D key={t.name} direction="up" delay={i * 100} distance={20}>
                                    <div style={{
                                        background: 'var(--bg-glass-light)',
                                        border: `1px solid ${t.color}18`,
                                        borderRadius: 'var(--radius-xl)',
                                        padding: 'var(--space-xl) var(--space-lg)',
                                        textAlign: 'center',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        transition: 'all 0.3s ease',
                                    }}>
                                        {/* Tier glow accent at top */}
                                        <div style={{
                                            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                                            width: '60px', height: '2px',
                                            background: t.color, borderRadius: '0 0 4px 4px',
                                            boxShadow: `0 0 12px ${t.color}40`,
                                        }} />

                                        <div style={{
                                            fontSize: '1.8rem', marginBottom: '10px',
                                            filter: `drop-shadow(0 0 8px ${t.color}30)`,
                                        }}>
                                            {t.emoji}
                                        </div>
                                        <h3 style={{
                                            fontSize: '0.9rem', fontWeight: 700,
                                            color: t.color, letterSpacing: '0.08em',
                                            textTransform: 'uppercase' as const,
                                            marginBottom: 'var(--space-md)',
                                        }}>
                                            {t.name}
                                        </h3>
                                        <ul style={{
                                            listStyle: 'none', padding: 0, margin: 0,
                                            display: 'flex', flexDirection: 'column', gap: '8px',
                                        }}>
                                            {t.perks.map((perk, j) => (
                                                <li key={j} style={{
                                                    fontSize: '0.72rem',
                                                    color: 'var(--text-secondary)',
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    justifyContent: 'center',
                                                }}>
                                                    <span style={{ color: t.color, fontSize: '0.6rem' }}>◆</span>
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

                {/* ═══ BECOME A PARTNER CTA ═══ */}
                <section style={{ padding: '0 0 var(--space-5xl)' }}>
                    <div className="container" style={{ maxWidth: '700px' }}>
                        <ScrollReveal3D direction="up" delay={100}>
                            <div style={{
                                background: 'linear-gradient(145deg, rgba(212,168,83,0.06), var(--bg-glass-light))',
                                border: '1px solid rgba(212,168,83,0.12)',
                                borderRadius: 'var(--radius-2xl)',
                                padding: 'var(--space-3xl) var(--space-2xl)',
                                textAlign: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                            }}>
                                {/* Decorative corner accents */}
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                                    background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.3), transparent)',
                                }} />
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
                                    background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.15), transparent)',
                                }} />

                                <div style={{ fontSize: '2.4rem', marginBottom: 'var(--space-md)' }}>🤝</div>
                                <h3 style={{
                                    fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                                    fontWeight: 800,
                                    marginBottom: 'var(--space-sm)',
                                    color: 'var(--text-primary)',
                                }}>
                                    {hasSponsor ? t('ctaTitle') : t('becomePartner')}
                                </h3>
                                <p style={{
                                    color: 'var(--text-tertiary)',
                                    marginBottom: 'var(--space-xl)',
                                    fontSize: '0.9rem',
                                    maxWidth: '480px',
                                    margin: '0 auto var(--space-xl)',
                                    lineHeight: 1.7,
                                }}>
                                    {hasSponsor ? t('ctaDesc') : t('becomeDesc')}
                                </p>
                                <a href="/contact" style={{
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
                                }}>
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
