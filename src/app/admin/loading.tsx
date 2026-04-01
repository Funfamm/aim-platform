export default function AdminLoading() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            background: 'var(--bg-primary)',
        }}>
            {/* Sidebar skeleton */}
            <aside style={{
                width: '240px', padding: '24px 16px', flexShrink: 0,
                borderRight: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
                <div style={{
                    width: '120px', height: '20px', borderRadius: '6px',
                    background: 'rgba(255,255,255,0.04)', marginBottom: '24px',
                }} />
                {[78, 66, 92, 70, 85, 62, 88, 74].map((w, i) => (
                    <div key={i} style={{
                        width: `${w}%`, height: '14px', borderRadius: '4px',
                        background: i === 0 ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.03)',
                    }} />
                ))}
            </aside>

            {/* Main content skeleton */}
            <main style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '200px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }} />
                    <div style={{ width: '120px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }} />
                </div>

                {/* Stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{
                            height: '100px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            animation: 'shimmer 1.5s infinite',
                            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)',
                            backgroundSize: '200% 100%',
                            animationDelay: `${i * 0.1}s`,
                        }} />
                    ))}
                </div>

                {/* Chart placeholder */}
                <div style={{
                    height: '300px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    animation: 'shimmer 1.5s infinite 0.4s',
                    backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)',
                    backgroundSize: '200% 100%',
                }} />

                <style>{`
                    @keyframes shimmer {
                        0% { background-position: 200% 0; }
                        100% { background-position: -200% 0; }
                    }
                `}</style>
            </main>
        </div>
    )
}
