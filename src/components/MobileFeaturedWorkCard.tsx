'use client'

import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'

export interface FeaturedWorkItem {
    title: string
    slug: string
    genre: string | null
    year: string | null
    status: string
    coverImage: string | null
    trailerUrl: string | null
    filmUrl: string | null
    translations: string | null
    /** Open casting calls — drives "View Casting Role" CTA when present */
    castingCalls?: { id: string }[]
}

interface Props {
    work: FeaturedWorkItem
    /** True for the first card — eager-loads the image for LCP. */
    priority?: boolean
}

/**
 * Single featured-work poster card for the mobile Works page hero carousel.
 *
 * CTA priority (highest → lowest):
 *   1. Open casting call → View Casting Role  → /casting/{id}/apply
 *   2. Full film          → Watch Now          → /works/{slug}/watch
 *   3. Trailer only       → Watch Trailer      → /works/{slug}#trailer
 *   4. Fallback           → Details            → /works/{slug}
 */
export default function MobileFeaturedWorkCard({ work, priority = false }: Props) {
    const t = useTranslations('works')
    const locale = useLocale()
    const loc = getLocalizedProject(work, locale)

    const genre = loc.genre
        ? loc.genre.split(',').map((g: string) => g.trim()).filter(Boolean).join(' · ')
        : null

    // ── CTA resolution ─────────────────────────────────────────────────────
    const openCasting = work.castingCalls?.find(c => c.id)
    let ctaHref: string
    let ctaLabel: string
    let ctaGold: boolean

    if (openCasting) {
        ctaHref  = `/casting/${openCasting.id}/apply`
        ctaLabel = t('viewCastingRole') ?? 'View Casting Role'
        ctaGold  = false
    } else if (work.filmUrl) {
        ctaHref  = `/works/${work.slug}/watch`
        ctaLabel = t('watchNow')
        ctaGold  = true
    } else if (work.trailerUrl) {
        ctaHref  = `/works/${work.slug}#trailer`
        ctaLabel = t('watchTrailer')
        ctaGold  = false
    } else {
        ctaHref  = `/works/${work.slug}`
        ctaLabel = t('viewDetails')
        ctaGold  = false
    }

    return (
        <>
            {/*
              * Zoom animation: slow cinematic scale 1.0 → 1.04 on the poster.
              * Isolated to an inner wrapper so opacity on the parent doesn't compound.
              * prefers-reduced-motion: disabled via CSS.
              */}
            <style>{`
                @keyframes mfwcZoom {
                    from { transform: scale(1.0); }
                    to   { transform: scale(1.04); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .mfwc-zoom { animation: none !important; }
                }
            `}</style>

            {/* Cover image with zoom wrapper */}
            <div
                className="mfwc-zoom"
                style={{
                    position: 'absolute', inset: 0,
                    animation: 'mfwcZoom 10s ease-in-out forwards',
                    willChange: 'transform',
                }}
            >
                {work.coverImage ? (
                    <Image
                        src={work.coverImage}
                        alt={loc.title}
                        fill
                        sizes="100vw"
                        priority={priority}
                        style={{ objectFit: 'cover', objectPosition: 'center top' }}
                    />
                ) : (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(135deg, #1a1d26, #0d0f14)',
                    }} />
                )}
            </div>

            {/* Cinematic gradient overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(13,15,20,0.04) 0%, rgba(13,15,20,0.08) 30%, rgba(13,15,20,0.62) 58%, rgba(13,15,20,0.93) 80%, rgba(13,15,20,0.98) 100%)',
                pointerEvents: 'none',
            }} />

            {/* Content — pinned to bottom, above gradient */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                padding: '0 20px 36px',
                zIndex: 2,
            }}>
                {genre && (
                    <span style={{
                        display: 'inline-block', marginBottom: '4px',
                        fontSize: '0.58rem', fontWeight: 700,
                        letterSpacing: '0.14em', textTransform: 'uppercase' as const,
                        color: 'var(--accent-gold)',
                    }}>
                        {genre}
                    </span>
                )}

                <h2 style={{
                    fontSize: 'clamp(1.35rem, 5.2vw, 1.85rem)',
                    fontWeight: 800, lineHeight: 1.15,
                    margin: '0 0 2px', color: '#ffffff',
                    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
                }}>
                    {loc.title}
                </h2>

                {work.year && (
                    <span style={{
                        display: 'block', marginBottom: '12px',
                        fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
                    }}>
                        {work.year}
                    </span>
                )}

                {/* CTA button */}
                <Link
                    href={ctaHref}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        fontSize: '0.8rem', fontWeight: 700,
                        padding: '0.5rem 1.1rem',
                        borderRadius: '99px',
                        textDecoration: 'none',
                        background: ctaGold
                            ? 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))'
                            : 'rgba(255,255,255,0.14)',
                        color: ctaGold ? '#0f1115' : '#ffffff',
                        border: ctaGold ? 'none' : '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: ctaGold ? 'none' : 'blur(8px)',
                        WebkitBackdropFilter: ctaGold ? 'none' : 'blur(8px)',
                    }}
                >
                    {ctaGold && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                    {ctaLabel}
                </Link>
            </div>
        </>
    )
}
