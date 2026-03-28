import { SkeletonBlock, SkeletonText, SkeletonStyles } from '@/components/Skeleton'

export default function DonateLoading() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <SkeletonStyles />
            {/* Hero */}
            <div style={{ padding: '80px 24px 60px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                <SkeletonBlock width="160px" height="44px" radius="8px" style={{ margin: '0 auto 12px' }} />
                <SkeletonBlock width="240px" height="14px" radius="6px" style={{ margin: '0 auto' }} />
            </div>

            <div className="container" style={{ padding: '60px 24px' }}>
                <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                    {/* Amount options */}
                    <SkeletonBlock width="120px" height="14px" radius="4px" style={{ marginBottom: '16px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonBlock key={i} width="100%" height="52px" radius="10px" />
                        ))}
                    </div>
                    {/* Form fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                        <SkeletonBlock width="100%" height="48px" radius="10px" />
                        <SkeletonBlock width="100%" height="48px" radius="10px" />
                    </div>
                    {/* Impact stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                                <SkeletonBlock width="60px" height="28px" radius="6px" style={{ margin: '0 auto 8px' }} />
                                <SkeletonText lines={2} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    )
}
