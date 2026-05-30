'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { afterPaint } from '@/lib/afterPaint'
import {
    PROJECT_TYPES, TYPE_FIELDS, REQUIRED_DYNAMIC,
    LONG_FIELDS, DATE_FIELDS,
} from './constants'
import type { StartProjectFormData } from './StartProjectFlow'

// ── Section state ───────────────────────────────────────────────────────────
type SectionId = 'projectType' | 'yourInfo' | 'projectDetails' | 'typeSpecific'

interface SectionState { unlocked: boolean; open: boolean }

// ── Field → section mapping (for error scroll) ─────────────────────────────
const FIELD_TO_SECTION: Record<string, SectionId> = {
    projectType: 'projectType',
    clientName: 'yourInfo', email: 'yourInfo',
    phone: 'yourInfo', contactMethod: 'yourInfo', companyName: 'yourInfo',
    projectTitle: 'projectDetails', description: 'projectDetails',
    deadline: 'projectDetails', audience: 'projectDetails', projectGoal: 'projectDetails',
}

// ── Props ───────────────────────────────────────────────────────────────────
interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function BasicsStep({ form, updateField, fieldErrors }: Props) {
    const t = useTranslations('startProject')

    // ── Section accordion state ─────────────────────────────────────────
    const [sections, setSections] = useState<Record<SectionId, SectionState>>(() => {
        const hasType = !!form.projectType
        const hasContact = !!(form.clientName?.trim() && form.email?.match(/.+@.+\..+/))
        const hasOverview = !!(form.projectTitle?.trim() && form.description?.trim().length >= 10)
        return {
            projectType:    { unlocked: true,       open: true       },
            yourInfo:       { unlocked: hasType,     open: hasType    },
            projectDetails: { unlocked: hasContact,  open: hasContact },
            typeSpecific:   { unlocked: hasOverview,  open: hasOverview },
        }
    })

    // Track which section was most recently unlocked (for scroll/focus)
    const [justUnlocked, setJustUnlocked] = useState<SectionId | null>(null)

    const unlockAndOpen = useCallback((id: SectionId) => {
        setSections(prev => {
            if (prev[id].unlocked && prev[id].open) return prev
            return { ...prev, [id]: { unlocked: true, open: true } }
        })
        setJustUnlocked(id)
    }, [])

    const toggleSection = useCallback((id: SectionId) => {
        setSections(prev => {
            if (!prev[id].unlocked) return prev
            return { ...prev, [id]: { ...prev[id], open: !prev[id].open } }
        })
    }, [])

    // Scroll to and focus newly unlocked section
    useEffect(() => {
        if (!justUnlocked) return
        afterPaint(() => {
            const el = document.getElementById(`section-${justUnlocked}`)
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            afterPaint(() => {
                const firstInput = el?.querySelector<HTMLElement>('input, select, textarea')
                firstInput?.focus()
            })
        })
        // Defer the state clear to avoid setState-in-effect lint
        const timer = setTimeout(() => setJustUnlocked(null), 0)
        return () => clearTimeout(timer)
    }, [justUnlocked])

    // ── React to validation errors — auto-open sections containing errors ──
    useEffect(() => {
        if (fieldErrors.length === 0) return

        const sectionsToOpen = new Set<SectionId>()
        for (const err of fieldErrors) {
            const section = FIELD_TO_SECTION[err]
            if (section) {
                sectionsToOpen.add(section)
            } else {
                sectionsToOpen.add('typeSpecific')
                if (process.env.NODE_ENV === 'development'
                    && !REQUIRED_DYNAMIC[form.projectType]?.includes(err)) {
                    console.warn(`[BasicsStep] Unknown error field "${err}" → typeSpecific`)
                }
            }
        }

        // Defer to avoid setState-in-effect lint
        setTimeout(() => {
            setSections(prev => {
                const next = { ...prev }
                for (const id of sectionsToOpen) {
                    next[id] = { unlocked: true, open: true }
                }
                return next
            })
        }, 0)

        afterPaint(() => {
            const firstErr = fieldErrors[0]
            const el = document.getElementById(`sp-${firstErr}`)
                || document.getElementById(`sp-cf-${firstErr}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                afterPaint(() => el.focus())
            }
        })
    }, [fieldErrors]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Clear dynamic fields when project type changes ──────────────────
    const prevTypeRef = useRef(form.projectType)
    useEffect(() => {
        if (form.projectType !== prevTypeRef.current) {
            const oldKeys = TYPE_FIELDS[prevTypeRef.current] || []
            const cleaned = { ...form.customFields }
            for (const key of oldKeys) delete cleaned[key]
            updateField('customFields', cleaned)
            prevTypeRef.current = form.projectType
        }
    }, [form.projectType]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Unlock trigger: check contact gate ──────────────────────────────
    const checkContactGate = () => {
        if (form.clientName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            unlockAndOpen('projectDetails')
        }
    }

    // ── Unlock trigger: check overview gate ─────────────────────────────
    const checkOverviewGate = () => {
        if (form.projectTitle.trim() && form.description.trim().length >= 10) {
            unlockAndOpen('typeSpecific')
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────
    const hasError = (field: string) => fieldErrors.includes(field)
    const errorStyle = { border: '1.5px solid rgba(239,68,68,0.5)' }

    const updateCustom = (key: string, value: string) => {
        updateField('customFields', { ...form.customFields, [key]: value })
    }

    // Dynamic fields for current project type
    const dynamicFields = TYPE_FIELDS[form.projectType] || TYPE_FIELDS.custom
    const requiredDynamic = new Set(REQUIRED_DYNAMIC[form.projectType] || REQUIRED_DYNAMIC.custom)

    // ── Render ──────────────────────────────────────────────────────────
    return (
        <section>
            <h2 className="sp-step-title">{t('stepLabels.basics')}</h2>

            {/* ── Section: Project Type ── */}
            <Accordion
                id="projectType"
                icon="🎬"
                title={t('sections.projectType')}
                isOpen={sections.projectType.open}
                isUnlocked={sections.projectType.unlocked}
                onToggle={() => toggleSection('projectType')}
            >
                <div className="sp-type-grid">
                    {PROJECT_TYPES.map(type => {
                        const active = form.projectType === type.id
                        return (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => {
                                    updateField('projectType', type.id)
                                    unlockAndOpen('yourInfo')
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    padding: 'clamp(14px, 3vw, 20px)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: `1.5px solid ${active ? 'var(--accent-gold)' : 'rgba(255,255,255,0.08)'}`,
                                    background: active ? type.gradient : 'rgba(255,255,255,0.03)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: active ? '0 4px 20px rgba(212,168,83,0.12)' : 'none',
                                    WebkitTapHighlightColor: 'transparent',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                {active && (
                                    <div style={{
                                        position: 'absolute', top: '10px', right: '10px',
                                        width: '18px', height: '18px', borderRadius: '50%',
                                        background: 'var(--accent-gold)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.55rem', color: '#000', fontWeight: 800,
                                    }}>✓</div>
                                )}
                                <span style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: '8px', display: 'block' }}>
                                    {type.icon}
                                </span>
                                <span style={{
                                    fontSize: 'clamp(0.82rem, 2vw, 0.92rem)', fontWeight: 700,
                                    color: active ? 'var(--accent-gold)' : 'var(--text-primary)',
                                    marginBottom: '4px', lineHeight: 1.3,
                                }}>
                                    {t(`projectTypes.${type.id}.title`)}
                                </span>
                                <span style={{
                                    fontSize: 'clamp(0.68rem, 1.5vw, 0.75rem)',
                                    color: 'var(--text-tertiary)', lineHeight: 1.4,
                                }}>
                                    {t(`projectTypes.${type.id}.description`)}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </Accordion>

            {/* ── Section: Your Info ── */}
            <Accordion
                id="yourInfo"
                icon="👤"
                title={t('sections.yourInfo')}
                isOpen={sections.yourInfo.open}
                isUnlocked={sections.yourInfo.unlocked}
                onToggle={() => toggleSection('yourInfo')}
            >
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
                            onBlur={checkContactGate}
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
                            onBlur={checkContactGate}
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
                                <option value="email">{t('contactMethods.email')}</option>
                                <option value="phone">{t('contactMethods.phone')}</option>
                                <option value="whatsapp">{t('contactMethods.whatsapp')}</option>
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
            </Accordion>

            {/* ── Section: Project Details ── */}
            <Accordion
                id="projectDetails"
                icon="📋"
                title={t('sections.projectDetails')}
                isOpen={sections.projectDetails.open}
                isUnlocked={sections.projectDetails.unlocked}
                onToggle={() => toggleSection('projectDetails')}
            >
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
                            onBlur={checkOverviewGate}
                        />
                        {hasError('projectTitle') && <p className="sp-error">{t('validation.required')}</p>}
                    </div>

                    <div>
                        <label className="sp-label" htmlFor="sp-deadline">{t('fields.deadline')}</label>
                        <div
                            onClick={() => {
                                const input = document.getElementById('sp-deadline') as HTMLInputElement | null
                                if (input) {
                                    if (typeof input.showPicker === 'function') {
                                        try { input.showPicker() } catch { input.focus() }
                                    } else { input.focus() }
                                }
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <input
                                id="sp-deadline"
                                type="date"
                                className="sp-input"
                                min={new Date().toISOString().split('T')[0]}
                                value={form.deadline}
                                onChange={e => updateField('deadline', e.target.value)}
                                style={{ cursor: 'pointer' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="sp-label" htmlFor="sp-description">{t('fields.description')} *</label>
                        <textarea
                            id="sp-description"
                            className="sp-input"
                            style={{
                                minHeight: '120px', resize: 'vertical',
                                ...(hasError('description') ? errorStyle : {}),
                            }}
                            placeholder={t('fields.description')}
                            value={form.description}
                            onChange={e => updateField('description', e.target.value)}
                            onBlur={checkOverviewGate}
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
            </Accordion>

            {/* ── Section: Type-Specific Details ── */}
            <Accordion
                id="typeSpecific"
                icon="🔧"
                title={t('sections.typeSpecific')}
                isOpen={sections.typeSpecific.open}
                isUnlocked={sections.typeSpecific.unlocked}
                onToggle={() => toggleSection('typeSpecific')}
            >
                <p className="sp-step-subtitle" style={{ marginBottom: 'var(--space-md)' }}>
                    {t(`projectTypes.${form.projectType}.title`)}
                </p>
                <div className="sp-form-stack">
                    {dynamicFields.map(field => (
                        <div key={field}>
                            <label className="sp-label" htmlFor={`sp-cf-${field}`}>
                                {t(`dynamicFields.${field}`)}{requiredDynamic.has(field) ? ' *' : ''}
                            </label>
                            {DATE_FIELDS.has(field) ? (
                                <div
                                    onClick={() => {
                                        const input = document.getElementById(`sp-cf-${field}`) as HTMLInputElement | null
                                        if (input) {
                                            if (typeof input.showPicker === 'function') {
                                                try { input.showPicker() } catch { input.focus() }
                                            } else { input.focus() }
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
                            ) : LONG_FIELDS.has(field) ? (
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
            </Accordion>
        </section>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// Accordion sub-component — custom <div> accordion (not native <details>)
// WAI-ARIA Accordion pattern: h3 > button[aria-expanded][aria-controls]
// ═══════════════════════════════════════════════════════════════════════════
function Accordion({
    id, icon, title, isOpen, isUnlocked, onToggle, children,
}: {
    id: string
    icon: string
    title: string
    isOpen: boolean
    isUnlocked: boolean
    onToggle: () => void
    children: React.ReactNode
}) {
    return (
        <div id={`section-${id}`} className="sp-accordion" style={{ marginTop: 'var(--space-md)' }}>
            <h3 style={{ margin: 0 }}>
                <button
                    id={`section-${id}-trigger`}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`section-${id}-body`}
                    onClick={onToggle}
                    disabled={!isUnlocked}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '14px 16px',
                        minHeight: '48px',
                        border: `1px solid ${isUnlocked ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                        borderRadius: 'var(--radius-md)',
                        background: isOpen ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                        cursor: isUnlocked ? 'pointer' : 'default',
                        opacity: isUnlocked ? 1 : 0.4,
                        transition: 'all 0.2s',
                        WebkitTapHighlightColor: 'transparent',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: isOpen ? 'var(--accent-gold)' : 'var(--text-primary)',
                        textAlign: 'left',
                    }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{icon}</span>
                        <span>{title}</span>
                        {!isUnlocked && <span style={{ fontSize: '0.7rem' }}>🔒</span>}
                    </span>
                    <span style={{
                        transition: 'transform 0.25s',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                    }}>
                        ▾
                    </span>
                </button>
            </h3>
            <div
                id={`section-${id}-body`}
                role="region"
                aria-labelledby={`section-${id}-trigger`}
                style={{
                    maxHeight: isOpen ? '5000px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.35s ease, opacity 0.25s ease',
                    opacity: isOpen ? 1 : 0,
                }}
            >
                <div style={{ padding: 'var(--space-md) 0' }}>
                    {children}
                </div>
            </div>
        </div>
    )
}
