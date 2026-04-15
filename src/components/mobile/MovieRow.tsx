'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import MovieCard, { type ProjectCard } from './MovieCard'
import SkeletonMovieCard from './SkeletonMovieCard'

interface MovieRowProps {
    title: string
    icon: string
    query: Record<string, string | boolean | number>
    locale: string
    onCardHover?: (project: ProjectCard, rect: DOMRect) => void
    onCardHoverEnd?: () => void
}

const SKELETON_COUNT = 4

export default function MovieRow({ title, icon, query, locale, onCardHover, onCardHoverEnd }: MovieRowProps) {
    const [projects, setProjects] = useState<ProjectCard[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [initialLoaded, setInitialLoaded] = useState(false)
    const [error, setError] = useState(false)

    const rowRef     = useRef<HTMLDivElement>(null)
    const stripRef   = useRef<HTMLDivElement>(null)
    const hasFetched = useRef(false)
    const loadingRef = useRef(false) // ref-based guard prevents stale closure race

    // Build API URL from query params
    const buildUrl = useCallback((cursor?: string) => {
        const params = new URLSearchParams()
        Object.entries(query).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
        })
        params.set('limit', '12')
        if (cursor) params.set('cursor', cursor)
        return `/api/projects?${params.toString()}`
    }, [query])

    const fetchProjects = useCallback(async (cursor?: string) => {
        if (loadingRef.current) return
        loadingRef.current = true
        setLoading(true)
        try {
            const res = await fetch(buildUrl(cursor))
            if (!res.ok) throw new Error('fetch failed')
            const data = await res.json()
            setProjects(prev => cursor ? [...prev, ...data.projects] : data.projects)
            setNextCursor(data.nextCursor)
        } catch {
            setError(true)
        } finally {
            loadingRef.current = false
            setLoading(false)
            setInitialLoaded(true)
        }
    }, [buildUrl]) // no loading dep — loadingRef.current is always fresh

    // Trigger first fetch only when this row scrolls into viewport
    useEffect(() => {
        const el = rowRef.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasFetched.current) {
                    hasFetched.current = true
                    fetchProjects()
                }
            },
            { threshold: 0.1, rootMargin: '200px 0px' } // pre-load 200px before visible
        )
        observer.observe(el)
        return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Load more when user scrolls to 80% of the strip
    const handleScroll = useCallback(() => {
        const strip = stripRef.current
        if (!strip || !nextCursor || loadingRef.current) return
        const progress = (strip.scrollLeft + strip.clientWidth) / strip.scrollWidth
        if (progress > 0.8) fetchProjects(nextCursor)
    }, [nextCursor, fetchProjects])

    const scroll = (dir: 'left' | 'right') => {
        stripRef.current?.scrollBy({ left: dir === 'right' ? 360 : -360, behavior: 'smooth' })
    }

    // Don't render the row at all if load succeeded with 0 results
    if (initialLoaded && projects.length === 0 && !error) return null

    return (
        <div ref={rowRef} style={{ marginBottom: '28px' }}>
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
                    }}>{title}</span>
                    {loading && initialLoaded && (
                        <span style={{
                            width: '12px', height: '12px',
                            border: '2px solid rgba(212,168,83,0.3)',
                            borderTopColor: 'var(--accent-gold)',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                    )}
                </div>

                {/* Scroll arrows (desktop only — touch users swipe naturally) */}
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

            {/* Horizontal scrollable strip — className needed for ::-webkit-scrollbar selector */}
            <div
                ref={stripRef}
                className="movie-strip"
                onScroll={handleScroll}
                style={{
                    display: 'flex',
                    gap: '10px',
                    overflowX: 'auto',
                    overflowY: 'hidden',          // not visible — iOS converts visible→auto = bounce
                    paddingBottom: '6px',
                    paddingTop: '2px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollSnapType: 'x mandatory',
                    overscrollBehaviorX: 'contain',
                    touchAction: 'pan-x',
                }}
            >
                <style>{`.movie-strip::-webkit-scrollbar{display:none}`}</style>

                {/* Skeletons while loading initial batch */}
                {!initialLoaded && Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                    <div key={i} style={{ scrollSnapAlign: 'start' }}>
                        <SkeletonMovieCard />
                    </div>
                ))}

                {/* Actual project cards */}
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

                {/* Inline load-more skeleton when fetching next page */}
                {loading && initialLoaded && (
                    <div style={{ scrollSnapAlign: 'start' }}>
                        <SkeletonMovieCard />
                    </div>
                )}
            </div>

            {error && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '4px 0 0 2px' }}>
                    Could not load this row — <button onClick={() => fetchProjects()} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: 'inherit', padding: 0 }}>retry</button>
                </p>
            )}
        </div>
    )
}
