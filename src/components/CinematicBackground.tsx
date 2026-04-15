'use client'

/**
 * CinematicBackground — A CSS-only ambient background for pages that
 * don't have admin-uploaded Page Media. Provides a premium, cinematic feel
 * with animated gradients and optional film grain.
 *
 * PERF: On mobile, animations are disabled (static gradients only).
 * Each animated fixed-position div creates a compositing layer — with 3
 * running simultaneously + film grain texture, this causes significant
 * GPU heat on mobile devices.
 *
 * Variants:
 *  - "auth"       → Warm gold + deep blue, evokes studio entrance
 *  - "dashboard"  → Subtle cool gradient, professional & clean
 *  - "creative"   → Deep purple + gold, for scripts/creative pages
 *  - "casting"    → Amber + dramatic dark, audition energy
 *  - "showcase"   → Gold accents on dark, for sponsors/works
 */

interface Props {
    variant?: 'auth' | 'dashboard' | 'creative' | 'casting' | 'showcase'
}

const VARIANTS = {
    auth: {
        gradient1: 'radial-gradient(ellipse at 20% 20%, rgba(212,168,83,0.12) 0%, transparent 55%)',
        gradient2: 'radial-gradient(ellipse at 80% 80%, rgba(59,130,246,0.08) 0%, transparent 50%)',
        gradient3: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 60%)',
        accent: 'rgba(212,168,83,0.04)',
    },
    dashboard: {
        gradient1: 'radial-gradient(ellipse at 30% 10%, rgba(59,130,246,0.06) 0%, transparent 50%)',
        gradient2: 'radial-gradient(ellipse at 70% 90%, rgba(16,185,129,0.05) 0%, transparent 50%)',
        gradient3: 'radial-gradient(ellipse at 50% 50%, rgba(212,168,83,0.03) 0%, transparent 60%)',
        accent: 'rgba(59,130,246,0.02)',
    },
    creative: {
        gradient1: 'radial-gradient(ellipse at 25% 15%, rgba(139,92,246,0.10) 0%, transparent 55%)',
        gradient2: 'radial-gradient(ellipse at 75% 85%, rgba(212,168,83,0.08) 0%, transparent 50%)',
        gradient3: 'radial-gradient(ellipse at 50% 50%, rgba(236,72,153,0.04) 0%, transparent 60%)',
        accent: 'rgba(139,92,246,0.03)',
    },
    casting: {
        gradient1: 'radial-gradient(ellipse at 40% 0%, rgba(245,158,11,0.10) 0%, transparent 55%)',
        gradient2: 'radial-gradient(ellipse at 60% 100%, rgba(212,168,83,0.06) 0%, transparent 50%)',
        gradient3: 'radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.03) 0%, transparent 60%)',
        accent: 'rgba(245,158,11,0.02)',
    },
    showcase: {
        gradient1: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.08) 0%, transparent 55%)',
        gradient2: 'radial-gradient(ellipse at 20% 80%, rgba(59,130,246,0.05) 0%, transparent 50%)',
        gradient3: 'radial-gradient(ellipse at 80% 50%, rgba(139,92,246,0.04) 0%, transparent 60%)',
        accent: 'rgba(212,168,83,0.02)',
    },
}

export default function CinematicBackground({ variant = 'auth' }: Props) {
    const v = VARIANTS[variant]

    return (
        <>
            {/* 
                PERF: On mobile, all 3 gradient layers are collapsed into a single
                static composite div to avoid 3 GPU compositing layers + animation.
                Desktop still gets the drift animations.
            */}

            {/* Mobile: single static composite gradient (1 layer instead of 3) */}
            <div className="cinematic-bg-mobile" style={{
                position: 'fixed', inset: 0, zIndex: 0,
                background: `${v.gradient1}, ${v.gradient2}, ${v.gradient3}`,
                pointerEvents: 'none',
            }} />

            {/* Desktop: separate animated layers */}
            <div className="cinematic-bg-desktop" style={{
                position: 'fixed', inset: 0, zIndex: 0,
                background: v.gradient1,
                animation: 'cinematicDrift1 20s ease-in-out infinite alternate',
                pointerEvents: 'none',
            }} />
            <div className="cinematic-bg-desktop" style={{
                position: 'fixed', inset: 0, zIndex: 0,
                background: v.gradient2,
                animation: 'cinematicDrift2 25s ease-in-out infinite alternate',
                pointerEvents: 'none',
            }} />
            <div className="cinematic-bg-desktop" style={{
                position: 'fixed', inset: 0, zIndex: 0,
                background: v.gradient3,
                animation: 'cinematicPulse 15s ease-in-out infinite alternate',
                pointerEvents: 'none',
            }} />

            {/* Film grain — desktop only (creates compositing layer) */}
            <div className="cinematic-bg-desktop" style={{
                position: 'fixed', inset: 0, zIndex: 0,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
                opacity: 0.5,
                pointerEvents: 'none',
            }} />

            {/* Bottom vignette for depth — static, cheap on both */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 0,
                background: 'linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(10,10,16,0.4) 100%)',
                pointerEvents: 'none',
            }} />

            <style jsx>{`
                @keyframes cinematicDrift1 {
                    0% { transform: scale(1) translate(0, 0); }
                    100% { transform: scale(1.1) translate(3%, 2%); }
                }
                @keyframes cinematicDrift2 {
                    0% { transform: scale(1.1) translate(2%, -1%); }
                    100% { transform: scale(1) translate(-2%, 1%); }
                }
                @keyframes cinematicPulse {
                    0% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                /* Mobile: show composite, hide animated layers */
                @media (max-width: 768px) {
                    .cinematic-bg-desktop { display: none !important; }
                    .cinematic-bg-mobile  { display: block !important; }
                }
                /* Desktop: show animated layers, hide composite */
                @media (min-width: 769px) {
                    .cinematic-bg-desktop { display: block; }
                    .cinematic-bg-mobile  { display: none !important; }
                }
                /* Respect user preference */
                @media (prefers-reduced-motion: reduce) {
                    .cinematic-bg-desktop { animation: none !important; }
                }
            `}</style>
        </>
    )
}
