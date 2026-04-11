'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AICastingReport from '@/components/application/AICastingReport'

interface Props {
    application: {
        id: string
        fullName: string
        email: string
        phone: string | null
        age: number | null
        gender: string | null
        location: string | null
        status: string
        aiScore: number | null
        aiFitLevel: string | null
        adminNotes: string | null
        createdAt: string
        resultVisibleAt: string | null
        statusNote: string | null
        auditState?: string | null
        adminRevealOverride?: boolean
    }
    castingCall: {
        roleName: string
        roleType: string
        roleDescription: string
        requirements: string
        projectTitle: string
    }
    photos: string[]
    voicePath: string | null
    experienceData: {
        text: string
        specialSkills: string
        personality: {
            describe_yourself: string
            why_acting: string
            dream_role: string
            unique_quality: string
        }
    }
    socialData: {
        primary: { platform: string; username: string }
        secondary: { platform: string; username: string } | null
    }
    aiReport: {
        overallScore: number
        roleFitScore: number
        strengths: string[]
        concerns: string[]
        recommendation: string
        notes: string
        screeningSkipped?: boolean
        warnings?: string[]
    } | null
    isSuperAdmin?: boolean
}

// Valid forward transitions per status (strict pipeline)
const NEXT_STEPS: Record<string, string[]> = {
    submitted:    ['under_review', 'shortlisted', 'not_selected'],
    under_review: ['shortlisted', 'not_selected'],
    shortlisted:  ['callback', 'final_review', 'not_selected'],
    callback:     ['final_review', 'not_selected'],
    final_review: ['selected', 'not_selected'],
    selected:     ['under_review'],      // restore path
    rejected:     ['under_review'],      // restore path
    not_selected: ['under_review'],      // restore path
}

const PIPELINE = [
    { key: 'submitted',    label: 'Received',     icon: '📥' },
    { key: 'under_review', label: 'Reviewing',    icon: '🔍' },
    { key: 'shortlisted',  label: 'Shortlisted',  icon: '⭐' },
    { key: 'callback',     label: 'Follow-up',    icon: '✉️' },
    { key: 'final_review', label: 'Final Review', icon: '🎭' },
    { key: 'selected',     label: 'Cast',         icon: '🏆' },
]

// Human-readable action labels
const ACTION_LABELS: Record<string, { label: string; icon: string; style: 'primary' | 'danger' | 'restore' }> = {
    under_review: { label: 'Begin Review',          icon: '🔍', style: 'primary'  },
    shortlisted:  { label: 'Shortlist',             icon: '⭐', style: 'primary'  },
    callback:     { label: 'Request Follow-up Email', icon: '✉️', style: 'primary' },
    final_review: { label: 'Move to Final Review',  icon: '🎭', style: 'primary'  },
    selected:     { label: 'Cast / Select',         icon: '🏆', style: 'primary'  },
    not_selected: { label: 'Not Selected',          icon: '✕',  style: 'danger'   },
    rejected:     { label: 'Reject',               icon: '✕',  style: 'danger'   },
}

export default function ApplicationDetailClient({ application, castingCall, photos, voicePath, experienceData, socialData, aiReport, isSuperAdmin }: Props) {
    const router = useRouter()
    const [runningAI, setRunningAI] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [currentReport, setCurrentReport] = useState(aiReport)
    const [aiError, setAiError] = useState('')
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
    const [editingFeedback, setEditingFeedback] = useState(application.statusNote || '')
    const [savingFeedback, setSavingFeedback] = useState(false)
    const [feedbackSaved, setFeedbackSaved] = useState(false)
    const [bypassActive, setBypassActive] = useState(false)
    const [confirmAction, setConfirmAction] = useState<string | null>(null)

    // Notification log
    const [notifOpen, setNotifOpen] = useState(false)
    const [notifLoading, setNotifLoading] = useState(false)
    const [notifications, setNotifications] = useState<Array<{
        id: string; createdAt: string; type: string; subject: string;
        recipientEmail: string; status: string;
    }>>([])
    const [notifPage, setNotifPage] = useState(1)
    const [notifTotal, setNotifTotal] = useState(0)
    const NOTIF_SIZE = 10

    const loadNotifications = async (page = 1) => {
        setNotifLoading(true)
        try {
            const res = await fetch(`/api/admin/applications/${application.id}/notifications?page=${page}&size=${NOTIF_SIZE}`)
            if (res.ok) {
                const data = await res.json()
                setNotifications(data.notifications)
                setNotifTotal(data.pagination.total)
                setNotifPage(page)
            }
        } catch { /* */ }
        finally { setNotifLoading(false) }
    }

    useEffect(() => {
        if (notifOpen && notifications.length === 0) {
            loadNotifications(1)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notifOpen])

    const resultVisibleAt = application.resultVisibleAt ? new Date(application.resultVisibleAt) : null
    const now = new Date()
    const isDelivered = resultVisibleAt ? now >= resultVisibleAt : false
    const hoursLeft = resultVisibleAt && !isDelivered ? Math.max(0, Math.ceil((resultVisibleAt.getTime() - now.getTime()) / (1000 * 60 * 60))) : 0
    const minutesLeft = resultVisibleAt && !isDelivered ? Math.max(0, Math.ceil((resultVisibleAt.getTime() - now.getTime()) / (1000 * 60))) : 0

    const saveFeedback = async () => {
        setSavingFeedback(true)
        try {
            await fetch(`/api/admin/applications/${application.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statusNote: editingFeedback }),
            })
            setFeedbackSaved(true)
            setTimeout(() => setFeedbackSaved(false), 2000)
        } catch { /* */ }
        finally { setSavingFeedback(false) }
    }

    const runAIAudit = async (action?: 'process_now' | 'reveal_now') => {
        setRunningAI(true); setAiError('')
        try {
            const res = await fetch(`/api/admin/applications/${application.id}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            })
            const data = await res.json()
            if (res.ok) {
                if (data.report) setCurrentReport(data.report)
                if (data.report?.applicantFeedback) setEditingFeedback(data.report.applicantFeedback)
                router.refresh()
            }
            else setAiError(data.error || 'AI analysis failed.')
        } catch { setAiError('Network error.') }
        finally { setRunningAI(false) }
    }

    const updateStatus = async (newStatus: string) => {
        setUpdatingStatus(true)
        setConfirmAction(null)
        try {
            await fetch(`/api/admin/applications/${application.id}/status`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })
            router.refresh()
        } catch { /* */ }
        finally { setUpdatingStatus(false) }
    }

    const stageOrder = PIPELINE.map(s => s.key)
    const currentIdx = stageOrder.indexOf(application.status)
    const isWithdrawn = application.status === 'withdrawn'
    const isTerminal = ['selected', 'rejected', 'not_selected'].includes(application.status)
    const isRejected = application.status === 'rejected' || application.status === 'not_selected'

    // Valid next steps for current status (or all if bypass active)
    const allowedNextSteps = bypassActive && isSuperAdmin
        ? stageOrder.filter(s => s !== application.status)
        : (NEXT_STEPS[application.status] || [])

    // Whether the Shortlist action is AI-gated
    const shortlistGated = !bypassActive && application.aiScore === null

    // Button style helper
    const actionBtnStyle = (variant: 'primary' | 'danger' | 'restore', disabled?: boolean): React.CSSProperties => ({
        padding: '8px 18px',
        fontSize: '0.78rem',
        fontWeight: 700,
        borderRadius: '10px',
        border: variant === 'primary'
            ? '1px solid rgba(212,168,83,0.35)'
            : variant === 'danger'
            ? '1px solid rgba(239,68,68,0.25)'
            : '1px solid rgba(139,92,246,0.25)',
        background: variant === 'primary'
            ? 'linear-gradient(135deg, rgba(212,168,83,0.18), rgba(212,168,83,0.06))'
            : variant === 'danger'
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(139,92,246,0.08)',
        color: variant === 'primary'
            ? 'var(--accent-gold)'
            : variant === 'danger'
            ? 'var(--color-error)'
            : '#a78bfa',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.2s',
    })

    return (
        <div>
            {/* ─── WITHDRAWN BANNER ─── */}
            {isWithdrawn && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 18px', marginBottom: '20px', borderRadius: '10px',
                    background: 'rgba(239,68,68,0.07)',
                    border: '1px solid rgba(239,68,68,0.25)',
                }}>
                    <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                    <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f87171' }}>Application Withdrawn by Applicant</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            This application is read-only. If the applicant wishes to reapply, a new submission will appear here.
                        </div>
                    </div>
                </div>
            )}

            {/* ─── HEADER BAR ─── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
            }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{application.fullName}</h1>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                        <span style={{ color: 'var(--accent-gold)' }}>{castingCall.roleName}</span> · {castingCall.projectTitle}
                        · Applied {new Date(application.createdAt).toLocaleDateString()}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Audit State Badge */}
                    {(application as any).auditState && (
                        <span style={{
                            padding: '3px 10px', fontSize: '0.66rem', fontWeight: 700,
                            borderRadius: '20px', letterSpacing: '0.04em',
                            background: {
                                queued: 'rgba(59,130,246,0.12)',
                                processing: 'rgba(245,158,11,0.12)',
                                scored_hidden: 'rgba(228,185,90,0.12)',
                                scored_visible: 'rgba(34,197,94,0.12)',
                                failed: 'rgba(239,68,68,0.12)',
                            }[(application as any).auditState as string] ?? 'rgba(255,255,255,0.06)',
                            color: {
                                queued: 'var(--color-info)',
                                processing: 'var(--color-warning)',
                                scored_hidden: 'var(--accent-gold)',
                                scored_visible: 'var(--color-success)',
                                failed: 'var(--color-error)',
                            }[(application as any).auditState as string] ?? 'var(--text-tertiary)',
                            border: '1px solid currentColor',
                            opacity: 0.9,
                        }}>
                            {String((application as any).auditState).replace('_', ' ').toUpperCase()}
                        </span>
                    )}

                    {/* AI Audit Buttons — hidden for withdrawn */}
                    {!isWithdrawn && (!(application as any).auditState || ['queued','failed',null].includes((application as any).auditState)) && (
                        <button onClick={() => runAIAudit('process_now')} disabled={runningAI}
                            style={{
                                padding: '6px 16px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px',
                                border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer',
                                background: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))',
                                color: 'var(--accent-gold)', transition: 'all 0.2s',
                            }}>
                            {runningAI ? '⏳ Processing...' : '🤖 Process Now'}
                        </button>
                    )}

                    {!isWithdrawn && (application as any).auditState === 'scored_hidden' && (
                        <button onClick={() => runAIAudit('reveal_now')} disabled={runningAI}
                            style={{
                                padding: '6px 16px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px',
                                border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer',
                                background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
                                color: 'var(--color-success)', transition: 'all 0.2s',
                            }}>
                            {runningAI ? '⏳ Revealing...' : '📬 Reveal Now'}
                        </button>
                    )}

                    {/* Superadmin Bypass Toggle */}
                    {isSuperAdmin && !isWithdrawn && (
                        <button
                            onClick={() => setBypassActive(b => !b)}
                            style={{
                                padding: '6px 14px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '8px',
                                border: bypassActive ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(168,85,247,0.2)',
                                background: bypassActive ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.05)',
                                color: '#a855f7', cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: bypassActive ? '0 0 12px rgba(168,85,247,0.25)' : 'none',
                            }}
                        >
                            {bypassActive ? '🔓 Override Active' : '🔒 Super Admin Override'}
                        </button>
                    )}
                </div>
            </div>

            {/* ─── PIPELINE BAR (Read-Only Visualization) ─── */}
            <div style={{
                display: 'flex', gap: '2px', marginBottom: '20px',
                padding: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.05)',
            }}>
                {PIPELINE.map((stage) => {
                    const stageIdx = stageOrder.indexOf(stage.key)
                    const isActive = application.status === stage.key
                    const isPast = !isRejected && currentIdx >= 0 && stageIdx < currentIdx
                    const isFuture = currentIdx >= 0 && stageIdx > currentIdx

                    return (
                        <div key={stage.key}
                            style={{
                                flex: 1, padding: '8px 4px', borderRadius: '8px',
                                background: isActive ? 'var(--accent-gold-glow)' : isPast ? 'rgba(16,185,129,0.06)' : 'transparent',
                                borderBottom: isActive ? '2px solid var(--accent-gold)' : isPast ? '2px solid rgba(16,185,129,0.4)' : '2px solid transparent',
                                textAlign: 'center',
                                opacity: isFuture && isRejected ? 0.3 : 1,
                            }}
                        >
                            <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>{isPast ? '✓' : stage.icon}</div>
                            <div style={{
                                fontSize: '0.62rem', fontWeight: isActive ? 700 : 500, letterSpacing: '0.02em',
                                color: isActive ? 'var(--accent-gold)' : isPast ? 'var(--color-success)' : 'var(--text-tertiary)',
                            }}>{stage.label}</div>
                            {isActive && <div style={{
                                width: '4px', height: '4px', borderRadius: '50%',
                                background: 'var(--accent-gold)', margin: '3px auto 0',
                            }} />}
                        </div>
                    )
                })}
                {isWithdrawn && (
                    <div style={{
                        flex: 1, padding: '8px 4px', borderRadius: '8px', textAlign: 'center',
                        background: 'rgba(239,68,68,0.08)', borderBottom: '2px solid rgba(239,68,68,0.4)',
                    }}>
                        <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>⤺</div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#f87171' }}>Withdrawn</div>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f87171', margin: '3px auto 0' }} />
                    </div>
                )}
            </div>

            {/* ─── SMART ACTION BLOCK ─── */}
            {!isWithdrawn && (
                <div style={{
                    padding: '16px 18px', marginBottom: '20px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.04), rgba(139,92,246,0.03))',
                    border: bypassActive ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(212,168,83,0.1)',
                    transition: 'border 0.2s',
                }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: bypassActive ? '#a855f7' : 'var(--accent-gold)', marginBottom: '12px' }}>
                        {bypassActive ? '🔓 Override Mode — All Actions Unlocked' : '⚡ Available Actions'}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {allowedNextSteps.map(nextStatus => {
                            const meta = ACTION_LABELS[nextStatus]
                            if (!meta) return null
                            const isShortlist = nextStatus === 'shortlisted'
                            const gated = isShortlist && shortlistGated

                            return (
                                <div key={nextStatus} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <button
                                        onClick={() => setConfirmAction(nextStatus)}
                                        disabled={updatingStatus || gated}
                                        style={actionBtnStyle(meta.style, updatingStatus || gated)}
                                    >
                                        {meta.icon} {meta.label}
                                    </button>
                                    {/* AI Skip override for Shortlist gate */}
                                    {gated && (
                                        <button
                                            onClick={() => setConfirmAction(nextStatus + '__skip_ai')}
                                            disabled={updatingStatus}
                                            style={{
                                                padding: '3px 10px', fontSize: '0.62rem', fontWeight: 600, borderRadius: '6px',
                                                border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.06)',
                                                color: '#f59e0b', cursor: 'pointer',
                                            }}
                                            title="Skip AI requirement and shortlist manually"
                                        >
                                            ⚡ Skip AI & Shortlist
                                        </button>
                                    )}
                                </div>
                            )
                        })}

                        {allowedNextSteps.length === 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                No further actions available for this status.
                            </span>
                        )}
                    </div>

                    {shortlistGated && !bypassActive && (
                        <div style={{ fontSize: '0.68rem', color: '#f59e0b', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>⚠️</span> Shortlist requires an AI Audit score. Run <strong>🤖 Process Now</strong> above, or use <strong>⚡ Skip AI & Shortlist</strong>.
                        </div>
                    )}
                </div>
            )}

            {/* ─── CONFIRM MODAL ─── */}
            {confirmAction && (
                <div onClick={() => setConfirmAction(null)} style={{
                    position: 'fixed', inset: 0, zIndex: 9000,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#141720', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
                        padding: '28px 32px', maxWidth: '400px', width: '90%',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                    }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '8px' }}>Confirm Action</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                            {confirmAction.endsWith('__skip_ai')
                                ? <>You are about to <strong>Shortlist</strong> this applicant without an AI audit. Only do this if you have manually reviewed their submission.</>
                                : <>Move <strong>{application.fullName}</strong> to <strong>{ACTION_LABELS[confirmAction]?.label || confirmAction}</strong>?
                                    {['callback'].includes(confirmAction) && <><br /><span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>⚠️ A follow-up email will be sent to the applicant.</span></>}
                                    {['selected'].includes(confirmAction) && <><br /><span style={{ color: '#22c55e', fontSize: '0.75rem' }}>🏆 A selection email will be sent to the applicant.</span></>}
                                    {['not_selected', 'rejected'].includes(confirmAction) && <><br /><span style={{ color: '#f87171', fontSize: '0.75rem' }}>✕ A rejection notification will be sent to the applicant.</span></>}
                                </>
                            }
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setConfirmAction(null)} style={{
                                padding: '8px 18px', fontSize: '0.78rem', fontWeight: 600, borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                                color: 'var(--text-tertiary)', cursor: 'pointer',
                            }}>Cancel</button>
                            <button
                                onClick={() => {
                                    const targetStatus = confirmAction.replace('__skip_ai', '')
                                    updateStatus(targetStatus)
                                }}
                                style={{
                                    padding: '8px 20px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px',
                                    border: '1px solid rgba(212,168,83,0.35)',
                                    background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))',
                                    color: 'var(--accent-gold)', cursor: 'pointer',
                                }}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── VISION SCREENING SKIPPED WARNING ─── */}
            {currentReport?.screeningSkipped && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', marginBottom: '16px', borderRadius: '8px',
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    fontSize: '0.75rem', fontWeight: 600,
                    color: 'hsl(38, 92%, 50%)',
                }}>
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    <span>Vision screening was skipped — photos were not validated by AI. A <strong>−5 point</strong> penalty has been applied.</span>
                </div>
            )}

            {/* ─── AUDIT WARNINGS ─── */}
            {currentReport?.warnings && currentReport.warnings.length > 0 && (
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    padding: '8px 14px', marginBottom: '16px', borderRadius: '8px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    fontSize: '0.75rem', fontWeight: 600,
                    color: 'var(--color-error)',
                }}>
                    {currentReport.warnings.map((warning, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1rem' }}>⚠️</span>
                            <span>{warning}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── MAIN GRID ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                {/* LEFT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Photo Gallery */}
                    <div style={{
                        padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                            📸 Photos ({photos.length})
                        </div>
                        {photos.length > 0 ? (
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {photos.map((photo, i) => (
                                    <div key={i}
                                        onClick={() => setLightboxIdx(i)}
                                        style={{
                                            width: '80px', height: '106px', flexShrink: 0,
                                            borderRadius: '6px', overflow: 'hidden', cursor: 'pointer',
                                            border: '2px solid transparent', transition: 'border 0.2s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-gold)')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={photo} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No photos</div>
                        )}
                    </div>

                    {/* Voice + Skills */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{
                            padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                                🎙️ Voice Tape
                            </div>
                            {voicePath ? (
                                <audio controls style={{ width: '100%', height: '32px' }}>
                                    <source src={voicePath} />
                                </audio>
                            ) : (
                                <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.78rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>No recording</div>
                            )}
                        </div>

                        <div style={{
                            padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                                🎯 Skills
                            </div>
                            {experienceData.specialSkills ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {experienceData.specialSkills.split(',').map((s, i) => (
                                        <span key={i} style={{
                                            padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600,
                                            borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                                        }}>{s.trim()}</span>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>None listed</div>
                            )}
                        </div>
                    </div>

                    {/* Personality Answers */}
                    <div style={{
                        padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                            💬 About the Applicant
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {[
                                { label: 'Self-description', value: experienceData.personality?.describe_yourself, emoji: '🪞' },
                                { label: 'Why acting?', value: experienceData.personality?.why_acting, emoji: '🎬' },
                                { label: 'Dream role', value: experienceData.personality?.dream_role, emoji: '✨' },
                                { label: 'Unique quality', value: experienceData.personality?.unique_quality, emoji: '💎' },
                            ].filter(item => item.value).map((item) => (
                                <div key={item.label} style={{
                                    padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                }}>
                                    <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                                        {item.emoji} {item.label}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: '60px', overflow: 'hidden' }}>
                                        {item.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {experienceData.text && (
                            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '4px' }}>📄 Experience</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: '80px', overflow: 'hidden' }}>{experienceData.text}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Info Card */}
                    <div style={{
                        padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                            👤 Applicant Info
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem' }}>
                            {[
                                { label: 'Email', value: application.email },
                                { label: 'Phone', value: application.phone },
                                { label: 'Age', value: application.age },
                                { label: 'Gender', value: application.gender },
                                { label: 'Location', value: application.location },
                                { label: 'Applied', value: new Date(application.createdAt).toLocaleDateString() },
                            ].filter(f => f.value).map(f => (
                                <div key={f.label}>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(f.value)}</div>
                                </div>
                            ))}
                        </div>
                        {socialData.primary.username && (
                            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>
                                <span style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{socialData.primary.platform}: </span>
                                <span style={{ color: 'var(--accent-gold)' }}>{socialData.primary.username}</span>
                                {socialData.secondary && (
                                    <div style={{ marginTop: '2px' }}>
                                        <span style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{socialData.secondary.platform}: </span>
                                        <span style={{ color: 'var(--accent-gold)' }}>{socialData.secondary.username}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <AICastingReport
                        report={currentReport}
                        isLoading={runningAI}
                        error={aiError}
                        onRunAudit={runAIAudit}
                    />

                    {/* Delivery Info */}
                    {(currentReport || application.statusNote) && (
                        <div style={{
                            padding: '14px', borderRadius: '10px',
                            background: isDelivered
                                ? 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))'
                                : 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
                            border: `1px solid ${isDelivered ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'}`,
                        }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: isDelivered ? 'var(--color-success)' : 'var(--color-warning)', marginBottom: '10px' }}>
                                📬 Applicant Delivery
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: isDelivered ? 'var(--color-success)' : 'var(--color-warning)',
                                    boxShadow: `0 0 8px ${isDelivered ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)'}`,
                                    animation: isDelivered ? 'none' : 'pulse 2s infinite',
                                }} />
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {isDelivered
                                        ? '✓ Results delivered to applicant'
                                        : resultVisibleAt
                                            ? `Delivering in ~${hoursLeft > 0 ? `${hoursLeft}h` : `${minutesLeft}m`}`
                                            : 'Not yet scheduled'
                                    }
                                </div>
                            </div>

                            {resultVisibleAt && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                                    Delivery time: {resultVisibleAt.toLocaleString()}
                                </div>
                            )}

                            {/* Editable Applicant Feedback — locked when withdrawn */}
                            <div style={{ marginTop: '8px' }}>
                                <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                                    ✉️ Message to applicant {isWithdrawn ? '(read-only)' : '(editable)'}
                                </div>
                                <textarea
                                    value={editingFeedback}
                                    onChange={(e) => { if (!isWithdrawn) { setEditingFeedback(e.target.value); setFeedbackSaved(false) } }}
                                    readOnly={isWithdrawn}
                                    style={{
                                        width: '100%', minHeight: '70px', padding: '8px',
                                        fontSize: '0.75rem', lineHeight: 1.5,
                                        background: isWithdrawn ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                                        color: isWithdrawn ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                                        resize: isWithdrawn ? 'none' : 'vertical', fontFamily: 'inherit',
                                        cursor: isWithdrawn ? 'not-allowed' : 'text',
                                    }}
                                    placeholder="Edit feedback before it reaches the applicant..."
                                />
                                {!isWithdrawn && (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                                        <button
                                            onClick={saveFeedback}
                                            disabled={savingFeedback || editingFeedback === (application.statusNote || '')}
                                            style={{
                                                padding: '5px 12px', fontSize: '0.7rem', fontWeight: 700,
                                                borderRadius: '6px', border: '1px solid rgba(212,168,83,0.3)',
                                                background: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))',
                                                color: 'var(--accent-gold)', cursor: 'pointer',
                                                opacity: editingFeedback === (application.statusNote || '') ? 0.4 : 1,
                                            }}
                                        >
                                            {savingFeedback ? '⏳ Saving...' : feedbackSaved ? '✓ Saved' : '💾 Save Changes'}
                                        </button>
                                        {editingFeedback !== (application.statusNote || '') && (
                                            <span style={{ fontSize: '0.65rem', color: 'var(--color-warning)' }}>Unsaved changes</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Role Requirements */}
                    <div style={{
                        padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '8px' }}>
                            🎭 Role: {castingCall.roleName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                            {castingCall.roleType} · {castingCall.projectTitle}
                        </div>
                        {castingCall.roleDescription && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: '60px', overflow: 'hidden' }}>
                                {castingCall.roleDescription}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── NOTIFICATION LOG ─── */}
            <div style={{ marginTop: '20px' }}>
                <button
                    onClick={() => setNotifOpen(o => !o)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)',
                        width: '100%', justifyContent: 'space-between',
                    }}
                >
                    <span>📬 Notification Log {notifTotal > 0 && <span style={{ color: 'var(--accent-gold)' }}>({notifTotal})</span>}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{notifOpen ? '▲ collapse' : '▼ expand'}</span>
                </button>
                {notifOpen && (
                    <div style={{
                        marginTop: '8px', padding: '12px', borderRadius: '8px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        {notifLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Loading…</div>
                        ) : notifications.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No notifications sent yet.</div>
                        ) : (
                            <>
                                {notifications.map((n, idx) => (
                                    <div key={n.id} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                                        padding: '8px 0',
                                        borderBottom: idx < notifications.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    }}>
                                        <span style={{ fontSize: '1rem', marginTop: '1px' }}>{n.status === 'sent' ? '✅' : '❌'}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {n.subject}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                                {new Date(n.createdAt).toLocaleString()} · {n.recipientEmail}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                            background: n.status === 'sent' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                            color: n.status === 'sent' ? 'var(--color-success)' : 'var(--color-error)',
                                        }}>{n.status.toUpperCase()}</span>
                                    </div>
                                ))}
                                {notifTotal > NOTIF_SIZE && (
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                                        <button
                                            disabled={notifPage <= 1 || notifLoading}
                                            onClick={() => loadNotifications(notifPage - 1)}
                                            style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', opacity: notifPage <= 1 ? 0.4 : 1 }}
                                        >← Prev</button>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                                            {notifPage} / {Math.ceil(notifTotal / NOTIF_SIZE)}
                                        </span>
                                        <button
                                            disabled={notifPage >= Math.ceil(notifTotal / NOTIF_SIZE) || notifLoading}
                                            onClick={() => loadNotifications(notifPage + 1)}
                                            style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', opacity: notifPage >= Math.ceil(notifTotal / NOTIF_SIZE) ? 0.4 : 1 }}
                                        >Next →</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ─── LIGHTBOX ─── */}
            {lightboxIdx !== null && (
                <div onClick={() => setLightboxIdx(null)} style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'zoom-out',
                }}>
                    <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(Math.max(0, lightboxIdx - 1)) }}
                        style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.5rem', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                        ‹
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photos[lightboxIdx]} alt="Full size" style={{ maxWidth: '80vw', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain' }} />
                    <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(Math.min(photos.length - 1, lightboxIdx + 1)) }}
                        style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.5rem', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                        ›
                    </button>
                    <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                        {lightboxIdx + 1} / {photos.length}
                    </div>
                    <button onClick={() => setLightboxIdx(null)}
                        style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>
                        ✕
                    </button>
                </div>
            )}

            <style jsx>{`
                @media (max-width: 1100px) {
                    div[style*="grid-template-columns: 1fr 1fr"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    )
}
