'use client'

import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'

interface ScrollReveal3DProps {
    children: ReactNode
    className?: string
    style?: CSSProperties
    direction?: 'up' | 'left' | 'right'
    delay?: number            // ms delay
    distance?: number         // px travel
    rotate?: number           // initial X rotation degrees
}

export default function ScrollReveal3D({
    children,
    className = '',
    style,
    direction = 'up',
    delay = 0,
    distance = 60,
    rotate = 8,
}: ScrollReveal3DProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.style.willChange = 'opacity, transform'
                    setTimeout(() => {
                        el.style.opacity = '1'
                        el.style.transform = 'none'
                        // Clear willChange after the 0.8s transition so the GPU
                        // layer is released and VRAM is freed.
                        setTimeout(() => { el.style.willChange = 'auto' }, 900)
                    }, delay)
                    observer.unobserve(el)
                }
            },
            { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [delay])

    const getInitialTransform = () => {
        switch (direction) {
            case 'left':
                return `perspective(800px) translateX(-${distance}px) rotateY(${rotate}deg)`
            case 'right':
                return `perspective(800px) translateX(${distance}px) rotateY(-${rotate}deg)`
            case 'up':
            default:
                return `perspective(800px) translateY(${distance}px) rotateX(-${rotate}deg)`
        }
    }

    return (
        <div
            ref={ref}
            className={`scroll-reveal-3d ${className}`}
            style={{
                ...style,
                opacity: 0,
                transform: getInitialTransform(),
                transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
            }}
        >
            {children}
        </div>
    )
}
