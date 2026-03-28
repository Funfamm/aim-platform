import { SkeletonBlock, SkeletonStyles } from '@/components/Skeleton'

export default function ContactLoading() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <SkeletonStyles />
            {/* Hero */}
            <div style={{ padding: '80px 24px 60px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                <SkeletonBlock width="120px" height="12px" radius="4px" style={{ margin: '0 auto 16px' }} />
                <SkeletonBlock width="280px" height="44px" radius="8px" style={{ margin: '0 auto 12px' }} />
                <SkeletonBlock width="200px" height="14px" radius="6px" style={{ margin: '0 auto' }} />
            </div>

            <div className="container" style={{ padding: '60px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', maxWidth: '960px', margin: '0 auto' }}>
                    {/* Form skeleton */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <SkeletonBlock width="100%" height="48px" radius="10px" />
                        <SkeletonBlock width="100%" height="48px" radius="10px" />
                        <SkeletonBlock width="100%" height="48px" radius="10px" />
                        <SkeletonBlock width="100%" height="120px" radius="10px" />
                        <SkeletonBlock width="160px" height="44px" radius="22px" />
                    </div>
                    {/* Info skeleton */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <SkeletonBlock width="40px" height="40px" radius="50%" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <SkeletonBlock width="60%" height="16px" radius="4px" style={{ marginBottom: '8px' }} />
                                    <SkeletonBlock width="80%" height="14px" radius="4px" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    )
}
