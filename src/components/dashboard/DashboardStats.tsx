'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface DashboardStatsProps {
    applications: number
    saved: number
    watched: number
    donated?: number
}

export default function DashboardStats({ applications, saved, watched, donated = 0 }: DashboardStatsProps) {
    const t = useTranslations('dashboard')
    // Praise words come from translations — pipe-delimited string split at runtime
    const PRAISE_WORDS = (t('praiseWords') || "You're amazing! 🌟|True supporter! 💫|Film hero! 🎬").split('|')
    const [praiseIdx, setPraiseIdx] = useState(0)
    const [fadeIn, setFadeIn] = useState(true)
    const showDonation = donated > 0


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

    const stats = [
        { label: t('applications'), value: applications, icon: '📋', cta: t('exploreCasting'), href: '/casting' },
        { label: t('saved'), value: saved, icon: '🎬', cta: t('browseProjects'), href: '/works' },
        { label: t('watched'), value: watched, icon: '📺', cta: t('watchFilms'), href: '/works' },
        ...(!showDonation ? [{ label: t('supportUs') || 'Support Us', value: 0, icon: '💛', cta: t('donateNow') || 'Donate Now →', href: '/donate' }] : []),
    ]

    return (
        <>
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
                .dash-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: var(--space-md);
                    margin-bottom: var(--space-2xl);
                }
                .dash-stat-card {
                    background: var(--bg-glass-light);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    padding: var(--space-md) var(--space-sm);
                    text-align: center;
                    transition: all 0.3s ease;
                    cursor: default;
                    position: relative;
                    overflow: hidden;
                }
                .dash-stat-card:hover {
                    transform: translateY(-3px);
                    border-color: rgba(212,168,83,0.3);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                }
                .dash-stat-card .stat-icon {
                    font-size: 1.1rem;
                    margin-bottom: 4px;
                    display: block;
                }
                .dash-stat-card .stat-value {
                    font-size: 1.3rem;
                    font-weight: 800;
                    color: var(--accent-gold);
                    line-height: 1.2;
                }
                .dash-stat-card .stat-value.zero {
                    color: rgba(255,255,255,0.12);
                }
                .dash-stat-card .stat-label {
                    font-size: 0.68rem;
                    color: var(--text-tertiary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-top: 2px;
                }
                .dash-stat-card .stat-cta {
                    font-size: 0.7rem;
                    color: var(--accent-gold);
                    text-decoration: none;
                    font-weight: 600;
                    opacity: 0.85;
                    transition: opacity 0.2s;
                    margin-top: 4px;
                    display: inline-block;
                }
                .dash-stat-card .stat-cta:hover { opacity: 1; }
                .donation-card {
                    background: linear-gradient(135deg, rgba(212,168,83,0.08), rgba(239,68,68,0.04), rgba(212,168,83,0.06)) !important;
                    border-color: rgba(212,168,83,0.25) !important;
                    box-shadow: 0 4px 20px rgba(212,168,83,0.08);
                }
                .donation-card:hover {
                    box-shadow: 0 8px 32px rgba(212,168,83,0.2) !important;
                }
                @media (max-width: 480px) {
                    .dash-stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: var(--space-sm);
                    }
                    .dash-stat-card {
                        padding: var(--space-sm);
                    }
                    .dash-stat-card .stat-value {
                        font-size: 1.1rem;
                    }
                    .dash-stat-card .stat-icon {
                        font-size: 1rem;
                    }
                }
            `}</style>

            <div className="dash-stats-grid">
                {stats.map(stat => (
                    <div key={stat.label} className="dash-stat-card">
                        <span className="stat-icon">{stat.icon}</span>
                        {stat.value > 0 ? (
                            <>
                                <div className="stat-value">{stat.value}</div>
                                <div className="stat-label">{stat.label}</div>
                            </>
                        ) : (
                            <>
                                <div className="stat-value zero">0</div>
                                <a href={stat.href} className="stat-cta">{stat.cta}</a>
                            </>
                        )}
                    </div>
                ))}

                {showDonation && (
                    <div className="dash-stat-card donation-card">
                        {/* Shimmer overlay */}
                        <div style={{
                            position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none',
                            background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.4), transparent)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 4s ease-in-out infinite',
                        }} />
                        {/* Animated heart */}
                        <span className="stat-icon" style={{
                            animation: 'heartFloat 2.5s ease-in-out infinite, heartGlow 3s ease-in-out infinite',
                            display: 'inline-block',
                        }}>💛</span>
                        <div style={{
                            fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2,
                            background: 'linear-gradient(135deg, var(--accent-gold), var(--color-warning), var(--accent-gold))',
                            backgroundSize: '200% auto',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            animation: 'shimmer 3s linear infinite',
                        }}>${donated.toFixed(0)}</div>
                        <div className="stat-label">{t('donated')}</div>
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
        </>
    )
}
