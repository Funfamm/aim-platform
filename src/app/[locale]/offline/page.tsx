import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Offline | AIM Studio',
    description: 'You appear to be offline.',
}

export default function OfflinePage() {
    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            textAlign: 'center',
            padding: '2rem',
        }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📡</div>
            <h1 style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 800,
                color: '#D4A853',
                marginBottom: '0.5rem',
            }}>
                You&apos;re Offline
            </h1>
            <p style={{
                color: 'var(--text-tertiary)',
                fontSize: '1rem',
                maxWidth: '400px',
                lineHeight: 1.6,
                marginBottom: '2rem',
            }}>
                It looks like you&apos;ve lost your connection. Check your internet and try again.
            </p>
            <Link href="/" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.8rem 2rem',
                background: 'linear-gradient(135deg, #D4A853, #b8943d)',
                color: '#000',
                borderRadius: '50px',
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: '0.9rem',
            }}>
                ← Try Again
            </Link>
        </main>
    )
}
