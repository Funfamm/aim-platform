'use client'

import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function OverviewStep({ form, updateField, fieldErrors }: Props) {
    const t = useTranslations('startProject')

    const hasError = (field: string) => fieldErrors.includes(field)
    const errorStyle = { border: '1.5px solid rgba(239,68,68,0.5)' }

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.overview')}</h2>
            <p className="sp-step-subtitle">{t('helpers.overviewHint')}</p>

            <div className="sp-form-stack">
                <div>
                    <label className="sp-label" htmlFor="sp-projectTitle">{t('fields.projectTitle')} *</label>
                    <input
                        id="sp-projectTitle"
                        className="sp-input"
                        style={hasError('projectTitle') ? errorStyle : undefined}
                        placeholder={t('fields.projectTitle')}
                        value={form.projectTitle}
                        onChange={e => updateField('projectTitle', e.target.value)}
                    />
                    {hasError('projectTitle') && <p className="sp-error">{t('validation.required')}</p>}
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-deadline">{t('fields.deadline')}</label>
                    <input
                        id="sp-deadline"
                        type="date"
                        className="sp-input"
                        value={form.deadline}
                        onChange={e => updateField('deadline', e.target.value)}
                    />
                </div>

                <div>
                    <label className="sp-label" htmlFor="sp-description">{t('fields.description')} *</label>
                    <textarea
                        id="sp-description"
                        className="sp-input"
                        style={{
                            minHeight: '120px',
                            resize: 'vertical',
                            ...(hasError('description') ? errorStyle : {}),
                        }}
                        placeholder={t('fields.description')}
                        value={form.description}
                        onChange={e => updateField('description', e.target.value)}
                    />
                    {hasError('description') && <p className="sp-error">{t('validation.descriptionMin')}</p>}
                </div>

                <div className="sp-form-grid-2">
                    <div>
                        <label className="sp-label" htmlFor="sp-audience">{t('fields.audience')}</label>
                        <input
                            id="sp-audience"
                            className="sp-input"
                            placeholder={t('fields.audience')}
                            value={form.audience}
                            onChange={e => updateField('audience', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="sp-label" htmlFor="sp-goal">{t('fields.projectGoal')}</label>
                        <input
                            id="sp-goal"
                            className="sp-input"
                            placeholder={t('fields.projectGoal')}
                            value={form.projectGoal}
                            onChange={e => updateField('projectGoal', e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
