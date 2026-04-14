'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
    { href: '/admin/analytics', label: '📊 Analytics' },
    { href: '/admin/projects', label: '🎬 Projects' },
    { href: '/admin/casting', label: '🎭 Casting' },
    { href: '/admin/applications', label: '📋 Applications' },
    { href: '/admin/scripts', label: '✍️ Scripts' },
    { href: '/admin/training', label: '🎓 Training' },
    { href: '/admin/media', label: '🖼️ Media' },
    { href: '/admin/sponsors', label: '🤝 Sponsors' },
    { href: '/admin/donations', label: '💰 Donations' },
    { href: '/admin/users', label: '👥 Users' },
    { href: '/admin/announcements', label: '📣 Announcements' },
    { href: '/admin/settings', label: '⚙️ Settings' },
]

export default function AdminSidebar() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    // Close nav when route changes (user tapped a link on mobile)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setOpen(false) }, [pathname])

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            const sidebar = document.querySelector('.admin-sidebar')
            if (sidebar && !sidebar.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // Close on ESC key
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open])

    // Lock body scroll while drawer is open on mobile
    useEffect(() => {
        const isMobile = window.innerWidth <= 768
        if (!isMobile) return
        document.body.style.overflow = open ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [open])


    return (
        <>
            {/* Backdrop overlay — dims main content while drawer is open on mobile */}
            {open && (
                <div
                    aria-hidden="true"
                    onClick={() => setOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 199,
                        background: 'rgba(0,0,0,0.52)',
                        backdropFilter: 'blur(2px)',
                        WebkitBackdropFilter: 'blur(2px)',
                        animation: 'fadeIn 0.18s ease',
                    }}
                />
            )}

            <aside className={`admin-sidebar${open ? ' open' : ''}`}>
                <div className="admin-sidebar-logo">
                    <Link href="/" prefetch={false} style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, textDecoration: 'none', color: 'inherit' }}>
                        <span style={{ color: 'var(--accent-gold)' }}>AIM</span> Studio
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }} className="admin-sidebar-subtitle">
                            Admin Panel
                        </div>
                        {/* Hamburger / X toggle — animates between states */}
                        <button
                            className={`admin-hamburger${open ? ' is-open' : ''}`}
                            onClick={() => setOpen(o => !o)}
                            aria-label={open ? 'Close menu' : 'Open menu'}
                            aria-expanded={open}
                        >
                            <span />
                            <span />
                            <span />
                        </button>
                    </div>
                </div>

                <ul className="admin-sidebar-nav">
                    {NAV_ITEMS.map(item => (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                prefetch={false}
                                className={pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}
                            >
                                {item.label}
                            </Link>
                        </li>
                    ))}
                    <li style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', gridColumn: '1 / -1' }}>
                        <Link href="/" prefetch={false} style={{ color: 'var(--text-tertiary)' }}>← Back to Site</Link>
                    </li>
                </ul>
            </aside>
        </>
    )
}
