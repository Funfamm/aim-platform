'use client'

import { useState, useEffect, useRef } from 'react'
import type { CtaModalCopy } from './NotifyMeEndCard'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function NotifyMeModal({
    copy,
    signupTag,
    onClose,
    onSuccess,
    visible,
}: {
    copy: CtaModalCopy
    signupTag: string
    onClose: () => void
    onSuccess: () => void
    visible: boolean
}) {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [token, setToken] = useState('')
    const [widgetError, setWidgetError] = useState(false)
    const [verifyNeeded, setVerifyNeeded] = useState(false)
    const [animateIn, setAnimateIn] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const turnstileRef = useRef<TurnstileInstance | null>(null)

    const siteKeyConfigured = !!SITE_KEY

    useEffect(() => {
        if (visible) {
            const t = setTimeout(() => {
                setAnimateIn(true)
                inputRef.current?.focus()
            }, 50)
            return () => clearTimeout(t)
        }
        const t = setTimeout(() => setAnimateIn(false), 0)
        return () => clearTimeout(t)
    }, [visible])

    if (!visible) return null

    const handleRetry = () => {
        setWidgetError(false)
        setVerifyNeeded(false)
        setToken('')
        turnstileRef.current?.reset()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setVerifyNeeded(false)

        const trimmed = email.trim()
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError('Please enter a valid email address.')
            return
        }

        // Honeypot check
        const form = e.target as HTMLFormElement
        const botField = (form.elements.namedItem('website') as HTMLInputElement)?.value
        if (botField) {
            onSuccess()
            return
        }

        // Require Turnstile token before submitting
        if (siteKeyConfigured && !token) {
            setVerifyNeeded(true)
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/notify-me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: trimmed,
                    signupTag,
                    language: document.documentElement.lang || 'en',
                    turnstileToken: token,
                    website: '',
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Something went wrong. Please try again.')
                setToken('')
                turnstileRef.current?.reset()
                return
            }

            onSuccess()
        } catch {
            setError('Network error. Please check your connection.')
            setToken('')
            turnstileRef.current?.reset()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                opacity: animateIn ? 1 : 0,
                transition: 'opacity 0.3s ease',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative',
                    background: 'linear-gradient(145deg, rgba(28,28,32,0.98), rgba(18,18,22,0.98))',
                    border: '1px solid rgba(212,168,83,0.2)',
                    borderRadius: '16px',
                    padding: 'clamp(24px, 4vw, 36px)',
                    maxWidth: '420px',
                    width: '90%',
                    textAlign: 'center',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.1)',
                    transform: animateIn ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.96)',
                    transition: 'transform 0.4s ease, opacity 0.3s ease',
                    opacity: animateIn ? 1 : 0,
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                >
                    ✕
                </button>

                {/* Headline */}
                <h3 style={{
                    fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
                    fontWeight: 800,
                    color: '#fff',
                    margin: '0 0 8px',
                    fontFamily: 'var(--font-display, inherit)',
                }}>
                    {copy.headline}
                </h3>

                {/* Subtext */}
                <p style={{
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.5,
                    margin: '0 0 20px',
                }}>
                    {copy.subtext}
                </p>

                {/* Email form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Honeypot — invisible to humans, filled by bots */}
                    <input
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
                    />

                    <input
                        ref={inputRef}
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        disabled={loading}
                        style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: error
                                ? '1px solid rgba(255,80,80,0.5)'
                                : '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            fontSize: '0.95rem',
                            outline: 'none',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                        onFocus={e => {
                            e.currentTarget.style.borderColor = 'rgba(212,168,83,0.5)'
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,168,83,0.1)'
                        }}
                        onBlur={e => {
                            e.currentTarget.style.borderColor = error
                                ? 'rgba(255,80,80,0.5)'
                                : 'rgba(255,255,255,0.12)'
                            e.currentTarget.style.boxShadow = 'none'
                        }}
                    />

                    {/* Turnstile — visible widget, loads only when modal is open */}
                    {siteKeyConfigured && (
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', margin: '0 0 8px', fontWeight: 500 }}>
                                Let us know you are human
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <Turnstile
                                    ref={turnstileRef}
                                    siteKey={SITE_KEY}
                                    options={{ theme: 'dark', size: 'normal', retry: 'auto', retryInterval: 5000 }}
                                    onSuccess={(tk) => {
                                        setToken(tk)
                                        setWidgetError(false)
                                        setVerifyNeeded(false)
                                    }}
                                    onExpire={() => setToken('')}
                                    onError={() => setWidgetError(true)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Widget load error — with retry */}
                    {widgetError && (
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '0.75rem', color: '#f59e0b', margin: '0 0 6px', lineHeight: 1.5 }}>
                                ⚠️ Human verification could not be completed. Please try again. If it continues, allow verification scripts for this site or use another browser.
                            </p>
                            <button
                                type="button"
                                onClick={handleRetry}
                                style={{
                                    background: 'rgba(245,158,11,0.12)',
                                    border: '1px solid rgba(245,158,11,0.4)',
                                    borderRadius: '8px',
                                    color: '#f59e0b',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.3rem 0.7rem',
                                    cursor: 'pointer',
                                }}
                            >
                                ↺ Retry verification
                            </button>
                        </div>
                    )}

                    {/* Nudge when user submits without completing the widget */}
                    {verifyNeeded && !widgetError && (
                        <p style={{ fontSize: '0.75rem', color: '#f59e0b', margin: 0, textAlign: 'left', lineHeight: 1.5 }}>
                            ⚠️ Please complete human verification above before continuing.
                        </p>
                    )}

                    {error && (
                        <p style={{ fontSize: '0.78rem', color: 'rgba(255,80,80,0.9)', margin: 0 }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: 'none',
                            background: loading
                                ? 'rgba(212,168,83,0.5)'
                                : 'linear-gradient(135deg, #d4a853, #c49a3a)',
                            color: '#000',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'transform 0.15s, box-shadow 0.2s',
                            boxShadow: '0 4px 16px rgba(212,168,83,0.25)',
                            width: '100%',
                        }}
                        onMouseEnter={e => {
                            if (!loading) e.currentTarget.style.transform = 'scale(1.02)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)'
                        }}
                    >
                        {loading ? 'Checking verification…' : copy.buttonLabel}
                    </button>
                </form>

                {/* Footnote + Privacy */}
                <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>
                        {copy.footnote}
                    </p>
                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
                        {copy.privacyNote}
                    </p>
                </div>
            </div>
        </div>
    )
}
