export default function CastingLoading() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <style>{`
                @keyframes shimmer {
                    0%   { background-position: -600px 0; }
                    100% { background-position:  600px 0; }
                }
                @keyframes pulse-fade {
                    0%, 100% { opacity: 0.5; }
                    50%       { opacity: 1; }
                }
                .sk {
                    background: rgba(255,255,255,0.05);
                    background-image: linear-gradient(
                        90deg,
                        rgba(255,255,255,0.04) 0%,
                        rgba(255,255,255,0.10) 40%,
                        rgba(212,168,83,0.08) 50%,
                        rgba(255,255,255,0.10) 60%,
                        rgba(255,255,255,0.04) 100%
                    );
                    background-size: 600px 100%;
                    background-repeat: no-repeat;
                    animation: shimmer 1.6s ease-in-out infinite;
                    border-radius: 8px;
                }
            `}</style>

            {/* Hero skeleton */}
            <section style={{
                padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-3xl)',
                textAlign: 'center',
            }}>
                <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 24px' }}>
                    {/* Badge */}
                    <div className="sk" style={{ width: '130px', height: '18px', borderRadius: '20px', margin: '0 auto 22px', animationDelay: '0s' }} />
                    {/* Title */}
                    <div className="sk" style={{ width: '420px', maxWidth: '90%', height: '44px', borderRadius: '10px', margin: '0 auto 14px', animationDelay: '0.1s' }} />
                    {/* Subtitle */}
                    <div className="sk" style={{ width: '300px', maxWidth: '70%', height: '18px', borderRadius: '8px', margin: '0 auto', animationDelay: '0.2s' }} />
                </div>
            </section>

            {/* Filter bar skeleton */}
            <section style={{ padding: '0 24px 24px' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {[80, 100, 90, 75].map((w, i) => (
                        <div key={i} className="sk" style={{
                            width: `${w}px`, height: '36px', borderRadius: '20px',
                            animationDelay: `${i * 0.08}s`,
                        }} />
                    ))}
                </div>
            </section>

            {/* Casting card skeletons */}
            <section style={{ padding: '0 24px 80px' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[1, 0.9, 0.85, 0.8].map((opacity, i) => (
                        <div key={i} style={{
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.02)',
                            padding: '20px 24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            opacity,
                            animationDelay: `${i * 0.1}s`,
                        }}>
                            {/* Left icon placeholder */}
                            <div className="sk" style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, animationDelay: `${i * 0.1}s` }} />
                            {/* Text lines */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="sk" style={{ width: '45%', height: '16px', animationDelay: `${i * 0.1 + 0.05}s` }} />
                                <div className="sk" style={{ width: '70%', height: '12px', animationDelay: `${i * 0.1 + 0.1}s` }} />
                            </div>
                            {/* Right badge */}
                            <div className="sk" style={{ width: '72px', height: '28px', borderRadius: '20px', flexShrink: 0, animationDelay: `${i * 0.1 + 0.15}s` }} />
                        </div>
                    ))}
                </div>
            </section>
        </main>
    )
}
