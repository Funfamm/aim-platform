'use client'

import { useRef, useCallback, type ReactNode, type CSSProperties } from 'react'

interface TiltCard3DProps {
    children: ReactNode
    className?: string
    style?: CSSProperties
    href?: string
    intensity?: number       // tilt strength in degrees (default 12)
    glare?: boolean          // show glare highlight
    scale?: number           // hover scale (default 1.04)
    perspective?: number     // perspective distance (default 800)
}

export default function TiltCard3D({
    children,
    className = '',
    style,
    href,
    intensity = 12,
    glare = true,
    scale = 1.04,
    perspective = 800,
}: TiltCard3DProps) {
    const cardRef = useRef<HTMLDivElement>(null)
    const glareRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number | null>(null)

    const targetRef = useRef({ x: 0, y: 0 })
    const currentRef = useRef({ x: 0, y: 0 })
    const animatingRef = useRef(false)

    const targetScaleRef = useRef(1)
    const currentScaleRef = useRef(1)

    // Smooth animation loop — lerp toward target rotation
    const animate = useCallback(() => {
        const card = cardRef.current
        if (!card) return

        const lerp = 0.08 // smoothing factor — lower = smoother
        currentRef.current.x += (targetRef.current.x - currentRef.current.x) * lerp
        currentRef.current.y += (targetRef.current.y - currentRef.current.y) * lerp
        currentScaleRef.current += (targetScaleRef.current - currentScaleRef.current) * lerp

        const s = currentScaleRef.current
        card.style.transform = `perspective(${perspective}px) rotateX(${currentRef.current.x}deg) rotateY(${currentRef.current.y}deg) scale3d(${s}, ${s}, ${s})`

        // Keep animating if still far from target
        const dx = Math.abs(targetRef.current.x - currentRef.current.x)
        const dy = Math.abs(targetRef.current.y - currentRef.current.y)
        const ds = Math.abs(targetScaleRef.current - currentScaleRef.current)
        if (dx > 0.01 || dy > 0.01 || ds > 0.001) {
            rafRef.current = requestAnimationFrame(animate)
        } else {
            animatingRef.current = false
        }
    }, [perspective])

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const card = cardRef.current
        if (!card) return

        const rect = card.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const centerX = rect.width / 2
        const centerY = rect.height / 2

        targetRef.current.x = ((y - centerY) / centerY) * -intensity
        targetRef.current.y = ((x - centerX) / centerX) * intensity
        targetScaleRef.current = scale

        if (glareRef.current) {
            const glareX = (x / rect.width) * 100
            const glareY = (y / rect.height) * 100
            glareRef.current.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(212,168,83,0.15) 0%, transparent 60%)`
            glareRef.current.style.opacity = '1'
        }

        if (!animatingRef.current) {
            animatingRef.current = true
            rafRef.current = requestAnimationFrame(animate)
        }
    }, [intensity, scale, animate])

    const handleMouseLeave = useCallback(() => {
        targetRef.current = { x: 0, y: 0 }
        targetScaleRef.current = 1

        if (glareRef.current) {
            glareRef.current.style.opacity = '0'
        }

        // Start smooth return animation if not already animating
        if (!animatingRef.current) {
            animatingRef.current = true
            rafRef.current = requestAnimationFrame(animate)
        }
    }, [animate])

    return (
        <div
            className="tilt-card-wrapper"
            style={{ perspective: `${perspective}px` }}
        >
            <div
                ref={cardRef}
                className={`tilt-card-3d ${className}`}
                style={{
                    ...style,
                    transition: 'transform 0.4s cubic-bezier(0.03, 0.98, 0.52, 0.99)',
                    willChange: 'transform',
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {children}

                {/* 3D depth shadow */}
                <div className="tilt-card-shadow" style={{ pointerEvents: 'none' }} />

                {/* Glare overlay */}
                {glare && (
                    <div
                        ref={glareRef}
                        className="tilt-card-glare"
                        style={{ pointerEvents: 'none' }}
                    />
                )}

                {/* Edge light effect */}
                <div className="tilt-card-edge-light" style={{ pointerEvents: 'none' }} />
            </div>
        </div>
    )
}
