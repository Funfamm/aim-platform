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
}

interface Props {
    work: FeaturedWorkItem
    /** True for the first card — eager-loads the image for LCP. */
    priority?: boolean
}

/**
 * Single featured-work poster card for the mobile hero carousel.
 * Fills its positioned parent with a cover image, cinematic gradient,
 * title/genre, and a context-aware CTA:
 *   • Watch Now   — full film available
 *   • Watch Trailer — only trailer available
 *   • Details     — upcoming or no media
 */
export default function MobileFeaturedWorkCard({ work, priority = false }: Props) {
    const t = useTranslations('works')
    const locale = useLocale()
    const loc = getLocalizedProject(work, locale)

    const genre = loc.genre
        ? loc.genre.split(',').map((g: string) => g.trim()).filter(Boolean).join(' · ')
        : null

    // CTA href and label — priority: film > trailer > detail page
    const ctaHref = work.filmUrl
        ? `/works/${work.slug}#watch`
        : work.trailerUrl
        ? `/works/${work.slug}#trailer`
        : `/works/${work.slug}`

    const ctaLabel = work.filmUrl
        ? t('watchNow')
        : work.trailerUrl
        ? t('watchTrailer')
        : t('viewDetails')

    const ctaGold = !!work.filmUrl

    return (
        <>
            {/* Cover image or dark fallback */}
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

            {/* Cinematic gradient overlay — heavier at bottom for readability */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(13,15,20,0.04) 0%, rgba(13,15,20,0.08) 30%, rgba(13,15,20,0.62) 58%, rgba(13,15,20,0.93) 80%, rgba(13,15,20,0.98) 100%)',
                pointerEvents: 'none',
            }} />

            {/* Content — pinned to bottom, above gradient */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                padding: '0 20px 36px', // 36 px bottom clears the dot row
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
