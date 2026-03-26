'use client'

import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import TiltCard3D from '@/components/TiltCard3D'

interface ProjectDetail3DProps {
    children: ReactNode
}

/* ─── Parallax Hero Background ─── */
export function ParallaxHeroBg({ imageUrl, fallback }: { imageUrl?: string | null; fallback?: string }) {
    const bgRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = bgRef.current
        if (!el) return

        let rafId: number
        const handleMouseMove = (e: MouseEvent) => {
            rafId = requestAnimationFrame(() => {
                const x = (e.clientX / window.innerWidth - 0.5) * 15
                const y = (e.clientY / window.innerHeight - 0.5) * 10
                el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.08)`
            })
        }

        window.addEventListener('mousemove', handleMouseMove)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            cancelAnimationFrame(rafId)
        }
    }, [])

    return (
        <div
            ref={bgRef}
            className="project-hero-bg"
            style={{
                backgroundImage: imageUrl
                    ? `url(${imageUrl})`
                    : fallback || 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                transition: 'transform 0.3s ease-out',
                willChange: 'transform',
            }}
        />
    )
}

/* ─── 3D Content Section ─── */
export function ContentReveal3D({ children, direction = 'up', delay = 0 }: {
    children: ReactNode
    direction?: 'up' | 'left' | 'right'
    delay?: number
}) {
    return (
        <ScrollReveal3D direction={direction} delay={delay} distance={50} rotate={6}>
            {children}
        </ScrollReveal3D>
    )
}

/* ─── 3D Sidebar Card ─── */
export function SidebarCard3D({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
    return (
        <ScrollReveal3D direction="right" delay={delay} distance={40} rotate={5}>
            <TiltCard3D intensity={8} scale={1.02} perspective={1000}>
                {children}
            </TiltCard3D>
        </ScrollReveal3D>
    )
}
