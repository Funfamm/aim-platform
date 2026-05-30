'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import StepProgress from './StepProgress'
import BasicsStep from './BasicsStep'
import CreativeBudgetStep from './CreativeBudgetStep'
import ReviewStep from './ReviewStep'
import ConfirmationView from './ConfirmationView'
import { REQUIRED_DYNAMIC } from './constants'

// ── Step definitions (3-step flow) ──────────────────────────────────────────
const STEPS = ['basics', 'creative', 'review'] as const

type StepKey = (typeof STEPS)[number]

// ── Versioned sessionStorage keys ───────────────────────────────────────────
const STORAGE_VERSION = 'v2'
const DRAFT_KEY = `sp_form_draft_${STORAGE_VERSION}`
const STEP_KEY = `sp_form_step_${STORAGE_VERSION}`

// ── Form state shape ────────────────────────────────────────────────────────
export interface StartProjectFormData {
    projectType: string
    // Contact
    clientName: string
    email: string
    phone: string
    contactMethod: string
    companyName: string
    // Overview
    projectTitle: string
    description: string
    deadline: string
    audience: string
    projectGoal: string
    // Creative
    tone: string[]
    visualStyle: string
    inspirationLinks: string[]
    avoidNotes: string
    emotionalFeeling: string
    // Budget & delivery
    budgetRange: string
    budgetCurrency: string
    duration: string
    aspectRatio: string
    deliveryPlatform: string
    addOns: string[]
    rushDelivery: boolean
    // Dynamic
    customFields: Record<string, string>
    // Uploads
    uploads: Array<{ key: string; url: string; name: string; type: string; size: number }>
    // Consent
    consentUpload: boolean
    consentContact: boolean
    // Meta
    language: string
}

const INITIAL: StartProjectFormData = {
    projectType: 'custom',
    clientName: '',
    email: '',
    phone: '',
    contactMethod: '',
    companyName: '',
    projectTitle: '',
    description: '',
    deadline: '',
    audience: '',
    projectGoal: '',
    tone: [],
    visualStyle: '',
    inspirationLinks: [],
    avoidNotes: '',
    emotionalFeeling: '',
    budgetRange: '',
    budgetCurrency: 'USD',
    duration: '',
    aspectRatio: '',
    deliveryPlatform: '',
    addOns: [],
    rushDelivery: false,
    customFields: {},
    uploads: [],
    consentUpload: false,
    consentContact: false,
    language: 'en',
}

// ── Submitted project shape ─────────────────────────────────────────────────
interface SubmittedProject {
    id: string
    projectTitle: string
    projectType: string
    status: string
    createdAt: string
    accessToken: string
}

// ── Validation per step (3-step flow) ───────────────────────────────────────
function validateStep(step: StepKey, form: StartProjectFormData): string[] {
    const errors: string[] = []
    switch (step) {
        case 'basics': {
            if (!form.projectType) errors.push('projectType')
            if (!form.clientName.trim()) errors.push('clientName')
            if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.push('email')
            if (!form.projectTitle.trim()) errors.push('projectTitle')
            if (form.description.trim().length < 10) errors.push('description')
            const required = REQUIRED_DYNAMIC[form.projectType] || REQUIRED_DYNAMIC.custom
            for (const field of required) {
                if (!form.customFields[field]?.trim()) errors.push(field)
            }
            break
        }
        case 'creative': {
            if (!form.budgetRange) errors.push('budgetRange')
            break
        }
        case 'review': {
            if (!form.consentContact) errors.push('consentContact')
            break
        }
    }
    return errors
}

// ════════════════════════════════════════════════════════════════════════════
export default function StartProjectFlow() {
    const t = useTranslations('startProject')
    const locale = useLocale()
    const [stepIndex, setStepIndex] = useState(0)
    const [form, setForm] = useState<StartProjectFormData>(() => {
        // Restore from sessionStorage if available
        if (typeof window !== 'undefined') {
            try {
                const saved = sessionStorage.getItem(DRAFT_KEY)
                const savedStep = sessionStorage.getItem(STEP_KEY)
                if (saved) {
                    const parsed = JSON.parse(saved)
                    // Restore step index too
                    if (savedStep) setTimeout(() => setStepIndex(Number(savedStep)), 0)
                    return { ...INITIAL, language: locale, ...parsed, uploads: [] }
                }
            } catch { /* ignore corrupt data */ }
        }
        return { ...INITIAL, language: locale }
    })
    const formSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [fieldErrors, setFieldErrors] = useState<string[]>([])
    const [submittedProject, setSubmittedProject] = useState<SubmittedProject | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [animKey, setAnimKey] = useState(0) // forces re-mount for animation
    const [isAdmin, setIsAdmin] = useState(false)

    // Detect admin user to allow bypassing required fields for form review
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(data => {
                if (data.user && ['admin', 'superadmin'].includes(data.user.role)) {
                    setIsAdmin(true)
                }
            })
            .catch(() => {})
    }, [])

    const currentStep = STEPS[stepIndex]

    // ── Field updater ───────────────────────────────────────────────────────
    const updateField = useCallback(<K extends keyof StartProjectFormData>(
        field: K,
        value: StartProjectFormData[K]
    ) => {
        setForm(prev => {
            const next = { ...prev, [field]: value }
            // Debounced save to sessionStorage (exclude uploads)
            if (formSaveTimer.current) clearTimeout(formSaveTimer.current)
            formSaveTimer.current = setTimeout(() => {
                try {
                    const { uploads: _uploads, ...saveable } = next
                    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(saveable))
                    sessionStorage.setItem(STEP_KEY, String(stepIndex))
                } catch { /* storage full or unavailable */ }
            }, 300)
            return next
        })
        setFieldErrors(prev => prev.filter(f => f !== field))
    }, [stepIndex])

    // ── Step navigation ─────────────────────────────────────────────────────
    const goNext = useCallback(() => {
        if (!isAdmin) {
            const errors = validateStep(currentStep, form)
            if (errors.length > 0) {
                setFieldErrors(errors)
                return
            }
        }
        setFieldErrors([])
        setStepIndex(i => Math.min(STEPS.length - 1, i + 1))
        setAnimKey(k => k + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [currentStep, form, isAdmin])

    const goBack = useCallback(() => {
        setFieldErrors([])
        setStepIndex(i => Math.max(0, i - 1))
        setAnimKey(k => k + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    const goToStep = useCallback((idx: number) => {
        if (idx < stepIndex || isAdmin) {
            setFieldErrors([])
            setStepIndex(idx)
            setAnimKey(k => k + 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [stepIndex, isAdmin])

    // ── Submit (fires from Review step) ───────────────────────────────────
    const handleSubmit = useCallback(async () => {
        // Validate review step consent
        if (!isAdmin) {
            const errors = validateStep('review', form)
            if (errors.length > 0) {
                setFieldErrors(errors)
                return
            }
        }

        setIsSubmitting(true)
        setSubmitError('')

        try {
            const res = await fetch('/api/project-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()

            if (!res.ok) {
                const details = data.details?.join(', ') || ''
                throw new Error(details || data.error || t('errors.submitFailed'))
            }

            // Clear saved draft on successful submission
            try {
                sessionStorage.removeItem(DRAFT_KEY)
                sessionStorage.removeItem(STEP_KEY)
            } catch { /* ignore */ }
            setSubmittedProject(data.project)
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : t('errors.somethingWrong'))
        } finally {
            setIsSubmitting(false)
        }
    }, [form, isAdmin])

    // ── Confirmation screen ─────────────────────────────────────────────────
    if (submittedProject) {
        return <ConfirmationView project={submittedProject} />
    }

    // ── Step rendering ──────────────────────────────────────────────────────
    const stepProps = { form, updateField, fieldErrors }

    return (
        <div style={{
            borderRadius: 'var(--radius-xl)',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            padding: 'clamp(1rem, 3vw, 1.5rem)',
            backdropFilter: 'blur(8px)',
        }}>
            {/* Admin Preview Banner */}
            {isAdmin && (
                <div style={{
                    marginBottom: 'var(--space-md)',
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(234,88,12,0.06))',
                    border: '1px solid rgba(245,158,11,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#f59e0b',
                }}>
                    <span style={{ fontSize: '1rem' }}>🛡️</span>
                    {t('helpers.adminPreview')}
                </div>
            )}

            <StepProgress
                steps={STEPS as unknown as string[]}
                currentIndex={stepIndex}
                onStepClick={goToStep}
            />

            {/* Step counter for mobile */}
            <div style={{
                textAlign: 'center',
                marginTop: 'var(--space-sm)',
                fontSize: '0.68rem',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.1em',
            }}>
                {stepIndex + 1} / {STEPS.length}
            </div>

            {/* Animated step body */}
            <div key={animKey} className="sp-step-body" style={{ marginTop: 'var(--space-lg)', minHeight: '280px' }}>
                {currentStep === 'basics' && <BasicsStep {...stepProps} />}
                {currentStep === 'creative' && <CreativeBudgetStep {...stepProps} />}
                {currentStep === 'review' && <ReviewStep {...stepProps} onGoToStep={goToStep} onSubmit={handleSubmit} isSubmitting={isSubmitting} />}
            </div>

            {/* ── Submit error ── */}
            {submitError && (
                <div style={{
                    marginTop: 'var(--space-md)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <span>⚠️</span> {submitError}
                </div>
            )}

            {/* ── Navigation buttons ── */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-md)',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                paddingTop: 'var(--space-lg)',
                marginTop: 'var(--space-lg)',
            }}>
                <button
                    type="button"
                    onClick={goBack}
                    disabled={stepIndex === 0}
                    className="sp-btn sp-btn-ghost"
                >
                    {t('buttons.back')}
                </button>

                {currentStep !== 'review' ? (
                    <button
                        type="button"
                        onClick={goNext}
                        className="sp-btn sp-btn-primary"
                    >
                        {t('buttons.continue')}
                    </button>
                ) : (
                    /* Review step has its own submit button */
                    null
                )}
            </div>
        </div>
    )
}
