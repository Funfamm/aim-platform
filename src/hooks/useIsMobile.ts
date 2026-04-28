'use client'

import { useState, useEffect } from 'react'

/**
 * Detect mobile viewport.
 * On real touch devices (phones/tablets), uses the SHORTER dimension so
 * landscape still counts as mobile — prevents desktop effects from mounting.
 * On desktop browsers, uses innerWidth so a narrow window stays desktop.
 *
 * Touch-enabled laptops (e.g. 13" HP, 1366×768) falsely triggered mobile
 * because browser chrome reduces innerHeight below 768. We now also check
 * screen.width — if the physical screen is ≥1024px wide, it's a laptop
 * with a touchscreen, not a phone/tablet.
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => {
            const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

            // Touch-enabled laptops: screen.width ≥ 1024 means it's a laptop
            // with a touchscreen, not a phone/tablet — treat as desktop.
            if (isTouch && typeof screen !== 'undefined' && screen.width >= 1024) {
                setIsMobile(false)
                return
            }

            const measure = isTouch
                ? Math.min(window.innerWidth, window.innerHeight)
                : window.innerWidth
            setIsMobile(measure < 768)
        }
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])
    return isMobile
}
