'use client'

import { useState, useEffect } from 'react'

/**
 * Detect mobile viewport.
 * On real touch devices (phones/tablets), uses the SHORTER dimension so
 * landscape still counts as mobile — prevents desktop effects from mounting.
 * On desktop browsers, uses innerWidth so a narrow window stays desktop.
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => {
            const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
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
