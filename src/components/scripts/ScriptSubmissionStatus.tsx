'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import Footer from '@/components/Footer'

// Status configuration
const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; emoji: string; labelKey: string }> = {
    submitted:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)',  emoji: '📤', labelKey: 'statusSubmitted' },
    analyzing:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', emoji: '🤖', labelKey: 'statusAnalyzing' },
    analyzed:    { color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)', emoji: '📊', labelKey: 'statusAnalyzed' },
    shortlisted: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  emoji: '⭐', labelKey: 'statusShortlisted' },
    selected:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  emoji: '🏆', labelKey: 'statusSelected' },
    rejected:    { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', emoji: '📝', labelKey: 'statusNotSelected' },
    withdrawn:   { color: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)', emoji: '↩️', labelKey: 'statusWithdrawn' },
}

interface Submission {
    id: string
    title: string
    logline: string
    synopsis: string
    genre: string | null
    estimatedDuration: string | null
    authorName: string
    authorEmail: string
    authorBio: string | null
    scriptText: string | null
    scriptFilePath: string | null
    status: string
    createdAt: string
    analysis: {
        overallScore: number
        originalityScore: number
        structureScore: number
        dialogueScore: number
        visualPotentialScore: number
        themeAlignmentScore: number
        feasibilityScore: number
        strengths: string | null
        concerns: string | null
        recommendation: string | null
    } | null
}

interface Props {
    submission: Submission
    callTitle: string
    callId: string
}

export default function ScriptSubmissionStatus({ submission, callTitle, callId }: Props) {
    const t = useTranslations('scripts')
    const locale = useLocale()
    
    // Manage status locally for instant UI update
    const [status, setStatus] = useState(submission.status)
    const [showConfirm, setShowConfirm] = useState(false)
    const [withdrawing, setWithdrawing] = useState(false)

    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted

    const submittedDate = new Date(submission.createdAt).toLocaleDateString(locale, {
        year: 'numeric', month: 'long', day: 'numeric',
    })
    const submittedTime = new Date(submission.createdAt).toLocaleTimeString(locale, {
        hour: '2-digit', minute: '2-digit',
    })

    const showAnalysis = submission.analysis && ['analyzed', 'shortlisted', 'selected'].includes(status)
    const canWithdraw = ['submitted', 'analyzing', 'analyzed'].includes(status)

    const handleWithdraw = async () => {
        setWithdrawing(true)
        try {
            const res = await fetch(`/api/script-calls/${callId}/withdraw`, { method: 'POST' })
            if (res.ok) {
                setStatus('withdrawn')
                setShowConfirm(false)
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
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0%   { background-position: -200% center; }
                    100% { background-position:  200% center; }
                }
                @keyframes statusPulse {
                    0%, 100% { box-shadow: 0 0 24px rgba(212,168,83,0.06); }
                    50%      { box-shadow: 0 0 48px rgba(212,168,83,0.14); }
                }
                @keyframes scoreReveal {
                    from { opacity: 0; transform: scale(0.8); }
                    to   { opacity: 1; transform: scale(1); }
                }
                .sub-fade    { animation: fadeInUp 0.5s ease both; }
                .sub-fade-1  { animation: fadeInUp 0.5s ease 0.1s both; }
                .sub-fade-2  { animation: fadeInUp 0.5s ease 0.2s both; }
                .sub-fade-3  { animation: fadeInUp 0.5s ease 0.3s both; }
                .sub-fade-4  { animation: fadeInUp 0.5s ease 0.4s both; }
                .sub-fade-5  { animation: fadeInUp 0.5s ease 0.5s both; }
                .status-card {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(212,168,83,0.12);
                    border-radius: 20px;
                    backdrop-filter: blur(20px);
                    animation: statusPulse 5s ease-in-out infinite;
                }
                .info-panel {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 16px;
                    padding: 28px 32px;
                }
                .meta-item {
                    display: flex; flex-direction: column; gap: 4px;
                    padding: 14px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .meta-item:last-child { border-bottom: none; }
                .meta-key {
                    font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
                    text-transform: uppercase; color: var(--text-tertiary);
                }
                .meta-val {
                    font-size: 0.95rem; color: var(--text-primary); font-weight: 500;
                    line-height: 1.6;
                }
                .score-ring {
                    width: 68px; height: 68px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.25rem; font-weight: 800;
                    animation: scoreReveal 0.4s ease both;
                }
                .analysis-grid {
                    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
                }
                .analysis-cell {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px;
                    padding: 18px 16px;
                    text-align: center;
                }
                .analysis-score {
                    font-size: 1.5rem; font-weight: 800; margin-bottom: 4px;
                }
                .analysis-label {
                    font-size: 0.65rem; font-weight: 600; letter-spacing: 0.06em;
                    text-transform: uppercase; color: var(--text-tertiary);
                }
                @media (max-width: 768px) {
                    .sub-grid { grid-template-columns: 1fr !important; }
                    .analysis-grid { grid-template-columns: repeat(2, 1fr); }
                }
            `}</style>

            <main style={{ minHeight: '100vh', paddingTop: '90px', background: 'transparent', position: 'relative', zIndex: 2 }}>

                {/* ── Hero strip ── */}
                <div style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: 'linear-gradient(180deg, rgba(13,15,20,0.7) 0%, rgba(13,15,20,0.5) 100%)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    padding: '48px 0 40px',
                }}>
                    <div className="container" style={{ maxWidth: '960px' }}>
                        {/* Back link */}
                        <Link href={`/${locale}/scripts/${callId}`} className="sub-fade" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-gold)',
                            textDecoration: 'none', marginBottom: '20px', opacity: 0.8,
                            transition: 'opacity 0.2s',
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                            {t('backToCall')}
                        </Link>

                        <h1 className="sub-fade-1" style={{
                            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                            fontWeight: 800, lineHeight: 1.15, marginBottom: '12px',
                            background: 'linear-gradient(135deg, #e8e6e3 30%, #d4a853)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                            {t('mySubmissionTitle')}
                        </h1>

                        <p className="sub-fade-2" style={{
                            fontSize: '0.9rem', color: 'var(--text-secondary)',
                            margin: 0, lineHeight: 1.6,
                        }}>
                            {callTitle}
                        </p>
                    </div>
                </div>

                {/* ── Content ── */}
                <section style={{ padding: '48px 0 80px' }}>
                    <div className="container" style={{ maxWidth: '960px' }}>

                        {/* ── Status Card ── */}
                        <div className="status-card sub-fade-2" style={{ padding: '36px 40px', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                    <div style={{
                                        width: 56, height: 56, borderRadius: '16px',
                                        background: cfg.bg, border: `1px solid ${cfg.border}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.6rem',
                                    }}>
                                        {cfg.emoji}
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                                            textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px',
                                        }}>
                                            {t('currentStatus')}
                                        </div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                                            padding: '6px 18px', borderRadius: 'var(--radius-full)',
                                            background: cfg.bg, border: `1px solid ${cfg.border}`,
                                        }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: cfg.color }}>
                                                {t(cfg.labelKey)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                                        {t('submittedOn')}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>{submittedDate}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{submittedTime}</div>
                                </div>
                            </div>
                        </div>

                        {/* ── Two-column grid ── */}
                        <div className="sub-grid" style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr',
                            gap: '28px', marginBottom: '32px',
                        }}>
                            {/* Script Info */}
                            <div className="info-panel sub-fade-3">
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: '16px' }}>
                                    {t('scriptSectionLabel')}
                                </div>
                                <div className="meta-item">
                                    <span className="meta-key">{t('formScriptTitleLabel')}</span>
                                    <span className="meta-val" style={{ fontWeight: 700 }}>{submission.title}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-key">{t('formLoglineLabel')}</span>
                                    <span className="meta-val">{submission.logline}</span>
                                </div>
                                {submission.genre && (
                                    <div className="meta-item">
                                        <span className="meta-key">{t('formGenreLabel')}</span>
                                        <span className="meta-val">{submission.genre}</span>
                                    </div>
                                )}
                                {submission.estimatedDuration && (
                                    <div className="meta-item">
                                        <span className="meta-key">{t('formDurationLabel')}</span>
                                        <span className="meta-val">{submission.estimatedDuration}</span>
                                    </div>
                                )}
                                {submission.scriptFilePath && (
                                    <div className="meta-item">
                                        <span className="meta-key">{t('formUploadLabel')}</span>
                                        <span className="meta-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            <span style={{ color: '#10b981' }}>{t('formUploadDone')}</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Author Info */}
                            <div className="info-panel sub-fade-4">
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: '16px' }}>
                                    {t('authorSectionLabel')}
                                </div>
                                <div className="meta-item">
                                    <span className="meta-key">{t('formNameLabel')}</span>
                                    <span className="meta-val" style={{ fontWeight: 700 }}>{submission.authorName}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-key">{t('formEmailLabel')}</span>
                                    <span className="meta-val">{submission.authorEmail}</span>
                                </div>
                                {submission.authorBio && (
                                    <div className="meta-item">
                                        <span className="meta-key">{t('formBioLabel')}</span>
                                        <span className="meta-val">{submission.authorBio}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Synopsis ── */}
                        <div className="info-panel sub-fade-4" style={{ marginBottom: '32px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: '16px' }}>
                                {t('formSynopsisLabel')}
                            </div>
                            <p style={{ fontSize: '0.95rem', lineHeight: 1.85, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                                {submission.synopsis}
                            </p>
                        </div>

                        {/* ── AI Analysis (if revealed) ── */}
                        {showAnalysis && submission.analysis && (
                            <div className="sub-fade-5" style={{ marginBottom: '32px' }}>
                                {/* Overall Score Hero */}
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(212,168,83,0.06), rgba(212,168,83,0.02))',
                                    border: '1px solid rgba(212,168,83,0.18)',
                                    borderRadius: '20px',
                                    padding: '36px 40px',
                                    marginBottom: '24px',
                                    display: 'flex', alignItems: 'center', gap: '28px',
                                }}>
                                    <div className="score-ring" style={{
                                        background: `conic-gradient(var(--accent-gold) ${submission.analysis.overallScore}%, rgba(255,255,255,0.06) 0)`,
                                        position: 'relative',
                                    }}>
                                        <div style={{
                                            width: 56, height: 56, borderRadius: '50%',
                                            background: 'var(--bg-primary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-gold)',
                                        }}>
                                            {Math.round(submission.analysis.overallScore)}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: '6px' }}>
                                            {t('analysisOverallScore')}
                                        </div>
                                        {submission.analysis.recommendation && (
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                                                {submission.analysis.recommendation}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Score breakdown grid */}
                                <div className="analysis-grid" style={{ marginBottom: '24px' }}>
                                    {[
                                        { key: 'analysisOriginality', score: submission.analysis.originalityScore },
                                        { key: 'analysisStructure', score: submission.analysis.structureScore },
                                        { key: 'analysisDialogue', score: submission.analysis.dialogueScore },
                                        { key: 'analysisVisualPotential', score: submission.analysis.visualPotentialScore },
                                        { key: 'analysisThemeAlignment', score: submission.analysis.themeAlignmentScore },
                                        { key: 'analysisFeasibility', score: submission.analysis.feasibilityScore },
                                    ].map(({ key, score }) => (
                                        <div key={key} className="analysis-cell">
                                            <div className="analysis-score" style={{
                                                color: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444',
                                            }}>
                                                {Math.round(score)}
                                            </div>
                                            <div className="analysis-label">{t(key)}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Strengths & Concerns */}
                                <div className="sub-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    {submission.analysis.strengths && (
                                        <div className="info-panel">
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#10b981', marginBottom: '12px' }}>
                                                ✅ {t('analysisStrengths')}
                                            </div>
                                            <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                                                {submission.analysis.strengths}
                                            </p>
                                        </div>
                                    )}
                                    {submission.analysis.concerns && (
                                        <div className="info-panel">
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: '12px' }}>
                                                ⚠️ {t('analysisConcerns')}
                                            </div>
                                            <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                                                {submission.analysis.concerns}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Action Buttons ── */}
                        <div className="sub-fade-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '20px 0' }}>
                            <Link href={`/${locale}/scripts`} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '14px 36px', borderRadius: 'var(--radius-full)',
                                background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold), var(--accent-gold-dark))',
                                color: '#0f1115', fontSize: '0.88rem', fontWeight: 700,
                                textDecoration: 'none', letterSpacing: '0.02em',
                                boxShadow: '0 4px 20px rgba(228,185,90,0.3)',
                                transition: 'all 0.3s ease',
                            }}>
                                {t('viewAllCalls')}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </Link>

                            {status === 'withdrawn' ? (
                                <a
                                    href={`/${locale}/scripts/${callId}?resubmit=1`}
                                    style={{
                                        fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-gold)',
                                        textDecoration: 'none', padding: '8px 24px',
                                        transition: 'opacity 0.2s',
                                    }}
                                >
                                    ↩ {t('resubmitBtn')}
                                </a>
                            ) : canWithdraw ? (
                                <button
                                    onClick={() => setShowConfirm(true)}
                                    style={{
                                        padding: '8px 24px', fontSize: '0.8rem',
                                        fontWeight: 600, letterSpacing: '0.02em', borderRadius: 'var(--radius-full)',
                                        border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)',
                                        color: 'rgba(239,68,68,0.75)', cursor: 'pointer', transition: 'all 0.2s ease',
                                        marginTop: '8px'
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'
                                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.45)'
                                        ;(e.currentTarget as HTMLButtonElement).style.color = 'rgb(239,68,68)'
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'
                                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.25)'
                                        ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.75)'
                                    }}
                                >
                                    {t('withdrawBtn')}
                                </button>
                            ) : null}
                        </div>

                    </div>
                </section>
            </main>
            <Footer />

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
