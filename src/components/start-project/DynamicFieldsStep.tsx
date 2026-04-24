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

export default function DynamicFieldsStep({ form, updateField }: Props) {
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
                            {t(`dynamicFields.${field}`)}
                        </label>
                        {longFields.has(field) ? (
                            <textarea
                                id={`sp-cf-${field}`}
                                className="sp-input"
                                style={{ minHeight: '80px', resize: 'vertical' }}
                                placeholder={t(`dynamicFields.${field}`)}
                                value={form.customFields[field] || ''}
                                onChange={e => updateCustom(field, e.target.value)}
                            />
                        ) : (
                            <input
                                id={`sp-cf-${field}`}
                                className="sp-input"
                                placeholder={t(`dynamicFields.${field}`)}
                                value={form.customFields[field] || ''}
                                onChange={e => updateCustom(field, e.target.value)}
                            />
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}
