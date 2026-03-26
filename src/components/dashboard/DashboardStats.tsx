'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

const PRAISE_WORDS = [
    "You're amazing! 🌟", "True supporter! 💫", "Film hero! 🎬",
    "Making dreams real! ✨", "You matter! 💛", "Incredible heart! 🫶",
    "Story champion! 🏆", "Art patron! 🎨", "Creative angel! 👼",
]

interface DashboardStatsProps {
    applications: number
    saved: number
    watched: number
    donated: number
}

export default function DashboardStats({ applications, saved, watched, donated }: DashboardStatsProps) {
    const t = useTranslations('dashboard')
    const [praiseIdx, setPraiseIdx] = useState(0)
    const [fadeIn, setFadeIn] = useState(true)
    const showDonation = donated > 0
    const cols = showDonation ? 4 : 3

    useEffect(() => {
        if (!showDonation) return
        const interval = setInterval(() => {
            setFadeIn(false)
            setTimeout(() => {
                setPraiseIdx(prev => (prev + 1) % PRAISE_WORDS.length)
                setFadeIn(true)
            }, 300)
        }, 3000)
        return () => clearInterval(interval)
    }, [showDonation])

    const statBoxBase: React.CSSProperties = {
        background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)', textAlign: 'center',
        transition: 'all 0.3s ease', cursor: 'default',
    }

    const emptyCtaStyle: React.CSSProperties = {
        fontSize: '0.68rem', color: 'var(--accent-gold)', marginTop: '4px',
        textDecoration: 'none', fontWeight: 600, opacity: 0.85,
        transition: 'opacity 0.2s',
    }

    const stats = [
        { label: t('applications'), value: applications, icon: '📋', cta: t('exploreCasting'), href: '/casting#roles' },
        { label: t('saved'), value: saved, icon: '🎬', cta: t('browseProjects'), href: '/projects' },
        { label: t('watched'), value: watched, icon: '📺', cta: t('watchFilms'), href: '/films' },
    ]

    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 'var(--space-md)', marginBottom: 'var(--space-2xl)' }}>
            <style>{`
                @keyframes heartFloat {
                    0%, 100% { transform: translateY(0) scale(1); }
                    25% { transform: translateY(-4px) scale(1.15); }
                    50% { transform: translateY(-2px) scale(1.05); }
                    75% { transform: translateY(-6px) scale(1.2); }
                }
                @keyframes heartGlow {
                    0%, 100% { filter: drop-shadow(0 0 4px rgba(212,168,83,0.3)); }
                    50% { filter: drop-shadow(0 0 12px rgba(212,168,83,0.6)) drop-shadow(0 0 24px rgba(239,68,68,0.2)); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .dash-stat-box:hover { transform: translateY(-2px); border-color: rgba(212,168,83,0.3) !important; }
                .donation-box:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 32px rgba(212,168,83,0.2) !important; }
            `}</style>

            {stats.map(stat => (
                <div key={stat.label} className="dash-stat-box" style={statBoxBase}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>{stat.icon}</div>
                    {stat.value > 0 ? (
                        <>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{stat.value}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.12)' }}>0</div>
                            <a href={stat.href} style={emptyCtaStyle}>{stat.cta}</a>
                        </>
                    )}
                </div>
            ))}

            {showDonation && (
                <div className="donation-box" style={{
                    ...statBoxBase,
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.08), rgba(239,68,68,0.04), rgba(212,168,83,0.06))',
                    borderColor: 'rgba(212,168,83,0.25)',
                    boxShadow: '0 4px 20px rgba(212,168,83,0.08)',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Shimmer overlay */}
                    <div style={{
                        position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none',
                        background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.4), transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 4s ease-in-out infinite',
                    }} />
                    {/* Animated heart */}
                    <div style={{
                        fontSize: '1.4rem', marginBottom: '2px',
                        animation: 'heartFloat 2.5s ease-in-out infinite, heartGlow 3s ease-in-out infinite',
                        display: 'inline-block',
                    }}>💛</div>
                    <div style={{
                        fontSize: '1.5rem', fontWeight: 800,
                        background: 'linear-gradient(135deg, var(--accent-gold), #f59e0b, var(--accent-gold))',
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'shimmer 3s linear infinite',
                    }}>${donated.toFixed(0)}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('donated')}</div>
                    {/* Rotating praise */}
                    <div style={{
                        fontSize: '0.62rem', color: 'var(--accent-gold)', marginTop: '6px',
                        fontWeight: 700, letterSpacing: '0.02em', minHeight: '16px',
                        opacity: fadeIn ? 1 : 0,
                        transform: fadeIn ? 'translateY(0)' : 'translateY(4px)',
                        transition: 'all 0.3s ease',
                    }}>{PRAISE_WORDS[praiseIdx]}</div>
                </div>
            )}
        </div>
    )
}
