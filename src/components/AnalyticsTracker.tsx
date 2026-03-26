'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function AnalyticsTracker() {
    const pathname = usePathname()
    const lastTracked = useRef('')

    useEffect(() => {
        // Don't track admin pages or API routes
        if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return
        // Don't double-track the same path
        if (pathname === lastTracked.current) return
        lastTracked.current = pathname

        // Fire tracking call (non-blocking)
        fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: pathname,
                referrer: document.referrer || null,
            }),
        }).catch(() => {
            // Silent fail — analytics should never break the UX
        })
    }, [pathname])

    return null // Invisible component
}
