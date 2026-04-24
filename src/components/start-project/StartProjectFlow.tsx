'use client'

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import StepProgress from './StepProgress'
import ProjectTypeStep from './ProjectTypeStep'
import ContactStep from './ContactStep'
import OverviewStep from './OverviewStep'
import CreativeDirectionStep from './CreativeDirectionStep'
import DynamicFieldsStep from './DynamicFieldsStep'
import UploadStep from './UploadStep'
import BudgetDeliveryStep from './BudgetDeliveryStep'
import ReviewStep from './ReviewStep'
import ConfirmationView from './ConfirmationView'

// ── Step definitions ────────────────────────────────────────────────────────
const STEPS = [
    'projectType',
    'contact',
    'overview',
    'creative',
    'dynamic',
    'uploads',
    'delivery',
    'review',
] as const

type StepKey = (typeof STEPS)[number]

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

// ── Validation per step ─────────────────────────────────────────────────────
function validateStep(step: StepKey, form: StartProjectFormData): string[] {
    const errors: string[] = []
    switch (step) {
        case 'contact':
            if (!form.clientName.trim()) errors.push('clientName')
            if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.push('email')
            break
        case 'overview':
            if (!form.projectTitle.trim()) errors.push('projectTitle')
            if (form.description.trim().length < 10) errors.push('description')
            break
        case 'review':
            if (!form.consentContact) errors.push('consentContact')
            break
    }
    return errors
}

// ════════════════════════════════════════════════════════════════════════════
export default function StartProjectFlow() {
    const t = useTranslations('startProject')
    const locale = useLocale()
    const [stepIndex, setStepIndex] = useState(0)
    const [form, setForm] = useState<StartProjectFormData>({ ...INITIAL, language: locale })
    const [fieldErrors, setFieldErrors] = useState<string[]>([])
    const [submittedProject, setSubmittedProject] = useState<SubmittedProject | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [animKey, setAnimKey] = useState(0) // forces re-mount for animation

    const currentStep = STEPS[stepIndex]

    // ── Field updater ───────────────────────────────────────────────────────
    const updateField = useCallback(<K extends keyof StartProjectFormData>(
        field: K,
        value: StartProjectFormData[K]
    ) => {
        setForm(prev => ({ ...prev, [field]: value }))
        setFieldErrors(prev => prev.filter(f => f !== field))
    }, [])

    // ── Step navigation ─────────────────────────────────────────────────────
    const goNext = useCallback(() => {
        const errors = validateStep(currentStep, form)
        if (errors.length > 0) {
            setFieldErrors(errors)
            return
        }
        setFieldErrors([])
        setStepIndex(i => Math.min(STEPS.length - 1, i + 1))
        setAnimKey(k => k + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [currentStep, form])

    const goBack = useCallback(() => {
        setFieldErrors([])
        setStepIndex(i => Math.max(0, i - 1))
        setAnimKey(k => k + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    const goToStep = useCallback((idx: number) => {
        if (idx < stepIndex) {
            setFieldErrors([])
            setStepIndex(idx)
            setAnimKey(k => k + 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [stepIndex])

    // ── Submit ──────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        const errors = validateStep('review', form)
        if (errors.length > 0) {
            setFieldErrors(errors)
            return
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
                throw new Error(data.error || 'Failed to submit')
            }

            setSubmittedProject(data.project)
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setIsSubmitting(false)
        }
    }, [form])

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
                {currentStep === 'projectType' && <ProjectTypeStep {...stepProps} />}
                {currentStep === 'contact' && <ContactStep {...stepProps} />}
                {currentStep === 'overview' && <OverviewStep {...stepProps} />}
                {currentStep === 'creative' && <CreativeDirectionStep {...stepProps} />}
                {currentStep === 'dynamic' && <DynamicFieldsStep {...stepProps} />}
                {currentStep === 'uploads' && <UploadStep {...stepProps} />}
                {currentStep === 'delivery' && <BudgetDeliveryStep {...stepProps} />}
                {currentStep === 'review' && <ReviewStep {...stepProps} onGoToStep={goToStep} />}
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
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="sp-btn sp-btn-primary"
                        style={{
                            opacity: isSubmitting ? 0.6 : 1,
                            minWidth: '180px',
                        }}
                    >
                        {isSubmitting ? '⏳ Submitting...' : `🚀 ${t('buttons.submit')}`}
                    </button>
                )}
            </div>
        </div>
    )
}
