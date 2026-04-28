'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

const TONE_OPTIONS = [
    'cinematic', 'emotional', 'fun', 'luxury', 'kidsFriendly',
    'bold', 'inspirational', 'cleanMinimal', 'dramatic', 'professional',
]
const MAX_TONES = 3

const VISUAL_STYLE_OPTIONS = [
    'realistic', 'animated', 'motionGraphics', 'documentary',
    'vintage', 'neon', 'blackAndWhite', 'abstract', 'corporate',
]

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function CreativeDirectionStep({ form, updateField, fieldErrors }: Props) {
    const t = useTranslations('startProject')
    const [showOtherStyle, setShowOtherStyle] = useState(
        () => form.visualStyle !== '' && !VISUAL_STYLE_OPTIONS.includes(form.visualStyle)
    )

    const toggleTone = (tone: string) => {
        const current = form.tone
        if (current.includes(tone)) {
            // Always allow deselect
            updateField('tone', current.filter(t => t !== tone))
        } else if (current.length < MAX_TONES) {
            updateField('tone', [...current, tone])
        }
    }

    const atLimit = form.tone.length >= MAX_TONES

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.creative')}</h2>

            <div className="sp-form-stack">
                {/* Tone pills */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="sp-label" style={{ marginBottom: 0 }}>{t('fields.tone')} *</label>
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 600,
                            color: atLimit ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                        }}>
                            {form.tone.length} / {MAX_TONES}
                        </span>
                    </div>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginTop: '6px',
                    }}>
                        {TONE_OPTIONS.map(tone => {
                            const active = form.tone.includes(tone)
                            const disabled = !active && atLimit
                            return (
                                <button
                                    key={tone}
                                    type="button"
                                    onClick={() => toggleTone(tone)}
                                    disabled={disabled}
                                    className="sp-tone-pill"
                                    data-active={active || undefined}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        border: `1px solid ${active ? 'rgba(212,168,83,0.5)' : 'var(--border-subtle)'}`,
                                        background: active ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)',
                                        color: active ? 'var(--accent-gold)' : disabled ? 'rgba(255,255,255,0.2)' : 'var(--text-secondary)',
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        opacity: disabled ? 0.5 : 1,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {t(`tones.${tone}`)}
                                </button>
                            )
                        })}
                    </div>
                    {fieldErrors.includes('tone') && <p className="sp-error">{t('validation.toneRequired') || 'Select at least 1 tone'}</p>}
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-visualStyle">{t('fields.visualStyle')} *</label>
                    <select
                        id="sp-visualStyle"
                        className="sp-input"
                        value={VISUAL_STYLE_OPTIONS.includes(form.visualStyle) ? form.visualStyle : showOtherStyle ? 'other' : ''}
                        onChange={e => {
                            if (e.target.value === 'other') {
                                updateField('visualStyle', '')
                                setShowOtherStyle(true)
                                setTimeout(() => document.getElementById('sp-visualStyleOther')?.focus(), 50)
                            } else {
                                updateField('visualStyle', e.target.value)
                                setShowOtherStyle(false)
                            }
                        }}
                        style={{ appearance: 'auto', ...(fieldErrors.includes('visualStyle') ? { border: '1.5px solid rgba(239,68,68,0.5)' } : {}) }}
                    >
                        <option value="">— {t('fields.visualStyle')} —</option>
                        {VISUAL_STYLE_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{t(`visualStyles.${opt}`)}</option>
                        ))}
                        <option value="other">{t('fields.other') || 'Other'}</option>
                    </select>
                    {showOtherStyle && (
                        <input
                            id="sp-visualStyleOther"
                            className="sp-input"
                            style={{ marginTop: '8px' }}
                            placeholder={t('fields.describeStyle') || 'Describe your preferred style...'}
                            value={form.visualStyle}
                            onChange={e => updateField('visualStyle', e.target.value)}
                        />
                    )}
                    {fieldErrors.includes('visualStyle') && <p className="sp-error">{t('validation.required')}</p>}
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
