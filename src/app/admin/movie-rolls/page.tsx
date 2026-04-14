'use client'

import { useState, useEffect, useCallback } from 'react'

interface Roll {
    id: string
    title: string
    icon: string
    slug: string
    displayOn: string
    visible: boolean
    sortOrder: number
    _count: { projects: number }
    projects: { id: string; projectId: string; sortOrder: number }[]
}

interface Project {
    id: string
    title: string
    slug: string
    coverImage: string | null
    status: string
}

export default function MovieRollsAdmin() {
    const [rolls, setRolls] = useState<Roll[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [editingRoll, setEditingRoll] = useState<Roll | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [expandedRoll, setExpandedRoll] = useState<string | null>(null)

    // New roll form state
    const [newTitle, setNewTitle] = useState('')
    const [newIcon, setNewIcon] = useState('🎬')
    const [newDisplayOn, setNewDisplayOn] = useState('both')

    const fetchRolls = useCallback(async () => {
        const res = await fetch('/api/admin/movie-rolls')
        if (res.ok) setRolls(await res.json())
    }, [])

    const fetchProjects = useCallback(async () => {
        const res = await fetch('/api/admin/projects')
        if (res.ok) {
            const data = await res.json()
            setProjects(data.map((p: Project & Record<string, unknown>) => ({
                id: p.id, title: p.title, slug: p.slug,
                coverImage: p.coverImage, status: p.status,
            })))
        }
    }, [])

    useEffect(() => {
        Promise.all([fetchRolls(), fetchProjects()]).then(() => setLoading(false))
    }, [fetchRolls, fetchProjects])

    const createRoll = async () => {
        if (!newTitle.trim()) return
        const res = await fetch('/api/admin/movie-rolls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, icon: newIcon, displayOn: newDisplayOn }),
        })
        if (res.ok) {
            setNewTitle(''); setNewIcon('🎬'); setNewDisplayOn('both')
            setShowCreate(false)
            await fetchRolls()
        }
    }

    const updateRoll = async (roll: Roll) => {
        await fetch('/api/admin/movie-rolls', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roll),
        })
        setEditingRoll(null)
        await fetchRolls()
    }

    const deleteRoll = async (id: string) => {
        if (!confirm('Delete this roll? Projects will not be affected.')) return
        await fetch(`/api/admin/movie-rolls?id=${id}`, { method: 'DELETE' })
        await fetchRolls()
    }

    const toggleVisibility = async (roll: Roll) => {
        await fetch('/api/admin/movie-rolls', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: roll.id, visible: !roll.visible }),
        })
        await fetchRolls()
    }

    const addProjectToRoll = async (rollId: string, projectId: string) => {
        await fetch('/api/admin/movie-rolls/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rollId, projectId }),
        })
        await fetchRolls()
    }

    const removeProjectFromRoll = async (rollId: string, projectId: string) => {
        await fetch(`/api/admin/movie-rolls/projects?rollId=${rollId}&projectId=${projectId}`, {
            method: 'DELETE',
        })
        await fetchRolls()
    }

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading…
            </div>
        )
    }

    return (
        <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '1.5rem',
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                        🎞️ Movie Rolls
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Create curated collections that appear as rows on the homepage and works page.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.8rem' }}
                >
                    + New Roll
                </button>
            </div>

            {/* Create form */}
            {showCreate && (
                <div style={{
                    padding: '1rem', marginBottom: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                            type="text"
                            placeholder="Roll title (e.g. Award Winners)"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            style={{
                                flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-primary)', color: '#fff',
                                fontSize: '0.85rem',
                            }}
                        />
                        <input
                            type="text"
                            placeholder="🎬"
                            value={newIcon}
                            onChange={e => setNewIcon(e.target.value)}
                            style={{
                                width: '50px', padding: '0.5rem', borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-primary)', color: '#fff',
                                fontSize: '1rem', textAlign: 'center',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                            value={newDisplayOn}
                            onChange={e => setNewDisplayOn(e.target.value)}
                            style={{
                                padding: '0.4rem 0.6rem', borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-primary)', color: '#fff',
                                fontSize: '0.8rem',
                            }}
                        >
                            <option value="both">Both Pages</option>
                            <option value="homepage">Homepage Only</option>
                            <option value="works">Works Only</option>
                        </select>
                        <button onClick={createRoll} className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem' }}>
                            Create
                        </button>
                        <button onClick={() => setShowCreate(false)} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Rolls list */}
            {rolls.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '3rem',
                    color: 'var(--text-secondary)', fontSize: '0.85rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--border-subtle)',
                }}>
                    No rolls yet. Create your first collection above.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {rolls.map(roll => {
                        const isExpanded = expandedRoll === roll.id
                        const rollProjectIds = new Set(roll.projects.map(p => p.projectId))
                        const availableProjects = projects.filter(p => !rollProjectIds.has(p.id))

                        return (
                            <div key={roll.id} style={{
                                borderRadius: 'var(--radius-lg)',
                                border: `1px solid ${roll.visible ? 'rgba(228,185,90,0.15)' : 'var(--border-subtle)'}`,
                                background: 'var(--bg-secondary)',
                                overflow: 'hidden',
                            }}>
                                {/* Roll header */}
                                <div
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => setExpandedRoll(isExpanded ? null : roll.id)}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>{roll.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{roll.title}</span>
                                            <span style={{
                                                fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px',
                                                background: roll.visible ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)',
                                                color: roll.visible ? '#34d399' : 'var(--text-tertiary)',
                                                fontWeight: 600,
                                            }}>
                                                {roll.visible ? 'LIVE' : 'HIDDEN'}
                                            </span>
                                            <span style={{
                                                fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px',
                                                background: 'rgba(96,165,250,0.1)',
                                                color: '#60a5fa', fontWeight: 600,
                                            }}>
                                                {roll.displayOn === 'both' ? 'Both' : roll.displayOn === 'homepage' ? 'Home' : 'Works'}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                            {roll._count.projects} projects · /{roll.slug}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleVisibility(roll) }}
                                            title={roll.visible ? 'Hide roll' : 'Show roll'}
                                            style={{
                                                padding: '4px 8px', borderRadius: '4px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--border-subtle)',
                                                color: '#fff', cursor: 'pointer', fontSize: '0.75rem',
                                            }}
                                        >
                                            {roll.visible ? '👁️' : '🚫'}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteRoll(roll.id) }}
                                            title="Delete roll"
                                            style={{
                                                padding: '4px 8px', borderRadius: '4px',
                                                background: 'rgba(239,68,68,0.1)',
                                                border: '1px solid rgba(239,68,68,0.2)',
                                                color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem',
                                            }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                    <span style={{
                                        fontSize: '0.8rem', color: 'var(--text-secondary)',
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                        transition: 'transform 0.2s',
                                    }}>▼</span>
                                </div>

                                {/* Expanded: project management */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '0 1rem 1rem',
                                        borderTop: '1px solid var(--border-subtle)',
                                        paddingTop: '0.75rem',
                                    }}>
                                        {/* Current projects */}
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 700,
                                                color: 'var(--text-secondary)',
                                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                                display: 'block', marginBottom: '0.5rem',
                                            }}>
                                                Projects in this roll
                                            </span>
                                            {roll.projects.length === 0 ? (
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                                    No projects yet. Add some below.
                                                </p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {roll.projects
                                                        .sort((a, b) => a.sortOrder - b.sortOrder)
                                                        .map(rp => {
                                                            const proj = projects.find(p => p.id === rp.projectId)
                                                            if (!proj) return null
                                                            return (
                                                                <div key={rp.id} style={{
                                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                                    padding: '6px 8px', borderRadius: '6px',
                                                                    background: 'rgba(255,255,255,0.03)',
                                                                }}>
                                                                    {proj.coverImage && (
                                                                        <img
                                                                            src={proj.coverImage}
                                                                            alt=""
                                                                            style={{
                                                                                width: '32px', height: '24px',
                                                                                objectFit: 'cover', borderRadius: '4px',
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600 }}>
                                                                        {proj.title}
                                                                    </span>
                                                                    <span style={{
                                                                        fontSize: '0.6rem', color: 'var(--text-tertiary)',
                                                                    }}>
                                                                        #{rp.sortOrder + 1}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => removeProjectFromRoll(roll.id, rp.projectId)}
                                                                        style={{
                                                                            padding: '2px 6px', borderRadius: '4px',
                                                                            background: 'rgba(239,68,68,0.1)',
                                                                            border: 'none',
                                                                            color: '#ef4444', cursor: 'pointer',
                                                                            fontSize: '0.65rem',
                                                                        }}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            )
                                                        })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Add project */}
                                        {availableProjects.length > 0 && (
                                            <div>
                                                <span style={{
                                                    fontSize: '0.7rem', fontWeight: 700,
                                                    color: 'var(--text-secondary)',
                                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                                    display: 'block', marginBottom: '0.5rem',
                                                }}>
                                                    Add a project
                                                </span>
                                                <div style={{
                                                    display: 'flex', flexWrap: 'wrap', gap: '4px',
                                                }}>
                                                    {availableProjects.map(proj => (
                                                        <button
                                                            key={proj.id}
                                                            onClick={() => addProjectToRoll(roll.id, proj.id)}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                                padding: '4px 8px', borderRadius: '6px',
                                                                background: 'rgba(212,168,83,0.08)',
                                                                border: '1px solid rgba(212,168,83,0.15)',
                                                                color: 'var(--accent-gold)',
                                                                cursor: 'pointer', fontSize: '0.7rem',
                                                                fontWeight: 600, transition: 'all 0.15s',
                                                            }}
                                                        >
                                                            + {proj.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
