'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const MIN_WIDTH = 180
const MAX_WIDTH = 380
const DEFAULT_WIDTH = 260

const NAV_ITEMS = [
    { href: '/admin/analytics', label: '📊 Analytics' },
    { href: '/admin/projects', label: '🎬 Projects' },
    { href: '/admin/casting', label: '🎭 Casting' },
    { href: '/admin/events', label: '📡 Live Events' },
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
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        // Lazy initialiser runs only on the client — safe for SSR because
        // the server renders the DEFAULT_WIDTH and hydration corrects it.
        if (typeof window === 'undefined') return DEFAULT_WIDTH
        const isTablet = window.innerWidth <= 1024
        const defaultForViewport = (window.innerWidth <= 768) ? DEFAULT_WIDTH : isTablet ? 200 : DEFAULT_WIDTH
        const saved = parseInt(localStorage.getItem('adminSidebarWidth') || '', 10)
        return (saved >= MIN_WIDTH && saved <= MAX_WIDTH) ? saved : defaultForViewport
    })
    const isResizing = useRef(false)
    const startX = useRef(0)
    const startW = useRef(DEFAULT_WIDTH)

    // Apply initial CSS variable on mount without triggering an extra render
    useEffect(() => {
        if (typeof window === 'undefined' || window.innerWidth <= 768) return
        document.documentElement.style.setProperty('--sidebar-w', `${sidebarWidth}px`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Keep CSS variable in sync during drag
    useEffect(() => {
        if (typeof window === 'undefined' || window.innerWidth <= 768) return
        document.documentElement.style.setProperty('--sidebar-w', `${sidebarWidth}px`)
    }, [sidebarWidth])

    const startResize = useCallback((e: React.PointerEvent) => {
        if (window.innerWidth <= 768) return
        e.preventDefault()
        isResizing.current = true
        startX.current = e.clientX
        startW.current = sidebarWidth
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

        const onMove = (ev: PointerEvent) => {
            if (!isResizing.current) return
            const delta = ev.clientX - startX.current
            const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta))
            setSidebarWidth(newW)
        }
        const onUp = () => {
            if (!isResizing.current) return
            isResizing.current = false
            setSidebarWidth(w => {
                localStorage.setItem('adminSidebarWidth', String(w))
                return w
            })
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
    }, [sidebarWidth])

    // Rec 3: Clean up CSS variable when viewport drops to mobile
    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth <= 768) {
                document.documentElement.style.removeProperty('--sidebar-w')
            }
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

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

            <aside
                className={`admin-sidebar${open ? ' open' : ''}`}
            >
                <div className="admin-sidebar-logo">
                    {/* Hamburger on the LEFT on mobile */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }} className="admin-sidebar-subtitle">
                            Admin Panel
                        </div>
                        <Link href="/" prefetch={false} style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, textDecoration: 'none', color: 'inherit' }}>
                            <span style={{ color: 'var(--accent-gold)' }}>AIM</span> Studio
                        </Link>
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
                    <li style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)' }}>
                        <Link href="/" prefetch={false} style={{ color: 'var(--text-tertiary)' }}>← Back to Site</Link>
                    </li>
                </ul>

                {/* ── Resize handle — desktop only ── */}
                <div
                    className="admin-sidebar-resize-handle"
                    onPointerDown={startResize}
                    title="Drag to resize sidebar"
                    aria-hidden="true"
                    style={{ touchAction: 'none' }}
                />
            </aside>
        </>
    )
}
