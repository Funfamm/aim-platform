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

const STATUS_BADGE: Record<string, { color: string; bg: string; border: string; label: string }> = {
    completed:       { color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)',  label: '✓ Released' },
    'in-production': { color: '#d4a853', bg: 'rgba(212,168,83,0.08)', border: 'rgba(212,168,83,0.2)',  label: '🎬 In Production' },
    upcoming:        { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)',  label: '✨ Coming Soon' },
}

export default function MovieCard({ project, locale, onHover, onHoverEnd }: MovieCardProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const [imgError, setImgError] = useState(false)
    const loc = getLocalizedProject(project, locale)
    const badge = STATUS_BADGE[project.status]

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        if (onHover) onHover(project, e.currentTarget.getBoundingClientRect())
    }

    // Fire view event on tap (fire-and-forget)
    const trackView = () => {
        fetch('/api/projects/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: project.id, source: 'browse', locale }),
        }).catch(() => {})
    }

    // ── Determine primary action based on production status ──
    const primaryAction = project.filmUrl
        ? { href: `/works/${project.slug}#watch`, label: '▶ Watch Now',  color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' }
        : project.trailerUrl
        ? { href: `/works/${project.slug}#trailer`, label: '▶ Trailer', color: '#d4a853', bg: 'rgba(212,168,83,0.12)', border: 'rgba(212,168,83,0.3)' }
        : { href: `/works/${project.slug}`, label: 'Details →',          color: '#b0a998', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' }

    return (
        <div
            className="movie-card-premium"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={onHoverEnd}
            style={{
                flexShrink: 0,
                width: '155px',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                background: 'rgba(13,15,22,0.95)',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
        >
            {/* ── Cover image — taller portrait aspect ── */}
            <div style={{
                width: '100%',
                height: '200px',
                position: 'relative',
                overflow: 'hidden',
                background: imgLoaded && !imgError
                    ? 'transparent'
                    : 'linear-gradient(135deg, rgba(212,168,83,0.04), rgba(139,92,246,0.04))',
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
                            transition: 'opacity 0.4s ease',
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
                        fontSize: '2.5rem', opacity: 0.15,
                    }}>🎬</div>
                )}

                {/* Status badge — top right */}
                {badge && (
                    <div style={{
                        position: 'absolute', top: '8px', right: '8px',
                        fontSize: '0.5rem', fontWeight: 700,
                        color: badge.color,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                        padding: '2px 7px',
                        borderRadius: '20px',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        zIndex: 3,
                        letterSpacing: '0.02em',
                    }}>{badge.label}</div>
                )}

                {/* Play indicator overlay — subtle */}
                {(project.trailerUrl || project.filmUrl) && (
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '32px', height: '32px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        border: '1.5px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', color: '#fff',
                        opacity: 0.7,
                        zIndex: 2,
                    }}>▶</div>
                )}

                {/* Bottom gradient */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '60%',
                    background: 'linear-gradient(to top, rgba(13,15,22,0.95) 0%, rgba(13,15,22,0.4) 50%, transparent 100%)',
                    pointerEvents: 'none', zIndex: 1,
                }} />
            </div>

            {/* ── Info panel ── */}
            <div style={{
                padding: '10px 10px 8px',
                borderTop: '1px solid rgba(212,168,83,0.06)',
            }}>
                {/* Title */}
                <Link
                    href={`/works/${project.slug}`}
                    onClick={trackView}
                    style={{
                        display: 'block',
                        fontSize: '0.78rem', fontWeight: 700, color: '#fff',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecoration: 'none',
                        marginBottom: '3px',
                        lineHeight: 1.3,
                    }}
                >{loc.title}</Link>

                {/* Genre */}
                {loc.genre && (
                    <div style={{
                        fontSize: '0.55rem', fontWeight: 600,
                        color: 'var(--accent-gold)', letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: '6px',
                        opacity: 0.8,
                    }}>{loc.genre}</div>
                )}

                {/* Action button — changes based on production status */}
                <Link
                    href={primaryAction.href}
                    onClick={e => e.stopPropagation()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        width: '100%',
                        padding: '5px 0',
                        borderRadius: '6px',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        color: primaryAction.color,
                        background: primaryAction.bg,
                        border: `1px solid ${primaryAction.border}`,
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                    }}
                >{primaryAction.label}</Link>
            </div>
        </div>
    )
}
