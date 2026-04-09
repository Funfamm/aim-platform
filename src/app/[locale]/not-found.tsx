'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

export default function LocaleNotFound() {
    const t = useTranslations('notFound')
    const locale = useLocale()

    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: 'var(--bg-primary)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Subtle radial glow */}
            <div style={{
                position: 'absolute',
                width: '600px', height: '600px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
            }} />

            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '500px' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.8 }}>🎬</div>

                <h1 style={{
                    fontSize: 'clamp(5rem, 15vw, 8rem)',
                    fontWeight: 900, lineHeight: 1,
                    background: 'linear-gradient(135deg, var(--accent-gold) 0%, #c4943a 50%, rgba(212,168,83,0.3) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '0.5rem',
                    letterSpacing: '-0.04em',
                }}>
                    404
                </h1>

                <h2 style={{
                    fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '1rem',
                }}>
                    {t('title')}
                </h2>

                <p style={{
                    color: 'var(--text-tertiary)',
                    fontSize: '1rem',
                    lineHeight: 1.7,
                    marginBottom: '2.5rem',
                }}>
                    {t('desc')}
                </p>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href={`/${locale}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '0.85rem 2rem',
                        background: 'linear-gradient(135deg, var(--accent-gold), #c4943a)',
                        color: '#000', fontWeight: 700, fontSize: '0.9rem',
                        borderRadius: 'var(--radius-md)',
                        textDecoration: 'none',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                    }}>
                        ← {t('backHome')}
                    </Link>
                    <Link href={`/${locale}/casting`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '0.85rem 2rem',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem',
                        borderRadius: 'var(--radius-md)',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                    }}>
                        {t('viewCasting')}
                    </Link>
                </div>

                {/* Decorative film strip */}
                <div style={{
                    marginTop: '3rem',
                    display: 'flex', justifyContent: 'center', gap: '4px',
                    opacity: 0.15,
                }}>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} style={{
                            width: '28px', height: '20px',
                            borderRadius: '3px',
                            background: i === 3 ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            opacity: i === 3 ? 0.6 : 0.3,
                        }} />
                    ))}
                </div>
            </div>
        </main>
    )
}
