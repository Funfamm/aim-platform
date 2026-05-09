'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

type Stage = 'idle' | 'exit' | 'enter'

const DURATION_EXIT  = 120  // ms — old page fades out
const DURATION_ENTER = 220  // ms — new page fades in

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isMobile = useIsMobile()

    const [displayChildren, setDisplayChildren] = useState(children)
    const [stage, setStage] = useState<Stage>('idle')

    const prevPathname = useRef(pathname)
    const prevIdx      = useRef<number>(
        typeof window !== 'undefined' ? (window.history.state?.idx ?? 0) : 0
    )
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Track whether the mobile check has ever resolved to true.
    // This ref prevents the animation from firing before useIsMobile's
    // useEffect has run — avoiding the hydration race that caused the
    // client-side crash on mobile login navigation.
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

        // Track history index (for future use)
        const currentIdx = window.history.state?.idx ?? prevIdx.current + 1
        prevIdx.current = currentIdx

        // If we haven't confirmed we're on mobile yet (e.g. first render,
        // or desktop), do an instant swap — no animation, no timers.
        if (!isMobileResolvedRef.current) {
            prevPathname.current = pathname
            setDisplayChildren(children)
            return
        }

        // Auth-related redirects (login, register, verify, forgot-password)
        // should feel instant — no crossfade, just swap.
        const authRoutes = ['/login', '/register', '/verify-email', '/forgot-password']
        const isAuthTransition = authRoutes.some(r => pathname.includes(r) || prevPathname.current.includes(r))
        if (isAuthTransition) {
            prevPathname.current = pathname
            setDisplayChildren(children)
            return
        }

        // ── OPACITY-ONLY crossfade ──────────────────────────────────────
        // IMPORTANT: We must NOT use CSS `transform` during page transitions.
        // Any transform (even translateX(0)) creates a new containing block,
        // which reparents all position:fixed children (hero backgrounds,
        // video overlays, gradient layers) from the viewport into this div.
        // On the homepage especially, this causes the fixed background to
        // "jump" with the slide animation — the glitch the user sees.
        // Opacity-only crossfade avoids this entirely while still feeling
        // smooth and intentional.
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
        if (!isMobile) return {};

        // When idle — neutral wrapper, no transform, position:fixed works normally.
        if (stage === 'idle') return {
            opacity: 1,
        };

        if (stage === 'exit') return {
            opacity: 0,
            transition: `opacity ${DURATION_EXIT}ms ease-in`,
        }

        // enter — fade in
        return {
            opacity: 1,
            transition: `opacity ${DURATION_ENTER}ms ease-out`,
        }
    }

    // ALWAYS render the same <div> element — never swap to a fragment.
    // Changing the root element type during a concurrent state update causes
    // React to throw a client-side exception on mobile devices.
    return (
        <div style={{ minHeight: '100dvh', ...getStyle() }}>
            {displayChildren}
        </div>
    );
}
