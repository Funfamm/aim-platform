'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { useTranslations, useLocale } from 'next-intl';
import { locales, localeNames, type Locale } from '@/i18n/routing'

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const [langMenuOpen, setLangMenuOpen] = useState(false)
    const settings = useSiteSettings();
    const brandName = settings?.siteName ? (() => {
        const parts = settings.siteName.split(' ');
        return { accent: parts[0] || 'AIM', rest: parts.slice(1).join(' ') || 'Studio' };
    })() : { accent: 'AIM', rest: 'Studio' };
    const logoUrl = settings?.logoUrl ?? '';
    const sections = {
        casting: settings?.castingCallsEnabled ?? true,
        scripts: settings?.scriptCallsEnabled ?? false,
        training: settings?.trainingEnabled ?? false,
        donations: settings?.donationsEnabled ?? true,
    };
    const pathname = usePathname()
    const router = useRouter()
    const { user, loading, logout } = useAuth()
    const t = useTranslations('nav')



    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClick = () => setUserMenuOpen(false)
        if (userMenuOpen) {
            document.addEventListener('click', handleClick)
            return () => document.removeEventListener('click', handleClick)
        }
    }, [userMenuOpen])

    const links = [
        { href: '/', label: t('home') },
        { href: '/works', label: t('works') },
        { href: '/upcoming', label: t('upcoming') },
        ...(sections.casting ? [{ href: '/casting', label: t('casting') }] : []),
        ...(sections.scripts ? [{ href: '/scripts', label: t('scripts') }] : []),
        ...(sections.training ? [{ href: '/training', label: t('training') }] : []),
        ...(sections.donations ? [{ href: '/donate', label: t('donate') }] : []),
    ]

    // Get current locale from next-intl
    const currentLocale = useLocale()

    const switchLocale = (newLocale: Locale) => {
        router.replace(pathname, { locale: newLocale })
        setLangMenuOpen(false)
    }

    return (
        <>
            <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} aria-label="Main navigation">
                <div className="navbar-inner">
                    <Link href="/" className="navbar-logo">
                        {logoUrl && (
                            <img
                                src={logoUrl}
                                alt="logo"
                                style={{ height: '28px', width: 'auto', objectFit: 'contain', display: 'block' }}
                                onError={() => {}}
                            />
                        )}
                        <span className="logo-accent">{brandName.accent}</span>
                        <span>{brandName.rest}</span>
                        <span className="logo-dot"></span>
                    </Link>

                    <ul className="navbar-links">
                        {links.map((link) => (
                            <li key={link.href}>
                                <Link
                                    href={link.href}
                                    className={pathname === link.href ? 'active' : ''}
                                >
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* Desktop Search Bar */}
                    {settings?.searchBetaEnabled && (
                      <div className="navbar-desktop-only mr-4">
                        <SearchBar />
                      </div>
                    )}

                    {/* Right actions — Bell + Language hidden on mobile via CSS */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Bell — desktop only */}
                        <Link href="/subscribe" title={t('notifications')} className="navbar-desktop-only" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-secondary)', transition: 'color 0.2s',
                            textDecoration: 'none',
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </Link>
                        {/* Mobile Search Button */}
                        {settings?.searchBetaEnabled && (
                          <button
                            onClick={() => setSearchOpen(true)}
                            className="navbar-mobile-only"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontSize: '1.2rem',
                              cursor: 'pointer',
                            }}
                            aria-label="Search"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                          </button>
                        )}
                        {/* Auth — always visible (avatar on mobile, full pill on desktop) */}
                        {loading ? null : user ? (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setUserMenuOpen(!userMenuOpen)
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: 'rgba(212,168,83,0.1)',
                                        border: '1px solid rgba(212,168,83,0.2)',
                                        borderRadius: 'var(--radius-full)',
                                        padding: '0.35rem 0.9rem 0.35rem 0.5rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        color: 'var(--text-primary)',
                                    }}
                                >
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dark))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: 'var(--bg-primary)',
                                    }}>
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="navbar-desktop-only" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user.name.split(' ')[0]}</span>
                                </button>

                                {userMenuOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 8px)',
                                        insetInlineEnd: 0,
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-xs)',
                                        minWidth: '180px',
                                        maxWidth: '90vw',
                                        boxShadow: 'var(--shadow-lg)',
                                        zIndex: 100,
                                    }}>
                                        <Link href="/dashboard" style={{
                                            display: 'block', padding: '0.6rem 1rem',
                                            fontSize: '0.85rem', borderRadius: 'var(--radius-md)',
                                            transition: 'background 0.2s',
                                            color: 'var(--text-primary)',
                                        }}>
                                            {t('dashboard')}
                                        </Link>
                                        <button onClick={logout} style={{
                                            display: 'block', width: '100%', textAlign: 'left',
                                            padding: '0.6rem 1rem', fontSize: '0.85rem',
                                            borderRadius: 'var(--radius-md)', background: 'none',
                                            border: 'none', cursor: 'pointer',
                                            color: 'var(--text-tertiary)',
                                            transition: 'color 0.2s',
                                        }}>
                                            {t('signOut')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link href="/login" style={{
                                padding: '0.4rem 1.2rem',
                                background: 'var(--bg-glass-light)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: 'var(--radius-full)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                letterSpacing: '0.02em',
                            }}>
                                {t('signIn')}
                            </Link>
                        )}
                        {/* Language Switcher — desktop only */}
                        <div style={{ position: 'relative' }} className="navbar-desktop-only">
                            <button
                                onClick={(e) => { e.stopPropagation(); setLangMenuOpen(!langMenuOpen) }}
                                title={t('language')}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-secondary)', transition: 'color 0.2s',
                                    padding: '4px',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <ellipse cx="12" cy="12" rx="4" ry="10" />
                                    <path d="M2 12h20" />
                                </svg>
                            </button>
                            {langMenuOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    insetInlineEnd: 0,
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--space-xs)',
                                    minWidth: '160px',
                                    maxWidth: '90vw',
                                    maxHeight: '320px',
                                    overflowY: 'auto',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 100,
                                }}>
                                    {locales.map((loc) => (
                                        <button
                                            key={loc}
                                            onClick={() => switchLocale(loc)}
                                            style={{
                                                display: 'block', width: '100%', textAlign: 'left',
                                                padding: '0.5rem 0.8rem', fontSize: '0.82rem',
                                                borderRadius: 'var(--radius-md)', background: currentLocale === loc ? 'rgba(212,168,83,0.1)' : 'none',
                                                border: 'none', cursor: 'pointer',
                                                color: currentLocale === loc ? 'var(--accent-gold)' : 'var(--text-primary)',
                                                fontWeight: currentLocale === loc ? 600 : 400,
                                                transition: 'background 0.2s',
                                            }}
                                        >
                                            {localeNames[loc]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        className="navbar-menu-btn"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </nav>

            {/* ═══ MOBILE SIDE DRAWER ═══ */}
            {/* Backdrop overlay */}
            {mobileOpen && (
                <div
                    className="mobile-drawer-backdrop"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}
            <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
                {/* ── Profile Section ── */}
                <div className="drawer-profile">
                    {user ? (
                        <>
                            <div className="drawer-avatar-wrap">
                                <div className="drawer-avatar">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="drawer-status-dot" />
                            </div>
                            <div className="drawer-user-info">
                                <span className="drawer-user-name">{user.name}</span>
                                <span className="drawer-user-role">
                                    {user.role === 'admin' || user.role === 'superadmin' ? `👑 ${t('admin')}` : `🎬 ${t('member')}`}
                                </span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="drawer-avatar-wrap">
                                <div className="drawer-avatar" style={{ background: 'var(--bg-glass-light)' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                            </div>
                            <div className="drawer-user-info">
                                <span className="drawer-user-name">{t('guest')}</span>
                                <Link href="/login" onClick={() => setMobileOpen(false)}
                                    className="drawer-sign-in-link">
                                    {t('signIn')} →
                                </Link>
                            </div>
                        </>
                    )}
                    <button
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close menu"
                        className="drawer-close"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* ── Quick Actions — Glass Card Grid (Smart Priority) ── */}
                {(() => {
                    // Slot 1 = Home (always). Slots 2 & 3 = priority: Training/Scripts first, then Works/Casting
                    type QCard = { href: string; label: string; path: string; icon: React.ReactNode };
                    const pool: QCard[] = [];
                    if (sections.training) pool.push({
                        href: '/training', label: t('training'), path: '/training',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                    });
                    if (sections.scripts) pool.push({
                        href: '/scripts', label: t('scripts'), path: '/scripts',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    });
                    // Fill remaining slots with Works, then Casting
                    if (pool.length < 2) pool.push({
                        href: '/works', label: t('works'), path: '/works',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" /></svg>
                    });
                    if (pool.length < 2 && sections.casting) pool.push({
                        href: '/casting', label: t('casting'), path: '/casting',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                    });
                    if (pool.length < 2) pool.push({
                        href: '/upcoming', label: t('upcoming'), path: '/upcoming',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    });
                    const slots = pool.slice(0, 2);

                    return (
                        <div className="drawer-quick-actions">
                            {/* Slot 1: Home — Always */}
                            <Link href="/" onClick={() => setMobileOpen(false)}
                                className={`drawer-quick-card ${pathname === '/' ? 'active-page' : ''}`}>
                                <span className="quick-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                        <polyline points="9 22 9 12 15 12 15 22" />
                                    </svg>
                                </span>
                                <span className="quick-label">{t('home')}</span>
                            </Link>
                            {/* Slots 2 & 3: Dynamic priority */}
                            {slots.map((card) => (
                                <Link key={card.href} href={card.href} onClick={() => setMobileOpen(false)}
                                    className={`drawer-quick-card ${pathname === card.path ? 'active-page' : ''}`}>
                                    <span className="quick-icon">{card.icon}</span>
                                    <span className="quick-label">{card.label}</span>
                                </Link>
                            ))}
                        </div>
                    );
                })()}

                {/* ── Account Actions ── */}
                {user && (
                    <div className="drawer-section">
                        <Link href="/dashboard" onClick={() => setMobileOpen(false)}
                            className={`drawer-item ${pathname === '/dashboard' ? 'active-page' : ''}`}>
                            <span className="drawer-icon-badge">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                </svg>
                            </span>
                            {t('dashboard')}
                        </Link>
                    </div>
                )}

                {/* ── Discover Section ── */}
                <div className="drawer-section">
                    <span className="drawer-section-label">{t('discover')}</span>
                    <Link href="/about" onClick={() => setMobileOpen(false)}
                        className={`drawer-item ${pathname === '/about' ? 'active-page' : ''}`}>
                        <span className="drawer-icon-glow">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </span>
                        {t('about')}
                    </Link>

                    {sections.donations && (
                        <Link href="/donate" onClick={() => setMobileOpen(false)}
                            className={`drawer-item ${pathname === '/donate' ? 'active-page' : ''}`}>
                            <span className="drawer-icon-glow">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                            </span>
                            {t('donate')}
                        </Link>
                    )}

                    <Link href="/contact" onClick={() => setMobileOpen(false)}
                        className={`drawer-item ${pathname === '/contact' ? 'active-page' : ''}`}>
                        <span className="drawer-icon-glow">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                        </span>
                        {t('contact')}
                    </Link>
                    <Link href="/sponsors" onClick={() => setMobileOpen(false)}
                        className={`drawer-item ${pathname === '/sponsors' ? 'active-page' : ''}`}>
                        <span className="drawer-icon-glow">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                        </span>
                        {t('sponsors')}
                    </Link>
                    <Link href="/subscribe" onClick={() => setMobileOpen(false)}
                        className={`drawer-item ${pathname === '/subscribe' ? 'active-page' : ''}`}>
                        <span className="drawer-icon-glow" style={{ position: 'relative' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            <span className="drawer-notif-dot" />
                        </span>
                        {t('notifications')}
                    </Link>
                </div>

                {/* ── Language Switcher ── */}
                <div className="drawer-section">
                    <span className="drawer-section-label">{t('language')}</span>
                    <div className="drawer-lang-grid">
                        {locales.map((loc) => (
                            <button
                                key={loc}
                                onClick={() => { switchLocale(loc); setMobileOpen(false) }}
                                className={`drawer-lang-btn ${currentLocale === loc ? 'active' : ''}`}
                            >
                                {localeNames[loc]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Sign Out ── */}
                {user && (
                    <div className="drawer-section drawer-signout-section">
                        <button
                            onClick={() => { logout(); setMobileOpen(false) }}
                            className="drawer-item drawer-signout"
                        >
                            <span className="drawer-icon-glow">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </span>
                            {t('signOut')}
                        </button>
                    </div>
                )}

                {/* ── Branding Footer ── */}
                <div className="drawer-footer-brand">
                    <span>AIM Studio · AI Cinema</span>
                </div>
            </div>
            {/* Floating Admin Tab — visible only to admin users */}
            {user && ['admin', 'superadmin', 'ADMIN', 'SUPER_ADMIN', 'POWER_ADMIN'].includes(user.role) && (
                <a href="/admin" style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9990,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.9), rgba(139,92,246,0.9))',
                    color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '0.78rem',
                    textDecoration: 'none',
                    boxShadow: '0 4px 20px rgba(168,85,247,0.4), 0 2px 8px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    transition: 'all 0.3s ease',
                    letterSpacing: '0.02em',
                }}>
                    ⚙️ {t('adminPanel')}
                </a>
            )}
            <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
