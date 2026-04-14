'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Saves scroll position to sessionStorage on unmount and restores it on mount.
 * Makes back-navigation feel native — user returns to where they were.
 *
 * Usage:
 *   useScrollRestoration('works-page')
 */
export function useScrollRestoration(key: string) {
    const pathname = usePathname()
    const storageKey = `scroll:${key}:${pathname}`
    const restored = useRef(false)

    // Restore scroll position after hydration
    useEffect(() => {
        if (restored.current) return
        restored.current = true

        const saved = sessionStorage.getItem(storageKey)
        if (saved) {
            const y = parseInt(saved, 10)
            // Use a small timeout so content-visibility:auto sections finish
            // measuring before we attempt to scroll. rAF alone is too early
            // when sections are off-screen and deferred by the browser engine.
            setTimeout(() => {
                window.scrollTo({ top: y, behavior: 'instant' })
            }, 150)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Save scroll position before unmount
    useEffect(() => {
        const handleBeforeUnload = () => {
            sessionStorage.setItem(storageKey, String(window.scrollY))
        }

        // Also save on route change start (Next.js SPA navigation)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                sessionStorage.setItem(storageKey, String(window.scrollY))
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            // Save on unmount (triggered by Next.js navigation)
            sessionStorage.setItem(storageKey, String(window.scrollY))
            window.removeEventListener('beforeunload', handleBeforeUnload)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey])
}
