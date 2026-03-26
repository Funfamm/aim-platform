'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { useTranslations, useLocale } from 'next-intl';
import { locales, localeNames, type Locale } from '@/i18n/routing'

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
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

                    {/* Bell, Auth, Language — always visible on all devices */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Link href="/subscribe" title={t('notifications')} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-secondary)', transition: 'color 0.2s',
                            textDecoration: 'none',
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </Link>
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
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user.name.split(' ')[0]}</span>
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
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 'var(--radius-full)',
                                color: '#fff',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                letterSpacing: '0.02em',
                            }}>
                                {t('signIn')}
                            </Link>
                        )}
                        {/* Language Switcher */}
                        <div style={{ position: 'relative' }}>
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

            {/* Mobile Menu */}
            <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
                <button
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close menu"
                    style={{
                        position: 'absolute',
                        top: '1.5rem',
                        right: '1.5rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '2rem',
                        cursor: 'pointer',
                    }}
                >
                    ✕
                </button>
                {links.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                    >
                        {link.label}
                    </Link>
                ))}
                {!user && (
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                        {t('signIn')}
                    </Link>
                )}
                {user && (
                    <>
                        <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                            {t('dashboard')}
                        </Link>
                        <button
                            onClick={() => { logout(); setMobileOpen(false) }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1.2rem', cursor: 'pointer' }}
                        >
                            {t('signOut')}
                        </button>
                    </>
                )}
            </div>
            {/* Floating Admin Tab — visible only to admin users */}
            {user && ['admin', 'superadmin', 'ADMIN', 'SUPER_ADMIN', 'POWER_ADMIN'].includes(user.role) && (
                <a href="/admin" style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9990,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.9), rgba(139,92,246,0.9))',
                    color: '#fff', fontWeight: 700, fontSize: '0.78rem',
                    textDecoration: 'none',
                    boxShadow: '0 4px 20px rgba(168,85,247,0.4), 0 2px 8px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    transition: 'all 0.3s ease',
                    letterSpacing: '0.02em',
                }}>
                    ⚙️ Admin Panel
                </a>
            )}
        </>
    )
}
