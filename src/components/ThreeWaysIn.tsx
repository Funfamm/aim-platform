'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import ScrollReveal3D from './ScrollReveal3D'

interface ThreeWaysInProps {
    overrides?: {
        card1Title?: string; card1Sub?: string; card1Body?: string; card1Cta?: string
        card2Title?: string; card2Sub?: string; card2Body?: string; card2Cta?: string
        card3Title?: string; card3Sub?: string; card3Body?: string; card3Cta?: string
    }
}

export default function ThreeWaysIn({ overrides }: ThreeWaysInProps) {
    const t = useTranslations('threeWaysIn')

    const v = (overrideKey: string, tKey: string) => {
        const val = overrides?.[overrideKey as keyof typeof overrides]
        return val && val.trim() ? val : t(tKey)
    }

    const cards = [
        {
            title: v('card1Title', 'card1Title'),
            sub: v('card1Sub', 'card1Sub'),
            body: v('card1Body', 'card1Body'),
            cta: v('card1Cta', 'card1Cta'),
            href: '/works',
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
            ),
        },
        {
            title: v('card2Title', 'card2Title'),
            sub: v('card2Sub', 'card2Sub'),
            body: v('card2Body', 'card2Body'),
            cta: v('card2Cta', 'card2Cta'),
            href: '/casting',
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            ),
        },
        {
            title: v('card3Title', 'card3Title'),
            sub: v('card3Sub', 'card3Sub'),
            body: v('card3Body', 'card3Body'),
            cta: v('card3Cta', 'card3Cta'),
            href: '/training',
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
                </svg>
            ),
        },
    ]

    return (
        <section className="section" style={{ position: 'relative', zIndex: 2 }}>
            <div className="container">
                {/* Section header */}
                <ScrollReveal3D direction="up" delay={0}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                        <span className="text-label" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
                            {t('eyebrow')}
                        </span>
                        <h2 style={{
                            fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)',
                            fontWeight: 800,
                            lineHeight: 1.2,
                        }}>
                            {t('title')}{' '}
                            <span style={{
                                fontFamily: 'var(--font-serif)',
                                fontStyle: 'italic',
                                background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                                {t('titleAccent')}
                            </span>
                        </h2>
                    </div>
                </ScrollReveal3D>

                {/* Cards grid — using grid-3 class for built-in responsive breakpoints */}
                <div className="grid-3">
                    {cards.map((card, i) => (
                        <ScrollReveal3D key={i} direction="up" delay={150 * (i + 1)}>
                            <div className="three-ways-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                {/* Icon */}
                                <div className="three-ways-icon">
                                    {card.icon}
                                </div>

                                {/* Title */}
                                <h3 style={{
                                    fontSize: '1.4rem',
                                    fontWeight: 800,
                                    marginBottom: 'var(--space-xs)',
                                    color: 'var(--text-primary)',
                                }}>
                                    {card.title}
                                </h3>

                                {/* Subtitle (gold caps) */}
                                <span style={{
                                    display: 'block',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    color: 'var(--accent-gold)',
                                    marginBottom: 'var(--space-md)',
                                }}>
                                    {card.sub}
                                </span>

                                {/* Body */}
                                <p style={{
                                    fontSize: '0.9rem',
                                    lineHeight: 1.7,
                                    color: 'var(--text-secondary)',
                                    flex: 1,
                                }}>
                                    {card.body}
                                </p>

                                {/* CTA */}
                                <Link href={card.href} prefetch={false} className="card-cta">
                                    {card.cta}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>
                        </ScrollReveal3D>
                    ))}
                </div>
            </div>
        </section>
    )
}
