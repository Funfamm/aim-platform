'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { getLocalizedProject } from '@/lib/localize'
import type { ProjectCard } from '@/components/mobile/MovieCard'

interface HoverPreviewCardProps {
    project: ProjectCard
    anchor: DOMRect
    locale: string
    onClose: () => void
}

const CARD_W = 420
const CARD_H = 370

function computePosition(anchor: DOMRect) {
    const vw = window.innerWidth
    const scrollY = window.scrollY

    // Horizontal: center on the card, clamped to viewport with margin
    let left = anchor.left + anchor.width / 2 - CARD_W / 2
    left = Math.max(16, Math.min(left, vw - CARD_W - 16))

    // Vertical: center the expanded card on the anchor, with scroll offset
    let top = anchor.top + scrollY + anchor.height / 2 - CARD_H / 2
    top = Math.max(scrollY + 16, top)

    // Transform-origin for the scale animation — follows horizontal position
    let transformOrigin = 'center center'
    if (left <= 20) transformOrigin = 'left center'
    else if (left + CARD_W >= vw - 20) transformOrigin = 'right center'

    return { left, top, transformOrigin }
}

export default function HoverPreviewCard({ project, anchor, locale, onClose }: HoverPreviewCardProps) {
    const [mounted, setMounted] = useState(false)
    const [visible, setVisible] = useState(false)
    const [muted, setMuted] = useState(true)
    const [inWatchlist, setInWatchlist] = useState(false)
    const [watchlistLoading, setWatchlistLoading] = useState(false)
    const [watchProgress, setWatchProgress] = useState<number | null>(null)
    const [videoError, setVideoError] = useState(false)

    const videoRef   = useRef<HTMLVideoElement>(null)
    const cardRef    = useRef<HTMLDivElement>(null)
    // Compute position once on mount — stable ref prevents re-calc on re-renders
    const pos        = useRef(computePosition(anchor)).current
    const loc        = getLocalizedProject(project, locale)

    // Portal mount
    useEffect(() => {
        setMounted(true)
        // Entrance animation on next tick
        requestAnimationFrame(() => setVisible(true))
    }, [])

    // Fetch watchlist state + watch progress (parallel, non-blocking)
    useEffect(() => {
        fetch(`/api/watchlist?projectId=${project.id}`)
            .then(r => r.json())
            .then(d => setInWatchlist(d.saved ?? false))
            .catch(() => {})

        // Watch history progress (if endpoint exists)
        fetch(`/api/watch-history?projectId=${project.id}`)
            .then(r => r.json())
            .then(d => { if (d.progress) setWatchProgress(d.progress) })
            .catch(() => {})
    }, [project.id])

    // Auto-play video when mounted — src is set via JSX prop, just call .play()
    useEffect(() => {
        const video = videoRef.current
        if (!video || !project.trailerUrl) return
        video.play().catch(() => { /* browser autoplay policy — user must interact first */ })
        return () => {
            video.pause()
        }
    }, [project.trailerUrl]) // NOT muted — toggling mute must NOT restart the video

    const toggleWatchlist = useCallback(async () => {
        setWatchlistLoading(true)
        try {
            // Always POST — the existing watchlist route toggles add/remove based on existence
            const res = await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id }),
            })
            if (res.status === 401) {
                // Redirect to login
                window.location.href = `/${locale}/login`
                return
            }
            const data = await res.json()
            // Existing route returns { saved: true/false } on POST
            setInWatchlist(data.saved ?? !inWatchlist)
        } catch { /* silent */ } finally {
            setWatchlistLoading(false)
        }
    }, [inWatchlist, project.id, locale])

    const toggleMute = () => {
        setMuted(prev => {
            const next = !prev
            if (videoRef.current) videoRef.current.muted = next
            return next
        })
    }

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    if (!mounted) return null

    // ── Bridge geometry: bounding box covering anchor card + preview portal ──
    // This ensures the cursor can travel between them without triggering close
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0
    const anchorTop = anchor.top + scrollY
    const anchorBottom = anchorTop + anchor.height
    const bridgeTop = Math.min(anchorTop, pos.top)
    const bridgeBottom = Math.max(anchorBottom, pos.top + CARD_H)
    const bridgeLeft = Math.min(anchor.left, pos.left)
    const bridgeRight = Math.max(anchor.left + anchor.width, pos.left + CARD_W)

    // Single bounding container with onMouseLeave — only this region catches
    // pointer events. The rest of the page scrolls normally.
    return createPortal(
        <div
            onMouseLeave={onClose}
            style={{
                position: 'absolute',
                top: `${bridgeTop}px`,
                left: `${bridgeLeft}px`,
                width: `${bridgeRight - bridgeLeft}px`,
                height: `${bridgeBottom - bridgeTop}px`,
                zIndex: 9998,
                pointerEvents: 'auto',
            }}
        >
            {/* The actual preview card — positioned relative to the bridge container */}
            <div
                ref={cardRef}
                style={{
                    position: 'absolute',
                    top: `${pos.top - bridgeTop}px`,
                    left: `${pos.left - bridgeLeft}px`,
                    width: `${CARD_W}px`,
                    zIndex: 9999,
                    borderRadius: '14px',
                    overflow: 'hidden',
                    background: 'linear-gradient(160deg, rgba(14,14,22,0.99), rgba(10,10,18,0.99))',
                    border: '1px solid rgba(212,168,83,0.2)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,168,83,0.08)',
                    transformOrigin: pos.transformOrigin,
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
                    transition: 'opacity 0.2s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1)',
                    pointerEvents: 'auto',
                }}
            >
                {/* VIDEO SECTION */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#0a0a10', overflow: 'hidden' }}>
                    {project.trailerUrl && !videoError ? (
                        <video
                            ref={videoRef}
                            src={project.trailerUrl}
                            autoPlay
                            muted={muted}
                            playsInline
                            loop
                            controlsList="nodownload nofullscreen"
                            onContextMenu={e => e.preventDefault()}
                            onError={() => setVideoError(true)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    ) : (
                        <div style={{
                            width: '100%', height: '100%',
                            backgroundImage: project.coverImage ? `url(${project.coverImage})` : undefined,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {!project.coverImage && <span style={{ fontSize: '3rem', opacity: 0.2 }}>🎬</span>}
                        </div>
                    )}

                    {/* Sound toggle */}
                    <button
                        onClick={toggleMute}
                        title={muted ? 'Unmute' : 'Mute'}
                        style={{
                            position: 'absolute', bottom: '10px', right: '10px',
                            width: '30px', height: '30px', borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff', cursor: 'pointer', fontSize: '0.75rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)' }}
                    >
                        {muted ? '🔇' : '🔊'}
                    </button>

                    {/* Bottom gradient into the card body */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                        background: 'linear-gradient(to top, rgba(10,10,18,0.99), transparent)',
                        pointerEvents: 'none',
                    }} />

                    {/* Title overlay on video */}
                    <div style={{ position: 'absolute', bottom: '10px', left: '14px', right: '50px' }}>
                        <div style={{
                            fontSize: '0.95rem', fontWeight: 800,
                            color: '#fff', lineHeight: 1.2,
                            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                        }}>
                            {loc.title}
                        </div>
                    </div>
                </div>

                {/* WATCH PROGRESS BAR */}
                {watchProgress !== null && watchProgress > 0 && (
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
                        <div style={{
                            position: 'absolute', left: 0, top: 0, height: '100%',
                            width: `${Math.min(watchProgress * 100, 100)}%`,
                            background: 'var(--accent-gold)',
                            transition: 'width 0.3s ease',
                        }} />
                    </div>
                )}

                {/* INFO + CONTROLS SECTION */}
                <div style={{ padding: '12px 14px 14px' }}>
                    {/* Action buttons row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Link
                            href={project.filmUrl ? `/works/${project.slug}#watch` : `/works/${project.slug}`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '7px 16px', borderRadius: '6px',
                                background: '#fff', color: '#000',
                                fontSize: '0.78rem', fontWeight: 800,
                                textDecoration: 'none',
                                transition: 'background 0.18s, transform 0.18s',
                                letterSpacing: '0.02em', whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#e8e8e8'; e.currentTarget.style.transform = 'scale(1.03)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)' }}
                        >
                            ▶ {project.filmUrl ? 'Watch' : project.trailerUrl ? 'Trailer' : 'Details'}
                        </Link>

                        <button
                            onClick={toggleWatchlist}
                            disabled={watchlistLoading}
                            title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                            style={{
                                width: '34px', height: '34px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.1)',
                                border: `1.5px solid ${inWatchlist ? 'var(--accent-gold)' : 'rgba(255,255,255,0.4)'}`,
                                color: inWatchlist ? 'var(--accent-gold)' : '#fff',
                                fontSize: '1rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                        >
                            {inWatchlist ? '✓' : '+'}
                        </button>

                        <Link
                            href={`/works/${project.slug}`}
                            title="More details"
                            style={{
                                marginLeft: 'auto',
                                width: '34px', height: '34px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1.5px solid rgba(255,255,255,0.4)',
                                color: '#fff', fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                textDecoration: 'none', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
                        >
                            ⌄
                        </Link>
                    </div>

                    {/* Metadata strip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {project.year && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 700 }}>
                                {project.year}
                            </span>
                        )}
                        {project.duration && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                {project.duration}
                            </span>
                        )}
                        {project.projectType === 'series' && project.episodeCount > 0 && (
                            <span style={{
                                fontSize: '0.62rem', fontWeight: 700,
                                color: 'var(--color-info)',
                                background: 'rgba(96,165,250,0.1)',
                                padding: '2px 7px', borderRadius: '4px',
                                border: '1px solid rgba(96,165,250,0.2)',
                            }}>
                                📺 {project.episodeCount} Episodes
                            </span>
                        )}
                        {watchProgress !== null && watchProgress > 0.05 && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                                {Math.round(watchProgress * 100)}% watched
                            </span>
                        )}
                    </div>

                    {/* Tagline */}
                    {loc.tagline && (
                        <p style={{
                            fontSize: '0.75rem', color: 'var(--text-secondary)',
                            lineHeight: 1.5, margin: 0, overflow: 'hidden',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                        }}>
                            {loc.tagline}
                        </p>
                    )}

                    {/* Genre tags */}
                    {loc.genre && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {loc.genre.split(/[,·/]/).slice(0, 3).map((g, i) => (
                                <span key={i} style={{
                                    fontSize: '0.62rem', fontWeight: 600,
                                    color: 'var(--text-tertiary)',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    padding: '2px 8px', borderRadius: '4px',
                                }}>
                                    {g.trim()}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
