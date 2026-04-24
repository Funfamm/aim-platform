'use client'

import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function ContactStep({ form, updateField, fieldErrors }: Props) {
    const t = useTranslations('startProject')

    const hasError = (field: string) => fieldErrors.includes(field)
    const errorStyle = { border: '1.5px solid rgba(239,68,68,0.5)' }

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.contact')}</h2>

            <div className="sp-form-stack">
                <div>
                    <label className="sp-label" htmlFor="sp-clientName">{t('fields.clientName')} *</label>
                    <input
                        id="sp-clientName"
                        className="sp-input"
                        style={hasError('clientName') ? errorStyle : undefined}
                        placeholder={t('fields.clientName')}
                        value={form.clientName}
                        onChange={e => updateField('clientName', e.target.value)}
                    />
                    {hasError('clientName') && <p className="sp-error">{t('validation.required')}</p>}
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-email">{t('fields.email')} *</label>
                    <input
                        id="sp-email"
                        type="email"
                        className="sp-input"
                        style={hasError('email') ? errorStyle : undefined}
                        placeholder={t('fields.email')}
                        value={form.email}
                        onChange={e => updateField('email', e.target.value)}
                    />
                    {hasError('email') && <p className="sp-error">{t('validation.email')}</p>}
                </div>

                <div className="sp-form-grid-2">
                    <div>
                        <label className="sp-label" htmlFor="sp-phone">{t('fields.phone')}</label>
                        <input
                            id="sp-phone"
                            className="sp-input"
                            placeholder={t('fields.phone')}
                            value={form.phone}
                            onChange={e => updateField('phone', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="sp-label" htmlFor="sp-contactMethod">{t('fields.contactMethod')}</label>
                        <select
                            id="sp-contactMethod"
                            className="sp-input"
                            value={form.contactMethod}
                            onChange={e => updateField('contactMethod', e.target.value)}
                            style={{ appearance: 'auto' }}
                        >
                            <option value="">—</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                            <option value="whatsapp">WhatsApp</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-company">{t('fields.companyName')}</label>
                    <input
                        id="sp-company"
                        className="sp-input"
                        placeholder={t('fields.companyName')}
                        value={form.companyName}
                        onChange={e => updateField('companyName', e.target.value)}
                    />
                </div>
            </div>
        </section>
    )
}
