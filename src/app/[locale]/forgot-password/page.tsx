'use client'

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react'
import Link from 'next/link'
import Footer from '@/components/Footer'
import CinematicBackground from '@/components/CinematicBackground'
import { useTranslations } from 'next-intl'

/* ── Animated Step Progress ── */
function StepProgress({ current }: { current: number }) {
    const steps = [
        { num: 1, label: 'Email' },
        { num: 2, label: 'Verify' },
        { num: 3, label: 'Reset' },
    ]
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', margin: '0 auto var(--space-xl)', maxWidth: '260px' }}>
            {steps.map((s, i) => (
                <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
                        background: s.num <= current ? 'linear-gradient(135deg, #d4a853, #c49b3a)' : 'transparent',
                        color: s.num <= current ? '#0f1115' : 'var(--text-tertiary)',
                        border: s.num <= current ? '2px solid #d4a853' : '2px solid var(--border-subtle)',
                        boxShadow: s.num === current ? '0 0 12px rgba(212,168,83,0.3)' : 'none',
                    }}>
                        {s.num < current ? '✓' : s.num}
                    </div>
                    {i < steps.length - 1 && (
                        <div style={{
                            flex: 1, height: '2px', margin: '0 6px', borderRadius: '1px', transition: 'all 0.5s',
                            background: s.num < current ? '#d4a853' : 'var(--border-subtle)',
                        }} />
                    )}
                </div>
            ))}
        </div>
    )
}

/* ── Animated Digit Input Boxes ── */
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])
    const digits = value.padEnd(6, '').split('').slice(0, 6)

    useEffect(() => {
        // Auto-focus first empty box
        const firstEmpty = digits.findIndex(d => !d.trim())
        if (firstEmpty >= 0 && inputRefs.current[firstEmpty]) {
            inputRefs.current[firstEmpty]?.focus()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[i] && i > 0) {
            const newVal = value.split('')
            newVal[i - 1] = ''
            onChange(newVal.join('').replace(/\s/g, ''))
            inputRefs.current[i - 1]?.focus()
        }
        if (e.key === 'ArrowLeft' && i > 0) inputRefs.current[i - 1]?.focus()
        if (e.key === 'ArrowRight' && i < 5) inputRefs.current[i + 1]?.focus()
    }

    const handleInput = (i: number, char: string) => {
        if (!/^\d$/.test(char)) return
        const newDigits = [...digits]
        newDigits[i] = char
        const newVal = newDigits.join('').replace(/\s/g, '')
        onChange(newVal)
        if (i < 5) inputRefs.current[i + 1]?.focus()
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (pasted) {
            onChange(pasted)
            const nextIdx = Math.min(pasted.length, 5)
            inputRefs.current[nextIdx]?.focus()
        }
    }

    return (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onPaste={handlePaste}>
            {digits.map((digit, i) => (
                <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit.trim()}
                    onChange={(e) => handleInput(i, e.target.value.slice(-1))}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    style={{
                        width: '48px', height: '60px', textAlign: 'center',
                        fontSize: '1.5rem', fontWeight: 800, fontFamily: "'Courier New', monospace",
                        background: digit.trim() ? 'rgba(212,168,83,0.08)' : 'var(--bg-primary)',
                        border: digit.trim() ? '2px solid rgba(212,168,83,0.5)' : '2px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        color: digit.trim() ? 'var(--accent-gold)' : 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                        boxShadow: digit.trim() ? '0 0 8px rgba(212,168,83,0.1)' : 'none',
                        caretColor: 'var(--accent-gold)',
                    }}
                />
            ))}
        </div>
    )
}

/* ── Countdown Timer ── */
function CountdownTimer({ seconds }: { seconds: number }) {
    const [remaining, setRemaining] = useState(seconds)
    useEffect(() => {
        const interval = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
        return () => clearInterval(interval)
    }, [])
    const mins = Math.floor(remaining / 60)
    const secs = remaining % 60
    const pct = (remaining / seconds) * 100
    return (
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <div style={{
                width: '100%', height: '3px', borderRadius: '2px', background: 'var(--border-subtle)', marginBottom: '6px', overflow: 'hidden',
            }}>
                <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: '2px', transition: 'width 1s linear',
                    background: remaining > 60 ? '#d4a853' : remaining > 30 ? '#f59e0b' : '#ef4444',
                }} />
            </div>
            <span style={{
                fontSize: '0.72rem', fontWeight: 600,
                color: remaining > 60 ? 'var(--text-tertiary)' : remaining > 30 ? '#f59e0b' : '#ef4444',
            }}>
                Code expires in {mins}:{secs.toString().padStart(2, '0')}
            </span>
        </div>
    )
}

export default function ForgotPasswordPage() {
    const t = useTranslations('forgotPassword')
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [step, setStep] = useState<'email' | 'code' | 'reset' | 'done'>('email')
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')
    const [loading, setLoading] = useState(false)
    const [codeTimerKey, setCodeTimerKey] = useState(0)

    const stepNum = step === 'email' ? 1 : step === 'code' ? 2 : step === 'reset' ? 3 : 3

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setInfo('')
        setLoading(true)

        if (step === 'email') {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action: 'verify' }),
            })
            const data = await res.json()
            setLoading(false)
            if (res.ok) {
                setStep('code')
                setCodeTimerKey(k => k + 1)
                if (data.emailConfigured) {
                    setInfo('📧 A 6-digit code has been sent to your email. Check your inbox and spam folder.')
                } else {
                    setInfo('⚠️ Email sending is not configured yet. Please contact the admin.')
                }
            } else {
                setError(data.error || t('emailNotFound'))
            }
        } else if (step === 'code') {
            if (code.length !== 6) { setError('Please enter all 6 digits.'); setLoading(false); return }
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: code.trim(), action: 'verify-code' }),
            })
            const data = await res.json()
            setLoading(false)
            if (res.ok) {
                setStep('reset')
                setInfo('')
            } else {
                setError(data.error || 'Invalid code')
            }
        } else if (step === 'reset') {
            if (newPassword.length < 6) { setError(t('minChars')); setLoading(false); return }
            if (newPassword !== confirmPassword) { setError(t('noMatch')); setLoading(false); return }
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: newPassword, code: code.trim(), action: 'reset' }),
            })
            const data = await res.json()
            setLoading(false)
            if (res.ok) {
                setStep('done')
            } else {
                setError(data.error || t('resetFailed'))
            }
        }
    }

    const handleResendCode = async () => {
        setError(''); setInfo('Sending a new code...')
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, action: 'verify' }),
        })
        if (res.ok) {
            setCode('')
            setCodeTimerKey(k => k + 1)
            setInfo('📧 A new code has been sent!')
        } else {
            const data = await res.json()
            setError(data.error || 'Failed to resend code. Try again later.')
            setInfo('')
        }
    }

    const inputStyle = {
        width: '100%',
        padding: '0.75rem 1rem',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        fontSize: '0.9rem',
        outline: 'none',
        transition: 'border-color 0.2s',
    }

    // Strength indicator for password
    const getPasswordStrength = (pw: string) => {
        let s = 0
        if (pw.length >= 6) s++
        if (pw.length >= 10) s++
        if (/[A-Z]/.test(pw)) s++
        if (/[0-9]/.test(pw)) s++
        if (/[^a-zA-Z0-9]/.test(pw)) s++
        return s
    }
    const pwStrength = getPasswordStrength(newPassword)
    const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
    const strengthColors = ['', '#ef4444', '#f59e0b', '#eab308', '#34d399', '#10b981']

    return (
        <>
<main id="main-content" style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'calc(80px + var(--space-2xl)) var(--space-lg) var(--space-2xl)', position: 'relative',
            }}>
                <CinematicBackground variant="auth" />

                <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
                    {/* Step Progress */}
                    {step !== 'done' && <StepProgress current={stepNum} />}

                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '0.3rem 0.8rem', background: 'rgba(212,168,83,0.1)',
                            border: '1px solid rgba(212,168,83,0.15)', borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em',
                            textTransform: 'uppercase' as const, color: 'var(--accent-gold)',
                            marginBottom: 'var(--space-lg)',
                        }}>
                            <span style={{ width: '5px', height: '5px', background: 'var(--accent-gold)', borderRadius: '50%' }} />
                            {t('accountRecovery')}
                        </div>
                        <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                            {step === 'done' ? '🎉 ' + t('passwordResetDone') : step === 'code' ? '🔐 Enter Verification Code' : t('resetPassword')}
                        </h1>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                            {step === 'email' && t('enterEmail')}
                            {step === 'code' && `We sent a code to ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`}
                            {step === 'reset' && t('chooseNew')}
                            {step === 'done' && t('updatedSuccess')}
                        </p>
                    </div>

                    <div style={{
                        background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)', backdropFilter: 'blur(20px)',
                    }}>
                        {error && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)',
                                marginBottom: 'var(--space-lg)', fontSize: '0.85rem', color: '#ef4444',
                                display: 'flex', alignItems: 'center', gap: '8px',
                            }}>⚠️ {error}</div>
                        )}
                        {info && (
                            <div style={{
                                background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                                borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)',
                                marginBottom: 'var(--space-lg)', fontSize: '0.85rem', color: '#34d399',
                            }}>{info}</div>
                        )}

                        {step === 'done' ? (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    width: '80px', height: '80px', margin: '0 auto var(--space-lg)',
                                    borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '2px solid rgba(52,211,153,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem',
                                    animation: 'pulse 2s ease-in-out infinite',
                                }}>
                                    ✅
                                </div>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
                                    {t('canSignIn')}
                                </p>
                                <Link href="/login" className="btn btn-primary" style={{
                                    display: 'inline-block', width: '100%', padding: '0.85rem',
                                    fontSize: '0.95rem', fontWeight: 700, textAlign: 'center',
                                }}>
                                    {t('signInBtn')}
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                {step === 'email' && (
                                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('email')}</label>
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t('emailPlaceholder')} style={inputStyle} autoFocus />
                                    </div>
                                )}

                                {step === 'code' && (
                                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                                            Enter your 6-digit verification code
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
                                            {[0, 1, 2, 3, 4, 5].map((i) => (
                                                <input
                                                    key={i}
                                                    id={`code-digit-${i}`}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={1}
                                                    value={code[i] || ''}
                                                    autoFocus={i === 0}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '')
                                                        if (!val && !e.target.value) {
                                                            // deletion
                                                            const newCode = code.split('')
                                                            newCode[i] = ''
                                                            setCode(newCode.join(''))
                                                            return
                                                        }
                                                        if (!val) return
                                                        const char = val.slice(-1)
                                                        const newCode = code.padEnd(6, ' ').split('')
                                                        newCode[i] = char
                                                        const joined = newCode.join('').replace(/\s/g, '')
                                                        setCode(joined)
                                                        // auto-advance
                                                        if (i < 5) {
                                                            const next = document.getElementById(`code-digit-${i + 1}`)
                                                            next?.focus()
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Backspace' && !code[i] && i > 0) {
                                                            const newCode = code.split('')
                                                            newCode[i - 1] = ''
                                                            setCode(newCode.join(''))
                                                            const prev = document.getElementById(`code-digit-${i - 1}`)
                                                            prev?.focus()
                                                        }
                                                        if (e.key === 'ArrowLeft' && i > 0) document.getElementById(`code-digit-${i - 1}`)?.focus()
                                                        if (e.key === 'ArrowRight' && i < 5) document.getElementById(`code-digit-${i + 1}`)?.focus()
                                                    }}
                                                    onPaste={(e) => {
                                                        e.preventDefault()
                                                        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                                                        if (pasted) {
                                                            setCode(pasted)
                                                            const focusIdx = Math.min(pasted.length, 5)
                                                            setTimeout(() => document.getElementById(`code-digit-${focusIdx}`)?.focus(), 50)
                                                        }
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    style={{
                                                        width: '48px', height: '60px', textAlign: 'center' as const,
                                                        fontSize: '1.5rem', fontWeight: 800, fontFamily: "'Courier New', monospace",
                                                        background: code[i] ? 'rgba(212,168,83,0.08)' : 'var(--bg-primary)',
                                                        border: code[i] ? '2px solid rgba(212,168,83,0.5)' : '2px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)',
                                                        color: code[i] ? 'var(--accent-gold)' : 'var(--text-primary)',
                                                        outline: 'none',
                                                        transition: 'all 0.2s',
                                                        boxShadow: code[i] ? '0 0 8px rgba(212,168,83,0.1)' : 'none',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <CountdownTimer key={codeTimerKey} seconds={600} />
                                        <div style={{ marginTop: '12px', textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={handleResendCode}
                                                style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                                            >
                                                Didn&apos;t receive the code? Resend
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {step === 'reset' && (
                                    <>
                                        <div style={{ marginBottom: 'var(--space-md)' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('newPassword')}</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    required
                                                    minLength={6}
                                                    placeholder={t('minCharsPlaceholder')}
                                                    style={{ ...inputStyle, paddingRight: '2.8rem' }}
                                                    autoFocus
                                                />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('hidePassword') : t('showPassword')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                                                    {showPassword ? (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                                    ) : (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                    )}
                                                </button>
                                            </div>
                                            {/* Password strength meter */}
                                            {newPassword.length > 0 && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                                                        {[1, 2, 3, 4, 5].map(n => (
                                                            <div key={n} style={{
                                                                flex: 1, height: '3px', borderRadius: '2px',
                                                                background: n <= pwStrength ? strengthColors[pwStrength] : 'var(--border-subtle)',
                                                                transition: 'background 0.3s',
                                                            }} />
                                                        ))}
                                                    </div>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: strengthColors[pwStrength] }}>
                                                        {strengthLabels[pwStrength]}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('confirmNew')}</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    required
                                                    placeholder={t('confirmPlaceholder')}
                                                    style={{
                                                        ...inputStyle,
                                                        paddingRight: '2.8rem',
                                                        borderColor: confirmPassword && confirmPassword === newPassword ? 'rgba(52,211,153,0.5)' : confirmPassword ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)',
                                                    }}
                                                />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('hidePassword') : t('showPassword')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                                                    {showPassword ? (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                                    ) : (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                    )}
                                                </button>
                                                {/* Match indicator */}
                                                {confirmPassword && (
                                                    <span style={{
                                                        position: 'absolute', right: '40px', top: '50%', transform: 'translateY(-50%)',
                                                        fontSize: '0.85rem',
                                                    }}>
                                                        {confirmPassword === newPassword ? '✓' : '✗'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button type="submit" disabled={loading || (step === 'code' && code.length !== 6)} className="btn btn-primary" style={{
                                    width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700,
                                    opacity: loading || (step === 'code' && code.length !== 6) ? 0.5 : 1,
                                    transition: 'opacity 0.2s',
                                }}>
                                    {loading
                                        ? t('processing')
                                        : step === 'email'
                                            ? '📧 ' + t('continueBtn')
                                            : step === 'code'
                                                ? '🔓 Verify Code'
                                                : '🔑 ' + t('resetBtn')
                                    }
                                </button>
                            </form>
                        )}

                        <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                            <Link href="/login" style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{t('backToSignIn')}</Link>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    )
}
