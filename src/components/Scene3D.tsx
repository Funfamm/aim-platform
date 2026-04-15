'use client'

import { useEffect, useRef } from 'react'

interface Particle {
    x: number
    y: number
    z: number
    size: number
    speed: number
    opacity: number
    hue: number
}

/**
 * Scene3D — Ambient particle background.
 *
 * PERF: On mobile devices the 60-fps canvas + radial-gradient draws +
 * O(n²) connection-line checks generate significant CPU/GPU heat.
 * → Mobile: skip rendering entirely (the page already has hero videos
 *   or CinematicBackground for ambience).
 * → Desktop: throttle to ~30 fps and reduce particle count.
 */
export default function Scene3D() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const particlesRef = useRef<Particle[]>([])
    const rafRef = useRef<number>(0)

    useEffect(() => {
        // ── Skip on mobile / tablet (≤1024px) to save battery ──
        if (window.innerWidth <= 1024) return

        // ── Also skip if user prefers reduced motion ──
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resize()
        window.addEventListener('resize', resize)

        // Reduced particle count (was 60)
        const count = 35
        particlesRef.current = Array.from({ length: count }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            z: Math.random() * 3 + 0.5,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 0.3 + 0.1,
            opacity: Math.random() * 0.4 + 0.1,
            hue: 38 + Math.random() * 10,
        }))

        // Throttle to ~30 fps (was uncapped ~60 fps)
        let lastFrame = 0
        const FRAME_INTERVAL = 33 // ms ≈ 30 fps

        const animate = (now: number) => {
            if (!ctx || !canvas) return

            // Skip frame if too soon
            if (now - lastFrame < FRAME_INTERVAL) {
                rafRef.current = requestAnimationFrame(animate)
                return
            }
            lastFrame = now

            ctx.clearRect(0, 0, canvas.width, canvas.height)

            for (const p of particlesRef.current) {
                // Slow upward drift
                p.y -= p.speed
                if (p.y < -10) {
                    p.y = canvas.height + 10
                    p.x = Math.random() * canvas.width
                }

                const drawX = p.x
                const drawY = p.y
                const drawSize = p.size * (1 + p.z * 0.3)

                // Soft glow circle
                ctx.beginPath()
                const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, drawSize * 4)
                gradient.addColorStop(0, `hsla(${p.hue}, 60%, 70%, ${p.opacity})`)
                gradient.addColorStop(0.4, `hsla(${p.hue}, 60%, 60%, ${p.opacity * 0.4})`)
                gradient.addColorStop(1, `hsla(${p.hue}, 60%, 50%, 0)`)
                ctx.fillStyle = gradient
                ctx.arc(drawX, drawY, drawSize * 4, 0, Math.PI * 2)
                ctx.fill()

                // Core dot
                ctx.beginPath()
                ctx.fillStyle = `hsla(${p.hue}, 70%, 80%, ${p.opacity * 1.5})`
                ctx.arc(drawX, drawY, drawSize * 0.6, 0, Math.PI * 2)
                ctx.fill()
            }

            // Draw subtle connection lines between nearby particles
            for (let i = 0; i < particlesRef.current.length; i++) {
                for (let j = i + 1; j < particlesRef.current.length; j++) {
                    const a = particlesRef.current[i]
                    const b = particlesRef.current[j]
                    const dist = Math.hypot(a.x - b.x, a.y - b.y)

                    if (dist < 120) {
                        const lineOpacity = (1 - dist / 120) * 0.08
                        ctx.beginPath()
                        ctx.strokeStyle = `hsla(38, 60%, 65%, ${lineOpacity})`
                        ctx.lineWidth = 0.5
                        ctx.moveTo(a.x, a.y)
                        ctx.lineTo(b.x, b.y)
                        ctx.stroke()
                    }
                }
            }

            rafRef.current = requestAnimationFrame(animate)
        }

        rafRef.current = requestAnimationFrame(animate)

        return () => {
            cancelAnimationFrame(rafRef.current)
            window.removeEventListener('resize', resize)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="scene-3d-canvas"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
                opacity: 0.6,
            }}
        />
    )
}
