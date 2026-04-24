import { getTranslations } from 'next-intl/server'
import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import StartProjectFlow from '@/components/start-project/StartProjectFlow'

export const metadata: Metadata = {
    title: 'Start a Project — Impact AI Studio',
    description: 'Submit your creative project request. From birthday videos to commercials, branding, short films, and custom productions.',
}

export default async function StartProjectPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations('startProject')

    return (
        <main className="sp-bottom-safe" style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
        }}>
            {/* ── Decorative background glow (desktop only) ── */}
            <div style={{
                position: 'fixed',
                top: '-20%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '800px',
                height: '600px',
                background: 'radial-gradient(ellipse at center, rgba(212,168,83,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            <section style={{
                position: 'relative',
                zIndex: 1,
                maxWidth: '900px',
                margin: '0 auto',
                padding: 'clamp(1rem, 3vw, 2rem) clamp(1rem, 3vw, 1.5rem) clamp(2rem, 5vw, 4rem)',
            }}>
                {/* ── Hero ── */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: 'clamp(1.5rem, 4vw, 2.5rem)',
                    padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem)',
                }}>
                    {/* Studio badge */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 16px',
                        borderRadius: '99px',
                        background: 'rgba(212,168,83,0.08)',
                        border: '1px solid rgba(212,168,83,0.15)',
                        marginBottom: 'clamp(1rem, 2vw, 1.5rem)',
                    }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>
                            Impact AI Studio
                        </span>
                    </div>

                    <h1 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1.6rem, 5vw, 2.8rem)',
                        fontWeight: 800,
                        lineHeight: 1.15,
                        maxWidth: '700px',
                        margin: '0 auto',
                        marginBottom: 'var(--space-md)',
                    }}>
                        {t('hero.title')}
                    </h1>
                    <p style={{
                        fontSize: 'clamp(0.88rem, 2vw, 1.05rem)',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.65,
                        maxWidth: '560px',
                        margin: '0 auto',
                    }}>
                        {t('hero.subtitle')}
                    </p>

                    {/* Trust indicators */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 'clamp(1rem, 3vw, 2rem)',
                        marginTop: 'clamp(1.2rem, 3vw, 1.8rem)',
                        flexWrap: 'wrap',
                    }}>
                        {[
                            { icon: '⚡', text: t('trustBadges.fast') },
                            { icon: '🎬', text: t('trustBadges.quality') },
                            { icon: '🌍', text: t('trustBadges.global') },
                        ].map(badge => (
                            <div key={badge.text} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.78rem',
                                color: 'var(--text-tertiary)',
                            }}>
                                <span>{badge.icon}</span>
                                <span style={{ fontWeight: 600 }}>{badge.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Multi-step form ── */}
                <StartProjectFlow />
            </section>
        </main>
    )
}
