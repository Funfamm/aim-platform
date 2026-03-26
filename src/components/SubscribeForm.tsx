'use client'

import { useState, FormEvent } from 'react'
import { useTranslations } from 'next-intl'

export default function SubscribeForm() {
    const t = useTranslations('footer')
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setStatus('sending')
        try {
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
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
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                fontSize: '0.85rem',
                color: 'var(--accent-gold)',
            }}>
                <span>✓</span> {t('subscribed')}
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            maxWidth: '480px',
        }}>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('emailPlaceholder')}
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

