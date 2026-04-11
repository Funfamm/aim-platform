'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; emoji: string; labelKey: string }> = {
    submitted:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)',  emoji: '📤', labelKey: 'statusSubmitted' },
    analyzing:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', emoji: '🤖', labelKey: 'statusAnalyzing' },
    analyzed:    { color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)', emoji: '📊', labelKey: 'statusAnalyzed' },
    shortlisted: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  emoji: '⭐', labelKey: 'statusShortlisted' },
    selected:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  emoji: '🏆', labelKey: 'statusSelected' },
    rejected:    { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', emoji: '📝', labelKey: 'statusNotSelected' },
    withdrawn:   { color: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)', emoji: '↩️', labelKey: 'statusWithdrawn' },
}

interface Props {
    callId: string
    callTitle: string
    submissionTitle: string
    submissionStatus: string
    submittedAt: string
    onWithdrawn?: () => void
}

export default function ScriptSubmittedCard({ callId, callTitle, submissionTitle, submissionStatus, submittedAt, onWithdrawn }: Props) {
    const t = useTranslations('scripts')
    const locale = useLocale()
    const [status, setStatus] = useState(submissionStatus)
    const [showConfirm, setShowConfirm] = useState(false)
    const [withdrawing, setWithdrawing] = useState(false)

    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted

    const submittedDate = new Date(submittedAt).toLocaleDateString(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
    })

    // Only allow withdraw for submitted/analyzing/analyzed
    const canWithdraw = ['submitted', 'analyzing', 'analyzed'].includes(status)

    const handleWithdraw = async () => {
        setWithdrawing(true)
        try {
            const res = await fetch(`/api/script-calls/${callId}/withdraw`, { method: 'POST' })
            if (res.ok) {
                setStatus('withdrawn')
                setShowConfirm(false)
                if (onWithdrawn) onWithdrawn()
            } else {
                const data = await res.json()
                if (res.status === 409) {
                    alert(t('withdrawErrorProcessed'))
                } else {
                    alert(data.error || t('withdrawError'))
                }
            }
        } catch {
            alert(t('withdrawError'))
        } finally {
            setWithdrawing(false)
        }
    }

    return (
        <>
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(212,168,83,0.18)',
                borderRadius: '20px',
                backdropFilter: 'blur(24px)',
                position: 'sticky',
                top: 100,
                overflow: 'hidden',
                animation: 'glow-pulse 4s ease-in-out infinite',
            }}>
                {/* Header */}
                <div style={{
                    padding: '28px 32px 20px',
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.06), transparent)',
                    borderBottom: '1px solid rgba(212,168,83,0.1)',
                }}>
                    <div style={{
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color: 'var(--accent-gold)',
                        marginBottom: '8px',
                    }}>
                        {t('submittedCardLabel')}
                    </div>
                    <div style={{
                        fontSize: '1.15rem', fontWeight: 700,
                        color: 'var(--text-primary)', lineHeight: 1.3,
                    }}>
                        {callTitle}
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '28px 32px 32px' }}>

                    {/* Submitted / Withdrawn badge */}
                    {status === 'withdrawn' ? (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '18px 20px', marginBottom: '24px',
                            background: 'rgba(156,163,175,0.06)',
                            border: '1px solid rgba(156,163,175,0.15)',
                            borderRadius: '14px',
                        }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: '12px',
                                background: 'rgba(156,163,175,0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem',
                            }}>
                                ↩️
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#9ca3af', marginBottom: '2px' }}>
                                    {t('withdrawnBadge')}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {t('resubmitHint')}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '18px 20px', marginBottom: '24px',
                            background: 'rgba(16,185,129,0.06)',
                            border: '1px solid rgba(16,185,129,0.15)',
                            borderRadius: '14px',
                        }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: '12px',
                                background: 'rgba(16,185,129,0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', marginBottom: '2px' }}>
                                    {t('submittedBadge')}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {submittedDate}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Script title */}
                    <div style={{
                        padding: '14px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        marginBottom: '14px',
                    }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                            {t('formScriptTitleLabel')}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {submissionTitle}
                        </div>
                    </div>

                    {/* Current status */}
                    <div style={{ padding: '14px 0', marginBottom: '24px' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                            {t('currentStatus')}
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '6px 16px', borderRadius: 'var(--radius-full)',
                            background: cfg.bg, border: `1px solid ${cfg.border}`,
                        }}>
                            <span style={{ fontSize: '0.85rem' }}>{cfg.emoji}</span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: cfg.color }}>
                                {t(cfg.labelKey)}
                            </span>
                        </div>
                    </div>

                    {/* CTAs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {status === 'withdrawn' ? (
                            /* Resubmit button — reloads the page so server re-renders with form */
                            <a
                                href={`/${locale}/scripts/${callId}?resubmit=1`}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    width: '100%', padding: '14px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'linear-gradient(135deg, rgba(228,185,90,0.15), rgba(228,185,90,0.08))',
                                    color: 'var(--accent-gold)', fontSize: '0.88rem', fontWeight: 700,
                                    textDecoration: 'none', letterSpacing: '0.02em',
                                    border: '1px solid rgba(228,185,90,0.3)',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                ↩ {t('resubmitBtn')}
                            </a>
                        ) : (
                            <>
                                {/* View submission */}
                                <Link
                                    href={`/${locale}/scripts/${callId}/submission`}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        width: '100%', padding: '14px',
                                        borderRadius: 'var(--radius-full)',
                                        background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold), var(--accent-gold-dark))',
                                        color: '#0f1115', fontSize: '0.88rem', fontWeight: 700,
                                        textDecoration: 'none', letterSpacing: '0.02em',
                                        boxShadow: '0 4px 16px rgba(228,185,90,0.3)',
                                        transition: 'all 0.3s ease',
                                    }}
                                >
                                    {t('viewSubmission')}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                </Link>

                                {/* Withdraw button */}
                                {canWithdraw && (
                                    <button
                                        onClick={() => setShowConfirm(true)}
                                        style={{
                                            width: '100%', padding: '10px 14px', fontSize: '0.78rem',
                                            fontWeight: 600, letterSpacing: '0.02em', borderRadius: 'var(--radius-full)',
                                            border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)',
                                            color: 'rgba(239,68,68,0.7)', cursor: 'pointer', transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'
                                            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.4)'
                                            ;(e.currentTarget as HTMLButtonElement).style.color = 'rgb(239,68,68)'
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.05)'
                                            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.2)'
                                            ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.7)'
                                        }}
                                    >
                                        {t('withdrawBtn')}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Confirmation Modal ── */}
            {showConfirm && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                    }}
                    onClick={() => !withdrawing && setShowConfirm(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card, #1a1d23)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '20px',
                            padding: '36px 32px',
                            maxWidth: '420px', width: '100%',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                        }}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                                {t('withdrawConfirmTitle')}
                            </h3>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                {t('withdrawConfirmMsg')}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={withdrawing}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 'var(--radius-full)',
                                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                                    color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                {t('withdrawConfirmNo')}
                            </button>
                            <button
                                onClick={handleWithdraw}
                                disabled={withdrawing}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 'var(--radius-full)',
                                    border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)',
                                    color: '#ef4444', fontSize: '0.85rem', fontWeight: 700,
                                    cursor: withdrawing ? 'not-allowed' : 'pointer',
                                    opacity: withdrawing ? 0.6 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {withdrawing ? t('withdrawing') : t('withdrawConfirmYes')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
