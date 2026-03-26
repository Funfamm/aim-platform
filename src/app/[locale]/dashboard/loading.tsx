export default function DashboardLoading() {
    return (
        <main style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            padding: '100px 24px 48px',
        }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                {/* Header skeleton */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
                    <div>
                        <div style={{ width: '180px', height: '20px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', marginBottom: '8px' }} />
                        <div style={{ width: '120px', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }} />
                    </div>
                </div>

                {/* Stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} style={{
                            height: '90px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            animation: 'shimmer 1.5s infinite',
                            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)',
                            backgroundSize: '200% 100%',
                            animationDelay: `${i * 0.1}s`,
                        }} />
                    ))}
                </div>

                {/* Tab bar skeleton */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{
                            width: '90px', height: '36px', borderRadius: '8px',
                            background: i === 0 ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.03)',
                        }} />
                    ))}
                </div>

                {/* Content cards */}
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{
                        height: '80px', borderRadius: '12px', marginBottom: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        animation: 'shimmer 1.5s infinite',
                        backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)',
                        backgroundSize: '200% 100%',
                        animationDelay: `${0.5 + i * 0.1}s`,
                    }} />
                ))}

                <style>{`
                    @keyframes shimmer {
                        0% { background-position: 200% 0; }
                        100% { background-position: -200% 0; }
                    }
                `}</style>
            </div>
        </main>
    )
}
