'use client'

import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

const TONE_OPTIONS = [
    'cinematic', 'emotional', 'fun', 'luxury', 'kidsFriendly',
    'bold', 'inspirational', 'cleanMinimal', 'dramatic', 'professional',
]

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function CreativeDirectionStep({ form, updateField }: Props) {
    const t = useTranslations('startProject')

    const toggleTone = (tone: string) => {
        const current = form.tone
        updateField(
            'tone',
            current.includes(tone)
                ? current.filter(t => t !== tone)
                : [...current, tone]
        )
    }

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.creative')}</h2>

            <div className="sp-form-stack">
                {/* Tone pills */}
                <div>
                    <label className="sp-label">{t('fields.tone')}</label>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginTop: '6px',
                    }}>
                        {TONE_OPTIONS.map(tone => {
                            const active = form.tone.includes(tone)
                            return (
                                <button
                                    key={tone}
                                    type="button"
                                    onClick={() => toggleTone(tone)}
                                    className="sp-tone-pill"
                                    data-active={active || undefined}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        border: `1px solid ${active ? 'rgba(212,168,83,0.5)' : 'var(--border-subtle)'}`,
                                        background: active ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)',
                                        color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {t(`tones.${tone}`)}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-visualStyle">{t('fields.visualStyle')}</label>
                    <input
                        id="sp-visualStyle"
                        className="sp-input"
                        placeholder={t('fields.visualStyle')}
                        value={form.visualStyle}
                        onChange={e => updateField('visualStyle', e.target.value)}
                    />
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-inspirationLinks">{t('fields.inspirationLinks')}</label>
                    <textarea
                        id="sp-inspirationLinks"
                        className="sp-input"
                        style={{ minHeight: '80px', resize: 'vertical' }}
                        placeholder="https://youtube.com/watch?v=...\nhttps://vimeo.com/..."
                        value={form.inspirationLinks.join('\n')}
                        onChange={e => updateField(
                            'inspirationLinks',
                            e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                        )}
                    />
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-avoidNotes">{t('fields.avoidNotes')}</label>
                    <textarea
                        id="sp-avoidNotes"
                        className="sp-input"
                        style={{ minHeight: '80px', resize: 'vertical' }}
                        placeholder={t('fields.avoidNotes')}
                        value={form.avoidNotes}
                        onChange={e => updateField('avoidNotes', e.target.value)}
                    />
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-emotionalFeeling">{t('fields.emotionalFeeling')}</label>
                    <input
                        id="sp-emotionalFeeling"
                        className="sp-input"
                        placeholder={t('fields.emotionalFeeling')}
                        value={form.emotionalFeeling}
                        onChange={e => updateField('emotionalFeeling', e.target.value)}
                    />
                </div>
            </div>
        </section>
    )
}
