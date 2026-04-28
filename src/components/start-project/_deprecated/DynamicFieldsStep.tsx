'use client'

import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

// ── Field configs per project type ──────────────────────────────────────────
const TYPE_FIELDS: Record<string, string[]> = {
    birthday: ['celebrantName', 'ageTurning', 'relationship', 'eventDate', 'favoriteColors', 'favoriteCharacters', 'messageToInclude', 'preferredMood'],
    brand:    ['brandName', 'industry', 'website', 'socialLinks', 'brandColors', 'mainMessage', 'targetAudience', 'desiredCTA'],
    commercial: ['productName', 'campaignGoal', 'platform', 'videoDuration', 'offer', 'cta', 'scriptReady', 'competitorLinks'],
    music:    ['songName', 'artistName', 'mood', 'lyricsSyncRequired', 'storyline', 'visualStyle', 'performanceOrCinematic'],
    film:     ['storyTitle', 'genre', 'synopsis', 'mainCharacters', 'runtimeTarget', 'dialogueRequired', 'mustHaveScenes', 'visualTone'],
    event:    ['eventName', 'eventDate', 'venue', 'promoGoal', 'speakers', 'cta', 'importantDetails'],
    custom:   ['requestDescription', 'whatIsThisFor', 'desiredResult', 'requiredDeliverables', 'specialNotes'],
}

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function DynamicFieldsStep({ form, updateField, fieldErrors }: Props) {
    const t = useTranslations('startProject')
    const fields = TYPE_FIELDS[form.projectType] || TYPE_FIELDS.custom

    const updateCustom = (key: string, value: string) => {
        updateField('customFields', { ...form.customFields, [key]: value })
    }

    // Fields that benefit from textarea
    const longFields = new Set([
        'synopsis', 'storyline', 'messageToInclude', 'mainCharacters',
        'mustHaveScenes', 'importantDetails', 'requestDescription',
        'desiredResult', 'requiredDeliverables', 'specialNotes',
        'socialLinks', 'competitorLinks',
    ])

    // Fields that should use a date picker
    const dateFields = new Set(['eventDate'])

    // Required fields for current project type (first 2)
    const REQUIRED_DYNAMIC: Record<string, string[]> = {
        birthday: ['celebrantName', 'ageTurning'],
        brand:    ['brandName', 'industry'],
        commercial: ['productName', 'campaignGoal'],
        music:    ['songName', 'artistName'],
        film:     ['storyTitle', 'genre'],
        event:    ['eventName', 'eventDate'],
        custom:   ['requestDescription', 'whatIsThisFor'],
    }
    const requiredFields = new Set(REQUIRED_DYNAMIC[form.projectType] || REQUIRED_DYNAMIC.custom)
    const hasError = (f: string) => fieldErrors.includes(f)
    const errorStyle = { border: '1.5px solid rgba(239,68,68,0.5)' }

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.dynamic')}</h2>
            <p className="sp-step-subtitle">
                {t(`projectTypes.${form.projectType}.title`)}
            </p>

            <div className="sp-form-stack">
                {fields.map(field => (
                    <div key={field}>
                        <label className="sp-label" htmlFor={`sp-cf-${field}`}>
                            {t(`dynamicFields.${field}`)}{requiredFields.has(field) ? ' *' : ''}
                        </label>
                        {dateFields.has(field) ? (
                            <div
                                onClick={() => {
                                    const input = document.getElementById(`sp-cf-${field}`) as HTMLInputElement | null
                                    if (input) {
                                        if (typeof input.showPicker === 'function') {
                                            try { input.showPicker() } catch { input.focus() }
                                        } else {
                                            input.focus()
                                        }
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <input
                                    id={`sp-cf-${field}`}
                                    type="date"
                                    className="sp-input"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={form.customFields[field] || ''}
                                    onChange={e => updateCustom(field, e.target.value)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div>
                        ) : longFields.has(field) ? (
                            <textarea
                                id={`sp-cf-${field}`}
                                className="sp-input"
                                style={{ minHeight: '80px', resize: 'vertical', ...(hasError(field) ? errorStyle : {}) }}
                                placeholder={t(`dynamicFields.${field}`)}
                                value={form.customFields[field] || ''}
                                onChange={e => updateCustom(field, e.target.value)}
                            />
                        ) : (
                            <input
                                id={`sp-cf-${field}`}
                                className="sp-input"
                                style={hasError(field) ? errorStyle : undefined}
                                placeholder={t(`dynamicFields.${field}`)}
                                value={form.customFields[field] || ''}
                                onChange={e => updateCustom(field, e.target.value)}
                            />
                        )}
                        {hasError(field) && <p className="sp-error">{t('validation.required')}</p>}
                    </div>
                ))}
            </div>
        </section>
    )
}
