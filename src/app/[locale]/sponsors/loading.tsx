import { SkeletonBlock, SkeletonStyles } from '@/components/Skeleton'

export default function SponsorsLoading() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <SkeletonStyles />
            {/* Hero */}
            <div style={{ padding: '80px 24px 60px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                <SkeletonBlock width="300px" height="44px" radius="8px" style={{ margin: '0 auto 12px' }} />
                <SkeletonBlock width="220px" height="14px" radius="6px" style={{ margin: '0 auto' }} />
            </div>

            <div className="container" style={{ padding: '60px 24px' }}>
                {/* Featured sponsors row */}
                <SkeletonBlock width="160px" height="12px" radius="4px" style={{ margin: '0 auto 32px', display: 'block' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} style={{ padding: '32px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                            <SkeletonBlock width="120px" height="60px" radius="8px" style={{ margin: '0 auto 20px' }} />
                            <SkeletonBlock width="60%" height="16px" radius="4px" style={{ margin: '0 auto 8px' }} />
                            <SkeletonBlock width="80%" height="12px" radius="4px" style={{ margin: '0 auto' }} />
                        </div>
                    ))}
                </div>

                {/* Other sponsors grid */}
                <SkeletonBlock width="120px" height="12px" radius="4px" style={{ margin: '0 auto 24px', display: 'block' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                            <SkeletonBlock width="80px" height="40px" radius="6px" style={{ margin: '0 auto' }} />
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}
