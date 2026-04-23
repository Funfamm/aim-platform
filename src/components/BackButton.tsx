'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface BackButtonProps {
    /** Fallback href when there's no browser history (e.g. direct link / new tab) */
    fallbackHref: string
    /** 
     * Translation key from the 'navigation' namespace for the label.
     * Defaults to generic "Back". Pass a specific key like "backToWorks" for context.
     */
    labelKey?: string
    /** Optional raw label override — skips translation lookup */
    label?: string
    /** 
     * Visibility mode:
     *  - 'always'      → show on all viewports (default)
     *  - 'mobile-only' → show only on mobile (≤768px), hidden on desktop
     *  - 'immersive'   → always show (for watch pages, forms, etc.)
     */
    mode?: 'always' | 'mobile-only' | 'immersive'
    /** Visual variant */
    variant?: 'default' | 'overlay'
}

/**
 * Smart back button that uses router.back() when there's history,
 * or navigates to the fallback href for direct-link visitors.
 * 
 * Responsive: adapts size for mobile touch targets (44px min).
 * Fully localized via next-intl.
 */
export default function BackButton({
    fallbackHref,
    labelKey,
    label,
    mode = 'always',
    variant = 'default',
}: BackButtonProps) {
    const router = useRouter()
    const t = useTranslations('backButton')

    const displayLabel = label || (labelKey ? t(labelKey) : t('back'))

    const handleClick = () => {
        // Check if there's actual navigation history in this tab
        // window.history.length > 1 means user navigated here from another page
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back()
        } else {
            router.push(fallbackHref)
        }
    }

    const modeClass = mode === 'mobile-only' ? 'back-btn-mobile-only' : ''
    const variantClass = variant === 'overlay' ? 'back-btn-overlay' : 'back-btn-default'

    return (
        <button
            onClick={handleClick}
            className={`back-btn-component ${variantClass} ${modeClass}`}
            aria-label={displayLabel}
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M19 12H5" />
                <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="back-btn-label">{displayLabel}</span>
        </button>
    )
}
