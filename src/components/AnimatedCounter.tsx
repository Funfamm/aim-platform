'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
    end: number
    duration?: number
    prefix?: string
    suffix?: string
    label: string
}

export default function AnimatedCounter({ end, duration = 2000, prefix = '', suffix = '', label }: AnimatedCounterProps) {
    const [count, setCount] = useState(0)
    const [hasAnimated, setHasAnimated] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated) {
                    setHasAnimated(true)
                    const startTime = performance.now()
                    const animate = (currentTime: number) => {
                        const elapsed = currentTime - startTime
                        const progress = Math.min(elapsed / duration, 1)
                        // Ease-out cubic
                        const eased = 1 - Math.pow(1 - progress, 3)
                        setCount(Math.floor(eased * end))
                        if (progress < 1) requestAnimationFrame(animate)
                    }
                    requestAnimationFrame(animate)
                    observer.unobserve(el)
                }
            },
            { threshold: 0.3 }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [end, duration, hasAnimated])

    return (
        <div ref={ref} style={{ textAlign: 'center' }}>
            <div style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 800,
                background: 'linear-gradient(135deg, var(--accent-gold) 0%, #f5d799 50%, var(--accent-gold) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.1,
                marginBottom: '0.5rem',
            }}>
                {prefix}{count}{suffix}
            </div>
            <div style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
                color: 'var(--text-tertiary)',
            }}>
                {label}
            </div>
        </div>
    )
}
