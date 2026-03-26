'use client'

import { useState, useEffect } from 'react'

export default function AboutBackground({ bgUrls }: { bgUrls: string[] }) {
    const [currentBg, setCurrentBg] = useState(0)

    useEffect(() => {
        if (bgUrls.length <= 1) return
        const timer = setInterval(() => setCurrentBg(p => (p + 1) % bgUrls.length), 6000)
        return () => clearInterval(timer)
    }, [bgUrls])

    if (bgUrls.length === 0) {
        // Fallback: subtle radial gradient when no backgrounds are uploaded
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 0,
                background: 'radial-gradient(ellipse at 50% 30%, rgba(212,168,83,0.06), transparent 70%)',
                pointerEvents: 'none',
            }} />
        )
    }

    return (
        <>
            {bgUrls.map((src, i) => (
                <div key={src} style={{
                    position: 'fixed', inset: 0, zIndex: 0,
                    backgroundImage: `url(${src})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: 'brightness(0.6) saturate(0.85)',
                    opacity: currentBg === i ? 1 : 0,
                    transition: 'opacity 1.5s ease-in-out',
                }} />
            ))}
            {/* Dark overlay for text readability */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 1,
                background: 'linear-gradient(to bottom, rgba(13,15,20,0.3) 0%, rgba(13,15,20,0.6) 50%, rgba(13,15,20,0.85) 100%)',
                pointerEvents: 'none',
            }} />
        </>
    )
}
