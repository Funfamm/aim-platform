/**
 * Shared skeleton shimmer component for loading states.
 * Use in loading.tsx files across page routes.
 */

/** Animated shimmer block */
export function SkeletonBlock({ width = '100%', height = '16px', radius = '6px', style }: {
    width?: string; height?: string; radius?: string; style?: React.CSSProperties
}) {
    return (
        <div style={{
            width, height, borderRadius: radius,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeletonShimmer 1.4s ease-in-out infinite',
            ...style,
        }} />
    )
}

/** Heading skeleton (wide block) */
export function SkeletonHeading({ width = '40%' }: { width?: string }) {
    return <SkeletonBlock width={width} height="32px" radius="8px" style={{ marginBottom: '12px' }} />
}

/** Paragraph/text skeleton (multiple lines) */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
    const widths = ['100%', '90%', '75%', '85%', '60%']
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonBlock key={i} width={widths[i % widths.length]} height="14px" />
            ))}
        </div>
    )
}

/** Card skeleton */
export function SkeletonCard({ style }: { style?: React.CSSProperties }) {
    return (
        <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            ...style,
        }}>
            <SkeletonBlock width="60%" height="20px" radius="6px" style={{ marginBottom: '12px' }} />
            <SkeletonText lines={3} />
        </div>
    )
}

/** Hero banner skeleton */
export function SkeletonHero({ height = '400px' }: { height?: string }) {
    return (
        <div style={{
            width: '100%', height,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
            borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            gap: '16px', padding: '0 24px', textAlign: 'center',
        }}>
            <SkeletonBlock width="50%" height="48px" radius="10px" />
            <SkeletonBlock width="35%" height="20px" radius="6px" />
            <SkeletonBlock width="160px" height="44px" radius="22px" style={{ marginTop: '8px' }} />
        </div>
    )
}

/** Grid of skeleton cards */
export function SkeletonGrid({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '24px',
        }}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    )
}

/** Inline shimmer style — inject once into a loading.tsx */
export function SkeletonStyles() {
    return (
        <style>{`
            @keyframes skeletonShimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `}</style>
    )
}
