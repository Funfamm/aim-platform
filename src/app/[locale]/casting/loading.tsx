export default function CastingLoading() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {/* Hero skeleton */}
            <section style={{
                padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-3xl)',
                textAlign: 'center',
            }}>
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <div style={{ width: '120px', height: '14px', borderRadius: '7px', background: 'rgba(212,168,83,0.08)', margin: '0 auto 20px' }} />
                    <div style={{ width: '400px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', margin: '0 auto 12px' }} />
                    <div style={{ width: '300px', height: '16px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', margin: '0 auto' }} />
                </div>
            </section>

            {/* Filter bar skeleton */}
            <section style={{ padding: '0 24px var(--space-lg)' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '8px' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{
                            width: '80px', height: '34px', borderRadius: '20px',
                            background: i === 0 ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.03)',
                        }} />
                    ))}
                </div>
            </section>

            {/* Casting cards skeleton */}
            <section style={{ padding: '0 24px var(--space-3xl)' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{
                            height: '120px', borderRadius: '16px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            animation: 'shimmer 1.5s infinite',
                            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)',
                            backgroundSize: '200% 100%',
                            animationDelay: `${i * 0.12}s`,
                        }} />
                    ))}
                </div>
            </section>

            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </main>
    )
}
