'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [displayChildren, setDisplayChildren] = useState(children)
    const [stage, setStage] = useState<'in' | 'out'>('in')
    const prevPathname = useRef(pathname)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (pathname === prevPathname.current) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDisplayChildren(children)
            return
        }

        // Path changed: start fade-out
        setStage('out')
        if (timerRef.current) clearTimeout(timerRef.current)

        timerRef.current = setTimeout(() => {
            // After fade-out, swap content and fade in
            prevPathname.current = pathname
            setDisplayChildren(children)
            setStage('in')
        }, 80) // short 80ms fade-out

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [pathname, children])

    return (
        <div
            style={{
                opacity: stage === 'out' ? 0 : 1,
                transition: stage === 'out' ? 'opacity 80ms ease-out' : 'opacity 200ms ease-in',
                minHeight: '100vh',
                background: 'var(--bg-primary)',
            }}
        >
            {displayChildren}
        </div>
    )
}
