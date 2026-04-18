'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

type Stage = 'idle' | 'exit' | 'enter'
type Direction = 'forward' | 'back'

const DURATION_EXIT  = 100  // ms — old page exits
const DURATION_ENTER = 280  // ms — new page enters (iOS-feel spring)
const EASING_ENTER   = 'cubic-bezier(0.22, 1, 0.36, 1)' // iOS standard spring

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isMobile = useIsMobile()

    const [displayChildren, setDisplayChildren] = useState(children)
    const [stage,     setStage]     = useState<Stage>('idle')
    const [direction, setDirection] = useState<Direction>('forward')

    const prevPathname = useRef(pathname)
    const prevIdx      = useRef<number>(
        typeof window !== 'undefined' ? (window.history.state?.idx ?? 0) : 0
    )
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Track whether the mobile check has ever resolved to true.
    // This ref prevents the animation from firing before useIsMobile's
    // useEffect has run — avoiding the hydration race that caused the
    // client-side crash on mobilev login navigation.
    const isMobileResolvedRef = useRef(false)
    useEffect(() => {
        if (isMobile) isMobileResolvedRef.current = true
    }, [isMobile])

    const clearTimer = useCallback(() => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }, [])

    useEffect(() => {
        if (pathname === prevPathname.current) {
            setDisplayChildren(children)
            return
        }

        // Detect direction via history idx (populated by Next.js App Router)
        const currentIdx = window.history.state?.idx ?? prevIdx.current + 1
        const dir: Direction = currentIdx >= prevIdx.current ? 'forward' : 'back'
        prevIdx.current = currentIdx

        // If we haven't confirmed we're on mobile yet (e.g. first render,
        // or desktop), do an instant swap — no animation, no timers.
        if (!isMobileResolvedRef.current) {
            prevPathname.current = pathname
            setDisplayChildren(children)
            return
        }

        // Mobile confirmed: slide exit → enter
        setDirection(dir)
        setStage('exit')
        clearTimer()

        timerRef.current = setTimeout(() => {
            prevPathname.current = pathname
            setDisplayChildren(children)
            setStage('enter')

            timerRef.current = setTimeout(() => {
                setStage('idle')
            }, DURATION_ENTER)
        }, DURATION_EXIT)

        return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, children])

    const getStyle = (): React.CSSProperties => {
        // Desktop / pre-hydration: passthrough wrapper — no transforms, no cost.
        // IMPORTANT: we still render the same <div> here (never a fragment) to
        // keep the DOM structure identical across all states and avoid React
        // reconciliation errors when isMobile flips simultaneously with a
        // pathname change (the root cause of the mobile login crash).
        if (!isMobile) return {}

        if (stage === 'idle') return {
            transform: 'translateX(0)',
            opacity: 1,
            willChange: 'auto',
        }
        if (stage === 'exit') return {
            transform: direction === 'forward' ? 'translateX(-8px)' : 'translateX(8px)',
            opacity: 0,
            transition: `transform ${DURATION_EXIT}ms ease-in, opacity ${DURATION_EXIT}ms ease-in`,
            willChange: 'transform, opacity',
        }
        // enter — @keyframes slideInRight/slideInLeft defined in globals.css
        return {
            transform: 'translateX(0)',
            opacity: 1,
            transition: `transform ${DURATION_ENTER}ms ${EASING_ENTER}, opacity ${DURATION_ENTER}ms ${EASING_ENTER}`,
            willChange: 'transform, opacity',
            animation: `${direction === 'forward' ? 'slideInRight' : 'slideInLeft'} ${DURATION_ENTER}ms ${EASING_ENTER} both`,
        }
    }

    // ALWAYS render the same <div> element — never swap to a fragment.
    // Changing the root element type during a concurrent state update causes
    // React to throw a client-side exception on mobile devices.
    return (
        <div style={{ minHeight: '100dvh', overflow: 'hidden', ...getStyle() }}>
            {displayChildren}
        </div>
    )
}
