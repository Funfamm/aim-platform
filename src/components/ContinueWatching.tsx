'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'
import { useIsMobile } from '@/hooks/useIsMobile'

interface HistoryItem {
    id: string
    projectId: string
    episodeId: string | null
    progress: number
    watchedAt: string
    project: {
        id: string
        title: string
        slug: string
        coverImage: string | null
        genre: string | null
        duration: string | null
        projectType: string
        translations: string | null
    }
    episode: {
        id: string
        title: string
        number: number
        season: number
        thumbnail: string | null
    } | null
}


/**
 * Continue Watching — horizontal scroll row shown on the homepage
 * for logged-in users with unfinished watch history.
 *
 * Rules:
 *  - Guest: API returns 401, component returns null
 *  - Logged in, no unfinished items: returns null
 *  - Logged in, has items: renders poster cards with progress bars
 *
 * Auth detection is client-side (via the API's 401) so the
 * homepage can stay on ISR (revalidate=300) without reading cookies.
 */
export default function ContinueWatching() {
    const [items, setItems] = useState<HistoryItem[]>([])
    const [loaded, setLoaded] = useState(false)
    const locale = useLocale()
    const isMobile = useIsMobile(false)
    const t = useTranslations('home')
    const cardWidth = isMobile ? 160 : 185

    useEffect(() => {
        fetch('/api/dashboard/history?limit=20')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data?.history) return
                const history: HistoryItem[] = data.history
                // Only show unfinished items (between 1% and 95% progress)
                const unfinished = history.filter(h =>
                    h.progress > 0.01 && h.progress < 0.95 && h.project
                )
                // Deduplicate by projectId — for series with multiple episode
                // records, keep only the most recently watched unfinished episode.
                // The API already sorts by watchedAt desc, so first-seen wins.
                const seen = new Set<string>()
                const deduped = unfinished.filter(h => {
                    if (seen.has(h.projectId)) return false
                    seen.add(h.projectId)
                    return true
                })
                setItems(deduped.slice(0, 8))
            })
            .catch(() => {})
            .finally(() => setLoaded(true))
    }, [])

    // No data → render nothing
    if (!loaded || items.length === 0) return null

    return (
        <section style={{
            position: 'relative',
            zIndex: 2,
            padding: 'var(--space-lg) 0 var(--space-xl)',
        }}>
            <div className="container">
                {/* Section header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    marginBottom: 'var(--space-md)',
                }}>
                    <div style={{
                        width: '3px', height: '18px',
                        background: 'var(--accent-gold)',
                        borderRadius: '2px', flexShrink: 0,
                    }} />
                    <h2 style={{
                        fontSize: '1rem', fontWeight: 800,
                        margin: 0, letterSpacing: '-0.01em',
                    }}>
                        <span style={{ marginRight: '6px' }}>▶</span>
                        {t('continueWatching')}
                    </h2>
                    <span style={{
                        fontSize: '0.58rem', fontWeight: 700,
                        color: 'var(--accent-gold)',
                        background: 'rgba(212,168,83,0.08)',
                        border: '1px solid rgba(212,168,83,0.18)',
                        padding: '2px 8px', borderRadius: '99px',
                    }}>
                        {items.length}
                    </span>
                </div>

                {/* Horizontal scroll row */}
                <div
                    className="cw-strip"
                    style={{
                        display: 'flex',
                        gap: '12px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        scrollSnapType: 'x mandatory',
                        overscrollBehaviorX: 'contain',
                        touchAction: 'pan-x pan-y',
                        paddingBottom: '8px',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                    }}
                >
                    <style>{`.cw-strip::-webkit-scrollbar{display:none}`}</style>

                    {items.map(item => {
                        const loc = getLocalizedProject(item.project, locale)
                        const progressPct = Math.round(item.progress * 100)
                        // Episode-level: /works/{slug}/s{S}e{E}   Project-level: /works/{slug}#watch
                        const href = item.episode
                            ? `/works/${item.project.slug}/s${item.episode.season}e${item.episode.number}`
                            : `/works/${item.project.slug}#watch`

                        return (
                            <Link
                                key={item.id}
                                href={href}
                                style={{
                                    flexShrink: 0,
                                    width: `${cardWidth}px`,
                                    scrollSnapAlign: 'start',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    transition: 'transform 0.2s, border-color 0.2s',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'scale(1.03)'
                                    e.currentTarget.style.borderColor = 'rgba(212,168,83,0.25)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'scale(1)'
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                                }}
                            >
                                {/* Poster — prefer episode thumbnail for series */}
                                <div style={{
                                    position: 'relative',
                                    aspectRatio: '16/10',
                                    background: 'var(--bg-tertiary)',
                                }}>
                                    {(item.episode?.thumbnail || item.project.coverImage) ? (
                                        <Image
                                            src={item.episode?.thumbnail || item.project.coverImage!}
                                            alt={loc.title}
                                            fill
                                            sizes={`${cardWidth}px`}
                                            style={{ objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(135deg, #1a1d26, #0d0f14)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '2rem',
                                        }}>
                                            🎬
                                        </div>
                                    )}

                                    {/* Play overlay */}
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.3)',
                                        opacity: 0,
                                        transition: 'opacity 0.2s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                                        onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}
                                    >
                                        <div style={{
                                            width: '36px', height: '36px',
                                            borderRadius: '50%',
                                            background: 'rgba(212,168,83,0.9)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0f1115">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0, left: 0, right: 0,
                                        height: '3px',
                                        background: 'rgba(255,255,255,0.15)',
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${Math.min(progressPct, 100)}%`,
                                            background: 'linear-gradient(90deg, var(--accent-gold), #e8c547)',
                                            borderRadius: '0 2px 2px 0',
                                            transition: 'width 0.3s ease',
                                        }} />
                                    </div>
                                </div>

                                {/* Info */}
                                <div style={{ padding: '8px 10px 10px' }}>
                                    <h3 style={{
                                        fontSize: '0.75rem', fontWeight: 700,
                                        margin: 0, lineHeight: 1.3,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                    }}>
                                        {loc.title}
                                    </h3>
                                    {/* Episode subtitle — shown when watching a series episode */}
                                    {item.episode && (
                                        <p style={{
                                            fontSize: '0.62rem', fontWeight: 600,
                                            margin: '2px 0 0', lineHeight: 1.3,
                                            color: 'rgba(255,255,255,0.55)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            S{item.episode.season}E{item.episode.number}
                                            {item.episode.title ? ` — ${item.episode.title}` : ''}
                                        </p>
                                    )}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        marginTop: '4px',
                                    }}>
                                        <span style={{
                                            fontSize: '0.6rem',
                                            color: 'var(--accent-gold)',
                                            fontWeight: 600,
                                        }}>
                                            {progressPct}%
                                        </span>
                                        {item.project.duration && (
                                            <span style={{
                                                fontSize: '0.58rem',
                                                color: 'var(--text-tertiary)',
                                            }}>
                                                · {item.project.duration}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
