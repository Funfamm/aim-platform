'use client'

import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

const BUDGET_OPTIONS = ['30-50', '50-100', '100-250', '250-500', '500+', 'not-sure']
const ASPECT_OPTIONS = ['16:9', '9:16', '1:1', 'multiple', 'not-sure']
const ADDON_OPTIONS = ['voiceover', 'subtitles', 'translation', 'multipleVersions', 'thumbnail', 'rushDelivery']

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function BudgetDeliveryStep({ form, updateField, fieldErrors }: Props) {
    const t = useTranslations('startProject')

    const hasError = (field: string) => fieldErrors.includes(field)

    const toggleAddon = (addon: string) => {
        const current = form.addOns
        updateField(
            'addOns',
            current.includes(addon)
                ? current.filter(a => a !== addon)
                : [...current, addon]
        )
    }

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.delivery')}</h2>

            <div className="sp-form-stack">
                {/* Budget */}
                <div>
                    <label className="sp-label" htmlFor="sp-budget">{t('fields.budgetRange')} *</label>
                    {hasError('budgetRange') && <p className="sp-error" style={{ marginBottom: '6px' }}>{t('validation.required')}</p>}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginTop: '6px',
                    }}>
                        {BUDGET_OPTIONS.map(opt => {
                            const active = form.budgetRange === opt
                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => updateField('budgetRange', active ? '' : opt)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        border: `1px solid ${active ? 'rgba(212,168,83,0.5)' : hasError('budgetRange') ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
                                        background: active ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)',
                                        color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {t(`budgetOptions.${opt}`)}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Aspect ratio */}
                <div>
                    <label className="sp-label">{t('fields.aspectRatio')}</label>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginTop: '6px',
                    }}>
                        {ASPECT_OPTIONS.map(opt => {
                            const active = form.aspectRatio === opt
                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => updateField('aspectRatio', active ? '' : opt)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        border: `1px solid ${active ? 'rgba(129,140,248,0.5)' : 'var(--border-subtle)'}`,
                                        background: active ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.04)',
                                        color: active ? '#818cf8' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {t(`aspectOptions.${opt}`)}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="sp-form-grid-2">
                    <div>
                        <label className="sp-label" htmlFor="sp-deliveryPlatform">{t('fields.deliveryPlatform')}</label>
                        <input
                            id="sp-deliveryPlatform"
                            className="sp-input"
                            placeholder="YouTube, TikTok, Instagram..."
                            value={form.deliveryPlatform}
                            onChange={e => updateField('deliveryPlatform', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="sp-label" htmlFor="sp-duration">{t('fields.duration')}</label>
                        <input
                            id="sp-duration"
                            className="sp-input"
                            placeholder="e.g. 30 sec, 1 min, 5 min"
                            value={form.duration}
                            onChange={e => updateField('duration', e.target.value)}
                        />
                    </div>
                </div>

                {/* Add-ons */}
                <div>
                    <label className="sp-label">{t('fields.addOns')}</label>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginTop: '6px',
                    }}>
                        {ADDON_OPTIONS.map(addon => {
                            const active = form.addOns.includes(addon)
                            return (
                                <button
                                    key={addon}
                                    type="button"
                                    onClick={() => toggleAddon(addon)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        border: `1px solid ${active ? 'rgba(52,211,153,0.5)' : 'var(--border-subtle)'}`,
                                        background: active ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
                                        color: active ? '#34d399' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {t(`addonOptions.${addon}`)}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </section>
    )
}
