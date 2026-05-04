'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useTranslations, useLocale } from 'next-intl'

// Turnstile site key (public)
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function SubscribeForm() {
    const t = useTranslations('footer')
    const locale = useLocale()
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'pending' | 'error'>('idle')
    const [turnstileToken, setTurnstileToken] = useState('')
    const turnstileRef = useRef<HTMLDivElement>(null)
    const loadedAtRef = useRef(0) // time-delay bot check — set on mount via useEffect (can't call Date.now() in render body)

    // Capture mount timestamp for time-delay bot check
    useEffect(() => { loadedAtRef.current = Date.now() }, [])

    // Load Turnstile widget
    useEffect(() => {
        if (!TURNSTILE_SITE_KEY || !turnstileRef.current) return

        // Load the Turnstile script if not already loaded
        const existingScript = document.querySelector('script[src*="turnstile"]')
        if (!existingScript) {
            const script = document.createElement('script')
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
            script.async = true
            script.defer = true
            script.onload = () => renderWidget()
            script.onerror = () => { /* widget failed to load — button stays enabled */ }
            document.head.appendChild(script)
        } else {
            // Script already loaded, render widget
            renderWidget()
        }

        function renderWidget() {
            if (!(window as unknown as Record<string, unknown>).turnstile || !turnstileRef.current) {
                // Wait for Turnstile to initialize
                setTimeout(renderWidget, 200)
                return
            }
            const ts = (window as unknown as { turnstile: { render: (el: HTMLElement, opts: Record<string, unknown>) => void } }).turnstile
            // Clear any previous widget
            turnstileRef.current.innerHTML = ''
            ts.render(turnstileRef.current, {
                sitekey: TURNSTILE_SITE_KEY,
                callback: (token: string) => setTurnstileToken(token),
                'expired-callback': () => setTurnstileToken(''),
                'error-callback': () => { /* widget error — button stays enabled */ },
                theme: 'dark',
                size: 'invisible',       // auto-executes; no user interaction needed
                execution: 'render',     // fire immediately on render
            })
        }
    }, [])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setStatus('sending')
        try {
            const form = e.target as HTMLFormElement
            // Honeypot: if 'website' field has been filled, silently do nothing
            const botField = (form.elements.namedItem('website') as HTMLInputElement)?.value
            if (botField) { setStatus('sent'); return } // fake success, don't call API
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, locale, website: '', turnstileToken, loadedAt: loadedAtRef.current }),
            })
            if (res.ok) {
                const data = await res.json()
                setStatus(data.pending ? 'pending' : 'sent')
                setEmail('')
            } else {
                setStatus('error')
            }
        } catch {
            setStatus('error')
        }
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
                {/* Existing confirmation — unchanged */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    fontSize: '0.85rem',
                    color: 'var(--accent-gold)',
                }}>
                    <span>✓</span> {t('subscribed')}
                </div>

                {/* Registration prompt card */}
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
                            display: 'inline-block',
                            padding: '6px 14px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: 'var(--accent-gold)',
                            color: '#000',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            transition: 'opacity 0.2s',
                        }}
                    >
                        {t('watchFreeBtn')}
                    </a>
                </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
            maxWidth: '480px',
        }}>
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
                        flex: 1,
                        minWidth: 0,
                        padding: '0.6rem 1rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none',
                    }}
                />
                <button
                    type="submit"
                    disabled={status === 'sending' || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
                    className="btn btn-primary"
                    style={{ whiteSpace: 'nowrap', padding: '0.6rem 1.5rem', fontSize: '0.85rem', flexShrink: 0, opacity: (!!TURNSTILE_SITE_KEY && !turnstileToken) ? 0.6 : 1, transition: 'opacity 0.2s' }}
                >
                    {status === 'sending' ? '...' : (!!TURNSTILE_SITE_KEY && !turnstileToken) ? '...' : t('subscribe')}
                </button>
            </div>
            {/* Turnstile — invisible mode, auto-executes, no visible widget */}
            {TURNSTILE_SITE_KEY && (
                <div ref={turnstileRef} style={{ display: 'none' }} />
            )}
        </form>
    )
}
