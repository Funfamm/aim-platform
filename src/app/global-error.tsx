"use client"
import React, { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { Sentry.captureException(error) }, [error])

    return (
        <html lang="en">
            <head>
                <title>Something went wrong – AIM Studio</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
            </head>
            <body style={{
                margin: 0, padding: 0,
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                background: '#0f1115',
                color: '#e8e6e3',
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {/* Ambient glow */}
                <div style={{
                    position: 'fixed', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(212,168,83,0.06) 0%, transparent 70%)',
                }} />

                <div style={{
                    position: 'relative', zIndex: 1, textAlign: 'center',
                    maxWidth: '520px', padding: '40px 32px',
                }}>
                    {/* Logo */}
                    <div style={{ marginBottom: '40px' }}>
                        <a href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
                            <span style={{
                                fontFamily: 'Inter, sans-serif', fontWeight: 800,
                                fontSize: '1.6rem', letterSpacing: '-0.5px',
                            }}>
                                <span style={{ color: '#d4a853' }}>AIM</span>
                                <span style={{ color: '#e8e6e3' }}> Studio</span>
                            </span>
                        </a>
                    </div>

                    {/* Icon */}
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 28px',
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '32px',
                    }}>
                        ⚠️
                    </div>

                    {/* Heading */}
                    <h1 style={{
                        fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800,
                        margin: '0 0 12px', lineHeight: 1.2, color: '#e8e6e3',
                    }}>
                        Something went wrong
                    </h1>

                    <p style={{
                        fontSize: '0.95rem', color: '#9ca3af',
                        lineHeight: 1.6, margin: '0 0 32px',
                    }}>
                        An unexpected error occurred. Our team has been notified and is working on a fix.
                    </p>

                    {/* Error digest for support */}
                    {error?.digest && (
                        <div style={{
                            padding: '10px 16px', borderRadius: '8px', marginBottom: '28px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            fontSize: '0.72rem', color: '#6b7280', fontFamily: 'monospace',
                        }}>
                            Error ID: {error.digest}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={reset}
                            style={{
                                padding: '12px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #d4a853, #c49b3a)',
                                color: '#0f1115', fontWeight: 700, fontSize: '0.9rem',
                                fontFamily: 'Inter, sans-serif',
                                transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                            Try again
                        </button>
                        <a
                            href="/"
                            style={{
                                padding: '12px 28px', borderRadius: '10px', cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.04)',
                                color: '#e8e6e3', fontWeight: 600, fontSize: '0.9rem',
                                textDecoration: 'none', fontFamily: 'Inter, sans-serif',
                            }}
                        >
                            Go Home
                        </a>
                    </div>

                    {/* Footer note */}
                    <p style={{ marginTop: '40px', fontSize: '0.75rem', color: '#4b5563' }}>
                        © {new Date().getFullYear()} AIM Studio · If this persists,{' '}
                        <a href="/contact" style={{ color: '#d4a853', textDecoration: 'none' }}>contact support</a>
                    </p>
                </div>
            </body>
        </html>
    )
}
