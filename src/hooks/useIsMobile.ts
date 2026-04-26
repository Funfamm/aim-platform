'use client'

import { useState, useEffect } from 'react'

/**
 * Detect mobile viewport.
 * Uses the SHORTER dimension (min of width/height) so landscape on a phone
 * still counts as mobile — prevents desktop effects from mounting in landscape
 * and breaking when the user rotates back to portrait.
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => {
            const short = Math.min(window.innerWidth, window.innerHeight)
            setIsMobile(short < 768)
        }
        check()
        // Listen for both resize and orientation change
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])
    return isMobile
}
