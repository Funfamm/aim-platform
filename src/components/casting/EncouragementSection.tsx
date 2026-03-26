'use client'

import { useState, useEffect } from 'react'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations } from 'next-intl'

export default function EncouragementSection() {
    const t = useTranslations('encouragement')
    const VALUES = [
        { num: '01', title: t('beSeen'), desc: t('beSeenDesc'), icon: '🎬' },
        { num: '02', title: t('beFair'), desc: t('beFairDesc'), icon: '⭐' },
        { num: '03', title: t('beBold'), desc: t('beBoldDesc'), icon: '🚀' },
        { num: '04', title: t('beYou'), desc: t('beYouDesc'), icon: '🌍' },
        { num: '05', title: t('bePart'), desc: t('bePartDesc'), icon: '🤝' },
    ]
    const [valueIdx, setValueIdx] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => setValueIdx(prev => (prev + 1) % VALUES.length), 4000)
        return () => clearInterval(timer)
    }, [])

    return (
        <section style={{
            padding: 'var(--space-3xl) 0 var(--space-3xl)',
            position: 'relative',
            zIndex: 2,
            background: 'var(--bg-primary)',
            overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
                width: '600px', height: '400px',
                background: 'radial-gradient(ellipse, rgba(228,185,90,0.04) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div className="container" style={{ maxWidth: 'min(900px, 100%)', padding: '0 var(--space-md)' }}>
                <ScrollReveal3D direction="up" distance={30} rotate={3}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                        <span className="text-label" style={{ display: 'block', marginBottom: '6px' }}>{t('label')}</span>
                        <h2 style={{
                            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
                            fontWeight: 800,
                            marginBottom: '6px',
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
                        <div className="divider divider-center" style={{ marginBottom: '8px' }} />
                    </div>
                </ScrollReveal3D>

                <ScrollReveal3D direction="up" delay={100} distance={25}>
                    <div style={{
                        borderLeft: '3px solid var(--accent-gold)',
                        paddingLeft: 'var(--space-lg)',
                        marginBottom: 'var(--space-xl)',
                        maxWidth: '600px',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                    }}>
                        <p style={{
                            fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                            lineHeight: 1.8,
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic',
                        }}>
                            &ldquo;{t('quote')}&rdquo; {t('quoteMiddle')}
                            <strong style={{ color: 'var(--accent-gold)', fontStyle: 'normal' }}>{t('invitation')}</strong>.
                            {t('community')} <em style={{ color: 'var(--text-primary)', fontStyle: 'normal' }}>{t('communityWord')}</em>{t('communitySuffix')}
                        </p>
                    </div>
                </ScrollReveal3D>

                {/* Rotating value strip */}
                <div style={{
                    marginBottom: 'var(--space-xl)',
                    position: 'relative',
                    height: '70px',
                    overflow: 'hidden',
                }}>
                    {VALUES.map((item, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-md)',
                            padding: 'var(--space-md) var(--space-lg)',
                            borderRadius: 'var(--radius-lg)',
                            background: 'rgba(228,185,90,0.03)',
                            border: '1px solid rgba(228,185,90,0.1)',
                            opacity: valueIdx === i ? 1 : 0,
                            transform: valueIdx === i ? 'translateY(0)' : 'translateY(12px)',
                            transition: 'opacity 0.5s ease, transform 0.5s ease',
                            pointerEvents: valueIdx === i ? 'auto' : 'none',
                        }}>
                            <div style={{
                                flexShrink: 0,
                                width: '40px', height: '40px',
                                borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, rgba(228,185,90,0.15), rgba(228,185,90,0.05))',
                                border: '1px solid rgba(228,185,90,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.75rem',
                                color: 'var(--accent-gold)',
                            }}>
                                {item.num}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem',
                                    marginBottom: '2px',
                                }}>
                                    {item.icon} {item.title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                                    {item.desc}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Dot indicators */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: 'var(--space-xl)' }}>
                    {VALUES.map((_, i) => (
                        <button key={i} onClick={() => setValueIdx(i)} style={{
                            width: valueIdx === i ? '20px' : '6px', height: '6px',
                            borderRadius: 'var(--radius-full)', border: 'none',
                            background: valueIdx === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)',
                            cursor: 'pointer', transition: 'all 0.3s ease',
                        }} />
                    ))}
                </div>

                {/* CTA */}
                <ScrollReveal3D direction="up" delay={300} distance={20}>
                    <div style={{ textAlign: 'center' }}>
                        <a href="#roles" className="btn btn-primary btn-lg">
                            {t('cta')}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                </ScrollReveal3D>
            </div>
        </section>
    )
}
