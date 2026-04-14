'use client'

import Link from 'next/link'
import { useState } from 'react'
import { getLocalizedProject } from '@/lib/localize'

export interface ProjectCard {
    id: string
    title: string
    slug: string
    tagline: string | null
    genre: string | null
    status: string
    projectType: string
    coverImage: string | null
    trailerUrl: string | null
    filmUrl: string | null
    featured: boolean
    viewCount: number
    year: string | null
    duration: string | null
    episodeCount: number
    translations: string | null
}

interface MovieCardProps {
    project: ProjectCard
    locale: string
    onHover?: (project: ProjectCard, rect: DOMRect) => void
    onHoverEnd?: () => void
}

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
    completed:     { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  label: 'Completed' },
    'in-production': { color: '#d4a853', bg: 'rgba(212,168,83,0.1)', label: 'In Production' },
    upcoming:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  label: 'Upcoming' },
}

export default function MovieCard({ project, locale, onHover, onHoverEnd }: MovieCardProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const [imgError, setImgError] = useState(false)
    const loc = getLocalizedProject(project, locale)
    const statusStyle = STATUS_STYLES[project.status]

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        if (onHover) {
            onHover(project, e.currentTarget.getBoundingClientRect())
        }
    }

    // Fire view event on tap (fire-and-forget)
    const handleClick = () => {
        fetch('/api/projects/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: project.id, source: 'browse', locale }),
        }).catch(() => {})
    }

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={onHoverEnd}
            style={{ flexShrink: 0, width: '175px', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}
        >
            <Link
                href={`/works/${project.slug}`}
                onClick={handleClick}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
                {/* Cover image — native lazy loading, no JS needed */}
                <div style={{
                    width: '175px', height: '110px',
                    background: imgLoaded && !imgError
                        ? 'transparent'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '10px 10px 0 0',
                }}>
                    {project.coverImage && !imgError && (
                        <img
                            src={project.coverImage}
                            alt={loc.title}
                            loading="lazy"
                            decoding="async"
                            onLoad={() => setImgLoaded(true)}
                            onError={() => setImgError(true)}
                            style={{
                                width: '100%', height: '100%',
                                objectFit: 'cover',
                                opacity: imgLoaded ? 1 : 0,
                                transition: 'opacity 0.3s ease',
                                userSelect: 'none',
                                pointerEvents: 'none',
                            }}
                            onContextMenu={e => e.preventDefault()}
                            draggable={false}
                        />
                    )}
                    {(!project.coverImage || imgError) && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2rem', opacity: 0.2,
                        }}>🎬</div>
                    )}

                    {/* Play badge — shown if has trailer or film */}
                    {(project.trailerUrl || project.filmUrl) && (
                        <div style={{
                            position: 'absolute', top: '6px', right: '6px',
                            width: '22px', height: '22px',
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '8px',
                            color: '#fff',
                            zIndex: 2,
                        }}>▶</div>
                    )}

                    {/* Gradient overlay */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                        background: 'linear-gradient(to top, rgba(10,10,16,0.8), transparent)',
                        pointerEvents: 'none', zIndex: 1,
                    }} />
                </div>

                {/* Name plate */}
                <div style={{
                    background: 'rgba(10,10,16,0.97)',
                    padding: '7px 10px 9px',
                    borderTop: '1px solid rgba(212,168,83,0.1)',
                }}>
                    <div style={{
                        fontSize: '0.78rem', fontWeight: 700, color: '#fff',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: '3px',
                    }}>
                        {loc.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {loc.genre && (
                            <span style={{
                                fontSize: '0.6rem', fontWeight: 600,
                                color: 'var(--accent-gold)', letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: '80px',
                            }}>{loc.genre}</span>
                        )}
                        {statusStyle && (
                            <span style={{
                                fontSize: '0.52rem', fontWeight: 700,
                                color: statusStyle.color,
                                background: statusStyle.bg,
                                padding: '1px 5px',
                                borderRadius: '20px',
                                whiteSpace: 'nowrap',
                            }}>{statusStyle.label}</span>
                        )}
                    </div>
                    {project.year && (
                        <div style={{
                            fontSize: '0.58rem', color: 'var(--text-tertiary)',
                            marginTop: '2px',
                        }}>{project.year}{project.duration ? ` · ${project.duration}` : ''}</div>
                    )}
                </div>
            </Link>
        </div>
    )
}
