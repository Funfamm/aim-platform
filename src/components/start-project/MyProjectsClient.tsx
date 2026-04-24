'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ProjectSummary {
    id: string
    projectType: string
    projectTitle: string
    status: string
    clientName: string
    description: string
    budgetRange: string | null
    deadline: string | null
    createdAt: string
    updatedAt: string
}

const STATUS_FLOW = [
    'received', 'reviewing', 'scope_confirmed', 'in_production', 'delivered', 'completed',
]

const STATUS_LABELS: Record<string, { emoji: string; color: string; label: string }> = {
    received:        { emoji: '📥', color: '#d4a853', label: 'Received' },
    reviewing:       { emoji: '🔍', color: '#3b82f6', label: 'Under Review' },
    scope_confirmed: { emoji: '📋', color: '#8b5cf6', label: 'Scope Confirmed' },
    in_production:   { emoji: '🎬', color: '#f59e0b', label: 'In Production' },
    awaiting_client: { emoji: '⏳', color: '#ef4444', label: 'Awaiting Client' },
    delivered:       { emoji: '📦', color: '#10b981', label: 'Delivered' },
    completed:       { emoji: '✅', color: '#10b981', label: 'Completed' },
    cancelled:       { emoji: '❌', color: '#6b7280', label: 'Cancelled' },
}

const TYPE_ICONS: Record<string, string> = {
    birthday: '🎉', brand: '🏢', commercial: '📺', music: '🎵',
    film: '🎬', event: '📣', custom: '✨',
}

export default function MyProjectsClient() {
    const searchParams = useSearchParams()
    const paramId = searchParams.get('id')
    const paramToken = searchParams.get('token')

    const [projects, setProjects] = useState<ProjectSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(paramId)
    const [needsAuth, setNeedsAuth] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const qs = new URLSearchParams()
                if (paramId) qs.set('id', paramId)
                if (paramToken) qs.set('token', paramToken)

                const res = await fetch(`/api/my-projects?${qs.toString()}`)

                if (res.status === 401) {
                    // User needs to login — redirect with callback
                    setNeedsAuth(true)
                    setLoading(false)
                    return
                }

                if (!res.ok) {
                    const data = await res.json()
                    throw new Error(data.error || 'Failed to load projects')
                }

                const data = await res.json()
                setProjects(data.projects || [])
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Something went wrong')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [paramId, paramToken])

    // ── Auth required screen ────────────────────────────────────────────
    if (needsAuth) {
        const redirectPath = encodeURIComponent(
            `/my-projects${paramId ? `?id=${paramId}` : ''}${paramToken ? `&token=${paramToken}` : ''}`
        )
        return (
            <div style={{ textAlign: 'center', paddingTop: 'clamp(3rem, 8vw, 6rem)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>🔐</div>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
                    fontWeight: 800,
                    marginBottom: 'var(--space-md)',
                }}>
                    Sign in to view your projects
                </h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.6 }}>
                    Create an account or sign in to track the progress of your project requests.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link
                        href={`/login?redirect=${redirectPath}`}
                        className="sp-btn sp-btn-primary"
                        style={{ textDecoration: 'none' }}
                    >
                        Sign In
                    </Link>
                    <Link
                        href={`/register?redirect=${redirectPath}`}
                        className="sp-btn sp-btn-ghost"
                        style={{ textDecoration: 'none' }}
                    >
                        Create Account
                    </Link>
                </div>
            </div>
        )
    }

    // ── Loading ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ textAlign: 'center', paddingTop: 'clamp(3rem, 8vw, 6rem)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)', animation: 'spin 1s linear infinite' }}>⏳</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading your projects...</p>
            </div>
        )
    }

    // ── Error ───────────────────────────────────────────────────────────
    if (error) {
        return (
            <div style={{ textAlign: 'center', paddingTop: 'clamp(3rem, 8vw, 6rem)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>⚠️</div>
                <p style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 600 }}>{error}</p>
                <Link href="/start-project" className="sp-btn sp-btn-ghost" style={{ textDecoration: 'none', marginTop: 'var(--space-lg)', display: 'inline-block' }}>
                    Start a New Project
                </Link>
            </div>
        )
    }

    // ── Empty ───────────────────────────────────────────────────────────
    if (projects.length === 0) {
        return (
            <div style={{ textAlign: 'center', paddingTop: 'clamp(3rem, 8vw, 6rem)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>📭</div>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
                    fontWeight: 800,
                    marginBottom: 'var(--space-md)',
                }}>
                    No projects yet
                </h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.6 }}>
                    Submit your first project request and track its progress here.
                </p>
                <Link href="/start-project" className="sp-btn sp-btn-primary" style={{ textDecoration: 'none' }}>
                    Start a Project
                </Link>
            </div>
        )
    }

    // ── Project list ────────────────────────────────────────────────────
    return (
        <div>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 'clamp(1.5rem, 4vw, 2.5rem)', paddingTop: 'clamp(0.5rem, 2vw, 1.5rem)' }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 16px',
                    borderRadius: '99px',
                    background: 'rgba(212,168,83,0.08)',
                    border: '1px solid rgba(212,168,83,0.15)',
                    marginBottom: 'clamp(1rem, 2vw, 1.5rem)',
                }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>
                        My Projects
                    </span>
                </div>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.4rem, 4vw, 2.2rem)',
                    fontWeight: 800,
                    marginBottom: 'var(--space-sm)',
                }}>
                    Project Tracker
                </h1>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {projects.length} project{projects.length !== 1 ? 's' : ''} submitted
                </p>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {projects.map(project => {
                    const st = STATUS_LABELS[project.status] || { emoji: '📋', color: '#9ca3af', label: project.status }
                    const isExpanded = expandedId === project.id
                    const currentStatusIdx = STATUS_FLOW.indexOf(project.status)

                    return (
                        <div key={project.id} style={{
                            borderRadius: 'var(--radius-xl)',
                            background: 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isExpanded ? 'rgba(212,168,83,0.2)' : 'rgba(255,255,255,0.06)'}`,
                            overflow: 'hidden',
                            transition: 'border-color 0.3s',
                        }}>
                            {/* Card header — always visible, clickable */}
                            <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : project.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'clamp(10px, 2vw, 16px)',
                                    width: '100%',
                                    padding: 'clamp(14px, 3vw, 20px)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    color: 'var(--text-primary)',
                                    WebkitTapHighlightColor: 'transparent',
                                }}
                            >
                                <span style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', flexShrink: 0 }}>
                                    {TYPE_ICONS[project.projectType] || '📁'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {project.projectTitle}
                                    </div>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-tertiary)',
                                        fontFamily: 'monospace',
                                        marginTop: '2px',
                                    }}>
                                        {project.id}
                                    </div>
                                </div>
                                {/* Status badge */}
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '99px',
                                    background: `${st.color}15`,
                                    border: `1px solid ${st.color}30`,
                                    flexShrink: 0,
                                }}>
                                    <span style={{ fontSize: '0.65rem' }}>{st.emoji}</span>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: st.color, whiteSpace: 'nowrap' }}>
                                        {st.label}
                                    </span>
                                </div>
                                {/* Chevron */}
                                <span style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--text-tertiary)',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                    transition: 'transform 0.2s',
                                    flexShrink: 0,
                                }}>
                                    ▾
                                </span>
                            </button>

                            {/* Expanded details */}
                            {isExpanded && (
                                <div style={{
                                    padding: '0 clamp(14px, 3vw, 20px) clamp(14px, 3vw, 20px)',
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    animation: 'spFadeIn 0.3s ease-out',
                                }}>
                                    {/* Meta info */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                        gap: '12px',
                                        marginTop: 'var(--space-md)',
                                        marginBottom: 'var(--space-lg)',
                                    }}>
                                        <MetaItem label="Type" value={project.projectType} />
                                        <MetaItem label="Submitted" value={new Date(project.createdAt).toLocaleDateString()} />
                                        {project.deadline && <MetaItem label="Deadline" value={new Date(project.deadline).toLocaleDateString()} />}
                                        {project.budgetRange && <MetaItem label="Budget" value={project.budgetRange} />}
                                        <MetaItem label="Last Updated" value={new Date(project.updatedAt).toLocaleDateString()} />
                                    </div>

                                    {/* Description */}
                                    <div style={{
                                        fontSize: '0.82rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.6,
                                        marginBottom: 'var(--space-lg)',
                                        padding: '12px 14px',
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        {project.description.length > 200
                                            ? project.description.slice(0, 200) + '...'
                                            : project.description}
                                    </div>

                                    {/* Status timeline */}
                                    <div style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-md)',
                                        border: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        <div style={{
                                            fontSize: '0.6rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.12em',
                                            textTransform: 'uppercase',
                                            color: 'var(--accent-gold)',
                                            marginBottom: 'var(--space-sm)',
                                        }}>
                                            Progress
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {STATUS_FLOW.map((status, i) => {
                                                const isCurrent = status === project.status
                                                const isPast = i < currentStatusIdx
                                                const info = STATUS_LABELS[status] || { emoji: '○', color: '#9ca3af', label: status }
                                                return (
                                                    <div key={status} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        opacity: isPast || isCurrent ? 1 : 0.3,
                                                    }}>
                                                        <div style={{
                                                            width: '22px',
                                                            height: '22px',
                                                            borderRadius: '50%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.55rem',
                                                            fontWeight: 800,
                                                            flexShrink: 0,
                                                            background: isCurrent
                                                                ? `${info.color}20`
                                                                : isPast
                                                                ? 'rgba(16,185,129,0.1)'
                                                                : 'rgba(255,255,255,0.04)',
                                                            border: `1.5px solid ${
                                                                isCurrent ? info.color : isPast ? '#10b981' : 'rgba(255,255,255,0.1)'
                                                            }`,
                                                            color: isPast ? '#10b981' : isCurrent ? info.color : 'var(--text-tertiary)',
                                                        }}>
                                                            {isPast ? '✓' : i + 1}
                                                        </div>
                                                        <span style={{
                                                            fontSize: '0.78rem',
                                                            fontWeight: isCurrent ? 700 : 400,
                                                            color: isCurrent ? 'var(--text-primary)' : isPast ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                                                        }}>
                                                            {info.label}
                                                        </span>
                                                        {isCurrent && (
                                                            <span style={{
                                                                fontSize: '0.55rem',
                                                                fontWeight: 700,
                                                                color: info.color,
                                                                padding: '2px 8px',
                                                                borderRadius: '99px',
                                                                background: `${info.color}15`,
                                                                marginLeft: 'auto',
                                                            }}>
                                                                CURRENT
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Footer CTA */}
            <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
                <Link href="/start-project" className="sp-btn sp-btn-ghost" style={{ textDecoration: 'none' }}>
                    Start Another Project
                </Link>
            </div>
        </div>
    )
}

function MetaItem({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
        }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                {label}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {value}
            </div>
        </div>
    )
}
