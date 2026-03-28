'use client'

import { useRouter } from 'next/navigation'

interface Props {
    roleName: string
    projectTitle: string
}

export default function ApplicationSuccess({ roleName, projectTitle }: Props) {
    const router = useRouter()

    return (
        <div style={{
            minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
            <style>{`
                @keyframes confettiFall {
                    0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                @keyframes spotlightPulse {
                    0%, 100% { opacity: 0.15; transform: scale(1); }
                    50% { opacity: 0.25; transform: scale(1.1); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.5) rotate(-10deg); }
                    to { opacity: 1; transform: scale(1) rotate(0deg); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes borderGlow {
                    0%, 100% { border-color: rgba(212,168,83,0.2); }
                    50% { border-color: rgba(212,168,83,0.5); }
                }
            `}</style>

            {/* Floating confetti */}
            {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    width: `${4 + Math.random() * 8}px`,
                    height: `${4 + Math.random() * 8}px`,
                    background: ['#d4a853', '#ffd700', '#b8860b', '#fff', '#f0c040', '#a0784c'][i % 6],
                    borderRadius: i % 3 === 0 ? '50%' : '2px',
                    left: `${Math.random() * 100}%`,
                    top: '-20px',
                    animation: `confettiFall ${2 + Math.random() * 3}s ease-in ${Math.random() * 2}s forwards`,
                    opacity: 0.8,
                }} />
            ))}

            {/* Spotlight glow */}
            <div style={{
                position: 'absolute',
                width: '500px', height: '500px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(212,168,83,0.15), transparent 70%)',
                animation: 'spotlightPulse 4s ease-in-out infinite',
                pointerEvents: 'none',
            }} />

            <div style={{ maxWidth: '560px', position: 'relative', zIndex: 1 }}>
                <div style={{
                    fontSize: '5rem', marginBottom: 'var(--space-lg)',
                    animation: 'scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    filter: 'drop-shadow(0 0 30px rgba(212,168,83,0.4))',
                }}>🎬</div>

                <h2 style={{
                    fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800,
                    marginBottom: 'var(--space-sm)',
                    background: 'linear-gradient(90deg, var(--text-primary), var(--accent-gold), var(--text-primary))',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'fadeInUp 0.6s ease forwards, shimmer 3s linear 1s infinite',
                    opacity: 0,
                    animationDelay: '0.3s',
                    animationFillMode: 'forwards',
                }}>You&apos;re In The Spotlight</h2>

                <p style={{
                    fontSize: '1rem', color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-lg)', lineHeight: 1.7,
                    animation: 'fadeInUp 0.6s ease 0.5s forwards', opacity: 0,
                }}>
                    Your application for <strong style={{ color: 'var(--accent-gold)' }}>{roleName}</strong> in{' '}
                    <em style={{ color: 'var(--text-primary)' }}>{projectTitle}</em> has been received.
                    Our team is now reviewing your submission.
                </p>

                <div style={{
                    width: '80px', height: '2px', margin: '0 auto var(--space-xl)',
                    background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)',
                    animation: 'fadeInUp 0.6s ease 0.7s forwards', opacity: 0,
                }} />

                <div style={{
                    textAlign: 'left',
                    padding: 'var(--space-xl)',
                    background: 'rgba(212,168,83,0.03)',
                    border: '1px solid rgba(212,168,83,0.12)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--space-xl)',
                    animation: 'fadeInUp 0.6s ease 0.9s forwards, borderGlow 3s ease-in-out infinite',
                    opacity: 0,
                }}>
                    <div style={{
                        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color: 'var(--accent-gold)',
                        marginBottom: 'var(--space-lg)',
                    }}>What Happens Next</div>

                    {[
                        { icon: '🔍', title: 'Review', desc: 'Our casting director analyzes your photos, voice, and profile for character compatibility', time: 'Within 24 hours' },
                        { icon: '👥', title: 'Team Evaluation', desc: 'Our creative team reviews the submission and makes final casting decisions', time: '1-3 days' },
                        { icon: '✉️', title: 'Contacted', desc: 'If selected, we\'ll reach out via email with next steps for your role', time: 'If shortlisted' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: 'var(--space-md)',
                            paddingBottom: i < 2 ? 'var(--space-md)' : 0,
                            marginBottom: i < 2 ? 'var(--space-md)' : 0,
                            borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                background: 'var(--accent-gold-glow)',
                                border: '1px solid rgba(212,168,83,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem',
                            }}>{s.icon}</div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '2px' }}>{s.title}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{s.desc}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', marginTop: '3px', fontWeight: 600 }}>{s.time}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{
                    animation: 'fadeInUp 0.6s ease 1.1s forwards', opacity: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)',
                }}>
                    <button
                        onClick={() => router.push('/casting')}
                        className="btn btn-primary btn-lg"
                        style={{
                            padding: '0.8rem 2.5rem',
                            background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))',
                            border: '1px solid rgba(212,168,83,0.35)',
                            color: 'var(--accent-gold)', fontWeight: 700,
                        }}
                    >
                        Explore More Roles
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-tertiary)', fontSize: '0.82rem',
                            padding: '0.5rem',
                        }}
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    )
}
