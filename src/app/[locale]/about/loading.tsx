import { SkeletonBlock, SkeletonStyles, SkeletonText } from '@/components/Skeleton'

export default function AboutLoading() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <SkeletonStyles />
            {/* Hero */}
            <div style={{ padding: '80px 24px 60px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                <SkeletonBlock width="200px" height="14px" radius="6px" style={{ margin: '0 auto 16px' }} />
                <SkeletonBlock width="340px" height="44px" radius="8px" style={{ margin: '0 auto 12px' }} />
                <SkeletonBlock width="260px" height="14px" radius="6px" style={{ margin: '0 auto' }} />
            </div>

            <div className="container" style={{ padding: '60px 24px' }}>
                {/* Mission section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', marginBottom: '64px', alignItems: 'center' }}>
                    <div>
                        <SkeletonBlock width="120px" height="12px" radius="4px" style={{ marginBottom: '12px' }} />
                        <SkeletonBlock width="70%" height="32px" radius="8px" style={{ marginBottom: '16px' }} />
                        <SkeletonText lines={4} />
                    </div>
                    <SkeletonBlock width="100%" height="300px" radius="16px" />
                </div>

                {/* Team grid */}
                <SkeletonBlock width="160px" height="12px" radius="4px" style={{ margin: '0 auto 8px', display: 'block' }} />
                <SkeletonBlock width="220px" height="32px" radius="8px" style={{ margin: '0 auto 40px', display: 'block' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                            <SkeletonBlock width="80px" height="80px" radius="50%" style={{ margin: '0 auto 16px' }} />
                            <SkeletonBlock width="60%" height="16px" radius="4px" style={{ margin: '0 auto 8px' }} />
                            <SkeletonBlock width="80%" height="12px" radius="4px" style={{ margin: '0 auto' }} />
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}
