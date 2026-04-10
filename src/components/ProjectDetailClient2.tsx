'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'

interface CastingCall {
    id: string
    roleName: string
    roleType: string
    ageRange: string | null
    gender: string | null
    translations: string | null
}

interface Episode {
    id: string
    title: string
    number: number
    season: number
    videoUrl: string | null
    duration: string | null
}

interface ProjectData {
    id: string
    title: string
    slug: string
    tagline: string
    description: string
    status: string
    projectType: string
    coverImage: string | null
    trailerUrl: string | null
    filmUrl: string | null
    genre: string | null
    year: string | null
    duration: string | null
    castingCalls: CastingCall[]
    episodes: Episode[]
    translations: string | null
}

const statusColors: Record<string, { color: string; bg: string }> = {
    completed: { color: 'var(--color-success)', bg: 'rgba(52,211,153,0.12)' },
    'in-production': { color: 'var(--accent-gold)', bg: 'rgba(212,168,83,0.12)' },
    upcoming: { color: 'var(--color-info)', bg: 'rgba(96,165,250,0.12)' },
}

const statusLabelKeys: Record<string, string> = {
    completed: 'completed',
    'in-production': 'inProduction',
    upcoming: 'comingSoon',
}

export default function ProjectDetailClient({ project }: { project: ProjectData }) {
    const t = useTranslations('projectDetail')
    const locale = useLocale()
    const trailerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isTrailerVisible, setIsTrailerVisible] = useState(false)
    const [user, setUser] = useState<{ id: string; name: string } | null>(null)
    const [checkingAuth, setCheckingAuth] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const router = useRouter()
    const colors = statusColors[project.status] || statusColors.upcoming
    const statusLabel = t(statusLabelKeys[project.status] || 'comingSoon')
    const status = { label: statusLabel, ...colors }

    // Parse translations for current locale
    const tr = (() => {
        if (locale === 'en' || !project.translations) return null
        try { return JSON.parse(project.translations)?.[locale] || null } catch { return null }
    })()
    const title = tr?.title || project.title
    const tagline = tr?.tagline || project.tagline
    const description = tr?.description || project.description
    const genre = tr?.genre || project.genre

    // Check user session + watchlist status
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.user) {
                    setUser(data.user)
                    // Check if project is in watchlist
                    fetch(`/api/watchlist?projectId=${project.id}`)
                        .then(r => r.json())
                        .then(d => { if (d?.saved) setIsSaved(true) })
                        .catch(() => { })
                }
            })
            .catch(() => { })
    }, [])

    // Handle hash scrolling on mount
    useEffect(() => {
        if (window.location.hash === '#trailer' && trailerRef.current) {
            setTimeout(() => {
                trailerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 500)
        }
    }, [])

    const scrollToTrailer = () => {
        setIsTrailerVisible(true)
        setTimeout(() => {
            trailerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            // Auto-play when scrolled to
            setTimeout(() => {
                videoRef.current?.play().catch(() => { })
            }, 600)
        }, 100)
        // Record watch history for trailer view
        if (user) {
            fetch('/api/dashboard/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, progress: 0 }),
            }).catch(() => { })
        }
    }

    const handleWatchNow = () => {
        setCheckingAuth(true)
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.user) {
                    // User is logged in, play the film
                    if (project.filmUrl) {
                        router.push(`/works/${project.slug}/watch`)
                    } else {
                        // Fallback: fullscreen the trailer
                        const vid = videoRef.current
                        if (vid) {
                            vid.play().catch(() => { })
                            if (vid.requestFullscreen) vid.requestFullscreen()
                        }
                    }
                } else {
                    // Not logged in, redirect to login
                    // Note: useRouter from @/i18n/navigation auto-prefixes locale
                    router.push(`/login?redirect=/works/${project.slug}/watch`)
                }
            })
            .catch(() => {
                router.push(`/login?redirect=/works/${project.slug}/watch`)
            })
            .finally(() => setCheckingAuth(false))
    }

    const isVideoFile = (url: string) => url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')

    return (
        <>
            {/* ═══ CINEMATIC POSTER HERO ═══ */}
            <section style={{
                position: 'relative',
                height: '85vh',
                minHeight: '550px',
                maxHeight: '800px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-end',
            }}>
                {/* Background poster */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: project.coverImage
                        ? `url(${project.coverImage})`
                        : 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center top',
                    transform: 'scale(1.05)',
                    filter: 'brightness(0.8) contrast(1.1)',
                }} />

                {/* Gradient overlays for text readability */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                        linear-gradient(180deg,
                            rgba(13,15,20,0.1) 0%,
                            rgba(13,15,20,0.0) 25%,
                            rgba(13,15,20,0.2) 55%,
                            rgba(13,15,20,0.75) 78%,
                            rgba(13,15,20,1) 100%
                        )
                    `,
                }} />
                {/* Side vignette */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(90deg, rgba(13,15,20,0.3) 0%, transparent 25%, transparent 75%, rgba(13,15,20,0.3) 100%)',
                }} />

                {/* Film grain texture */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.03,
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
                    pointerEvents: 'none',
                }} />

                {/* Content */}
                <div className="container" style={{
                    position: 'relative',
                    zIndex: 2,
                    paddingBottom: 'var(--space-3xl)',
                }}>
                    <div style={{ maxWidth: '680px' }}>
                        {/* Status badge */}
                        <div className="animate-fade-in-up" style={{ marginBottom: 'var(--space-md)' }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: status.color,
                                background: status.bg,
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-full)',
                                border: `1px solid ${status.color}33`,
                            }}>
                                <span style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: status.color,
                                }} />
                                {status.label}
                            </span>
                            {project.projectType === 'series' && (
                                <span style={{
                                    display: 'inline-flex', marginLeft: '8px',
                                    fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em',
                                    textTransform: 'uppercase',
                                    color: 'var(--color-info)',
                                    background: 'rgba(96,165,250,0.12)',
                                    padding: '4px 12px',
                                    borderRadius: 'var(--radius-full)',
                                    border: '1px solid rgba(96,165,250,0.25)',
                                }}>{t('series')}</span>
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="animate-fade-in-up delay-1" style={{
                            fontSize: 'clamp(2.4rem, 6vw, 4rem)',
                            fontWeight: 800,
                            lineHeight: 1.05,
                            marginBottom: 'var(--space-sm)',
                        }}>
                            {title}
                        </h1>

                        {/* Tagline */}
                        {tagline && (
                            <p className="animate-fade-in-up delay-1" style={{
                                fontFamily: 'var(--font-serif)',
                                fontStyle: 'italic',
                                fontSize: '1.2rem',
                                color: 'var(--text-secondary)',
                                marginBottom: 'var(--space-lg)',
                            }}>
                                {tagline}
                            </p>
                        )}

                        {/* Meta row */}
                        <div className="animate-fade-in-up delay-2" style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
                            marginBottom: 'var(--space-xl)',
                            fontSize: '0.85rem', color: 'var(--text-tertiary)',
                        }}>
                            {genre && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                    </svg>
                                    {genre}
                                </span>
                            )}
                            {project.year && <span>{project.year}</span>}
                            {project.duration && <span>{project.duration}</span>}
                            {project.projectType === 'series' && project.episodes.length > 0 && (
                                <span>{project.episodes.length} {project.episodes.length !== 1 ? t('episodes') : t('episode')}</span>
                            )}
                        </div>

                        {/* ─── Action Buttons ─── */}
                        <div className="animate-fade-in-up delay-3" style={{
                            display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)',
                        }}>
                            {project.trailerUrl && (
                                <button
                                    onClick={scrollToTrailer}
                                    className="btn btn-primary btn-lg"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <polygon points="5,3 19,12 5,21" />
                                    </svg>
                                    {t('watchTrailer')}
                                </button>
                            )}
                            {project.filmUrl && (
                                <button
                                    onClick={handleWatchNow}
                                    disabled={checkingAuth}
                                    className="btn btn-lg"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        cursor: checkingAuth ? 'wait' : 'pointer',
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))',
                                        border: '1px solid rgba(212,168,83,0.35)',
                                        color: 'var(--accent-gold)',
                                        fontWeight: 600,
                                        minWidth: '180px',
                                        opacity: checkingAuth ? 0.7 : 1,
                                        transition: 'opacity 0.2s ease',
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                                        <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
                                    </svg>
                                    {user ? t('watchFull') : t('watchNow')}
                                    {!user && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0110 0v4" />
                                        </svg>
                                    )}
                                </button>
                            )}
                            {/* Save to Watchlist */}
                            <button
                                onClick={async () => {
                                    if (!user) {
                                        router.push(`/login?redirect=/works/${project.slug}`)
                                        return
                                    }
                                    if (isSaved) {
                                        await fetch(`/api/watchlist?projectId=${project.id}`, { method: 'DELETE' })
                                        setIsSaved(false)
                                    } else {
                                        await fetch('/api/watchlist', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ projectId: project.id }),
                                        })
                                        setIsSaved(true)
                                    }
                                }}
                                className="btn btn-lg"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                    cursor: 'pointer',
                                    background: isSaved ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.06)',
                                    border: isSaved ? '1px solid rgba(212,168,83,0.3)' : '1px solid rgba(255,255,255,0.12)',
                                    color: isSaved ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                                </svg>
                                {isSaved ? t('saved') : t('save')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom decorative line */}
                <div style={{
                    position: 'absolute',
                    bottom: 0, left: '10%', right: '10%', height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.2), transparent)',
                }} />
            </section>

            {/* ═══ TRAILER SECTION ═══ */}
            {project.trailerUrl && (
                <section
                    ref={trailerRef}
                    id="trailer"
                    style={{
                        scrollMarginTop: '1rem',
                        padding: 'var(--space-3xl) 0',
                        background: 'linear-gradient(180deg, var(--bg-primary), var(--bg-secondary) 50%, var(--bg-primary))',
                    }}
                >
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em',
                                textTransform: 'uppercase', color: 'var(--accent-gold)',
                            }}>
                                {t('officialTrailer')}
                            </span>
                            <h2 style={{ marginTop: '4px', fontSize: '1.6rem' }}>
                                {title}
                            </h2>
                        </div>

                        <div style={{
                            maxWidth: '960px',
                            margin: '0 auto',
                            borderRadius: 'var(--radius-xl)',
                            overflow: 'hidden',
                            border: '1px solid var(--border-subtle)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,168,83,0.05)',
                            background: '#000',
                            position: 'relative',
                        }}>
                            {isVideoFile(project.trailerUrl) ? (
                                <video
                                    ref={videoRef}
                                    src={project.trailerUrl}
                                    controls
                                    controlsList="nodownload"
                                    onContextMenu={(e) => e.preventDefault()}
                                    poster={project.coverImage || undefined}
                                    style={{
                                        width: '100%',
                                        aspectRatio: '16/9',
                                        display: 'block',
                                        objectFit: 'contain',
                                        background: '#000',
                                    }}
                                />
                            ) : (
                                <iframe
                                    src={project.trailerUrl}
                                    style={{
                                        width: '100%',
                                        aspectRatio: '16/9',
                                        display: 'block',
                                        border: 'none',
                                    }}
                                    allowFullScreen
                                />
                            )}
                        </div>

                        <div style={{
                            textAlign: 'center', marginTop: 'var(--space-lg)',
                            fontSize: '0.75rem', color: 'var(--text-tertiary)',
                        }}>
                            {t('fullscreenTip')}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ CONTENT SECTION ═══ */}
            <section style={{ padding: 'var(--space-2xl) 0 var(--space-xl)' }}>
                <div className="container" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div className="responsive-grid-2-1" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                        {/* Main Content */}
                        <div>
                            <h2 style={{ marginBottom: 'var(--space-lg)' }}>{t('synopsis')}</h2>
                            <div className="divider" />
                            <p style={{ fontSize: '1.05rem', lineHeight: 1.8, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{description}</p>

                            {/* Episodes list for series */}
                            {project.projectType === 'series' && project.episodes.length > 0 && (
                                <div id="episodes" style={{ marginTop: 'var(--space-3xl)', scrollMarginTop: '2rem' }}>
                                    <h3 style={{ marginBottom: 'var(--space-lg)' }}>
                                        {t('episodes')}
                                        <span style={{
                                            fontSize: '0.8rem', fontWeight: 400,
                                            color: 'var(--text-tertiary)', marginLeft: '8px',
                                        }}>
                                            ({project.episodes.length})
                                        </span>
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                        {project.episodes.map((ep) => (
                                            <div key={ep.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                                padding: 'var(--space-sm) var(--space-md)',
                                                background: 'rgba(255,255,255,0.02)',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border-subtle)',
                                                transition: 'all 0.2s',
                                            }}>
                                                <span style={{
                                                    fontFamily: 'var(--font-display)',
                                                    fontSize: '1.1rem', fontWeight: 700,
                                                    color: 'var(--accent-gold)',
                                                    minWidth: '28px',
                                                }}>
                                                    {ep.number}
                                                </span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ep.title}</div>
                                                    {ep.duration && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                            S{ep.season} • {ep.duration}
                                                        </span>
                                                    )}
                                                </div>
                                                {ep.videoUrl && (
                                                    <span style={{
                                                        fontSize: '0.6rem', fontWeight: 600,
                                                        color: 'var(--color-success)',
                                                        background: 'rgba(52,211,153,0.1)',
                                                        padding: '3px 8px',
                                                        borderRadius: 'var(--radius-full)',
                                                        border: '1px solid rgba(52,211,153,0.2)',
                                                    }}>▶ {t('watch')}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div>
                            {/* Compact Project Info */}
                            <div className="glass-card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-lg)', maxWidth: '100%', boxSizing: 'border-box' }}>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)',
                                }}>
                                    {genre && (
                                        <div>
                                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '1px' }}>{t('genre')}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{genre}</div>
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '1px' }}>{t('status')}</div>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            fontSize: '0.8rem', fontWeight: 600, color: status.color,
                                        }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: status.color }} />
                                            {status.label}
                                        </span>
                                    </div>
                                    {project.year && (
                                        <div>
                                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '1px' }}>{t('year')}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{project.year}</div>
                                        </div>
                                    )}
                                    {project.duration && (
                                        <div>
                                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '1px' }}>{t('duration')}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{project.duration}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Casting Calls */}
                            {project.castingCalls.length > 0 && (
                                <div className="glass-card" style={{ padding: 'var(--space-md)', border: '1px solid var(--border-accent)', maxWidth: '100%', boxSizing: 'border-box' }}>
                                    <h4 style={{ color: 'var(--accent-gold)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
                                        🎭 {t('openCasting')}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                        {project.castingCalls.map((call) => (
                                            <div key={call.id} style={{ paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--border-subtle)' }}>
                                                <div style={{ fontWeight: 600, marginBottom: '2px', fontSize: '0.85rem' }}>{call.roleName}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-xs)' }}>
                                                    {(() => { const rk: Record<string, string> = { lead: 'roleTypeLead', supporting: 'roleTypeSupporting', extra: 'roleTypeExtra' }; return t(rk[call.roleType.toLowerCase()] || 'roleTypeLead'); })()} • {call.ageRange || t('anyAge')} • {call.gender || t('anyGender')}
                                                </div>
                                                <Link href={`/casting/${call.id}/apply`} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                                                    {t('applyNow')}
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}
