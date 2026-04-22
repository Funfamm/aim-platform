'use client'

import { useEffect } from 'react'

/**
 * OrientationFix
 *
 * Chrome and Edge on Android cache the vw/viewport width value from the
 * landscape orientation and sometimes fail to re-flow elements when the
 * device returns to portrait. This component forces a single-frame CSS
 * repaint on the <html> element whenever the visual viewport is resized
 * (which always fires on orientation change), giving the browser a kick
 * to re-evaluate all media queries and vw-based sizes correctly.
 *
 * Implementation:
 * - Uses visualViewport.resize (more reliable than window.resize for
 *   orientation change on mobile Chrome/Edge).
 * - Applies a no-op CSS property toggle on <html> for one rAF frame,
 *   which forces the browser to re-composite without any visual flash.
 * - Cleans up the listener on unmount (SSR-safe guard included).
 */
export default function OrientationFix() {
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!window.visualViewport) return

        let rafId: number

        const forceRepaint = () => {
            // Cancel any pending frame from a previous rapid resize
            cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                const html = document.documentElement
                // Toggle a harmless CSS property for one frame to force
                // the browser to invalidate its layout and re-check media queries
                html.style.setProperty('--_orientation-fix', '1')
                requestAnimationFrame(() => {
                    html.style.removeProperty('--_orientation-fix')
                })
            })
        }

        window.visualViewport.addEventListener('resize', forceRepaint)
        return () => {
            cancelAnimationFrame(rafId)
            window.visualViewport?.removeEventListener('resize', forceRepaint)
        }
    }, [])

    // Renders nothing — purely a side-effect component
    return null
}
