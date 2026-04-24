'use client'

import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
    onGoToStep: (idx: number) => void
}

export default function ReviewStep({ form, updateField, fieldErrors, onGoToStep }: Props) {
    const t = useTranslations('startProject')

    const hasError = (field: string) => fieldErrors.includes(field)

    function renderRow(label: string, value: string | string[] | undefined, step: number) {
        if (!value || (Array.isArray(value) && value.length === 0)) return null
        return (
            <div key={label} className="sp-review-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '3px' }}>
                        {label}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {Array.isArray(value) ? value.join(', ') : value}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onGoToStep(step)}
                    style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: 'var(--accent-gold)',
                        background: 'rgba(212,168,83,0.06)',
                        border: '1px solid rgba(212,168,83,0.15)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        padding: '4px 12px',
                        borderRadius: '6px',
                        minHeight: '32px',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                >
                    {t('buttons.edit')}
                </button>
            </div>
        )
    }

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.review')}</h2>
            <p className="sp-step-subtitle" style={{ marginBottom: 'var(--space-lg)' }}>
                {t('helpers.reviewHint') || 'Review your project details before submitting.'}
            </p>

            <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--radius-lg)',
                padding: 'clamp(12px, 3vw, 20px)',
                border: '1px solid rgba(255,255,255,0.06)',
            }}>
                {renderRow(t('fields.projectType'), t(`projectTypes.${form.projectType}.title`), 0)}
                {renderRow(t('fields.clientName'), form.clientName, 1)}
                {renderRow(t('fields.email'), form.email, 1)}
                {form.phone && renderRow(t('fields.phone'), form.phone, 1)}
                {form.companyName && renderRow(t('fields.companyName'), form.companyName, 1)}
                {renderRow(t('fields.projectTitle'), form.projectTitle, 2)}
                {renderRow(t('fields.description'), form.description, 2)}
                {form.deadline && renderRow(t('fields.deadline'), form.deadline, 2)}
                {form.tone.length > 0 && renderRow(t('fields.tone'), form.tone.map(tone => t(`tones.${tone}`)), 3)}
                {form.visualStyle && renderRow(t('fields.visualStyle'), form.visualStyle, 3)}
                {form.budgetRange && renderRow(t('fields.budgetRange'), t(`budgetOptions.${form.budgetRange}`), 6)}
                {form.aspectRatio && renderRow(t('fields.aspectRatio'), t(`aspectOptions.${form.aspectRatio}`), 6)}
                {form.duration && renderRow(t('fields.duration'), form.duration, 6)}
                {form.deliveryPlatform && renderRow(t('fields.deliveryPlatform'), form.deliveryPlatform, 6)}
                {form.addOns.length > 0 && renderRow(t('fields.addOns'), form.addOns.map(a => t(`addonOptions.${a}`)), 6)}
                {form.uploads.length > 0 && renderRow(t('fields.uploads'), `${form.uploads.length} ${t('helpers.filesUploaded')}`, 5)}
            </div>

            {/* ── Consent checkboxes ── */}
            <div style={{
                marginTop: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)',
            }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'border-color 0.2s',
                    WebkitTapHighlightColor: 'transparent',
                }}>
                    <input
                        type="checkbox"
                        checked={form.consentUpload}
                        onChange={e => updateField('consentUpload', e.target.checked)}
                        style={{ width: '20px', height: '20px', accentColor: 'var(--accent-gold)', marginTop: '1px', flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span>{t('consent.uploadPermission')}</span>
                </label>

                <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    color: hasError('consentContact') ? '#f87171' : 'var(--text-secondary)',
                    lineHeight: 1.5,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: hasError('consentContact') ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${hasError('consentContact') ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'border-color 0.2s, background 0.2s',
                    WebkitTapHighlightColor: 'transparent',
                }}>
                    <input
                        type="checkbox"
                        checked={form.consentContact}
                        onChange={e => updateField('consentContact', e.target.checked)}
                        style={{ width: '20px', height: '20px', accentColor: 'var(--accent-gold)', marginTop: '1px', flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span>{t('consent.contactAgreement')} *</span>
                </label>
                {hasError('consentContact') && (
                    <p className="sp-error">{t('validation.consentRequired')}</p>
                )}
            </div>
        </section>
    )
}
