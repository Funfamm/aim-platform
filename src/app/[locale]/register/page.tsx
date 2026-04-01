'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Footer from '@/components/Footer'
import CinematicBackground from '@/components/CinematicBackground'
import { useTranslations, useLocale } from 'next-intl'

export default function RegisterPage() {
    const t = useTranslations('register')
    const locale = useLocale()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const { register } = useAuth()
    const router = useRouter()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        if (password !== confirmPassword) {
            setError(t('passwordsNoMatch'))
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            })
            const data = await res.json()
            if (res.ok && data.requiresVerification) {
                // Redirect to the verification page with the email
                router.push(`/verify-email?email=${encodeURIComponent(email)}`)
            } else if (res.ok && data.user) {
                // Fallback: already verified (e.g. OAuth)
                router.push('/dashboard')
            } else {
                setError(data.error || t('registrationFailed'))
            }
        } catch {
            setError(t('registrationFailed'))
        }
        setLoading(false)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
<main id="main-content" style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'calc(80px + var(--space-2xl)) var(--space-lg) var(--space-2xl)',
                position: 'relative',
            }}>
                <CinematicBackground variant="auth" />

                <div style={{
                    width: '100%',
                    maxWidth: '440px',
                    position: 'relative',
                    zIndex: 1,
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '0.3rem 0.8rem',
                            background: 'rgba(212,168,83,0.1)',
                            border: '1px solid rgba(212,168,83,0.15)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase' as const,
                            color: 'var(--accent-gold)',
                            marginBottom: 'var(--space-lg)',
                        }}>
                            <span style={{
                                width: '5px', height: '5px',
                                background: 'var(--accent-gold)',
                                borderRadius: '50%',
                            }} />
                            {t('joinStudio')}
                        </div>
                        <h1 style={{
                            fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
                            fontWeight: 800,
                            marginBottom: 'var(--space-sm)',
                        }}>{t('createAccount')}</h1>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                            {t('registerDesc')}
                        </p>
                    </div>

                    <div style={{
                        background: 'var(--bg-glass-light)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)',
                        padding: 'var(--space-xl)',
                        backdropFilter: 'blur(20px)',
                    }}>
                        {error && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-sm) var(--space-md)',
                                marginBottom: 'var(--space-lg)',
                                fontSize: '0.85rem',
                                color: '#ef4444',
                            }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <label style={{
                                    display: 'block', fontSize: '0.8rem', fontWeight: 600,
                                    color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.03em',
                                }}>{t('fullName')}</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder={t('fullNamePlaceholder')}
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem',
                                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                        fontSize: '0.9rem', outline: 'none',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <label style={{
                                    display: 'block', fontSize: '0.8rem', fontWeight: 600,
                                    color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.03em',
                                }}>{t('email')}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder={t('emailPlaceholder')}
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem',
                                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                        fontSize: '0.9rem', outline: 'none',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <label style={{
                                    display: 'block', fontSize: '0.8rem', fontWeight: 600,
                                    color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.03em',
                                }}>{t('password')}</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        placeholder={t('passwordPlaceholder')}
                                        style={{
                                            width: '100%', padding: '0.75rem 1rem', paddingRight: '2.8rem',
                                            background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                            fontSize: '0.9rem', outline: 'none',
                                        }}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                                        {showPassword ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: 'var(--space-lg)' }}>
                                <label style={{
                                    display: 'block', fontSize: '0.8rem', fontWeight: 600,
                                    color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.03em',
                                }}>{t('confirmPassword')}</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder={t('confirmPlaceholder')}
                                        style={{
                                            width: '100%', padding: '0.75rem 1rem', paddingRight: '2.8rem',
                                            background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                            fontSize: '0.9rem', outline: 'none',
                                        }}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                                        {showPassword ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary"
                                style={{
                                    width: '100%', padding: '0.85rem', fontSize: '0.95rem',
                                    fontWeight: 700, opacity: loading ? 0.7 : 1,
                                }}
                            >
                                {loading ? t('creatingAccount') : t('createAccountBtn')}
                            </button>
                        </form>

                        <div style={{
                            textAlign: 'center', marginTop: 'var(--space-lg)',
                            fontSize: '0.85rem', color: 'var(--text-tertiary)',
                        }}>
                            {t('alreadyHaveAccount')}{' '}
                            <Link href={`/${locale}/login`} style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
                                {t('signIn')}
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    )
}
