import { SkeletonStyles } from '@/components/Skeleton'

// Generic fallback loading — used for any [locale]/... route without its own loading.tsx
export default function LocaleLoading() {
    return (
        <main style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
        }}>
            <SkeletonStyles />
            {/* Page-level shimmer skeleton — a simple full-width layout placeholder */}
            <div style={{ padding: '80px 24px 60px', textAlign: 'center' }}>
                <div style={{
                    width: '260px', height: '40px',
                    borderRadius: '8px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'skeletonShimmer 1.4s ease-in-out infinite',
                    margin: '0 auto 16px',
                }} />
                <div style={{
                    width: '180px', height: '16px',
                    borderRadius: '6px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'skeletonShimmer 1.4s ease-in-out infinite 0.1s',
                    margin: '0 auto',
                }} />
            </div>

            <div className="container" style={{ padding: '0 24px 60px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '24px',
                            animationDelay: `${i * 0.05}s`,
                        }}>
                            <div style={{ width: '60%', height: '18px', borderRadius: '4px', marginBottom: '12px', background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.4s ease-in-out infinite' }} />
                            {[100, 90, 75].map((w, j) => (
                                <div key={j} style={{ width: `${w}%`, height: '12px', borderRadius: '4px', marginBottom: '8px', background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: `skeletonShimmer 1.4s ease-in-out infinite ${0.1 * j}s` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}
