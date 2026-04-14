'use client'

import Link from 'next/link'
import { useState } from 'react'
import { getLocalizedProject } from '@/lib/localize'

interface PosterProject {
    id: string
    title: string
    slug: string
    tagline: string | null
    genre: string | null
    coverImage: string | null
    trailerUrl: string | null
    translations: string | null
}

interface CinematicPosterCardProps {
    project: PosterProject
    locale: string
}

/**
 * Homepage-only cinematic poster card.
 * Large, image-forward, minimal text — designed to make a strong first impression.
 * No badges, no genre tags, no action buttons. Just tap to explore.
 */
export default function CinematicPosterCard({ project, locale }: CinematicPosterCardProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const loc = getLocalizedProject(project, locale)

    return (
        <Link
            href={`/works/${project.slug}`}
            prefetch={false}
            className="press-feedback"
            style={{
                display: 'block',
                width: '180px',
                flexShrink: 0,
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                textDecoration: 'none',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                /* transition handled by .press-feedback class */
            }}
        >
            {/* Cover image — 3:4 poster aspect */}
            <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '3/4',
                background: '#0a0a12',
            }}>
                {project.coverImage && (
                    <img
                        src={project.coverImage}
                        alt={loc.title}
                        loading="lazy"
                        onLoad={() => setImgLoaded(true)}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            opacity: imgLoaded ? 1 : 0,
                            transition: 'opacity 0.4s ease',
                        }}
                    />
                )}

                {/* Shimmer placeholder */}
                {!imgLoaded && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(135deg, rgba(212,168,83,0.05), rgba(30,30,45,0.3), rgba(212,168,83,0.05))',
                        backgroundSize: '200% 200%',
                        animation: 'shimmer 1.8s ease-in-out infinite',
                    }} />
                )}

                {/* Bottom gradient for text readability */}
                <div style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    height: '60%',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
                    pointerEvents: 'none',
                }} />

                {/* Play indicator for trailers */}
                {project.trailerUrl && (
                    <div style={{
                        position: 'absolute',
                        top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '40px', height: '40px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        border: '1.5px solid rgba(255,255,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.2s',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <polygon points="6,3 20,12 6,21" />
                        </svg>
                    </div>
                )}

                {/* Title + tagline overlay */}
                <div style={{
                    position: 'absolute',
                    bottom: '12px', left: '12px', right: '12px',
                }}>
                    <h3 style={{
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: '#fff',
                        lineHeight: 1.2,
                        margin: 0,
                        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                    }}>
                        {loc.title}
                    </h3>
                    {loc.genre && (
                        <span style={{
                            display: 'block',
                            marginTop: '4px',
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'rgba(212,168,83,0.9)',
                            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {loc.genre}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}
