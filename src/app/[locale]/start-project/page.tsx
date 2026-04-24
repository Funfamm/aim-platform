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
        <main style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            paddingBottom: 'var(--space-3xl)',
        }}>
            {/* ── Hero Section ── */}
            <section style={{
                maxWidth: '1100px',
                margin: '0 auto',
                padding: 'var(--space-xl) var(--space-lg)',
            }}>
                <div className="glass-card" style={{
                    padding: 'clamp(1.5rem, 4vw, 3rem)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(212,168,83,0.15)',
                    marginBottom: 'var(--space-xl)',
                }}>
                    <p style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.25em',
                        textTransform: 'uppercase',
                        color: 'var(--accent-gold)',
                        marginBottom: 'var(--space-sm)',
                    }}>
                        Impact AI Studio
                    </p>
                    <h1 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1.6rem, 4vw, 2.8rem)',
                        fontWeight: 800,
                        lineHeight: 1.15,
                        maxWidth: '700px',
                        marginBottom: 'var(--space-md)',
                    }}>
                        {t('hero.title')}
                    </h1>
                    <p style={{
                        fontSize: 'clamp(0.88rem, 2vw, 1.05rem)',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.65,
                        maxWidth: '600px',
                    }}>
                        {t('hero.subtitle')}
                    </p>
                </div>

                <StartProjectFlow />
            </section>
        </main>
    )
}
