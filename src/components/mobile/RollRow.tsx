'use client'

/**
 * RollRow — renders a pre-loaded admin-curated movie roll as a horizontal
 * scrollable strip. Unlike MovieRow (which fetches lazily), RollRow receives
 * its project data as a prop so it renders instantly with zero extra requests.
 */

import { useRef } from 'react'
import Link from 'next/link'
import MovieCard, { type ProjectCard } from './MovieCard'

interface RollRowProps {
    title: string
    titleI18n: string | null
    icon: string
    projects: ProjectCard[]
    locale: string
    onCardHover?: (project: ProjectCard, rect: DOMRect) => void
    onCardHoverEnd?: () => void
}

export default function RollRow({ title, titleI18n, icon, projects, locale, onCardHover, onCardHoverEnd }: RollRowProps) {
    const stripRef = useRef<HTMLDivElement>(null)

    if (projects.length === 0) return null

    // Resolve localized title from JSON i18n blob
    let displayTitle = title
    if (titleI18n) {
        try {
            const parsed = JSON.parse(titleI18n) as Record<string, string>
            displayTitle = parsed[locale] || parsed['en'] || title
        } catch { /* keep original title */ }
    }

    const scroll = (dir: 'left' | 'right') => {
        stripRef.current?.scrollBy({ left: dir === 'right' ? 360 : -360, behavior: 'smooth' })
    }

    return (
        <div style={{ marginBottom: '28px' }}>
            {/* Row header */}
            <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                padding: '0 2px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '1rem' }}>{icon}</span>
                    <span style={{
                        fontSize: '0.78rem', fontWeight: 800,
                        letterSpacing: '0.04em', color: '#e8e8ec',
                    }}>{displayTitle}</span>
                    {/* Curated badge */}
                    <span style={{
                        fontSize: '0.5rem', fontWeight: 700,
                        color: 'var(--accent-gold)',
                        background: 'rgba(212,168,83,0.1)',
                        border: '1px solid rgba(212,168,83,0.2)',
                        padding: '1px 6px', borderRadius: '20px',
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>Curated</span>
                </div>

                {/* Scroll arrows */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    {(['left', 'right'] as const).map(dir => (
                        <button
                            key={dir}
                            onClick={() => scroll(dir)}
                            aria-label={`Scroll ${dir}`}
                            style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: 'rgba(212,168,83,0.08)',
                                border: '1px solid rgba(212,168,83,0.2)',
                                color: 'var(--accent-gold)',
                                cursor: 'pointer', fontSize: '0.75rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.18)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.08)' }}
                        >
                            {dir === 'left' ? '‹' : '›'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Horizontal scrollable strip */}
            <div
                ref={stripRef}
                className="movie-strip"
                style={{
                    display: 'flex',
                    gap: '10px',
                    overflowX: 'auto',
                    overflowY: 'visible',
                    paddingBottom: '6px',
                    paddingTop: '2px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                    scrollSnapType: 'x mandatory',
                }}
            >
                <style>{`.movie-strip::-webkit-scrollbar{display:none}`}</style>
                {projects.map(project => (
                    <div key={project.id} style={{ scrollSnapAlign: 'start' }}>
                        <MovieCard
                            project={project}
                            locale={locale}
                            onHover={onCardHover}
                            onHoverEnd={onCardHoverEnd}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
