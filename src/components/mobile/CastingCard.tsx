'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'

interface CastingProject {
    id: string
    title: string
    slug: string
    tagline: string | null
    genre: string | null
    status: string
    coverImage: string | null
    translations: string | null
    castingCalls: {
        id: string
        roleName: string
        status: string
    }[]
}

interface CastingCardProps {
    project: CastingProject
    locale: string
}

/**
 * Upcoming page casting-focused card.
 * Emphasizes production status, open casting roles, and "Apply" CTA.
 * Blue accent tint differentiates from the gold-themed Works cards.
 */
export default function CastingCard({ project, locale }: CastingCardProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const t = useTranslations('upcomingHero')
    const loc = getLocalizedProject(project, locale)

    const openRoles = project.castingCalls.filter(c => c.status === 'open')
    const isInProduction = project.status === 'in-production'

    return (
        <Link
            href={`/works/${project.slug}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            aria-label={`View details for ${loc.title}`}
        >
        <div className="press-feedback" style={{
            width: '200px',
            flexShrink: 0,
            borderRadius: '12px',
            overflow: 'hidden',
            background: 'rgba(14,16,24,0.95)',
            border: `1px solid ${isInProduction ? 'rgba(212,168,83,0.15)' : 'rgba(96,165,250,0.15)'}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
            {/* Cover image — 16:10 landscape aspect */}
            <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/10',
                background: '#0a0a12',
                overflow: 'hidden',
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
                            filter: 'brightness(0.8)',
                        }}
                    />
                )}

                {/* Shimmer */}
                {!imgLoaded && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(135deg, rgba(96,165,250,0.05), rgba(30,30,45,0.3), rgba(96,165,250,0.05))',
                        backgroundSize: '200% 200%',
                        animation: 'shimmer 1.8s ease-in-out infinite',
                    }} />
                )}

                {/* Status badge */}
                <div style={{
                    position: 'absolute',
                    top: '8px', left: '8px',
                }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.55rem', fontWeight: 700,
                        letterSpacing: '0.06em',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isInProduction ? 'rgba(212,168,83,0.2)' : 'rgba(96,165,250,0.2)',
                        border: `1px solid ${isInProduction ? 'rgba(212,168,83,0.3)' : 'rgba(96,165,250,0.3)'}`,
                        color: isInProduction ? '#d4a853' : '#60a5fa',
                        backdropFilter: 'blur(8px)',
                    }}>
                        <span style={{
                            width: '5px', height: '5px', borderRadius: '50%',
                            background: isInProduction ? '#d4a853' : '#60a5fa',
                            animation: 'pulse-gold 2s infinite',
                        }} />
                        {isInProduction ? t('inProduction') : t('comingSoon')}
                    </span>
                </div>

                {/* Roles badge — top right */}
                {openRoles.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '8px', right: '8px',
                    }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '0.55rem', fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(52,211,153,0.15)',
                            border: '1px solid rgba(52,211,153,0.3)',
                            color: '#34d399',
                            backdropFilter: 'blur(8px)',
                        }}>
                            🎭 {openRoles.length} {t('roles')}
                        </span>
                    </div>
                )}

                {/* Bottom gradient */}
                <div style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0, height: '50%',
                    background: 'linear-gradient(to top, rgba(14,16,24,0.95), transparent)',
                    pointerEvents: 'none',
                }} />
            </div>

            {/* Info section */}
            <div style={{ padding: '10px 12px 12px' }}>
                {/* Title */}
                <h3 style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#fff',
                    lineHeight: 1.2,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                }}>
                    {loc.title}
                </h3>

                {/* Tagline */}
                {loc.tagline && (
                    <p style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        margin: '4px 0 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                        fontStyle: 'italic',
                    }}>
                        {loc.tagline}
                    </p>
                )}

                {/* Role pills */}
                {openRoles.length > 0 && (
                    <div style={{
                        display: 'flex', gap: '4px', flexWrap: 'wrap',
                        marginTop: '8px',
                    }}>
                        {openRoles.slice(0, 2).map(role => (
                            <span key={role.id} style={{
                                fontSize: '0.55rem', fontWeight: 600,
                                padding: '2px 6px', borderRadius: '4px',
                                background: 'rgba(212,168,83,0.08)',
                                border: '1px solid rgba(212,168,83,0.15)',
                                color: 'var(--accent-gold)',
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap', maxWidth: '85px',
                            }}>
                                {role.roleName}
                            </span>
                        ))}
                        {openRoles.length > 2 && (
                            <span style={{
                                fontSize: '0.55rem', fontWeight: 600,
                                padding: '2px 6px', borderRadius: '4px',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-tertiary)',
                            }}>
                                +{openRoles.length - 2}
                            </span>
                        )}
                    </div>
                )}

                {/* Action buttons */}
                <div style={{
                    display: 'flex', gap: '6px',
                    marginTop: '10px',
                }}>
                    {/* Details button — same destination as the card wrapper link */}
                    <span
                        className="press-feedback-sm"
                        style={{
                            flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '6px 0',
                            borderRadius: '6px',
                            fontSize: '0.62rem', fontWeight: 700,
                            letterSpacing: '0.03em',
                            color: '#b0a998',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textDecoration: 'none',
                        }}
                    >
                        {t('details')}
                    </span>
                    {openRoles.length > 0 && (
                        <Link
                            href="/casting"
                            className="press-feedback-sm"
                            onClick={e => e.stopPropagation()}
                            style={{
                                flex: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '6px 0',
                                borderRadius: '6px',
                                fontSize: '0.62rem', fontWeight: 700,
                                letterSpacing: '0.03em',
                                color: '#34d399',
                                background: 'rgba(52,211,153,0.1)',
                                border: '1px solid rgba(52,211,153,0.25)',
                                textDecoration: 'none',
                            }}
                        >
                            {t('applyNow')}
                        </Link>
                    )}
                </div>
            </div>
        </div>
        </Link>
    )
}
