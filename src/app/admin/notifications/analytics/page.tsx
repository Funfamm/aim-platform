'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface FilmSignup {
    signupTag: string; count: number; projectTitle: string
    projectSlug: string; notificationType: string
}

interface Analytics {
    totalSignups: number
    signupsLast7Days: number
    signupsLast30Days: number
    activeCtas: number
    topFilmsBySignups: FilmSignup[]
    topFilmsByVelocity: FilmSignup[]
    languageDistribution: { language: string; count: number }[]
    countryDistribution: { country: string; count: number }[]
    signupsByType: { type: string; count: number }[]
}

export default function AdminNotificationAnalytics() {
    const [data, setData] = useState<Analytics | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/admin/notification-analytics')
            .then(r => r.json())
            .then(setData)
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading analytics...</div>
    if (!data) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Failed to load analytics</div>

    const StatCard = ({ label, value, color = 'var(--accent-gold)', sub }: { label: string; value: string | number; color?: string; sub?: string }) => (
        <div style={{
            padding: '20px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>{label}</div>
            {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px', opacity: 0.6 }}>{sub}</div>}
        </div>
    )

    const maxSignup = Math.max(...data.topFilmsBySignups.map(f => f.count), 1)

    return (
        <div style={{ padding: 'var(--space-lg)', maxWidth: '1100px' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <Link href="/admin/notifications/ctas" style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textDecoration: 'none' }}>
                    ← Back to CTAs
                </Link>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '8px 0 4px', color: 'var(--text-primary)' }}>
                    📊 Notification Analytics
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: 0 }}>
                    Cross-film notification signup insights
                </p>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <StatCard label="Total Signups" value={data.totalSignups.toLocaleString()} />
                <StatCard label="Last 7 Days" value={`+${data.signupsLast7Days}`} color="#48bb78" />
                <StatCard label="Last 30 Days" value={`+${data.signupsLast30Days}`} color="#63b3ed" />
                <StatCard label="Active CTAs" value={data.activeCtas} color="#9f7aea" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                {/* Top by total */}
                <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
                        🏆 Top Films by Signups
                    </h3>
                    {data.topFilmsBySignups.length === 0 ? (
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No data yet</p>
                    ) : data.topFilmsBySignups.map((f, i) => (
                        <div key={f.signupTag} style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                    {i + 1}. {f.projectTitle}
                                </span>
                                <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{f.count}</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                                <div style={{
                                    height: '100%', borderRadius: '3px',
                                    background: 'linear-gradient(90deg, rgba(212,168,83,0.6), var(--accent-gold))',
                                    width: `${(f.count / maxSignup) * 100}%`,
                                    transition: 'width 0.5s ease',
                                }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Top by velocity */}
                <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
                        🚀 Fastest Growing (7 days)
                    </h3>
                    {data.topFilmsByVelocity.length === 0 ? (
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No recent signups</p>
                    ) : data.topFilmsByVelocity.map((f, i) => (
                        <div key={f.signupTag} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{i + 1}. {f.projectTitle}</span>
                            <span style={{ color: '#48bb78', fontWeight: 700 }}>+{f.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* By type */}
                <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
                        By Notification Type
                    </h3>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        {data.signupsByType.map(t => (
                            <div key={t.type} style={{ flex: 1, textAlign: 'center', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: t.type === 'release' ? 'var(--accent-gold)' : '#9f7aea' }}>{t.count}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>{t.type === 'release' ? '🔔 Release' : '🔁 More'}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Language distribution */}
                <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
                        🌍 Languages
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {data.languageDistribution.map(l => (
                            <span key={l.language} style={{
                                padding: '4px 12px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 600,
                                background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.15)',
                                color: 'var(--text-secondary)',
                            }}>
                                {l.language.toUpperCase()}: {l.count}
                            </span>
                        ))}
                        {data.languageDistribution.length === 0 && (
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No data yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
