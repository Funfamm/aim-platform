'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [displayChildren, setDisplayChildren] = useState(children)
    const prevPathname = useRef(pathname)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (pathname === prevPathname.current) {
            setDisplayChildren(children)
            return
        }

        // Path changed: swap content immediately, no animation
        if (timerRef.current) clearTimeout(timerRef.current)
        prevPathname.current = pathname
        setDisplayChildren(children)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [pathname, children])

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {displayChildren}
        </div>
    )
}
