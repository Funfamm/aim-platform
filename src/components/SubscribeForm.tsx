'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

// How long to wait for a Turnstile token before showing a retry error (ms)
const VERIFICATION_TIMEOUT_MS = 15_000

export default function SubscribeForm() {
    const t = useTranslations('footer')
    const locale = useLocale()
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'pending' | 'error'>('idle')
    const [token, setToken] = useState('')
    const [widgetError, setWidgetError] = useState(false)
    const loadedAtRef = useRef(0)
    const turnstileRef = useRef<TurnstileInstance | null>(null)
    const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Capture mount timestamp for time-delay bot check
    useEffect(() => { loadedAtRef.current = Date.now() }, [])

    // ── Verification timeout: if Turnstile hasn't called onSuccess within
    // VERIFICATION_TIMEOUT_MS, surface a retry error instead of hanging forever.
    useEffect(() => {
        if (!siteKeyConfigured || token || widgetError) return
        verifyTimeoutRef.current = setTimeout(() => {
            if (!token) {
                console.warn('[SubscribeForm] Turnstile timeout — token not received within', VERIFICATION_TIMEOUT_MS, 'ms')
                setWidgetError(true)
            }
        }, VERIFICATION_TIMEOUT_MS)
        return () => {
            if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])  // run once on mount — siteKeyConfigured is stable (module-level constant)

    // Button is enabled only when:
    //  - not currently sending, AND
    //  - either no site key (dev) OR token received
    // Disabled states:
    //  - sending → show '...'
    //  - site key configured + no token + no widget error → show 'Verifying…'
    //  - site key configured + widget error → show retry option, button disabled
    const siteKeyConfigured = !!SITE_KEY
    const isVerifying = siteKeyConfigured && !token && !widgetError
    const isDisabled = status === 'sending' || isVerifying || widgetError

    // Retry: reset Turnstile widget + clear error state. Email is intentionally kept.
    const handleRetry = () => {
        setWidgetError(false)
        setToken('')
        setStatus('idle')
        if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current)
        turnstileRef.current?.reset()
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setStatus('sending')
        try {
            const form = e.target as HTMLFormElement
            const botField = (form.elements.namedItem('website') as HTMLInputElement)?.value
            if (botField) { setStatus('sent'); return }
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    locale,
                    website: '',
                    loadedAt: loadedAtRef.current,
                    turnstileToken: token,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                setStatus(data.welcomed ? 'sent' : data.pending ? 'pending' : 'sent')
                setEmail('')
                // Reset widget after success
                setToken('')
                turnstileRef.current?.reset()
            } else {
                setStatus('error')
                // Reset widget so user can retry without hard refresh
                setToken('')
                turnstileRef.current?.reset()
            }
        } catch {
            setStatus('error')
            // Reset widget so user can retry without hard refresh
            setToken('')
            turnstileRef.current?.reset()
        }
    }

    // When Turnstile site key is not configured, show a friendly error.
    // The API is also fail-closed in this state, so we avoid a confusing UX.
    if (!siteKeyConfigured) {
        return (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0 }}>
                Subscriptions are temporarily unavailable. Please check back soon.
            </p>
        )
    }

    if (status === 'pending') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                    fontSize: '0.85rem', color: 'var(--accent-gold)',
                }}>
                    <span>📬</span> Check your inbox!
                </div>
                <div style={{
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                    We sent a confirmation link to your email. Click it to complete your subscription. The link expires in 72 hours.
                </div>
            </div>
        )
    }

    if (status === 'sent') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                    fontSize: '0.85rem', color: 'var(--accent-gold)',
                }}>
                    <span>✓</span> {t('subscribed')}
                </div>
                <div style={{
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        🎬 {t('watchFreeTitle')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: '10px' }}>
                        {t('watchFreeDesc')}
                    </div>
                    <a
                        href={`/${locale}/register?utm_source=subscribe_form`}
                        style={{
                            display: 'inline-block', padding: '6px 14px', fontSize: '0.75rem',
                            fontWeight: 700, background: 'var(--accent-gold)', color: '#000',
                            borderRadius: 'var(--radius-md)', textDecoration: 'none', transition: 'opacity 0.2s',
                        }}
                    >
                        {t('watchFreeBtn')}
                    </a>
                </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxWidth: '480px' }}>
            {/* Honeypot field — invisible to humans, filled by bots */}
            <input
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
            />

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t('emailPlaceholder')}
                    onInvalid={e => (e.target as HTMLInputElement).setCustomValidity(t('validationRequired'))}
                    onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                    style={{
                        flex: 1, minWidth: 0, padding: '0.6rem 1rem',
                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                        fontSize: '0.85rem', outline: 'none',
                    }}
                />
                <button
                    type="submit"
                    disabled={isDisabled}
                    className="btn btn-primary"
                    style={{
                        whiteSpace: 'nowrap', padding: '0.6rem 1.5rem',
                        fontSize: '0.85rem', flexShrink: 0,
                        opacity: isDisabled ? 0.55 : 1,
                        transition: 'opacity 0.2s',
                    }}
                >
                    {status === 'sending' ? '...' : t('subscribe')}
                </button>
            </div>

            {/* Turnstile widget — invisible mode, renders below the input row */}
            {siteKeyConfigured && (
                <Turnstile
                    ref={turnstileRef}
                    siteKey={SITE_KEY}
                    options={{ theme: 'dark', size: 'invisible', execution: 'render', retry: 'auto', retryInterval: 5000 }}
                    onSuccess={(tk) => {
                        if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current)
                        setToken(tk)
                        setWidgetError(false)
                    }}
                    onExpire={() => setToken('')}
                    onError={() => {
                        if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current)
                        setWidgetError(true)
                    }}
                    style={{ display: 'none' }}
                />
            )}

            {/* Widget error — improved message with retry, no hard refresh needed */}
            {widgetError && (
                <div>
                    <p style={{ fontSize: '0.78rem', color: '#f59e0b', margin: '0 0 6px', lineHeight: 1.5 }}>
                        ⚠️ Human verification could not be completed. Please try again. If it continues, allow verification scripts for this site or use another browser.
                    </p>
                    <button
                        type="button"
                        onClick={handleRetry}
                        style={{
                            background: 'rgba(245,158,11,0.12)',
                            border: '1px solid rgba(245,158,11,0.4)',
                            borderRadius: 'var(--radius-md)',
                            color: '#f59e0b',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            padding: '0.35rem 0.8rem',
                            cursor: 'pointer',
                        }}
                    >
                        ↺ Retry verification
                    </button>
                </div>
            )}

            {status === 'error' && (
                <p style={{ fontSize: '0.78rem', color: '#ef4444', margin: 0 }}>
                    Something went wrong. Please try again.
                </p>
            )}
        </form>
    )
}
