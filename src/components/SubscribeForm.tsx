'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import ClientTurnstile, { type ClientTurnstileHandle } from '@/components/ClientTurnstile'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function SubscribeForm() {
    const t = useTranslations('footer')
    const locale = useLocale()
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'pending' | 'error'>('idle')
    const [token, setToken] = useState('')
    const [widgetError, setWidgetError] = useState(false)
    const [verifyNeeded, setVerifyNeeded] = useState(false)
    const loadedAtRef = useRef(0)
    const turnstileRef = useRef<ClientTurnstileHandle | null>(null)
    const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const siteKeyConfigured = !!SITE_KEY
    // Button is only disabled while actively submitting
    const isDisabled = status === 'sending'

    // Capture mount timestamp for time-delay bot check
    useEffect(() => { loadedAtRef.current = Date.now() }, [])

    // Surface a retry error if the Turnstile script never loads (blocked script,
    // domain not allowlisted, CSP) so the user isn't left with an invisible gap.
    useEffect(() => {
        if (!siteKeyConfigured || token || widgetError) return
        verifyTimeoutRef.current = setTimeout(() => {
            if (!token) setWidgetError(true)
        }, 15_000)
        return () => {
            if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current)
        }
    }, [siteKeyConfigured, token, widgetError])

    const handleRetry = () => {
        if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current)
        setWidgetError(false)
        setVerifyNeeded(false)
        setToken('')
        setStatus('idle')
        turnstileRef.current?.reset()
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setVerifyNeeded(false)
        const form = e.target as HTMLFormElement
        const botField = (form.elements.namedItem('website') as HTMLInputElement)?.value
        if (botField) { setStatus('sent'); return }
        if (siteKeyConfigured && !token) {
            setVerifyNeeded(true)
            return
        }
        setStatus('sending')
        try {
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
                setToken('')
                turnstileRef.current?.reset()
            } else {
                setStatus('error')
                setToken('')
                turnstileRef.current?.reset()
            }
        } catch {
            setStatus('error')
            setToken('')
            turnstileRef.current?.reset()
        }
    }

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

            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('emailPlaceholder')}
                onInvalid={e => (e.target as HTMLInputElement).setCustomValidity(t('validationRequired'))}
                onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                style={{
                    width: '100%', padding: '0.6rem 1rem',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                }}
            />

            {/* Turnstile — client-only widget with SPA-safe lifecycle */}
            <ClientTurnstile
                ref={turnstileRef}
                siteKey={SITE_KEY}
                label="Let us know you are human"
                labelStyle={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}
                onSuccess={(tk) => {
                    if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current)
                    setToken(tk)
                    setWidgetError(false)
                    setVerifyNeeded(false)
                }}
                onExpire={() => setToken('')}
                onError={() => {
                    if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current)
                    setWidgetError(true)
                }}
            />

            {/* Widget load error — with retry */}
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

            {/* Nudge when user submits without completing the widget */}
            {verifyNeeded && !widgetError && (
                <p style={{ fontSize: '0.78rem', color: '#f59e0b', margin: 0, lineHeight: 1.5 }}>
                    ⚠️ Please complete human verification above before subscribing.
                </p>
            )}

            <button
                type="submit"
                disabled={isDisabled}
                className="btn btn-primary"
                style={{
                    width: '100%', padding: '0.6rem 1.5rem',
                    fontSize: '0.85rem',
                    opacity: isDisabled ? 0.55 : 1,
                    transition: 'opacity 0.2s',
                }}
            >
                {status === 'sending' ? 'Checking verification…' : t('subscribe')}
            </button>

            {status === 'error' && (
                <p style={{ fontSize: '0.78rem', color: '#ef4444', margin: 0 }}>
                    Something went wrong. Please try again.
                </p>
            )}
        </form>
    )
}
