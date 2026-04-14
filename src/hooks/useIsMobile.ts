'use client'

import { useState, useEffect } from 'react'

/**
 * Detect mobile viewport (< 768px).
 * Uses matchMedia for efficient, debounce-free resize listening.
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        const mq = window.matchMedia('(max-width: 767px)')
        mq.addEventListener('change', check)
        return () => mq.removeEventListener('change', check)
    }, [])
    return isMobile
}
