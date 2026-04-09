'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface NotifyMeButtonProps {
    scriptCallId: string
    initialSubscribed: boolean
}

export default function NotifyMeButton({ scriptCallId, initialSubscribed }: NotifyMeButtonProps) {
    const t = useTranslations('scripts')
    const [subscribed, setSubscribed] = useState(initialSubscribed)
    const [loading, setLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    async function handleNotify() {
        if (subscribed) return
        setLoading(true)
        try {
            const res = await fetch('/api/scripts/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptCallId }),
            })
            if (res.ok) {
                setSubscribed(true)
                setShowConfirm(true)
                setTimeout(() => setShowConfirm(false), 4000)
            }
        } catch { /* ignore */ } finally {
            setLoading(false)
        }
    }

    if (subscribed) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04))',
                border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 'var(--radius-full)',
                animation: showConfirm ? 'notifyPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
            }}>
                <style>{`
                    @keyframes notifyPop {
                        0%   { transform: scale(0.88); opacity: 0; }
                        60%  { transform: scale(1.04); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    @keyframes notifyRing {
                        0%, 100% { transform: rotate(0deg); }
                        20%      { transform: rotate(-15deg); }
                        40%      { transform: rotate(12deg); }
                        60%      { transform: rotate(-8deg); }
                        80%      { transform: rotate(5deg); }
                    }
                `}</style>

                {/* Animated bell */}
                <span style={{
                    fontSize: '1.1rem',
                    animation: showConfirm ? 'notifyRing 0.8s ease 0.2s' : 'none',
                    display: 'inline-block',
                }}>🔔</span>

                <span style={{ flex: 1 }}>
                    <span style={{
                        display: 'block', fontWeight: 700, fontSize: '0.82rem',
                        color: '#10b981',
                    }}>
                        {t('notifyConfirmedTitle')}
                    </span>
                    <span style={{
                        display: 'block', fontSize: '0.7rem',
                        color: 'rgba(16,185,129,0.7)',
                    }}>
                        {t('notifyConfirmedDesc')}
                    </span>
                </span>

                {/* Checkmark */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </div>
        )
    }

    return (
        <button
            onClick={handleNotify}
            disabled={loading}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '10px 18px',
                background: loading
                    ? 'rgba(212,168,83,0.06)'
                    : 'linear-gradient(135deg, rgba(212,168,83,0.12), rgba(212,168,83,0.06))',
                border: '1px solid rgba(212,168,83,0.3)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--accent-gold)',
                fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.03em',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.25s ease',
                opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={e => {
                if (!loading) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,168,83,0.18)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(212,168,83,0.2)'
                    ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                }
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(212,168,83,0.12), rgba(212,168,83,0.06))'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            }}
        >
            <span style={{ fontSize: '1rem' }}>{loading ? '⏳' : '🔔'}</span>
            {loading ? t('notifyLoading') : t('notifyMeBtn')}
        </button>
    )
}
