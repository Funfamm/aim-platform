'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'

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
    scriptFilePath: string | null
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
    deadline: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    submitted:   { label: 'Submitted',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.2)',  dot: '#94a3b8' },
    analyzing:   { label: 'Analyzing',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.2)',   dot: '#f59e0b' },
    analyzed:    { label: 'Analyzed',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.2)',   dot: '#60a5fa' },
    shortlisted: { label: 'Shortlisted', color: '#d4a853', bg: 'rgba(212,168,83,0.1)',   border: 'rgba(212,168,83,0.2)',   dot: '#d4a853' },
    selected:    { label: 'Selected',    color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.2)',   dot: '#34d399' },
    rejected:    { label: 'Rejected',    color: '#f43f5e', bg: 'rgba(244,63,94,0.1)',    border: 'rgba(244,63,94,0.2)',    dot: '#f43f5e' },
    withdrawn:   { label: 'Withdrawn',   color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.15)', dot: '#6b7280' },
}

// ── Status state machine ──────────────────────────────────────────────
// Flow: submitted → analyzed → shortlisted → selected (terminal)
//                         ↘               ↘
//                       rejected        rejected  (terminal)
// Once rejected or selected, the decision is final — no backward moves.
const NEXT_STEPS: Record<string, string[]> = {
    submitted:   ['analyzed', 'rejected'],   // review it or fast-reject
    analyzed:    ['shortlisted', 'rejected'],// advance or reject after AI review
    shortlisted: ['selected', 'rejected'],   // final decision
    selected:    [],                         // TERMINAL — script chosen
    rejected:    [],                         // TERMINAL — decision made
    withdrawn:   [],                         // TERMINAL — author withdrew
}

const ACTION_META: Record<string, { label: string; icon: string; danger?: boolean; success?: boolean }> = {
    analyzed:    { label: 'Mark Analyzed',  icon: '✅' },
    shortlisted: { label: 'Shortlist',      icon: '⭐' },
    selected:    { label: 'Select',         icon: '🏆', success: true },
    rejected:    { label: 'Decline',        icon: '✕',  danger: true },
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color }}>{score}</span>
            </div>
            <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                    width: `${score}%`, height: '100%', borderRadius: '3px',
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: `0 0 6px ${color}44`,
                }} />
            </div>
        </div>
    )
}

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 70 ? '#34d399' : score >= 50 ? '#d4a853' : '#f43f5e'
    const bg = score >= 70 ? 'rgba(52,211,153,0.12)' : score >= 50 ? 'rgba(212,168,83,0.12)' : 'rgba(244,63,94,0.12)'
    const border = score >= 70 ? 'rgba(52,211,153,0.3)' : score >= 50 ? 'rgba(212,168,83,0.3)' : 'rgba(244,63,94,0.3)'
    return (
        <div style={{
            width: 44, height: 44, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', fontWeight: 900, flexShrink: 0,
            background: bg, border: `2px solid ${border}`, color,
            boxShadow: `0 0 12px ${color}22`,
        }}>
            {Math.round(score)}
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
    const [analyzeAllLoading, setAnalyzeAllLoading] = useState(false)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'all' | 'analyzed' | 'shortlisted' | 'selected'>('all')
    const [scoreThreshold, setScoreThreshold] = useState(60)

    // ── Single-script confirm modal (enhanced with threshold guard) ────────
    const [confirmAction, setConfirmAction] = useState<{
        subId: string
        status: string
        isBelowThreshold?: boolean  // triggers override modal variant
        score?: number
    } | null>(null)
    const [overrideChecked, setOverrideChecked] = useState(false)

    // ── Bulk selection ──────────────────────────────────────────────────────
    const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set())
    const [bulkAction, setBulkAction] = useState('')
    const [bulkLoading, setBulkLoading] = useState(false)
    const [bulkToast, setBulkToast] = useState<string | null>(null)
    // Threshold override modal for bulk shortlist
    const [bulkOverrideModal, setBulkOverrideModal] = useState<{
        belowIds: string[];   // submission IDs below threshold
        aboveIds: string[];   // submission IDs at/above threshold
        belowTitles: string[] // titles for display
    } | null>(null)
    // Bulk decline confirmation modal
    const [bulkDeclineModal, setBulkDeclineModal] = useState(false)
    const [bulkDeclineChecked, setBulkDeclineChecked] = useState(false)
    const [bulkDeclineNote, setBulkDeclineNote] = useState('')

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
        setAnalyzeAllLoading(true)
        const unanalyzed = submissions.filter(s => !s.analysis && s.status !== 'analyzing' && s.status !== 'withdrawn')
        for (const sub of unanalyzed) {
            await analyzeSubmission(sub.id)
        }
        setAnalyzeAllLoading(false)
    }

    const updateStatus = async (subId: string, status: string) => {
        await fetch(`/api/script-calls/${id}/submissions/${subId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        fetchData()
    }

    // ── Bulk action helpers ─────────────────────────────────────────────────
    const toggleSubSelect = (subId: string) => {
        setSelectedSubs(prev => {
            const next = new Set(prev)
            if (next.has(subId)) next.delete(subId); else next.add(subId)
            return next
        })
    }

    const selectAllVisible = () => {
        const visible = filteredSubsIds()
        if (selectedSubs.size === visible.length) setSelectedSubs(new Set())
        else setSelectedSubs(new Set(visible))
    }

    // Helper to get current visible submission IDs (called after filteredSubs is computed)
    const filteredSubsIds = () => {
        const analyzed = submissions.filter(s => s.analysis)
        const shortlisted = submissions.filter(s => s.status === 'shortlisted')
        const selected = submissions.filter(s => s.status === 'selected')
        const filtered = activeTab === 'all' ? submissions
            : activeTab === 'analyzed' ? analyzed
            : activeTab === 'shortlisted' ? shortlisted
            : selected
        return filtered.map(s => s.id)
    }

    const applyBulkAction = async (action: string, ids: string[], note?: string) => {
        setBulkLoading(true)
        try {
            const res = await fetch(`/api/script-calls/${id}/submissions/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionIds: ids, status: action, statusNote: note }),
            })
            if (res.ok) {
                const data = await res.json()
                let msg = `✅ ${data.updated} updated`
                if (data.notified > 0) msg += ` · ${data.notified} notified`
                if (data.skipped > 0) msg += ` · ${data.skipped} already notified (skipped)`
                setBulkToast(msg)
                setTimeout(() => setBulkToast(null), 5000)
            } else {
                setBulkToast('⚠️ Bulk action failed. Please try again.')
                setTimeout(() => setBulkToast(null), 4000)
            }
        } catch {
            setBulkToast('⚠️ Network error.')
            setTimeout(() => setBulkToast(null), 4000)
        } finally {
            setBulkLoading(false)
            setSelectedSubs(new Set())
            setBulkAction('')
            fetchData()
        }
    }

    const exportCsv = async (ids: string[]) => {
        const res = await fetch(`/api/script-calls/${id}/submissions/export-csv`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionIds: ids }),
        })
        if (!res.ok) return
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `AIM_Scripts_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a); a.click()
        document.body.removeChild(a); URL.revokeObjectURL(url)
        setSelectedSubs(new Set()); setBulkAction('')
    }

    const handleBulkApply = () => {
        if (!bulkAction || selectedSubs.size === 0) return
        const ids = [...selectedSubs]

        if (bulkAction === 'export_csv') { exportCsv(ids); return }

        if (bulkAction === 'rejected') {
            setBulkDeclineChecked(false)
            setBulkDeclineNote('')
            setBulkDeclineModal(true)
            return
        }

        if (bulkAction === 'shortlisted') {
            const selectedSubmissions = submissions.filter(s => selectedSubs.has(s.id))
            const below = selectedSubmissions.filter(s => s.analysis && s.analysis.overallScore < scoreThreshold)
            const above = selectedSubmissions.filter(s => !s.analysis || s.analysis.overallScore >= scoreThreshold)
            if (below.length > 0) {
                setBulkOverrideModal({
                    belowIds: below.map(s => s.id),
                    aboveIds: above.map(s => s.id),
                    belowTitles: below.map(s => s.title),
                })
                return
            }
        }

        applyBulkAction(bulkAction, ids)
    }

    if (loading) return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                <div style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⏳</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Loading submissions...</div>
                </div>
            </main>
        </div>
    )
    if (!call) return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                <div style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🎬</div>
                    <div style={{ color: 'var(--text-tertiary)' }}>Script call not found</div>
                </div>
            </main>
        </div>
    )

    const analyzed = submissions.filter(s => s.analysis)
    const shortlisted = submissions.filter(s => s.status === 'shortlisted')
    const selected = submissions.filter(s => s.status === 'selected')
    const unscored = submissions.filter(s => !s.analysis && s.status !== 'withdrawn' && s.status !== 'analyzing')
    const topScores = [...analyzed].sort((a, b) => (b.analysis?.overallScore || 0) - (a.analysis?.overallScore || 0))
    const avgScore = analyzed.length > 0
        ? Math.round(analyzed.reduce((acc, s) => acc + (s.analysis?.overallScore || 0), 0) / analyzed.length)
        : null

    const filteredSubs = activeTab === 'all' ? submissions
        : activeTab === 'analyzed' ? analyzed
        : activeTab === 'shortlisted' ? shortlisted
        : selected

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
            <>
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes expandIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .admin-sub-card {
                    background: linear-gradient(145deg, rgba(16,18,26,0.95), rgba(12,14,20,0.9));
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 16px;
                    transition: all 0.25s ease;
                    overflow: hidden;
                    animation: fadeUp 0.35s ease both;
                }
                .admin-sub-card:hover {
                    border-color: rgba(212,168,83,0.2);
                    box-shadow: 0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(212,168,83,0.06);
                    transform: translateY(-1px);
                }
                .admin-sub-card.is-expanded {
                    border-color: rgba(212,168,83,0.25);
                }
                .sub-expanded-body {
                    animation: expandIn 0.25s ease both;
                }
                .stat-pill {
                    display: flex; flex-direction: column; align-items: center;
                    padding: 16px 24px; border-radius: 14px; gap: 4px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.06);
                    min-width: 90px;
                }
                .tab-btn {
                    padding: 7px 16px; border-radius: 8px; font-size: 0.72rem;
                    font-weight: 600; cursor: pointer; transition: all 0.15s;
                    border: 1px solid transparent; background: transparent;
                    color: var(--text-tertiary); letter-spacing: 0.02em;
                }
                .tab-btn.active {
                    background: rgba(212,168,83,0.12);
                    border-color: rgba(212,168,83,0.25);
                    color: var(--accent-gold);
                }
                .tab-btn:not(.active):hover {
                    background: rgba(255,255,255,0.04);
                    color: var(--text-secondary);
                }
                .action-btn {
                    padding: 5px 14px; font-size: 0.65rem; font-weight: 700;
                    border-radius: 8px; cursor: pointer; transition: all 0.15s;
                    letter-spacing: 0.03em; white-space: nowrap;
                }
                .action-btn:hover { transform: translateY(-1px); filter: brightness(1.15); }
                .action-btn:active { transform: translateY(0); }
                .podium-card {
                    padding: 16px 18px; border-radius: 12px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.06);
                    animation: fadeUp 0.4s ease both;
                }
                .podium-card.rank-1 {
                    background: linear-gradient(135deg, rgba(212,168,83,0.07), rgba(212,168,83,0.02));
                    border-color: rgba(212,168,83,0.2);
                }
            `}</style>

            {/* ── Page Header ── */}
            <div style={{ marginBottom: '28px', animation: 'fadeUp 0.3s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <Link href="/admin/scripts" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '0.7rem', color: 'var(--text-tertiary)', textDecoration: 'none',
                        padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.15s',
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                        All Calls
                    </Link>
                    <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem' }}>/</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Submissions</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px', lineHeight: 1.2 }}>
                            {call.title}
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {call.genre && (
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 600, padding: '2px 10px',
                                    borderRadius: 'var(--radius-full)', background: 'rgba(212,168,83,0.1)',
                                    border: '1px solid rgba(212,168,83,0.2)', color: 'var(--accent-gold)',
                                }}>{call.genre}</span>
                            )}
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 600, padding: '2px 10px',
                                borderRadius: 'var(--radius-full)',
                                background: call.status === 'open' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${call.status === 'open' ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                color: call.status === 'open' ? '#34d399' : '#f87171',
                                textTransform: 'uppercase',
                            }}>{call.status}</span>
                            {call.deadline && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                    Deadline: {new Date(call.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Analyze All Button */}
                    {unscored.length > 0 && (
                        <button
                            onClick={analyzeAll}
                            disabled={analyzeAllLoading}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '10px 22px', borderRadius: '10px',
                                background: analyzeAllLoading
                                    ? 'rgba(245,158,11,0.06)'
                                    : 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.06))',
                                border: '1px solid rgba(245,158,11,0.25)',
                                color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700,
                                cursor: analyzeAllLoading ? 'not-allowed' : 'pointer',
                                opacity: analyzeAllLoading ? 0.7 : 1,
                                transition: 'all 0.2s', letterSpacing: '0.02em',
                                boxShadow: '0 2px 12px rgba(245,158,11,0.1)',
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>{analyzeAllLoading ? '⏳' : '🤖'}</span>
                            {analyzeAllLoading ? 'Analyzing...' : `Analyze All Unscored (${unscored.length})`}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Stats Bar ── */}
            <div style={{
                display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap',
                animation: 'fadeUp 0.35s ease both',
            }}>
                <div className="stat-pill">
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)' }}>{submissions.length}</div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</div>
                </div>
                <div className="stat-pill">
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#60a5fa' }}>{analyzed.length}</div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Analyzed</div>
                </div>
                <div className="stat-pill">
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#d4a853' }}>{shortlisted.length}</div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Shortlisted</div>
                </div>
                <div className="stat-pill">
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34d399' }}>{selected.length}</div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected</div>
                </div>
                {avgScore !== null && (
                    <div className="stat-pill" style={{ borderColor: 'rgba(212,168,83,0.15)', background: 'rgba(212,168,83,0.04)' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-gold)' }}>{avgScore}</div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg Score</div>
                    </div>
                )}
                {unscored.length > 0 && (
                    <div className="stat-pill" style={{ borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.04)' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f87171' }}>{unscored.length}</div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unscored</div>
                    </div>
                )}
            </div>

            {/* ── Score Threshold Panel ── */}
            {analyzed.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(96,165,250,0.04), rgba(139,92,246,0.03))',
                    border: '1px solid rgba(96,165,250,0.12)',
                    borderRadius: '14px', padding: '16px 20px',
                    marginBottom: '24px',
                    animation: 'fadeUp 0.38s ease 0.05s both',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.9rem' }}>🎚️</span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Shortlist Threshold
                            </span>
                            <span style={{
                                fontSize: '0.75rem', fontWeight: 900,
                                color: '#60a5fa',
                                background: 'rgba(96,165,250,0.12)',
                                border: '1px solid rgba(96,165,250,0.25)',
                                padding: '1px 9px', borderRadius: '99px',
                            }}>{scoreThreshold}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.68rem' }}>
                            <span style={{ color: '#34d399', fontWeight: 700 }}>
                                ↑ {analyzed.filter(s => (s.analysis?.overallScore ?? 0) >= scoreThreshold).length} shortlist
                            </span>
                            <span style={{ color: '#f43f5e', fontWeight: 700 }}>
                                ↓ {analyzed.filter(s => (s.analysis?.overallScore ?? 0) < scoreThreshold).length} decline
                            </span>
                        </div>
                    </div>

                    {/* Slider */}
                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <input
                            type="range" min={0} max={100} step={1}
                            value={scoreThreshold}
                            onChange={e => setScoreThreshold(Number(e.target.value))}
                            style={{
                                width: '100%', accentColor: '#60a5fa',
                                height: '4px', cursor: 'pointer',
                            }}
                        />
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)',
                            marginTop: '2px', pointerEvents: 'none',
                        }}>
                            <span>0 — decline all</span>
                            <span style={{ color: 'rgba(96,165,250,0.5)' }}>▲ {scoreThreshold}</span>
                            <span>100 — shortlist all</span>
                        </div>
                    </div>

                    {/* Score distribution bar */}
                    {(() => {
                        const total = analyzed.length
                        const above = analyzed.filter(s => (s.analysis?.overallScore ?? 0) >= scoreThreshold).length
                        const pct = total > 0 ? Math.round((above / total) * 100) : 0
                        return (
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
                                <div style={{
                                    height: '100%', borderRadius: '4px',
                                    width: `${pct}%`,
                                    background: 'linear-gradient(90deg, #34d399, #60a5fa)',
                                    transition: 'width 0.3s ease',
                                }} />
                            </div>
                        )
                    })()}
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                        Scripts scoring ≥ <strong style={{ color: '#60a5fa' }}>{scoreThreshold}</strong> are recommended for shortlisting.
                        Scores below are recommended for declining. This does not auto-change any status.
                    </div>
                </div>
            )}

            {/* ── Top 3 Podium ── */}
            {topScores.length >= 2 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.05), rgba(212,168,83,0.01))',
                    border: '1px solid rgba(212,168,83,0.15)',
                    borderRadius: '16px', padding: '20px 24px', marginBottom: '28px',
                    animation: 'fadeUp 0.4s ease 0.1s both',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <span style={{ fontSize: '1rem' }}>🏆</span>
                        <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                            AI Top Picks
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(topScores.length, 3)}, 1fr)`, gap: '12px' }}>
                        {topScores.slice(0, 3).map((sub, i) => (
                            <div
                                key={sub.id}
                                className={`podium-card rank-${i + 1}`}
                                style={{ cursor: 'pointer', animationDelay: `${0.05 * i}s` }}
                                onClick={() => { setExpanded(sub.id); setActiveTab('all') }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: 800, color: i === 0 ? '#d4a853' : i === 1 ? '#94a3b8' : '#cd7f32',
                                    }}>#{i + 1}</span>
                                    <div style={{
                                        fontSize: '0.95rem', fontWeight: 900,
                                        padding: '2px 8px', borderRadius: '6px',
                                        background: `rgba(${i === 0 ? '212,168,83' : '255,255,255'},0.08)`,
                                        color: i === 0 ? '#d4a853' : 'var(--text-primary)',
                                    }}>
                                        {Math.round(sub.analysis?.overallScore || 0)}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '3px', lineHeight: 1.3 }}>{sub.title}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>by {sub.authorName}</div>
                                {sub.analysis?.recommendation && (
                                    <div style={{
                                        marginTop: '8px', fontSize: '0.68rem', color: 'var(--text-secondary)',
                                        lineHeight: 1.5,
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                    }}>
                                        {sub.analysis.recommendation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Filter Tabs ── */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', animation: 'fadeUp 0.4s ease 0.15s both', alignItems: 'center', flexWrap: 'wrap' }}>
                {([
                    { key: 'all', label: `All (${submissions.length})` },
                    { key: 'analyzed', label: `Analyzed (${analyzed.length})` },
                    { key: 'shortlisted', label: `Shortlisted (${shortlisted.length})` },
                    { key: 'selected', label: `Selected (${selected.length})` },
                ] as const).map(tab => (
                    <button
                        key={tab.key}
                        className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
                {filteredSubs.length > 0 && (
                    <button
                        onClick={selectAllVisible}
                        style={{
                            marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 600, padding: '5px 12px',
                            borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)',
                            background: selectedSubs.size === filteredSubs.length ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.03)',
                            color: selectedSubs.size === filteredSubs.length ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                        }}
                    >
                        {selectedSubs.size === filteredSubs.length ? 'Deselect All' : 'Select All'}
                    </button>
                )}
            </div>

            {/* ── Bulk Action Bar ── */}
            {selectedSubs.size > 0 && (
                <div style={{
                    position: 'sticky', top: '70px', zIndex: 40,
                    marginBottom: '12px', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid rgba(212,168,83,0.2)',
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.06), rgba(20,24,32,0.95))',
                    backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    animation: 'fadeUp 0.2s ease both',
                }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                        {selectedSubs.size} selected
                    </span>
                    <select
                        value={bulkAction}
                        onChange={e => setBulkAction(e.target.value)}
                        style={{
                            padding: '6px 10px', borderRadius: '7px',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'inherit',
                            cursor: 'pointer', colorScheme: 'dark',
                        }}
                    >
                        <option value="">Bulk Action...</option>
                        <option value="analyzed">→ Mark Analyzed</option>
                        <option value="shortlisted">⭐ Shortlist</option>
                        <option value="rejected">✕ Decline</option>
                        <option value="export_csv">📊 Export CSV</option>
                    </select>
                    <button
                        onClick={handleBulkApply}
                        disabled={!bulkAction || bulkLoading}
                        style={{
                            padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '7px',
                            cursor: !bulkAction || bulkLoading ? 'not-allowed' : 'pointer',
                            opacity: !bulkAction ? 0.4 : 1,
                            background: bulkAction === 'rejected' ? 'rgba(244,63,94,0.1)' : 'rgba(212,168,83,0.1)',
                            border: `1px solid ${bulkAction === 'rejected' ? 'rgba(244,63,94,0.25)' : 'rgba(212,168,83,0.25)'}`,
                            color: bulkAction === 'rejected' ? '#f43f5e' : 'var(--accent-gold)',
                        }}
                    >
                        {bulkLoading ? '...' : 'Apply'}
                    </button>
                    <button
                        onClick={() => setSelectedSubs(new Set())}
                        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* ── Bulk Toast ── */}
            {bulkToast && (
                <div style={{
                    padding: '10px 16px', marginBottom: '12px', borderRadius: '8px',
                    background: bulkToast.startsWith('⚠️') ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                    border: `1px solid ${bulkToast.startsWith('⚠️') ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)'}`,
                    fontSize: '0.78rem', fontWeight: 600,
                    color: bulkToast.startsWith('⚠️') ? '#f59e0b' : '#22c55e',
                    animation: 'fadeUp 0.2s ease both',
                }}>
                    {bulkToast}
                </div>
            )}

            {/* ── Submissions List ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {filteredSubs.map((sub, idx) => {
                    const sc = STATUS_CONFIG[sub.status] || STATUS_CONFIG.submitted
                    const isExpanded = expanded === sub.id
                    const isAnalyzing = analyzingIds.has(sub.id)

                    return (
                        <div
                            key={sub.id}
                            className={`admin-sub-card ${isExpanded ? 'is-expanded' : ''}`}
                            style={{ animationDelay: `${0.04 * idx}s` }}
                        >
                            {/* ── Summary Row ── */}
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', cursor: 'pointer' }}
                                onClick={() => setExpanded(isExpanded ? null : sub.id)}
                            >
                                {/* Score Badge */}
                                {sub.analysis ? (
                                    <ScoreBadge score={sub.analysis.overallScore} />
                                ) : (
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.1rem',
                                        background: isAnalyzing ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                                        border: `2px solid ${isAnalyzing ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                    }}>
                                        {isAnalyzing ? '⏳' : '—'}
                                    </div>
                                )}

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{sub.title}</span>
                                        <span style={{
                                            fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase',
                                            padding: '2px 8px', borderRadius: '5px', letterSpacing: '0.06em',
                                            color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`,
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                        }}>
                                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                                            {sc.label}
                                        </span>
                                        {/* Threshold recommendation badge — only for analyzed, non-terminal */}
                                        {sub.analysis && sub.status === 'analyzed' && (() => {
                                            const meets = sub.analysis.overallScore >= scoreThreshold
                                            return (
                                                <span title={`AI score ${Math.round(sub.analysis.overallScore)} is ${meets ? 'above' : 'below'} threshold of ${scoreThreshold}`} style={{
                                                    fontSize: '0.55rem', fontWeight: 700,
                                                    padding: '2px 8px', borderRadius: '5px',
                                                    color: meets ? '#34d399' : '#f43f5e',
                                                    background: meets ? 'rgba(52,211,153,0.08)' : 'rgba(244,63,94,0.08)',
                                                    border: `1px solid ${meets ? 'rgba(52,211,153,0.2)' : 'rgba(244,63,94,0.2)'}`,
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {meets ? '→ Shortlist' : '→ Decline'}
                                                </span>
                                            )
                                        })()}
                                        {sub.genre && <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)', padding: '1px 7px', borderRadius: '4px' }}>{sub.genre}</span>}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        by <strong style={{ color: 'var(--text-secondary)' }}>{sub.authorName}</strong>
                                        {' · '}
                                        <span style={{ fontStyle: 'italic' }}>
                                            {sub.logline.length > 90 ? sub.logline.slice(0, 90) + '…' : sub.logline}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                    {/* Analyze Button */}
                                    {sub.status !== 'withdrawn' && !sub.analysis && !isAnalyzing && (
                                        <button
                                            className="action-btn"
                                            onClick={() => analyzeSubmission(sub.id)}
                                            style={{
                                                background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                                                color: '#60a5fa',
                                            }}
                                        >
                                            🤖 Analyze
                                        </button>
                                    )}

                                    {/* Status Action Buttons */}
                                    {(() => {
                                        const nextSteps = NEXT_STEPS[sub.status] ?? []
                                        const isTerminal = nextSteps.length === 0
                                        const terminalConfig: Record<string, { icon: string; label: string; color: string }> = {
                                            selected:  { icon: '🏆', label: 'Selected — Final',  color: '#34d399' },
                                            rejected:  { icon: '🔒', label: 'Declined — Final',  color: '#f43f5e' },
                                            withdrawn: { icon: '↩', label: 'Withdrawn',          color: '#6b7280' },
                                        }
                                        if (isTerminal) {
                                            const tc = terminalConfig[sub.status]
                                            return tc ? (
                                                <span title="This decision is final and cannot be changed." style={{
                                                    fontSize: '0.62rem', fontWeight: 700,
                                                    padding: '4px 10px', borderRadius: '6px',
                                                    color: tc.color,
                                                    background: `${tc.color}10`,
                                                    border: `1px solid ${tc.color}30`,
                                                    cursor: 'default', userSelect: 'none',
                                                }}>
                                                    {tc.icon} {tc.label}
                                                </span>
                                            ) : null
                                        }
                                        return nextSteps.map(nextStatus => {
                                            const meta = ACTION_META[nextStatus]
                                            if (!meta) return null
                                            const gated = nextStatus === 'shortlisted' && !sub.analysis
                                            // Threshold guard: below-threshold shortlist gets a warning style
                                            const isBelowThreshold = nextStatus === 'shortlisted'
                                                && sub.analysis
                                                && sub.analysis.overallScore < scoreThreshold
                                            return (
                                                <button
                                                    key={nextStatus}
                                                    className="action-btn"
                                                    onClick={() => {
                                                        if (gated) return
                                                        if (isBelowThreshold) {
                                                            // Trigger threshold override modal instead
                                                            setOverrideChecked(false)
                                                            setConfirmAction({
                                                                subId: sub.id,
                                                                status: nextStatus,
                                                                isBelowThreshold: true,
                                                                score: sub.analysis?.overallScore,
                                                            })
                                                        } else {
                                                            setConfirmAction({ subId: sub.id, status: nextStatus })
                                                        }
                                                    }}
                                                    title={gated ? 'Run AI analysis before shortlisting' : isBelowThreshold ? `Score ${Math.round(sub.analysis?.overallScore ?? 0)} is below threshold of ${scoreThreshold} — click to override` : meta.label}
                                                    style={{
                                                        opacity: gated ? 0.35 : 1,
                                                        cursor: gated ? 'not-allowed' : 'pointer',
                                                        background: isBelowThreshold
                                                            ? 'rgba(245,158,11,0.08)'
                                                            : meta.danger
                                                            ? 'rgba(244,63,94,0.07)'
                                                            : meta.success
                                                            ? 'rgba(52,211,153,0.08)'
                                                            : 'rgba(212,168,83,0.08)',
                                                        border: `1px solid ${isBelowThreshold ? 'rgba(245,158,11,0.3)' : meta.danger ? 'rgba(244,63,94,0.2)' : meta.success ? 'rgba(52,211,153,0.2)' : 'rgba(212,168,83,0.2)'}`,
                                                        color: isBelowThreshold ? '#f59e0b' : meta.danger ? '#f43f5e' : meta.success ? '#34d399' : 'var(--accent-gold)',
                                                    }}
                                                >
                                                    {isBelowThreshold ? '⚠️' : meta.icon} {meta.label}
                                                </button>
                                            )
                                        })
                                    })()}


                                    {/* Expand chevron */}
                                    <div style={{
                                        color: 'var(--text-tertiary)', fontSize: '0.7rem',
                                        transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        marginLeft: '4px',
                                    }}>
                                        ▾
                                    </div>
                                </div>
                            </div>

                            {/* ── Expanded Detail Panel ── */}
                            {isExpanded && (
                                <div
                                    className="sub-expanded-body"
                                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 20px 20px' }}
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: sub.analysis ? '1fr 1.1fr' : '1fr', gap: '24px' }}>

                                        {/* Left: Submission Details */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {/* Author Card */}
                                            <div style={{
                                                padding: '14px 16px', borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                            }}>
                                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                                                    Author
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '2px' }}>{sub.authorName}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#60a5fa', marginBottom: sub.authorBio ? '8px' : 0 }}>
                                                    <a href={`mailto:${sub.authorEmail}`} style={{ color: 'inherit', textDecoration: 'none' }}>{sub.authorEmail}</a>
                                                </div>
                                                {sub.authorBio && (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                                                        {sub.authorBio}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Script Meta */}
                                            <div style={{
                                                padding: '14px 16px', borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                            }}>
                                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                                                    Script
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: '12px' }}>
                                                    {sub.genre && (
                                                        <div>
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Genre</div>
                                                            <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{sub.genre}</div>
                                                        </div>
                                                    )}
                                                    {sub.estimatedDuration && (
                                                        <div>
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Duration</div>
                                                            <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{sub.estimatedDuration}</div>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Submitted</div>
                                                        <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                                                            {new Date(sub.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Logline</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '12px' }}>
                                                    "{sub.logline}"
                                                </div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Synopsis</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{sub.synopsis}</div>
                                            </div>

                                            {/* Full Script Toggle (pasted text) */}
                                            {sub.scriptText && (
                                                <details style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <summary style={{
                                                        cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                                                        color: 'var(--accent-gold)', padding: '10px 14px',
                                                        background: 'rgba(212,168,83,0.04)',
                                                        listStyle: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                                                    }}>
                                                        📄 View Full Script
                                                    </summary>
                                                    <pre style={{
                                                        margin: 0, padding: '16px',
                                                        background: 'rgba(0,0,0,0.4)',
                                                        fontSize: '0.72rem', lineHeight: 1.7,
                                                        maxHeight: '360px', overflow: 'auto',
                                                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                        color: 'var(--text-secondary)',
                                                    }}>{sub.scriptText}</pre>
                                                </details>
                                            )}

                                            {/* Uploaded Script File — download from R2 */}
                                            {sub.scriptFilePath && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px',
                                                    padding: '10px 14px', borderRadius: '10px',
                                                    background: 'rgba(96,165,250,0.05)',
                                                    border: '1px solid rgba(96,165,250,0.15)',
                                                }}>
                                                    <span style={{ fontSize: '1.1rem' }}>📎</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa' }}>Script File Uploaded</div>
                                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {sub.scriptFilePath.split('/').pop()}
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={sub.scriptFilePath}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        download
                                                        style={{
                                                            padding: '6px 14px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 700,
                                                            background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)',
                                                            color: '#60a5fa', textDecoration: 'none', whiteSpace: 'nowrap',
                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        }}
                                                    >
                                                        ⬇ Download
                                                    </a>
                                                    <a
                                                        href={sub.scriptFilePath}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            padding: '6px 14px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 700,
                                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                                            color: 'var(--text-tertiary)', textDecoration: 'none', whiteSpace: 'nowrap',
                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        }}
                                                    >
                                                        🔗 Open
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: AI Analysis */}
                                        {sub.analysis && (
                                            <div>
                                                {/* Overall Score Hero */}
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '16px',
                                                    padding: '16px 18px', borderRadius: '12px', marginBottom: '16px',
                                                    background: 'linear-gradient(135deg, rgba(212,168,83,0.07), rgba(212,168,83,0.02))',
                                                    border: '1px solid rgba(212,168,83,0.18)',
                                                }}>
                                                    <div style={{
                                                        position: 'relative', width: 56, height: 56, flexShrink: 0,
                                                        borderRadius: '50%',
                                                        background: `conic-gradient(var(--accent-gold) ${sub.analysis.overallScore}%, rgba(255,255,255,0.05) 0)`,
                                                    }}>
                                                        <div style={{
                                                            position: 'absolute', inset: 5, borderRadius: '50%',
                                                            background: '#0c0e14',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.9rem', fontWeight: 900, color: 'var(--accent-gold)',
                                                        }}>
                                                            {Math.round(sub.analysis.overallScore)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold)', marginBottom: '4px' }}>
                                                            AI Overall Score
                                                        </div>
                                                        {sub.analysis.recommendation && (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                                {sub.analysis.recommendation}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Score Breakdown */}
                                                <div style={{
                                                    padding: '16px 18px', borderRadius: '12px', marginBottom: '14px',
                                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                                }}>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                                                        Score Breakdown
                                                    </div>
                                                    <ScoreBar label="Originality"      score={sub.analysis.originalityScore}     color="#34d399" />
                                                    <ScoreBar label="Structure"        score={sub.analysis.structureScore}        color="#60a5fa" />
                                                    <ScoreBar label="Dialogue"         score={sub.analysis.dialogueScore}         color="#f59e0b" />
                                                    <ScoreBar label="Visual Potential" score={sub.analysis.visualPotentialScore}  color="#a78bfa" />
                                                    <ScoreBar label="Theme Alignment"  score={sub.analysis.themeAlignmentScore}   color="#f472b6" />
                                                    <ScoreBar label="Feasibility"      score={sub.analysis.feasibilityScore}      color="#22d3ee" />
                                                </div>

                                                {/* Strengths & Concerns */}
                                                {sub.analysis.strengths && (
                                                    <div style={{
                                                        padding: '12px 16px', borderRadius: '10px', marginBottom: '10px',
                                                        background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)',
                                                    }}>
                                                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#34d399', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                            ✅ Strengths
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{sub.analysis.strengths}</div>
                                                    </div>
                                                )}
                                                {sub.analysis.concerns && (
                                                    <div style={{
                                                        padding: '12px 16px', borderRadius: '10px',
                                                        background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)',
                                                    }}>
                                                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                            ⚠️ Concerns
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{sub.analysis.concerns}</div>
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

            {/* Empty State */}
            {filteredSubs.length === 0 && (
                <div style={{
                    textAlign: 'center', padding: '60px 40px', borderRadius: '16px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    animation: 'fadeUp 0.35s ease both',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
                        {activeTab === 'all' ? '📭' : activeTab === 'analyzed' ? '🤖' : activeTab === 'shortlisted' ? '⭐' : '🏆'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                        {activeTab === 'all' ? 'No submissions yet' : `No ${activeTab} submissions`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {activeTab === 'all'
                            ? 'Share the call link to start receiving scripts.'
                            : `Switch to "All" to view all submissions.`}
                    </div>
                </div>
            )}

            {/* ─── Single-Script Confirm Modal (+ Threshold Override Variant) ─── */}
            {confirmAction && (
                <div
                    onClick={() => { setConfirmAction(null); setOverrideChecked(false) }}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9000,
                        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'linear-gradient(145deg, #141820, #101318)',
                            border: confirmAction.isBelowThreshold
                                ? '1px solid rgba(245,158,11,0.3)'
                                : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px', padding: '32px',
                            maxWidth: '440px', width: '100%',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                            animation: 'fadeUp 0.25s ease both',
                        }}
                    >
                        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '12px' }}>
                            {confirmAction.isBelowThreshold ? '⚠️' : confirmAction.status === 'rejected' ? '⚠️' : confirmAction.status === 'selected' ? '🏆' : '✅'}
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>
                            {confirmAction.isBelowThreshold ? 'Override Shortlist Threshold?' : 'Confirm Action'}
                        </div>

                        {confirmAction.isBelowThreshold ? (
                            <>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6, textAlign: 'center' }}>
                                    This script scored <strong style={{ color: '#f59e0b' }}>{Math.round(confirmAction.score ?? 0)}</strong> against your threshold of <strong style={{ color: 'var(--accent-gold)' }}>{scoreThreshold}</strong>.
                                    Shortlisting it would override the rule.
                                </div>
                                {/* Score vs Threshold bar */}
                                <div style={{ marginBottom: '18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                                        <span>AI Score: {Math.round(confirmAction.score ?? 0)}</span>
                                        <span>Threshold: {scoreThreshold}</span>
                                    </div>
                                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'visible' }}>
                                        <div style={{ height: '100%', borderRadius: '3px', background: 'rgba(245,158,11,0.5)', width: `${Math.min(100, confirmAction.score ?? 0)}%`, transition: 'width 0.3s ease' }} />
                                        {/* Threshold marker */}
                                        <div style={{
                                            position: 'absolute', top: '-3px', bottom: '-3px',
                                            left: `${scoreThreshold}%`, width: '2px',
                                            background: 'rgba(212,168,83,0.8)',
                                            borderRadius: '1px',
                                        }} />
                                    </div>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '20px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    <input
                                        type="checkbox"
                                        checked={overrideChecked}
                                        onChange={e => setOverrideChecked(e.target.checked)}
                                        style={{ accentColor: '#f59e0b', marginTop: '2px', flexShrink: 0 }}
                                    />
                                    I understand this script is below my scoring threshold and I am overriding the recommendation.
                                </label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => { setConfirmAction(null); setOverrideChecked(false) }} style={{ flex: 1, padding: '11px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                                    <button
                                        disabled={!overrideChecked}
                                        onClick={() => { updateStatus(confirmAction.subId, 'shortlisted'); setConfirmAction(null); setOverrideChecked(false) }}
                                        style={{ flex: 1, padding: '11px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '10px', cursor: overrideChecked ? 'pointer' : 'not-allowed', opacity: overrideChecked ? 1 : 0.4, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
                                    >
                                        Override &amp; Shortlist
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.6, textAlign: 'center' }}>
                                    Move this submission to{' '}
                                    <strong style={{ color: 'var(--text-primary)' }}>
                                        {ACTION_META[confirmAction.status]?.label || confirmAction.status}
                                    </strong>?
                                </div>
                                {confirmAction.status === 'selected' && (
                                    <div style={{ fontSize: '0.72rem', color: '#34d399', textAlign: 'center', marginBottom: '4px' }}>
                                        🏆 A selection email will be sent to the author.
                                    </div>
                                )}
                                {confirmAction.status === 'rejected' && (
                                    <div style={{ fontSize: '0.72rem', color: '#f87171', textAlign: 'center', marginBottom: '4px' }}>
                                        ✕ A rejection notification will be sent to the author.
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                                    <button onClick={() => setConfirmAction(null)} style={{ flex: 1, padding: '11px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 0.15s' }}>Cancel</button>
                                    <button
                                        onClick={() => { updateStatus(confirmAction.subId, confirmAction.status); setConfirmAction(null) }}
                                        style={{ flex: 1, padding: '11px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', background: confirmAction.status === 'rejected' ? 'rgba(244,63,94,0.12)' : confirmAction.status === 'selected' ? 'rgba(52,211,153,0.12)' : 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))', border: `1px solid ${confirmAction.status === 'rejected' ? 'rgba(244,63,94,0.3)' : confirmAction.status === 'selected' ? 'rgba(52,211,153,0.3)' : 'rgba(212,168,83,0.35)'}`, color: confirmAction.status === 'rejected' ? '#f43f5e' : confirmAction.status === 'selected' ? '#34d399' : 'var(--accent-gold)' }}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Bulk Decline Modal ─── */}
            {bulkDeclineModal && (
                <div onClick={() => setBulkDeclineModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 9001, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(145deg, #141820, #101318)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', animation: 'fadeUp 0.25s ease both' }}>
                        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '12px' }}>⚠️</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>Decline {selectedSubs.size} Submission{selectedSubs.size !== 1 ? 's' : ''}?</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6, textAlign: 'center' }}>
                            A decline notification will be sent to each author.
                        </div>
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Optional note to include in email</div>
                            <textarea
                                value={bulkDeclineNote}
                                onChange={e => setBulkDeclineNote(e.target.value)}
                                placeholder="Leave blank for the standard decline message..."
                                rows={3}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: '0.78rem', fontFamily: 'inherit', resize: 'vertical', colorScheme: 'dark', boxSizing: 'border-box' }}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '20px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <input type="checkbox" checked={bulkDeclineChecked} onChange={e => setBulkDeclineChecked(e.target.checked)} style={{ accentColor: '#f43f5e', marginTop: '2px', flexShrink: 0 }} />
                            I understand this will send a decline notification to {selectedSubs.size} author{selectedSubs.size !== 1 ? 's' : ''}.
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setBulkDeclineModal(false)} style={{ flex: 1, padding: '11px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                            <button
                                disabled={!bulkDeclineChecked}
                                onClick={() => { setBulkDeclineModal(false); applyBulkAction('rejected', [...selectedSubs], bulkDeclineNote || undefined) }}
                                style={{ flex: 1, padding: '11px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '10px', cursor: bulkDeclineChecked ? 'pointer' : 'not-allowed', opacity: bulkDeclineChecked ? 1 : 0.4, background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e' }}
                            >
                                Decline &amp; Notify
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Bulk Threshold Override Modal ─── */}
            {bulkOverrideModal && (
                <div onClick={() => setBulkOverrideModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 9002, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(145deg, #141820, #101318)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', animation: 'fadeUp 0.25s ease both' }}>
                        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '12px' }}>⚠️</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>Shortlist Threshold Warning</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6, textAlign: 'center' }}>
                            <strong style={{ color: '#f59e0b' }}>{bulkOverrideModal.belowIds.length}</strong> of <strong>{selectedSubs.size}</strong> selected scripts are below your threshold of <strong style={{ color: 'var(--accent-gold)' }}>{scoreThreshold}</strong>:
                        </div>
                        <div style={{ borderRadius: '8px', padding: '10px 12px', marginBottom: '18px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                            {bulkOverrideModal.belowTitles.map((title, i) => (
                                <div key={i} style={{ fontSize: '0.72rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ opacity: 0.5 }}>⚠</span> {title}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                                onClick={() => { setBulkOverrideModal(null); applyBulkAction('shortlisted', [...bulkOverrideModal.belowIds, ...bulkOverrideModal.aboveIds]) }}
                                style={{ padding: '11px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '10px', cursor: 'pointer', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
                            >
                                Override All — Shortlist {selectedSubs.size} scripts
                            </button>
                            {bulkOverrideModal.aboveIds.length > 0 && (
                                <button
                                    onClick={() => { setBulkOverrideModal(null); applyBulkAction('shortlisted', bulkOverrideModal.aboveIds) }}
                                    style={{ padding: '11px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '10px', cursor: 'pointer', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
                                >
                                    Shortlist Eligible Only — {bulkOverrideModal.aboveIds.length} script{bulkOverrideModal.aboveIds.length !== 1 ? 's' : ''} above threshold
                                </button>
                            )}
                            <button
                                onClick={() => setBulkOverrideModal(null)}
                                style={{ padding: '11px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-tertiary)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    </main>
</div>
)
}
