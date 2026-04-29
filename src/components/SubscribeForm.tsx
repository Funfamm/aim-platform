'use client'

import { useState, FormEvent } from 'react'
import { useTranslations, useLocale } from 'next-intl'

export default function SubscribeForm() {
    const t = useTranslations('footer')
    const locale = useLocale()
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

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
                body: JSON.stringify({ email, locale, website: '' }),
            })
            if (res.ok) {
                setStatus('sent')
                setEmail('')
            } else {
                setStatus('error')
            }
        } catch {
            setStatus('error')
        }
    }

    if (status === 'sent') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    fontSize: '0.85rem',
                    color: 'var(--accent-gold)',
                }}>
                    <span>✓</span> {t('subscribed')}
                </div>
                <a
                    href={`/${locale}/register?utm_source=subscribe_form`}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '0.6rem 1.2rem', fontSize: '0.8rem', fontWeight: 600,
                        background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.25)',
                        borderRadius: 'var(--radius-md)', color: 'var(--accent-gold)',
                        textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer',
                    }}
                >
                    🎬 {t('watchFreePrompt', { defaultMessage: 'Watch our films free — create your account' })}
                </a>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} style={{
            display: 'flex',
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
                disabled={status === 'sending'}
                className="btn btn-primary"
                style={{ whiteSpace: 'nowrap', padding: '0.6rem 1.5rem', fontSize: '0.85rem', flexShrink: 0 }}
            >
                {status === 'sending' ? '...' : t('subscribe')}
            </button>
        </form>
    )
}

