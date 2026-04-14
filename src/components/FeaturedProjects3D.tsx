'use client'

import Link from 'next/link'
import ScrollReveal3D from './ScrollReveal3D'
import MovieCard from './mobile/MovieCard'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'
import { useIsMobile } from '@/hooks/useIsMobile'

interface ProjectData {
    id: string
    title: string
    slug: string
    tagline: string
    genre: string | null
    coverImage: string | null
    trailerUrl: string | null
    translations: string | null
}

export default function FeaturedProjects3D({ projects }: { projects: ProjectData[] }) {
    const t = useTranslations('works')
    const locale = useLocale()
    const isMobile = useIsMobile()

    // ── Mobile: horizontal scroll strip with new premium card design ──
    if (isMobile) {
        return (
            <div style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: '8px',
                margin: '0 -16px',
                padding: '0 16px 8px',
            }}>
                {projects.map(project => (
                    <div key={project.id} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                        <MovieCard
                            project={{
                                ...project,
                                status: 'completed',
                                projectType: 'film',
                                filmUrl: null,
                                featured: true,
                                viewCount: 0,
                                year: null,
                                duration: null,
                                episodeCount: 0,
                            }}
                            locale={locale}
                        />
                    </div>
                ))}
            </div>
        )
    }

    // ── Desktop: existing grid with scroll reveal ──
    return (
        <div className="grid-3">
            {projects.map((project, i) => {
                const loc = getLocalizedProject(project, locale)
                return (
                <ScrollReveal3D key={project.id} delay={i * 150} direction="up" distance={50} rotate={6}>
                    <Link
                        href={`/works/${project.slug}`}
                        prefetch={false}
                        className="project-card"
                        style={{ display: 'block' }}
                    >
                        <div
                            className="project-card-image"
                            style={{
                                backgroundImage: project.coverImage
                                    ? `url(${project.coverImage})`
                                    : 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                            }}
                        />
                        <div className="project-card-overlay" />
                        {project.trailerUrl && (
                            <div className="project-card-play">
                                <svg viewBox="0 0 24 24">
                                    <polygon points="5,3 19,12 5,21" />
                                </svg>
                            </div>
                        )}
                        <div className="project-card-content">
                            <span className="project-card-genre">{loc.genre}</span>
                            <h3>{loc.title}</h3>
                            <p>{loc.tagline}</p>
                            {project.trailerUrl && (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em',
                                    textTransform: 'uppercase', color: 'var(--accent-gold)',
                                    marginTop: 'var(--space-sm)',
                                }}>
                                    ▶ {t('watchTrailer')}
                                </span>
                            )}
                        </div>
                    </Link>
                </ScrollReveal3D>
                )
            })}
        </div>
    )
}
