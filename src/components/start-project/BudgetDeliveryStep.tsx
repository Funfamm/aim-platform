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

                {/* Agreed Project Total */}
                <div>
                    <label className="sp-label" htmlFor="sp-agreedTotal">
                        {t('fields.agreedProjectTotal') || 'Agreed Project Total (USD)'} *
                    </label>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '8px', lineHeight: 1.5 }}>
                        {t('helpers.agreedTotalHint') || 'Enter the exact agreed price for this project. A 40% deposit will be collected at checkout.'}
                    </p>
                    {hasError('agreedProjectTotal') && (
                        <p className="sp-error" style={{ marginBottom: '6px' }}>
                            {t('validation.agreedTotalRequired') || 'Agreed project total is required (minimum $50)'}
                        </p>
                    )}
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                            fontSize: '1rem', fontWeight: 700, color: 'var(--accent-gold)',
                        }}>$</span>
                        <input
                            id="sp-agreedTotal"
                            type="number"
                            min="50"
                            step="0.01"
                            className="sp-input"
                            style={{ paddingLeft: '32px', fontSize: '1.05rem', fontWeight: 700 }}
                            placeholder="e.g. 2500.00"
                            value={form.agreedProjectTotal ?? ''}
                            onChange={e => {
                                const val = e.target.value ? parseFloat(e.target.value) : null
                                updateField('agreedProjectTotal', val)
                            }}
                        />
                    </div>
                    {form.agreedProjectTotal && form.agreedProjectTotal >= 50 && (
                        <div style={{
                            marginTop: '10px', padding: '10px 14px',
                            background: 'rgba(212,168,83,0.06)',
                            border: '1px solid rgba(212,168,83,0.12)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: '0.78rem',
                        }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                                💳 {t('helpers.depositPreview') || '40% deposit due at checkout'}:
                            </span>
                            <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.9rem' }}>
                                ${(Math.round(form.agreedProjectTotal * 0.4 * 100) / 100).toFixed(2)}
                            </span>
                        </div>
                    )}
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
                            placeholder={t('helpers.platformPlaceholder')}
                            value={form.deliveryPlatform}
                            onChange={e => updateField('deliveryPlatform', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="sp-label" htmlFor="sp-duration">{t('fields.duration')}</label>
                        <input
                            id="sp-duration"
                            className="sp-input"
                            placeholder={t('helpers.durationPlaceholder')}
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
