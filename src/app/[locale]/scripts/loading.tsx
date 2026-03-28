import { SkeletonBlock, SkeletonStyles } from '@/components/Skeleton'

export default function ScriptsLoading() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <SkeletonStyles />
            {/* Hero */}
            <div style={{ padding: '80px 24px 60px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                <SkeletonBlock width="260px" height="44px" radius="8px" style={{ margin: '0 auto 12px' }} />
                <SkeletonBlock width="200px" height="14px" radius="6px" style={{ margin: '0 auto' }} />
            </div>

            <div className="container" style={{ padding: '60px 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: '24px', padding: '24px',
                            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-subtle)', alignItems: 'flex-start',
                        }}>
                            <SkeletonBlock width="60px" height="80px" radius="8px" style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <SkeletonBlock width="60%" height="18px" radius="4px" style={{ marginBottom: '8px' }} />
                                <SkeletonBlock width="40%" height="12px" radius="4px" style={{ marginBottom: '12px' }} />
                                <SkeletonBlock width="90%" height="12px" radius="4px" style={{ marginBottom: '6px' }} />
                                <SkeletonBlock width="80%" height="12px" radius="4px" />
                            </div>
                            <SkeletonBlock width="100px" height="36px" radius="8px" style={{ flexShrink: 0 }} />
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}
