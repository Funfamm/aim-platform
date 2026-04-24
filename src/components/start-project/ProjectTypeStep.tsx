'use client'

import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

const PROJECT_TYPES = [
    { id: 'birthday', icon: '🎉' },
    { id: 'brand',    icon: '🏢' },
    { id: 'commercial', icon: '📺' },
    { id: 'music',    icon: '🎵' },
    { id: 'film',     icon: '🎬' },
    { id: 'event',    icon: '📣' },
    { id: 'custom',   icon: '✨' },
]

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function ProjectTypeStep({ form, updateField }: Props) {
    const t = useTranslations('startProject')

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.projectType')}</h2>
            <p className="sp-step-subtitle">{t('hero.subtitle')}</p>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 'var(--space-md)',
                marginTop: 'var(--space-lg)',
            }}>
                {PROJECT_TYPES.map(type => {
                    const active = form.projectType === type.id
                    return (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => updateField('projectType', type.id)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                padding: 'var(--space-lg)',
                                borderRadius: 'var(--radius-lg)',
                                border: `1.5px solid ${active ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                                background: active
                                    ? 'rgba(212,168,83,0.1)'
                                    : 'rgba(255,255,255,0.03)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s',
                                transform: active ? 'scale(1.02)' : 'scale(1)',
                            }}
                        >
                            <span style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>
                                {type.icon}
                            </span>
                            <span style={{
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                color: active ? 'var(--accent-gold)' : 'var(--text-primary)',
                                marginBottom: '4px',
                            }}>
                                {t(`projectTypes.${type.id}.title`)}
                            </span>
                            <span style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-tertiary)',
                                lineHeight: 1.4,
                            }}>
                                {t(`projectTypes.${type.id}.description`)}
                            </span>
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
