import { SkeletonBlock, SkeletonText, SkeletonStyles } from '@/components/Skeleton'

export default function TrainingLoading() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <SkeletonStyles />
            {/* Hero */}
            <div style={{ padding: '80px 24px 60px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                <SkeletonBlock width="260px" height="44px" radius="8px" style={{ margin: '0 auto 12px' }} />
                <SkeletonBlock width="200px" height="14px" radius="6px" style={{ margin: '0 auto 24px' }} />
                <SkeletonBlock width="160px" height="44px" radius="22px" style={{ margin: '0 auto' }} />
            </div>

            <div className="container" style={{ padding: '60px 24px' }}>
                {/* Course cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                            <SkeletonBlock width="100%" height="180px" radius="0" />
                            <div style={{ padding: '20px' }}>
                                <SkeletonBlock width="80px" height="20px" radius="10px" style={{ marginBottom: '12px' }} />
                                <SkeletonBlock width="70%" height="18px" radius="4px" style={{ marginBottom: '10px' }} />
                                <SkeletonText lines={2} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                                    <SkeletonBlock width="60px" height="20px" radius="4px" />
                                    <SkeletonBlock width="80px" height="32px" radius="8px" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}
