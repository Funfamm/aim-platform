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
            <div key={label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                gap: '12px',
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '3px' }}>
                        {label}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
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
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                        padding: '2px 8px',
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

            <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                border: '1px solid var(--border-subtle)',
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
                {form.budgetRange && renderRow(t('fields.budgetRange'), t(`budgetOptions.${form.budgetRange}`), 6)}
                {form.aspectRatio && renderRow(t('fields.aspectRatio'), t(`aspectOptions.${form.aspectRatio}`), 6)}
                {form.addOns.length > 0 && renderRow(t('fields.addOns'), form.addOns.map(a => t(`addonOptions.${a}`)), 6)}
                {form.uploads.length > 0 && renderRow(t('fields.uploads'), `${form.uploads.length} ${t('helpers.filesUploaded')}`, 5)}
            </div>

            {/* ── Consent checkboxes (audit fix #6) ── */}
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
                }}>
                    <input
                        type="checkbox"
                        checked={form.consentUpload}
                        onChange={e => updateField('consentUpload', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)', marginTop: '2px', flexShrink: 0 }}
                    />
                    {t('consent.uploadPermission')}
                </label>

                <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    color: hasError('consentContact') ? '#f87171' : 'var(--text-secondary)',
                    lineHeight: 1.5,
                    border: hasError('consentContact') ? '1px solid rgba(239,68,68,0.4)' : 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: hasError('consentContact') ? '8px 10px' : '0',
                }}>
                    <input
                        type="checkbox"
                        checked={form.consentContact}
                        onChange={e => updateField('consentContact', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)', marginTop: '2px', flexShrink: 0 }}
                    />
                    {t('consent.contactAgreement')} *
                </label>
                {hasError('consentContact') && (
                    <p className="sp-error">{t('validation.consentRequired')}</p>
                )}
            </div>
        </section>
    )
}
