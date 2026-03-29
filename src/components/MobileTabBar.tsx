'use client'

import Link from 'next/link'
import { usePathname } from '@/i18n/navigation'
import { useSiteSettings } from '@/context/SiteSettingsContext'
import { useTranslations } from 'next-intl'

/* SVG icon components — kept inline for zero-dependency simplicity */
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
    donate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    ),
    scripts: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    ),
    training: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    ),
}

type TabItem = { href: string; label: string; icon: React.ReactNode }

export default function MobileTabBar() {
    const pathname = usePathname()
    const settings = useSiteSettings()
    const t = useTranslations('nav')

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    /* Build tabs dynamically — mirrors the Navbar logic.
       Home + Works are always present. The rest depend on admin settings.
       We cap at 5 tabs for a clean mobile UX.                             */
    const tabs: TabItem[] = [
        { href: '/', label: t('home'), icon: icons.home },
        { href: '/works', label: t('works'), icon: icons.works },
    ]

    if (settings?.castingCallsEnabled ?? true) {
        tabs.push({ href: '/casting', label: t('casting'), icon: icons.casting })
    }

    // Always show Upcoming
    tabs.push({ href: '/upcoming', label: t('upcoming'), icon: icons.upcoming })

    // Add optional sections — fill remaining slots up to 5
    if (tabs.length < 5 && (settings?.scriptCallsEnabled ?? false)) {
        tabs.push({ href: '/scripts', label: t('scripts'), icon: icons.scripts })
    }
    if (tabs.length < 5 && (settings?.trainingEnabled ?? false)) {
        tabs.push({ href: '/training', label: t('training'), icon: icons.training })
    }
    if (tabs.length < 5 && (settings?.donationsEnabled ?? true)) {
        tabs.push({ href: '/donate', label: t('donate'), icon: icons.donate })
    }

    return (
        <nav className="mobile-tab-bar" aria-label="Mobile navigation">
            {tabs.map((tab) => (
                <Link
                    key={tab.href}
                    href={tab.href}
                    className={isActive(tab.href) ? 'tab-active' : ''}
                >
                    {tab.icon}
                    <span className="tab-label">{tab.label}</span>
                </Link>
            ))}
        </nav>
    )
}
