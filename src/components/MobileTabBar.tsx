'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useSiteSettings } from '@/context/SiteSettingsContext'
import { useTranslations, useLocale } from 'next-intl'

/* ── SVG icon components ── */
const icons = {
    home: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    works: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="7" x2="7" y2="7" />
            <line x1="2" y1="17" x2="7" y2="17" />
            <line x1="17" y1="7" x2="22" y2="7" />
            <line x1="17" y1="17" x2="22" y2="17" />
        </svg>
    ),
    casting: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
    ),
    upcoming: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    training: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    ),
    scripts: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
    ),
    search: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    ),
    close: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
}

type TabItem = { href: string; label: string; icon: React.ReactNode }
type SearchMode = 'idle' | 'search-bar' | 'search-focused'
type SearchResult = {
    category: string
    icon: string
    title: string
    subtitle: string
    href: string
}

/* ── Custom debounce hook ── */
function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debounced
}

export default function MobileTabBar() {
    const pathname = usePathname()
    const router = useRouter()
    const settings = useSiteSettings()
    const t = useTranslations('nav')
    const tSearch = useTranslations('search')
    const locale = useLocale()

    const [collapsed, setCollapsed] = useState(false)
    const [searchMode, setSearchMode] = useState<SearchMode>('idle')
    const [searchQuery, setSearchQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const [focusedIndex, setFocusedIndex] = useState(-1)

    const lastScrollY = useRef(0)
    const scrollThreshold = 60
    const searchInputRef = useRef<HTMLInputElement>(null)
    const barRef = useRef<HTMLDivElement>(null)
    const suggestionsRef = useRef<HTMLDivElement>(null)

    const debouncedQuery = useDebounce(searchQuery, 300)

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    const castingEnabled = settings?.castingCallsEnabled ?? false
    const trainingEnabled = settings?.trainingEnabled ?? false
    const scriptsEnabled = settings?.scriptCallsEnabled ?? false

    /* ── Build the 4 main tabs ────────────────────────────────────────────────── */
    const tabs: TabItem[] = [
        { href: '/', label: t('home'), icon: icons.home },
        { href: '/works', label: t('works'), icon: icons.works },
        { href: '/upcoming', label: t('upcoming'), icon: icons.upcoming },
    ]

    // Extra tabs: all enabled sections, in priority order, capped at 2 slots (5 tabs total)
    const extraPool: TabItem[] = []
    if (castingEnabled)  extraPool.push({ href: '/casting',  label: t('casting'),  icon: icons.casting  })
    if (scriptsEnabled)  extraPool.push({ href: '/scripts',  label: t('scripts'),  icon: icons.scripts  })
    if (trainingEnabled) extraPool.push({ href: '/training', label: t('training'), icon: icons.training })
    extraPool.slice(0, 1).forEach(tab => tabs.push(tab))

    /* ── Scroll collapse/expand logic (only in idle mode) ── */
    const handleScroll = useCallback(() => {
        if (searchMode !== 'idle') return // Don't collapse during search
        const currentY = window.scrollY

        if (currentY <= scrollThreshold) {
            setCollapsed(false)
        } else if (currentY > lastScrollY.current + 8) {
            setCollapsed(true)
        } else if (currentY < lastScrollY.current - 8) {
            setCollapsed(false)
        }

        lastScrollY.current = currentY
    }, [searchMode])

    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [handleScroll])

    /* ── Home icon tap toggles collapsed state ── */
    const handleHomeTap = (e: React.MouseEvent) => {
        if (collapsed) {
            e.preventDefault()
            setCollapsed(false)
        }
    }

    /* ═══ SEARCH STATE MACHINE ═══ */

    // Phase 1: Tap search pill → morph to search bar
    const openSearchBar = () => {
        setCollapsed(true) // collapse tabs behind Home
        setSearchMode('search-bar')
        // Focus input after animation
        setTimeout(() => {
            searchInputRef.current?.focus()
        }, 100)
    }

    // Phase 2: Tap input → full-width focused mode
    const focusSearch = () => {
        setSearchMode('search-focused')
    }

    // Cancel: reverse everything
    const cancelSearch = () => {
        setSearchMode('idle')
        setSearchQuery('')
        setResults([])
        setFocusedIndex(-1)
        setLoading(false)
        // Let scroll position dictate collapse state
        if (window.scrollY <= scrollThreshold) {
            setCollapsed(false)
        }
    }

    // Navigate to result
    const selectResult = (href: string) => {
        cancelSearch()
        router.push(href)
    }

    /* ── Fetch suggestions ── */
    useEffect(() => {
        if (debouncedQuery.length < 2) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setResults([])
            setLoading(false)
            return
        }

        setLoading(true)
        const controller = new AbortController()

        fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&locale=${locale}`, {
            signal: controller.signal,
        })
            .then(r => r.json())
            .then(data => {
                setResults(data.results || [])
                setLoading(false)
                setFocusedIndex(-1)
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    setLoading(false)
                }
            })

        return () => controller.abort()
    }, [debouncedQuery, locale])

    /* ── Keyboard navigation ── */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            cancelSearch()
            return
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setFocusedIndex(prev => Math.min(prev + 1, results.length - 1))
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            setFocusedIndex(prev => Math.max(prev - 1, -1))
        }
        if (e.key === 'Enter' && focusedIndex >= 0 && results[focusedIndex]) {
            e.preventDefault()
            selectResult(results[focusedIndex].href)
        }
    }

    /* ── Keyboard-aware positioning ── */
    useEffect(() => {
        if (searchMode !== 'search-focused') return
        const vv = window.visualViewport
        if (!vv) return

        const onResize = () => {
            const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop
            if (barRef.current && keyboardHeight > 50) {
                barRef.current.style.bottom = `${keyboardHeight + 8}px`
            } else if (barRef.current) {
                barRef.current.style.bottom = '12px'
            }
        }

        vv.addEventListener('resize', onResize)
        vv.addEventListener('scroll', onResize)
        onResize() // initial position
        return () => {
            vv.removeEventListener('resize', onResize)
            vv.removeEventListener('scroll', onResize)
        }
    }, [searchMode])

    /* ── Close search on Escape (global) ── */
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && searchMode !== 'idle') cancelSearch()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [searchMode])

    /* ── Scroll focused suggestion into view ── */
    useEffect(() => {
        if (focusedIndex >= 0 && suggestionsRef.current) {
            const items = suggestionsRef.current.querySelectorAll('.search-suggestion-item')
            items[focusedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
    }, [focusedIndex])

    /* ── Group results by category ── */
    const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
        if (!acc[r.category]) acc[r.category] = []
        acc[r.category].push(r)
        return acc
    }, {})

    /* ═══ RENDER ═══ */
    const isSearchActive = searchMode !== 'idle'

    // Build CSS class for the bar
    const barClasses = [
        'mobile-tab-bar',
        collapsed ? 'collapsed' : '',
        searchMode === 'search-bar' ? 'search-mode' : '',
        searchMode === 'search-focused' ? 'search-mode search-focused-mode' : '',
    ].filter(Boolean).join(' ')

    return (
        <>
            {/* ── Suggestion panel (above the bar) ── */}
            {isSearchActive && searchMode === 'search-focused' && (
                <div className="search-suggestions-backdrop" onClick={cancelSearch}>
                    <div
                        ref={suggestionsRef}
                        className="search-suggestions-panel"
                        onClick={(e) => e.stopPropagation()}
                        role="listbox"
                        aria-label={tSearch('suggestions')}
                    >
                        {/* Loading skeletons */}
                        {loading && (
                            <div className="search-suggestions-loading">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="search-suggestion-skeleton" style={{ animationDelay: `${i * 0.1}s` }}>
                                        <div className="skeleton-icon" />
                                        <div className="skeleton-text">
                                            <div className="skeleton-title" />
                                            <div className="skeleton-subtitle" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Results */}
                        {!loading && results.length > 0 && (
                            <div className="search-suggestions-results">
                                {Object.entries(groupedResults).map(([category, items]) => (
                                    <div key={category} className="search-suggestion-group">
                                        <div className="search-suggestion-group-header">
                                            <span>{items[0].icon}</span>
                                            <span>{category}</span>
                                        </div>
                                        {items.map((item, idx) => {
                                            const globalIdx = results.indexOf(item)
                                            return (
                                                <button
                                                    key={`${item.href}-${idx}`}
                                                    className={`search-suggestion-item ${globalIdx === focusedIndex ? 'focused' : ''}`}
                                                    onClick={() => selectResult(item.href)}
                                                    role="option"
                                                    aria-selected={globalIdx === focusedIndex}
                                                >
                                                    <span className="suggestion-icon">{item.icon}</span>
                                                    <div className="suggestion-content">
                                                        <span className="suggestion-title">{item.title}</span>
                                                        <span className="suggestion-subtitle">{item.subtitle}</span>
                                                    </div>
                                                    <svg className="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="9 18 15 12 9 6" />
                                                    </svg>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty state */}
                        {!loading && results.length === 0 && debouncedQuery.length >= 2 && (
                            <div className="search-empty-state">
                                <div className="search-empty-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        <line x1="8" y1="11" x2="14" y2="11" />
                                    </svg>
                                </div>
                                <p className="search-empty-title">{tSearch('noResults', { query: debouncedQuery })}</p>
                                <p className="search-empty-subtitle">{tSearch('tryDifferent')}</p>
                                <div className="search-empty-links">
                                    <button onClick={() => selectResult('/works')} className="search-empty-link">🎬 {t('works')}</button>
                                    {castingEnabled && <button onClick={() => selectResult('/casting')} className="search-empty-link">🎭 {t('casting')}</button>}
                                    <button onClick={() => selectResult('/about')} className="search-empty-link">📄 {tSearch('about')}</button>
                                </div>
                            </div>
                        )}

                        {/* Quick access (when input empty) */}
                        {!loading && debouncedQuery.length < 2 && (
                            <div className="search-quick-access">
                                <div className="search-suggestion-group-header">
                                    <span>⚡</span>
                                    <span>{tSearch('quickAccess')}</span>
                                </div>
                                <button className="search-suggestion-item" onClick={() => selectResult('/works')}>
                                    <span className="suggestion-icon">🎬</span>
                                    <div className="suggestion-content">
                                        <span className="suggestion-title">{t('works')}</span>
                                        <span className="suggestion-subtitle">{tSearch('browseAll')}</span>
                                    </div>
                                    <svg className="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                </button>
                                <button className="search-suggestion-item" onClick={() => selectResult('/upcoming')}>
                                    <span className="suggestion-icon">⏳</span>
                                    <div className="suggestion-content">
                                        <span className="suggestion-title">{t('upcoming')}</span>
                                        <span className="suggestion-subtitle">{tSearch('comingSoon')}</span>
                                    </div>
                                    <svg className="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                </button>
                                {castingEnabled && (
                                    <button className="search-suggestion-item" onClick={() => selectResult('/casting')}>
                                        <span className="suggestion-icon">🎭</span>
                                        <div className="suggestion-content">
                                            <span className="suggestion-title">{t('casting')}</span>
                                            <span className="suggestion-subtitle">{tSearch('openRoles')}</span>
                                        </div>
                                        <svg className="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                    </button>
                                )}
                                {scriptsEnabled && (
                                    <button className="search-suggestion-item" onClick={() => selectResult('/scripts')}>
                                        <span className="suggestion-icon">✍️</span>
                                        <div className="suggestion-content">
                                            <span className="suggestion-title">{t('scripts')}</span>
                                            <span className="suggestion-subtitle">{tSearch('submitScript')}</span>
                                        </div>
                                        <svg className="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                    </button>
                                )}
                                {trainingEnabled && (
                                    <button className="search-suggestion-item" onClick={() => selectResult('/training')}>
                                        <span className="suggestion-icon">📚</span>
                                        <div className="suggestion-content">
                                            <span className="suggestion-title">{t('training')}</span>
                                            <span className="suggestion-subtitle">{tSearch('learnSkills')}</span>
                                        </div>
                                        <svg className="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                    </button>
                                )}
                                <button className="search-suggestion-item" onClick={() => selectResult('/donate')}>
                                    <span className="suggestion-icon">❤️</span>
                                    <div className="suggestion-content">
                                        <span className="suggestion-title">{t('donate')}</span>
                                        <span className="suggestion-subtitle">{tSearch('supportUs')}</span>
                                    </div>
                                    <svg className="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                </button>
                                <button className="search-suggestion-item" onClick={() => selectResult('/about')}>
                                    <span className="suggestion-icon">ℹ️</span>
                                    <div className="suggestion-content">
                                        <span className="suggestion-title">{tSearch('about')}</span>
                                        <span className="suggestion-subtitle">{tSearch('ourStory')}</span>
                                    </div>
                                    <svg className="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab Bar ── */}
            <nav ref={barRef} className={barClasses} aria-label="Mobile navigation" role="search">
                {/* Main nav pill */}
                <div className={`tab-pill tab-pill-nav ${isSearchActive ? 'search-active' : ''}`}>
                    {tabs.map((tab, index) => (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            prefetch={false}
                            className={`tab-item ${isActive(tab.href) ? 'tab-active' : ''} ${index === 0 ? 'tab-home' : 'tab-collapsible'}`}
                            onClick={index === 0 ? handleHomeTap : undefined}
                        >
                            <span className="tab-icon-wrap">{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                        </Link>
                    ))}
                </div>

                {/* Search pill / Search bar */}
                {searchMode === 'idle' ? (
                    <button
                        className="tab-pill tab-pill-search"
                        onClick={openSearchBar}
                        aria-label={tSearch('searchButton')}
                    >
                        <span className="tab-icon-wrap">{icons.search}</span>
                    </button>
                ) : (
                    <div className={`tab-pill tab-search-bar ${searchMode === 'search-focused' ? 'full-width' : ''}`}>
                        <div className="search-bar-inner">
                            <span className="search-bar-icon">{icons.search}</span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="search-bar-input"
                                placeholder={tSearch('placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={focusSearch}
                                onKeyDown={handleKeyDown}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                                aria-label={tSearch('placeholder')}
                                aria-controls="search-suggestions"
                                aria-activedescendant={focusedIndex >= 0 ? `suggestion-${focusedIndex}` : undefined}
                            />
                            {loading && (
                                <span className="search-bar-spinner" />
                            )}
                            <button
                                className="search-bar-cancel"
                                onClick={cancelSearch}
                                aria-label={tSearch('cancel')}
                            >
                                {icons.close}
                            </button>
                        </div>
                    </div>
                )}
            </nav>
        </>
    )
}
