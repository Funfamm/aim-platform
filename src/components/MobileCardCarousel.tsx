'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface MobileCardCarouselProps {
    children: React.ReactNode[]
    /** Milliseconds between auto-advances. 0 = disabled. */
    autoRotateMs?: number
}

/**
 * Generic mobile horizontal snap-scroll carousel.
 * Fills its positioned parent (position: absolute, inset: 0).
 * Each child is rendered in a full-width, full-height snap slot.
 * Auto-rotation pauses for 8 s when the user interacts.
 * No external library — pure CSS scroll-snap + minimal state.
 */
export default function MobileCardCarousel({ children, autoRotateMs = 5000 }: MobileCardCarouselProps) {
    const stripRef = useRef<HTMLDivElement>(null)
    const [activeIdx, setActiveIdx] = useState(0)
    const isPausedRef = useRef(false)
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const count = children.length

    // Derive active index from scroll position
    const handleScroll = useCallback(() => {
        const strip = stripRef.current
        if (!strip || !strip.clientWidth) return
        const idx = Math.round(strip.scrollLeft / strip.clientWidth)
        setActiveIdx(Math.min(Math.max(idx, 0), count - 1))
    }, [count])

    // Auto-rotate: advance one slide at the interval unless user is interacting
    useEffect(() => {
        if (!autoRotateMs || count <= 1) return
        const interval = setInterval(() => {
            if (isPausedRef.current) return
            const strip = stripRef.current
            if (!strip) return
            const current = Math.round(strip.scrollLeft / strip.clientWidth)
            const next = (current + 1) % count
            // Wrap last→first: use instant scroll so the user doesn't see
            // a fast rewind across all slides. Normal advances use smooth.
            const behavior = next === 0 ? 'instant' : 'smooth'
            strip.scrollTo({ left: next * strip.clientWidth, behavior: behavior as ScrollBehavior })
        }, autoRotateMs)
        return () => clearInterval(interval)
    }, [autoRotateMs, count])

    // Pause auto-rotation when user touches/clicks the strip
    const pauseRotation = useCallback(() => {
        isPausedRef.current = true
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
        pauseTimerRef.current = setTimeout(() => { isPausedRef.current = false }, 3000)
    }, [])

    // Jump to a specific slide (dot click)
    const goTo = useCallback((idx: number) => {
        const strip = stripRef.current
        if (!strip) return
        strip.scrollTo({ left: idx * strip.clientWidth, behavior: 'smooth' })
        pauseRotation()
    }, [pauseRotation])

    useEffect(() => () => {
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    }, [])

    if (count === 0) return null

    return (
        <div style={{ position: 'absolute', inset: 0 }}>
            {/* Scrollable strip */}
            <div
                ref={stripRef}
                className="mcc-strip"
                onScroll={handleScroll}
                onPointerDown={pauseRotation}
                onTouchStart={pauseRotation}
                style={{
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    scrollSnapType: 'x mandatory',
                    overscrollBehaviorX: 'contain',
                    touchAction: 'pan-x pan-y',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}
            >
                {/* Hide scrollbar in WebKit */}
                <style>{`.mcc-strip::-webkit-scrollbar{display:none}`}</style>

                {children.map((child, i) => (
                    <div
                        key={i}
                        style={{
                            flexShrink: 0,
                            width: '100%',
                            height: '100%',
                            scrollSnapAlign: 'start',
                            position: 'relative',
                        }}
                    >
                        {child}
                    </div>
                ))}
            </div>

            {/* Dot indicators */}
            {count > 1 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '5px',
                        zIndex: 10,
                    }}
                >
                    {Array.from({ length: count }, (_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            aria-label={`Slide ${i + 1}`}
                            style={{
                                width: activeIdx === i ? '22px' : '6px',
                                height: '6px',
                                borderRadius: '99px',
                                border: 'none',
                                padding: 0,
                                background: activeIdx === i
                                    ? 'var(--accent-gold)'
                                    : 'rgba(255,255,255,0.38)',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
