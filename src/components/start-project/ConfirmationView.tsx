'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface Props {
    project: {
        id: string
        projectTitle: string
        projectType: string
        status: string
        createdAt: string
    }
}

const STATUS_FLOW = [
    'received', 'reviewing', 'scope_confirmed', 'in_production', 'delivered', 'completed',
]

export default function ConfirmationView({ project }: Props) {
    const t = useTranslations('startProject')

    return (
        <div className="glass-card" style={{
            padding: 'clamp(1.5rem, 4vw, 2.5rem)',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
        }}>
            {/* Success icon */}
            <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(52,211,153,0.1)',
                border: '2px solid rgba(52,211,153,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto var(--space-lg)',
            }}>
                ✓
            </div>

            <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
                fontWeight: 800,
                marginBottom: 'var(--space-sm)',
            }}>
                {t('confirmation.title')}
            </h2>

            <p style={{
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-xl)',
                lineHeight: 1.6,
            }}>
                {t('confirmation.subtitle')}
            </p>

            {/* Project ID card */}
            <div style={{
                display: 'inline-block',
                padding: 'var(--space-md) var(--space-xl)',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(212,168,83,0.08)',
                border: '1px solid rgba(212,168,83,0.2)',
                marginBottom: 'var(--space-xl)',
            }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                    {t('confirmation.projectId')}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'monospace' }}>
                    {project.id}
                </div>
            </div>

            {/* Details */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 'var(--space-xl)',
                flexWrap: 'wrap',
                marginBottom: 'var(--space-xl)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
            }}>
                <span><strong>{t('fields.projectTitle')}:</strong> {project.projectTitle}</span>
                <span><strong>Date:</strong> {new Date(project.createdAt).toLocaleDateString()}</span>
            </div>

            {/* Status flow */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'left',
                marginBottom: 'var(--space-xl)',
            }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>
                    {t('confirmation.nextSteps')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {STATUS_FLOW.map((status, i) => {
                        const isCurrent = status === project.status
                        const isPast = i < STATUS_FLOW.indexOf(project.status)
                        return (
                            <div key={status} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                opacity: isPast || isCurrent ? 1 : 0.35,
                            }}>
                                <div style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.6rem',
                                    fontWeight: 800,
                                    background: isCurrent ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                                    border: `1.5px solid ${isCurrent ? '#34d399' : isPast ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                    color: isCurrent ? '#34d399' : isPast ? '#34d399' : 'var(--text-tertiary)',
                                }}>
                                    {isPast ? '✓' : i + 1}
                                </div>
                                <span style={{
                                    fontSize: '0.82rem',
                                    fontWeight: isCurrent ? 700 : 400,
                                    color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                                }}>
                                    {t(`statuses.${status}`)}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Next steps text */}
            <div style={{
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: 'var(--space-xl)',
            }}>
                <p>📧 {t('confirmation.step1')}</p>
                <p>📋 {t('confirmation.step2')}</p>
                <p>🎬 {t('confirmation.step3')}</p>
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="sp-btn sp-btn-ghost"
                >
                    {t('buttons.submitAnother')}
                </button>
                <Link
                    href="/"
                    className="sp-btn sp-btn-primary"
                    style={{ textDecoration: 'none' }}
                >
                    {t('buttons.returnHome')}
                </Link>
            </div>
        </div>
    )
}
