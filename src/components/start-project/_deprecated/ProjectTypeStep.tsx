'use client'

import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

const PROJECT_TYPES = [
    { id: 'birthday', icon: '🎉', gradient: 'rgba(249,115,22,0.12)' },
    { id: 'brand',    icon: '🏢', gradient: 'rgba(59,130,246,0.12)' },
    { id: 'commercial', icon: '📺', gradient: 'rgba(6,182,212,0.12)' },
    { id: 'music',    icon: '🎵', gradient: 'rgba(168,85,247,0.12)' },
    { id: 'film',     icon: '🎬', gradient: 'rgba(239,68,68,0.12)' },
    { id: 'event',    icon: '📣', gradient: 'rgba(245,158,11,0.12)' },
    { id: 'custom',   icon: '✨', gradient: 'rgba(212,168,83,0.12)' },
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

            <div className="sp-type-grid">
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
                                padding: 'clamp(14px, 3vw, 20px)',
                                borderRadius: 'var(--radius-lg)',
                                border: `1.5px solid ${active ? 'var(--accent-gold)' : 'rgba(255,255,255,0.08)'}`,
                                background: active
                                    ? type.gradient
                                    : 'rgba(255,255,255,0.03)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: active ? '0 4px 20px rgba(212,168,83,0.12)' : 'none',
                                WebkitTapHighlightColor: 'transparent',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Active indicator */}
                            {active && (
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: 'var(--accent-gold)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.55rem',
                                    color: '#000',
                                    fontWeight: 800,
                                }}>
                                    ✓
                                </div>
                            )}

                            <span style={{
                                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                                marginBottom: '8px',
                                display: 'block',
                            }}>
                                {type.icon}
                            </span>
                            <span style={{
                                fontSize: 'clamp(0.82rem, 2vw, 0.92rem)',
                                fontWeight: 700,
                                color: active ? 'var(--accent-gold)' : 'var(--text-primary)',
                                marginBottom: '4px',
                                lineHeight: 1.3,
                            }}>
                                {t(`projectTypes.${type.id}.title`)}
                            </span>
                            <span style={{
                                fontSize: 'clamp(0.68rem, 1.5vw, 0.75rem)',
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
