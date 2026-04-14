'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'

interface SearchResult {
    id: string
    title: string
    slug: string
    genre: string | null
    status: string
    year: string | null
    coverImage: string | null
    viewCount: number
    translations: string | null
    highlight: { start: number; end: number } | null
}

export default function SearchBar() {
    const locale = useLocale()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)

    const inputRef     = useRef<HTMLInputElement>(null)
    const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
    const cacheRef     = useRef<Map<string, SearchResult[]>>(new Map())
    const containerRef = useRef<HTMLDivElement>(null)

    const search = useCallback(async (q: string) => {
        if (q.length < 2) { setResults([]); return }

        // Serve from session cache if available
        const cached = cacheRef.current.get(q)
        if (cached) { setResults(cached); return }

        setLoading(true)
        try {
            const res = await fetch(`/api/projects/search?q=${encodeURIComponent(q)}&locale=${locale}&limit=6`)
            if (!res.ok) return
            const data = await res.json()
            cacheRef.current.set(q, data.results)
            setResults(data.results)
        } catch { /* silent */ } finally {
            setLoading(false)
        }
    }, [locale])

    // Debounce input: 220ms
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (query.trim().length < 2) { setResults([]); setOpen(false); return }
        debounceRef.current = setTimeout(() => {
            search(query.trim())
            setOpen(true)
            setActiveIndex(-1)
        }, 220)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [query, search])

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open || results.length === 0) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex(i => Math.min(i + 1, results.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex(i => Math.max(i - 1, -1))
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault()
            window.location.href = `/works/${results[activeIndex].slug}`
        } else if (e.key === 'Escape') {
            setOpen(false)
            inputRef.current?.blur()
        }
    }

    // Render highlighted title
    const renderTitle = (result: SearchResult) => {
        const loc = getLocalizedProject(result, locale)
        if (!result.highlight) return <span>{loc.title}</span>
        const { start, end } = result.highlight
        const title = loc.title
        return (
            <span>
                {title.slice(0, start)}
                <mark style={{ background: 'rgba(212,168,83,0.3)', color: 'var(--accent-gold)', borderRadius: '2px', padding: '0 1px' }}>
                    {title.slice(start, end)}
                </mark>
                {title.slice(end)}
            </span>
        )
    }

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: '16px' }}>
            {/* Input */}
            <div style={{ position: 'relative' }}>
                <svg
                    style={{
                        position: 'absolute', left: '12px', top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-tertiary)', pointerEvents: 'none',
                    }}
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (results.length > 0) setOpen(true) }}
                    placeholder="Search films, genres…"
                    aria-label="Search films"
                    aria-expanded={open}
                    aria-autocomplete="list"
                    style={{
                        width: '100%',
                        padding: '10px 36px 10px 38px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(8px)',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        transition: 'border-color 0.2s, background 0.2s',
                        boxSizing: 'border-box',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,168,83,0.3)' }}
                    onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
                {loading && (
                    <div style={{
                        position: 'absolute', right: '12px', top: '50%',
                        transform: 'translateY(-50%)',
                        width: '14px', height: '14px',
                        border: '2px solid rgba(212,168,83,0.2)',
                        borderTopColor: 'var(--accent-gold)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                )}
                {query && !loading && (
                    <button
                        onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus() }}
                        style={{
                            position: 'absolute', right: '10px', top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none', border: 'none',
                            color: 'var(--text-tertiary)', cursor: 'pointer',
                            fontSize: '1rem', lineHeight: 1, padding: '2px',
                        }}
                        aria-label="Clear search"
                    >×</button>
                )}
            </div>

            {/* Dropdown results */}
            {open && results.length > 0 && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                    background: 'rgba(12,12,20,0.97)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(212,168,83,0.15)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    zIndex: 200,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    animation: 'fadeInDown 0.15s ease',
                }}>
                    <style>{`@keyframes fadeInDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                    {results.map((result, i) => {
                        const loc = getLocalizedProject(result, locale)
                        const isActive = i === activeIndex
                        return (
                            <a
                                key={result.id}
                                href={`/works/${result.slug}`}
                                onClick={() => {
                                    fetch('/api/projects/view', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ projectId: result.id, source: 'search', locale }),
                                    }).catch(() => {})
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 14px',
                                    textDecoration: 'none', color: 'inherit',
                                    background: isActive ? 'rgba(212,168,83,0.08)' : 'transparent',
                                    borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.08)'; setActiveIndex(i) }}
                                onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(212,168,83,0.08)' : 'transparent' }}
                            >
                                {/* Poster thumbnail */}
                                <div style={{
                                    width: '42px', height: '28px',
                                    borderRadius: '5px', overflow: 'hidden', flexShrink: 0,
                                    background: 'rgba(255,255,255,0.05)',
                                }}>
                                    {result.coverImage && (
                                        <img
                                            src={result.coverImage}
                                            alt=""
                                            loading="lazy"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}
                                </div>

                                {/* Title + meta */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '0.82rem', fontWeight: 600,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        color: '#fff',
                                    }}>
                                        {renderTitle(result)}
                                    </div>
                                    <div style={{
                                        fontSize: '0.62rem', color: 'var(--text-tertiary)',
                                        marginTop: '1px',
                                    }}>
                                        {loc.genre}{result.year ? ` · ${result.year}` : ''}
                                    </div>
                                </div>

                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </a>
                        )
                    })}

                    {/* Escape hatch: "See all results" */}
                    <a
                        href={`/works?q=${encodeURIComponent(query)}`}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '5px', padding: '10px',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: 'var(--accent-gold)', textDecoration: 'none',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,168,83,0.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                        See all results for &ldquo;{query}&rdquo; →
                    </a>
                </div>
            )}
        </div>
    )
}
