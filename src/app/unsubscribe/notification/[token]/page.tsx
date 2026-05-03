'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function UnsubscribePage() {
    const params = useParams()
    const token = params.token as string

    const [info, setInfo] = useState<{
        email: string; signupTag: string; notificationType: string; otherSubscriptionCount: number
    } | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)
    const [message, setMessage] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        fetch(`/api/unsubscribe/notification/${token}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) setError(data.error)
                else setInfo(data)
            })
            .catch(() => setError('Failed to load unsubscribe info.'))
            .finally(() => setLoading(false))
    }, [token])

    const handleUnsubscribe = async (scope: 'tag' | 'all') => {
        setActionLoading(true)
        try {
            const res = await fetch(`/api/unsubscribe/notification/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope }),
            })
            const data = await res.json()
            if (data.error) {
                setError(data.error)
            } else {
                setDone(true)
                setMessage(data.message)
            }
        } catch {
            setError('Network error. Please try again.')
        }
        setActionLoading(false)
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary, #0a0a0f)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'var(--font-body, system-ui)',
        }}>
            <div style={{
                maxWidth: '480px',
                width: '100%',
                textAlign: 'center',
                padding: '40px 32px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
            }}>
                {/* Logo */}
                <div style={{ marginBottom: '24px' }}>
                    <span style={{ fontFamily: 'var(--font-display, inherit)', fontSize: '1.3rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--accent-gold, #d4a853)' }}>AIM</span>{' '}
                        <span style={{ color: 'var(--text-primary, #fff)' }}>Studio</span>
                    </span>
                </div>

                {loading && (
                    <p style={{ color: 'var(--text-tertiary, #888)', fontSize: '0.9rem' }}>Loading...</p>
                )}

                {error && !done && (
                    <div style={{
                        padding: '16px', borderRadius: '10px',
                        background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.15)',
                        color: 'rgba(255,80,80,0.9)', fontSize: '0.9rem', marginBottom: '16px',
                    }}>
                        {error}
                    </div>
                )}

                {done && (
                    <div>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '50%',
                            background: 'rgba(72,187,120,0.1)', border: '2px solid rgba(72,187,120,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px',
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#48bb78" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
                            Unsubscribed
                        </h2>
                        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                            {message}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: '16px' }}>
                            You can close this page.
                        </p>
                    </div>
                )}

                {info && !done && (
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
                            Unsubscribe
                        </h2>
                        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: '24px' }}>
                            You&apos;re unsubscribing <strong style={{ color: '#fff' }}>{info.email}</strong> from{' '}
                            <strong style={{ color: 'var(--accent-gold, #d4a853)' }}>{info.signupTag.replace(/_/g, ' ')}</strong> notifications.
                        </p>

                        {/* Granular unsubscribe */}
                        <button
                            onClick={() => handleUnsubscribe('tag')}
                            disabled={actionLoading}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '10px',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            {actionLoading ? '...' : `Unsubscribe from "${info.signupTag.replace(/_/g, ' ')}"`}
                        </button>

                        {/* Global unsubscribe — only show if they have other subscriptions */}
                        {info.otherSubscriptionCount > 0 && (
                            <button
                                onClick={() => handleUnsubscribe('all')}
                                disabled={actionLoading}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '10px',
                                    background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.15)',
                                    color: 'rgba(255,80,80,0.9)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                Unsubscribe from all notifications ({info.otherSubscriptionCount + 1} total)
                            </button>
                        )}

                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: '16px' }}>
                            This only affects &quot;Notify Me&quot; notifications, not your AIM Studio account or newsletter.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
