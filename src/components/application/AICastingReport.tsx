'use client'

import { useState } from 'react'

interface AIReport {
    overallScore: number
    roleFitScore: number
    strengths: string[]
    concerns: string[]
    recommendation: string
    notes: string
}

interface Props {
    report: AIReport | null
    isLoading: boolean
    error: string
    onRunAudit: () => void
}

const scoreColor = (s: number) => s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'

const fitColors: Record<string, { bg: string; c: string }> = {
    STRONG_FIT: { bg: 'rgba(34,197,94,0.12)', c: '#22c55e' },
    GOOD_FIT: { bg: 'rgba(59,130,246,0.12)', c: '#60a5fa' },
    MODERATE: { bg: 'rgba(245,158,11,0.12)', c: '#f59e0b' },
    WEAK_FIT: { bg: 'rgba(239,68,68,0.12)', c: '#ef4444' },
}

export default function AICastingReport({ report, isLoading, error, onRunAudit }: Props) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div style={{
            padding: '14px', borderRadius: '10px',
            background: report ? 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(212,168,83,0.04))' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${report ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)'}`,
        }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                🤖 AI Casting Report
            </div>

            {/* No report */}
            {!report && !isLoading && (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: '1.8rem', opacity: 0.3, marginBottom: '6px' }}>🔬</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '10px' }}>No analysis yet</div>
                    {error && (
                        <div style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '0.72rem', color: '#ef4444', marginBottom: '8px', textAlign: 'left' }}>
                            ⚠️ {error}
                        </div>
                    )}
                    <button onClick={onRunAudit} style={{
                        width: '100%', padding: '7px', fontSize: '0.78rem', fontWeight: 700,
                        borderRadius: '8px', border: '1px solid rgba(212,168,83,0.3)',
                        background: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))',
                        color: 'var(--accent-gold)', cursor: 'pointer',
                    }}>🧠 Run Analysis</button>
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div className="loading-spinner" style={{ width: '28px', height: '28px', borderWidth: '2px', margin: '0 auto 10px' }} />
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)' }}>Analyzing...</div>
                </div>
            )}

            {/* Report */}
            {report && !isLoading && (
                <>
                    {/* Score Circle + Fit Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.15rem', fontWeight: 900,
                            color: scoreColor(report.overallScore),
                            background: `conic-gradient(${scoreColor(report.overallScore)} ${report.overallScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                            position: 'relative',
                        }}>
                            <div style={{
                                position: 'absolute', inset: '4px', borderRadius: '50%',
                                background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {report.overallScore}
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <span style={{
                                padding: '3px 10px', fontSize: '0.65rem', fontWeight: 700,
                                borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em',
                                background: (fitColors[report.recommendation] || fitColors.MODERATE).bg,
                                color: (fitColors[report.recommendation] || fitColors.MODERATE).c,
                            }}>
                                {report.recommendation.replace(/_/g, ' ')}
                            </span>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                Role Fit: {report.roleFitScore}/100
                            </div>
                        </div>
                    </div>

                    {/* Strengths + Concerns */}
                    <div style={{ maxHeight: expanded ? '600px' : '140px', overflow: 'hidden', transition: 'max-height 0.3s' }}>
                        {report.strengths.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#22c55e', marginBottom: '4px' }}>Strengths</div>
                                {report.strengths.map((s: string, i: number) => (
                                    <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '1px 0' }}>✓ {s}</div>
                                ))}
                            </div>
                        )}
                        {report.concerns.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f59e0b', marginBottom: '4px' }}>Considerations</div>
                                {report.concerns.map((c: string, i: number) => (
                                    <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '1px 0' }}>⚠ {c}</div>
                                ))}
                            </div>
                        )}
                        {report.notes && (
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Notes</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{report.notes}</div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setExpanded(!expanded)} style={{
                        width: '100%', padding: '4px', marginTop: '6px', fontSize: '0.68rem', fontWeight: 600,
                        color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                        {expanded ? '▲ Show Less' : '▼ Show More'}
                    </button>

                    <button onClick={onRunAudit} disabled={isLoading} style={{
                        width: '100%', marginTop: '6px', padding: '5px', fontSize: '0.68rem',
                        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px',
                        background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer',
                    }}>🔄 Re-analyze</button>
                </>
            )}
        </div>
    )
}
