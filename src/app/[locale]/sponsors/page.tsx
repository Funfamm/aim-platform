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

    // Access gate
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } })

    // Page visibility gate
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
        platinum: { label: `💎 ${t('platinum')}`, color: '#e5e7eb', borderColor: 'rgba(229,231,235,0.25)', cardSize: '300px', logoH: '80px' },
        gold: { label: `🥇 ${t('gold')}`, color: '#D4A853', borderColor: 'rgba(212,168,83,0.25)', cardSize: '260px', logoH: '65px' },
        silver: { label: `🥈 ${t('silver')}`, color: '#C0C0C0', borderColor: 'rgba(192,192,192,0.2)', cardSize: '220px', logoH: '50px' },
        bronze: { label: `🥉 ${t('bronze')}`, color: '#CD7F32', borderColor: 'rgba(205,127,50,0.2)', cardSize: '180px', logoH: '40px' },
    }

    return (
        <>
            <CinematicBackground variant="showcase" />
            <Scene3D />
            <main id="main-content">
                <section style={{
                    padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-5xl)',
                    textAlign: 'center',
                }}>
                    <div className="container" style={{ maxWidth: '960px' }}>
                        <ScrollReveal3D direction="up" distance={40}>
                            <span className="text-label">{t('label')}</span>
                            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: 'var(--space-md)' }}>
                                {t('title')} <span style={{ color: 'var(--accent-gold)' }}>{t('titleAccent')}</span>
                            </h1>
                            <div className="divider divider-center" />
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '1rem', marginBottom: 'var(--space-3xl)' }}>
                                {t('description')}
                            </p>
                        </ScrollReveal3D>

                        {sponsors.length === 0 ? (
                            <ScrollReveal3D direction="up" delay={150}>
                                <div style={{
                                    background: 'var(--bg-glass-light)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-xl)',
                                    padding: 'var(--space-3xl)',
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🤝</div>
                                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>{t('becomePartner')}</h3>
                                    <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>
                                        {t('becomeDesc')}
                                    </p>
                                    <a href="/contact" className="btn btn-primary btn-sm">{t('getInTouch')}</a>
                                </div>
                            </ScrollReveal3D>
                        ) : (
                            Object.entries(tiers).map(([tier, list]) => {
                                if (list.length === 0) return null
                                const config = tierConfig[tier as keyof typeof tierConfig]
                                const isPremium = tier === 'platinum' || tier === 'gold'
                                return (
                                    <div key={tier} style={{ marginBottom: 'var(--space-3xl)' }}>
                                        <ScrollReveal3D direction="up" distance={20}>
                                            <h2 style={{
                                                fontSize: '1rem', fontWeight: 700, letterSpacing: '0.1em',
                                                textTransform: 'uppercase' as const, color: config.color,
                                                marginBottom: 'var(--space-xl)',
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
                                                        background: 'var(--bg-glass-light)',
                                                        border: `1px solid ${config.borderColor}`,
                                                        borderRadius: 'var(--radius-xl)',
                                                        overflow: 'hidden',
                                                        transition: 'transform 0.2s, border-color 0.3s, box-shadow 0.3s',
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
                                                                <div style={{ fontSize: isPremium ? '2rem' : '1.5rem', marginBottom: 'var(--space-sm)' }}>🏢</div>
                                                            )}
                                                            <span style={{
                                                                fontSize: isPremium ? '1rem' : '0.9rem',
                                                                fontWeight: 700, color: 'var(--text-primary)',
                                                                marginBottom: '4px',
                                                            }}>
                                                                {sponsor.name}
                                                            </span>
                                                            {isPremium && sponsor.description && (
                                                                <p style={{
                                                                    fontSize: '0.78rem', color: 'var(--text-tertiary)',
                                                                    lineHeight: 1.5, marginBottom: 'var(--space-sm)',
                                                                    maxHeight: '48px', overflow: 'hidden',
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
                                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                        marginTop: 'auto', paddingTop: 'var(--space-sm)',
                                                                        fontSize: '0.72rem', fontWeight: 600,
                                                                        color: config.color, textDecoration: 'none',
                                                                        padding: '5px 14px', borderRadius: '6px',
                                                                        background: `${config.color}10`,
                                                                        border: `1px solid ${config.borderColor}`,
                                                                        transition: 'background 0.2s',
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
                            })
                        )}

                        {/* CTA */}
                        <ScrollReveal3D direction="up" delay={200}>
                            <div style={{
                                background: 'var(--bg-glass-light)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-xl)',
                                padding: 'var(--space-2xl)',
                                textAlign: 'center',
                                marginTop: 'var(--space-2xl)',
                            }}>
                                <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-sm)' }}>{t('ctaTitle')}</h3>
                                <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
                                    {t('ctaDesc')}
                                </p>
                                <a href="/contact" className="btn btn-primary btn-sm">{t('ctaBtn')}</a>
                            </div>
                        </ScrollReveal3D>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
