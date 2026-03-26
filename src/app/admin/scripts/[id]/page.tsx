'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface ScriptAnalysis {
    originalityScore: number
    structureScore: number
    dialogueScore: number
    visualPotentialScore: number
    themeAlignmentScore: number
    feasibilityScore: number
    overallScore: number
    strengths: string | null
    concerns: string | null
    recommendation: string | null
}

interface Submission {
    id: string
    authorName: string
    authorEmail: string
    authorBio: string | null
    title: string
    logline: string
    synopsis: string
    scriptText: string | null
    genre: string | null
    estimatedDuration: string | null
    status: string
    analysis: ScriptAnalysis | null
    createdAt: string
}

interface ScriptCall {
    id: string
    title: string
    description: string
    genre: string | null
    status: string
}

const statusColors: Record<string, { color: string; bg: string }> = {
    submitted: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    analyzing: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    analyzed: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    shortlisted: { color: '#d4a853', bg: 'rgba(212,168,83,0.1)' },
    selected: { color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    rejected: { color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
    return (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '3px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 700, color }}>{score}/100</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s' }} />
            </div>
        </div>
    )
}

export default function AdminScriptCallDetailPage() {
    const params = useParams()
    const id = params.id as string
    const [call, setCall] = useState<ScriptCall | null>(null)
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [loading, setLoading] = useState(true)
    const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())
    const [expanded, setExpanded] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        const [callRes, subRes] = await Promise.all([
            fetch(`/api/script-calls/${id}`),
            fetch(`/api/script-calls/${id}/submissions`),
        ])
        if (callRes.ok) setCall(await callRes.json())
        if (subRes.ok) setSubmissions(await subRes.json())
        setLoading(false)
    }, [id])

    useEffect(() => { fetchData() }, [fetchData])

    const analyzeSubmission = async (subId: string) => {
        setAnalyzingIds(prev => new Set(prev).add(subId))
        try {
            const res = await fetch(`/api/script-calls/${id}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: subId }),
            })
            if (!res.ok) {
                const data = await res.json()
                alert(data.error || 'Analysis failed')
            }
            fetchData()
        } finally {
            setAnalyzingIds(prev => { const s = new Set(prev); s.delete(subId); return s })
        }
    }

    const analyzeAll = async () => {
        const unanalyzed = submissions.filter(s => !s.analysis && s.status !== 'analyzing')
        for (const sub of unanalyzed) {
            await analyzeSubmission(sub.id)
        }
    }

    const updateStatus = async (subId: string, status: string) => {
        await fetch(`/api/script-calls/${id}/submissions/${subId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        fetchData()
    }

    if (loading) return <div style={{ padding: 'var(--space-3xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
    if (!call) return <div style={{ padding: 'var(--space-3xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>Script call not found</div>

    const topScores = submissions.filter(s => s.analysis).sort((a, b) => (b.analysis?.overallScore || 0) - (a.analysis?.overallScore || 0))

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{call.title}</h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    {submissions.length} submission{submissions.length !== 1 ? 's' : ''} ·
                    {topScores.length} analyzed ·
                    {call.genre || 'Any genre'}
                </p>
            </div>

            {/* Top 3 Banner */}
            {topScores.length >= 3 && (
                <div className="glass-card" style={{
                    padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)',
                    border: '1px solid rgba(212,168,83,0.2)',
                }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>
                        🏆 AI Top 3 Picks
                    </h3>
                    <div className="grid-3col">
                        {topScores.slice(0, 3).map((sub, i) => (
                            <div key={sub.id} style={{
                                padding: 'var(--space-md)',
                                background: i === 0 ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.02)',
                                borderRadius: 'var(--radius-md)',
                                border: `1px solid ${i === 0 ? 'rgba(212,168,83,0.2)' : 'var(--border-subtle)'}`,
                            }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                                    #{i + 1} · Score: {sub.analysis?.overallScore}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{sub.title}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>by {sub.authorName}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}>
                <button onClick={analyzeAll} className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                    🤖 Analyze All Unscored
                </button>
            </div>

            {/* Submissions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {submissions.map(sub => {
                    const sc = statusColors[sub.status] || statusColors.submitted
                    const isExpanded = expanded === sub.id

                    return (
                        <div key={sub.id} className="glass-card" style={{ padding: 'var(--space-lg)', overflow: 'hidden' }}>
                            {/* Summary row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : sub.id)}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1rem', fontWeight: 800, flexShrink: 0,
                                    background: sub.analysis ? (sub.analysis.overallScore >= 70 ? 'rgba(52,211,153,0.15)' : sub.analysis.overallScore >= 50 ? 'rgba(212,168,83,0.15)' : 'rgba(244,63,94,0.15)') : 'rgba(255,255,255,0.05)',
                                    color: sub.analysis ? (sub.analysis.overallScore >= 70 ? '#34d399' : sub.analysis.overallScore >= 50 ? 'var(--accent-gold)' : '#f43f5e') : 'var(--text-tertiary)',
                                    border: `1px solid ${sub.analysis ? (sub.analysis.overallScore >= 70 ? 'rgba(52,211,153,0.3)' : sub.analysis.overallScore >= 50 ? 'rgba(212,168,83,0.3)' : 'rgba(244,63,94,0.3)') : 'var(--border-subtle)'}`,
                                }}>
                                    {sub.analysis ? Math.round(sub.analysis.overallScore) : '-'}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{sub.title}</span>
                                        <span style={{
                                            fontSize: '0.5rem', fontWeight: 600, textTransform: 'uppercase',
                                            padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                            color: sc.color, background: sc.bg,
                                        }}>{sub.status}</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                        by {sub.authorName} · {sub.logline.slice(0, 80)}{sub.logline.length > 80 ? '...' : ''}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    {!sub.analysis && (
                                        <button
                                            onClick={e => { e.stopPropagation(); analyzeSubmission(sub.id) }}
                                            className="btn btn-sm"
                                            disabled={analyzingIds.has(sub.id)}
                                            style={{
                                                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                                                color: '#60a5fa', fontSize: '0.65rem', cursor: 'pointer',
                                            }}
                                        >
                                            {analyzingIds.has(sub.id) ? '⏳' : '🤖 Analyze'}
                                        </button>
                                    )}
                                    <select
                                        value={sub.status}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => updateStatus(sub.id, e.target.value)}
                                        style={{
                                            padding: '3px 6px', fontSize: '0.65rem',
                                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer',
                                        }}
                                    >
                                        <option value="submitted">Submitted</option>
                                        <option value="analyzed">Analyzed</option>
                                        <option value="shortlisted">Shortlisted</option>
                                        <option value="selected">Selected ✓</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: sub.analysis ? '1fr 1fr' : '1fr', gap: 'var(--space-xl)' }}>
                                        {/* Script Details */}
                                        <div>
                                            <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>Script Details</h4>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Author</div>
                                            <div style={{ fontSize: '0.85rem', marginBottom: 'var(--space-sm)' }}>{sub.authorName} ({sub.authorEmail})</div>
                                            {sub.authorBio && <>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Bio</div>
                                                <div style={{ fontSize: '0.85rem', marginBottom: 'var(--space-sm)' }}>{sub.authorBio}</div>
                                            </>}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Logline</div>
                                            <div style={{ fontSize: '0.85rem', marginBottom: 'var(--space-sm)', fontStyle: 'italic' }}>{sub.logline}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Synopsis</div>
                                            <div style={{ fontSize: '0.85rem', marginBottom: 'var(--space-sm)', lineHeight: 1.6 }}>{sub.synopsis}</div>
                                            {sub.genre && <>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Genre</div>
                                                <div style={{ fontSize: '0.85rem', marginBottom: 'var(--space-sm)' }}>{sub.genre}</div>
                                            </>}
                                            {sub.scriptText && (
                                                <details style={{ marginTop: 'var(--space-md)' }}>
                                                    <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--accent-gold)' }}>View Full Script</summary>
                                                    <pre style={{
                                                        marginTop: 'var(--space-sm)', padding: 'var(--space-md)',
                                                        background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)',
                                                        fontSize: '0.75rem', lineHeight: 1.6,
                                                        maxHeight: '400px', overflow: 'auto',
                                                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                    }}>{sub.scriptText}</pre>
                                                </details>
                                            )}
                                        </div>

                                        {/* AI Analysis */}
                                        {sub.analysis && (
                                            <div>
                                                <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>
                                                    AI Analysis: Score: {sub.analysis.overallScore}
                                                </h4>
                                                <ScoreBar label="Originality" score={sub.analysis.originalityScore} color="#34d399" />
                                                <ScoreBar label="Structure" score={sub.analysis.structureScore} color="#60a5fa" />
                                                <ScoreBar label="Dialogue" score={sub.analysis.dialogueScore} color="#f59e0b" />
                                                <ScoreBar label="Visual Potential" score={sub.analysis.visualPotentialScore} color="#a78bfa" />
                                                <ScoreBar label="Theme Alignment" score={sub.analysis.themeAlignmentScore} color="#f472b6" />
                                                <ScoreBar label="Feasibility" score={sub.analysis.feasibilityScore} color="#22d3ee" />

                                                {sub.analysis.strengths && (
                                                    <div style={{ marginTop: 'var(--space-md)' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600, marginBottom: '4px' }}>✅ Strengths</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{sub.analysis.strengths}</div>
                                                    </div>
                                                )}
                                                {sub.analysis.concerns && (
                                                    <div style={{ marginTop: 'var(--space-sm)' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>⚠️ Concerns</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{sub.analysis.concerns}</div>
                                                    </div>
                                                )}
                                                {sub.analysis.recommendation && (
                                                    <div style={{ marginTop: 'var(--space-sm)' }}>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 600, marginBottom: '4px' }}>📋 Recommendation</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{sub.analysis.recommendation}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {submissions.length === 0 && (
                <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-tertiary)' }}>
                    No submissions yet. Share the call link to start receiving scripts.
                </div>
            )}
        </div>
    )
}
