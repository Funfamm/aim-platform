'use client'

import Link from 'next/link'
import ScrollReveal3D from '@/components/ScrollReveal3D'

interface EmptyStateProps {
    icon: string
    title: string
    desc: string
    linkHref: string
    linkText: string
}

export default function EmptyState({ icon, title, desc, linkHref, linkText }: EmptyStateProps) {
    return (
        <ScrollReveal3D direction="up" delay={250}>
            <div style={{
                position: 'relative', overflow: 'hidden',
                background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xl)', padding: 'var(--space-3xl) var(--space-2xl)',
                textAlign: 'center',
            }}>
                {/* Animated background glow */}
                <div style={{
                    position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
                    width: '400px', height: '400px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 60%)',
                    animation: 'emptyPulse 4s ease-in-out infinite',
                    pointerEvents: 'none',
                }} />

                {/* Floating particles */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} style={{
                        position: 'absolute',
                        width: `${2 + (i % 3) * 2}px`, height: `${2 + (i % 3) * 2}px`,
                        borderRadius: '50%',
                        background: `rgba(212,168,83,${0.08 + (i % 3) * 0.06})`,
                        left: `${8 + i * 12}%`,
                        top: `${15 + (i * 17) % 70}%`,
                        animation: `emptyFloat${i % 3} ${3 + i * 0.4}s ease-in-out infinite`,
                        pointerEvents: 'none',
                    }} />
                ))}

                {/* Icon with animated ring */}
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 'var(--space-lg)', zIndex: 1 }}>
                    <div style={{
                        position: 'absolute', inset: '-8px', borderRadius: '50%',
                        border: '1px solid rgba(212,168,83,0.12)',
                        animation: 'emptyRing 3s ease-in-out infinite',
                    }} />
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(212,168,83,0.1), rgba(212,168,83,0.03))',
                        border: '1px solid rgba(212,168,83,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 30px rgba(212,168,83,0.06)',
                    }}>
                        <span style={{ fontSize: '1.8rem', filter: 'drop-shadow(0 2px 8px rgba(212,168,83,0.25))' }}>{icon}</span>
                    </div>
                </div>

                <h3 style={{
                    fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-xs)',
                    color: 'var(--text-primary)', position: 'relative', zIndex: 1,
                    letterSpacing: '-0.01em',
                }}>{title}</h3>
                <p style={{
                    color: 'var(--text-tertiary)', fontSize: '0.88rem', maxWidth: '340px',
                    margin: '0 auto var(--space-lg)', lineHeight: 1.6,
                    position: 'relative', zIndex: 1,
                }}>{desc}</p>
                <Link href={linkHref} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '0.65rem 1.8rem', fontSize: '0.82rem', fontWeight: 700,
                    background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dark))',
                    color: 'var(--bg-primary)', borderRadius: 'var(--radius-full)',
                    textDecoration: 'none', position: 'relative', zIndex: 1,
                    boxShadow: '0 2px 16px rgba(212,168,83,0.25), 0 0 0 1px rgba(212,168,83,0.1)',
                    transition: 'all 0.3s ease',
                    letterSpacing: '0.02em',
                }}>
                    {linkText}
                    <span style={{ fontSize: '1rem', transition: 'transform 0.3s' }}>→</span>
                </Link>

                {/* Bottom decorative line */}
                <div style={{
                    position: 'absolute', bottom: 0, left: '10%', right: '10%', height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.15) 30%, rgba(212,168,83,0.25) 50%, rgba(212,168,83,0.15) 70%, transparent)',
                }} />
            </div>

            <style>{`
                @keyframes emptyPulse {
                    0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(0.9); }
                    50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
                }
                @keyframes emptyFloat0 {
                    0%, 100% { transform: translateY(0) scale(1); opacity: 0.2; }
                    50% { transform: translateY(-10px) scale(1.2); opacity: 0.5; }
                }
                @keyframes emptyFloat1 {
                    0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
                    50% { transform: translateY(-15px) scale(1.4); opacity: 0.6; }
                }
                @keyframes emptyFloat2 {
                    0%, 100% { transform: translateY(0) scale(1); opacity: 0.15; }
                    50% { transform: translateY(-8px) scale(1.1); opacity: 0.4; }
                }
                @keyframes emptyRing {
                    0%, 100% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(1.15); opacity: 0.7; }
                }
            `}</style>
        </ScrollReveal3D>
    )
}
