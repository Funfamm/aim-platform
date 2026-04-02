'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CinematicBackground from '@/components/CinematicBackground'
import Footer from '@/components/Footer'

function VerifyEmailContent() {
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''

    const [code, setCode] = useState(['', '', '', '', '', ''])
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [resending, setResending] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
            return () => clearTimeout(t)
        }
    }, [resendCooldown])

    const handleDigitInput = (idx: number, val: string) => {
        // Handle paste of full code
        if (val.length === 6 && /^\d{6}$/.test(val)) {
            const digits = val.split('')
            setCode(digits)
            inputRefs.current[5]?.focus()
            return
        }
        const digit = val.replace(/\D/g, '').slice(-1)
        const next = [...code]
        next[idx] = digit
        setCode(next)
        if (digit && idx < 5) inputRefs.current[idx + 1]?.focus()
    }

    const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[idx] && idx > 0) {
            inputRefs.current[idx - 1]?.focus()
        }
    }

    const handleVerify = async () => {
        const fullCode = code.join('')
        if (fullCode.length !== 6) { setError('Please enter the 6-digit code.'); return }
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: fullCode }),
            })
            const data = await res.json()
            if (res.ok) {
                setSuccess(true)
                // Hard redirect so AuthProvider re-initializes with the new cookie
                setTimeout(() => { window.location.href = '/dashboard' }, 1500)
            } else {
                setError(data.error || 'Verification failed. Please try again.')
            }
        } catch {
            setError('Network error. Please try again.')
        }
        setLoading(false)
    }

    const handleResend = async () => {
        if (resendCooldown > 0) return
        setResending(true); setError('')
        try {
            const res = await fetch('/api/auth/verify-email', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            if (res.ok) {
                setResendCooldown(60)
                setCode(['', '', '', '', '', ''])
                inputRefs.current[0]?.focus()
            } else {
                const data = await res.json()
                setError(data.error || 'Failed to resend code.')
            }
        } catch {
            setError('Network error. Please try again.')
        }
        setResending(false)
    }

    if (success) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginBottom: '8px' }}>Email Verified!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Redirecting you to your dashboard...</p>
            </div>
        )
    }

    return (
        <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '0.3rem 0.8rem', background: 'rgba(212,168,83,0.1)',
                    border: '1px solid rgba(212,168,83,0.15)', borderRadius: '999px',
                    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const, color: 'var(--accent-gold)',
                    marginBottom: '16px',
                }}>
                    <span style={{ width: '5px', height: '5px', background: 'var(--accent-gold)', borderRadius: '50%' }} />
                    Email Verification
                </div>
                <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, marginBottom: '8px' }}>
                    Check Your Email 📧
                </h1>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    We sent a 6-digit code to<br />
                    <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                </p>
            </div>

            {/* Card */}
            <div style={{
                background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
                borderRadius: '20px', padding: '36px 32px', backdropFilter: 'blur(20px)',
            }}>
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '10px', padding: '10px 16px', marginBottom: '24px',
                        fontSize: '0.85rem', color: '#ef4444', textAlign: 'center',
                    }}>
                        {error}
                    </div>
                )}

                {/* 6-digit input boxes */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
                    {code.map((digit, idx) => (
                        <input
                            key={idx}
                            ref={el => { inputRefs.current[idx] = el }}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={digit}
                            onChange={e => handleDigitInput(idx, e.target.value)}
                            onKeyDown={e => handleKeyDown(idx, e)}
                            onFocus={e => e.target.select()}
                            style={{
                                width: '52px', height: '60px', textAlign: 'center', fontSize: '1.6rem', fontWeight: 800,
                                background: digit ? 'rgba(212,168,83,0.08)' : 'var(--bg-primary)',
                                border: `2px solid ${digit ? 'rgba(212,168,83,0.5)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: '12px', color: 'var(--accent-gold)', outline: 'none',
                                fontFamily: "'Courier New', monospace",
                                transition: 'border-color 0.2s, background 0.2s',
                            }}
                        />
                    ))}
                </div>

                {/* Verify Button */}
                <button
                    onClick={handleVerify}
                    disabled={loading || code.join('').length !== 6}
                    style={{
                        width: '100%', padding: '0.9rem', borderRadius: '12px', border: 'none',
                        background: code.join('').length === 6 ? 'linear-gradient(135deg, #d4a853, #c49b3a)' : 'rgba(212,168,83,0.2)',
                        color: code.join('').length === 6 ? '#0f1115' : '#d4a853',
                        fontSize: '1rem', fontWeight: 700, cursor: code.join('').length === 6 ? 'pointer' : 'not-allowed',
                        opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
                    }}
                >
                    {loading ? 'Verifying...' : 'Confirm Email →'}
                </button>

                {/* Resend */}
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                        Didn&apos;t receive the code?
                    </p>
                    <button
                        onClick={handleResend}
                        disabled={resending || resendCooldown > 0}
                        style={{
                            background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                            color: resendCooldown > 0 ? 'var(--text-tertiary)' : 'var(--accent-gold)',
                            fontSize: '0.85rem', fontWeight: 600, padding: 0,
                        }}
                    >
                        {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                </div>

                {/* Hint */}
                <div style={{
                    marginTop: '24px', padding: '12px 16px', borderRadius: '10px',
                    background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)',
                    fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.6,
                }}>
                    💡 Check your spam folder if you don&apos;t see the email. The code expires in 15 minutes.
                </div>
            </div>
        </>
    )
}

export default function VerifyEmailPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <main id="main-content" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'calc(80px + 2rem) 1rem 2rem', position: 'relative',
            }}>
                <CinematicBackground variant="auth" />
                <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
                    <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>}>
                        <VerifyEmailContent />
                    </Suspense>
                </div>
            </main>
            <Footer />
        </div>
    )
}
