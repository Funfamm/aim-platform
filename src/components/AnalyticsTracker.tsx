'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function AnalyticsTracker() {
    const pathname = usePathname()
    const lastTracked = useRef('')
    const pageStartTime = useRef<number>(Date.now())

    useEffect(() => {
        // Don't track admin pages or API routes
        if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return
        // Don't double-track the same path
        if (pathname === lastTracked.current) return

        // If navigating away from previous page, send duration for it
        if (lastTracked.current) {
            const durationMs = Date.now() - pageStartTime.current
            navigator.sendBeacon('/api/analytics/track', JSON.stringify({
                path: lastTracked.current,
                event: 'unload',
                durationMs,
            }))
        }

        lastTracked.current = pathname
        pageStartTime.current = Date.now()

        // Fire pageview tracking (non-blocking)
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

    // Send duration on tab close / hard navigation
    useEffect(() => {
        const sendDuration = () => {
            if (!lastTracked.current || lastTracked.current.startsWith('/admin')) return
            const durationMs = Date.now() - pageStartTime.current
            navigator.sendBeacon('/api/analytics/track', JSON.stringify({
                path: lastTracked.current,
                event: 'unload',
                durationMs,
            }))
        }
        window.addEventListener('beforeunload', sendDuration)
        return () => window.removeEventListener('beforeunload', sendDuration)
    }, [])

    return null // Invisible component
}
