'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

/**
 * Button that lets a logged-in user subscribe to be notified
 * when new script calls open — no email input needed, uses their account email.
 */
export default function NotifyNewCallsButton({ initialSubscribed = false }: { initialSubscribed?: boolean }) {
    const t = useTranslations('scripts')
    const [subscribed, setSubscribed] = useState(initialSubscribed)
    const [loading, setLoading] = useState(false)
    const [showPop, setShowPop] = useState(false)

    async function handleClick() {
        if (subscribed || loading) return
        setLoading(true)
        try {
            // Subscribe using the user's account email (session-based, no form needed)
            const res = await fetch('/api/scripts/notify-new-calls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            if (res.ok) {
                setSubscribed(true)
                setShowPop(true)
                setTimeout(() => setShowPop(false), 5000)
            }
        } catch { /* silent */ } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <style>{`
                @keyframes notifyPop {
                    0%   { transform: scale(0.88); opacity: 0; }
                    60%  { transform: scale(1.05); }
                    100% { transform: scale(1);    opacity: 1; }
                }
                @keyframes bellRing {
                    0%, 100% { transform: rotate(0deg); }
                    20%      { transform: rotate(-16deg); }
                    40%      { transform: rotate(12deg); }
                    60%      { transform: rotate(-8deg); }
                    80%      { transform: rotate(5deg); }
                }
                @keyframes checkDraw {
                    from { stroke-dashoffset: 30; }
                    to   { stroke-dashoffset: 0; }
                }
            `}</style>

            {subscribed ? (
                /* ── Confirmed state ── */
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '10px',
                    padding: '10px 22px',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
                    border: '1.5px solid rgba(16,185,129,0.3)',
                    borderRadius: 'var(--radius-full)',
                    animation: showPop ? 'notifyPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                    cursor: 'default',
                }}>
                    {/* Animated bell */}
                    <span style={{
                        fontSize: '1.1rem',
                        display: 'inline-block',
                        animation: showPop ? 'bellRing 0.8s ease 0.2s' : 'none',
                    }}>🔔</span>

                    <span>
                        <span style={{
                            display: 'block',
                            fontWeight: 700, fontSize: '0.85rem',
                            color: '#10b981',
                        }}>
                            {t('notifyConfirmedTitle')}
                        </span>
                        <span style={{
                            display: 'block',
                            fontSize: '0.72rem',
                            color: 'rgba(16,185,129,0.7)',
                        }}>
                            {t('notifyConfirmedDesc')}
                        </span>
                    </span>

                    {/* Animated checkmark */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline
                            points="20 6 9 17 4 12"
                            strokeDasharray="30"
                            style={{ animation: showPop ? 'checkDraw 0.4s ease 0.3s both' : 'none' }}
                        />
                    </svg>
                </div>
            ) : (
                /* ── Default button ── */
                <button
                    onClick={handleClick}
                    disabled={loading}
                    id="notify-new-calls-btn"
                    style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '11px 28px',
                        background: loading
                            ? 'rgba(212,168,83,0.06)'
                            : 'linear-gradient(135deg, var(--accent-gold), #c4943a)',
                        border: 'none',
                        borderRadius: 'var(--radius-full)',
                        color: loading ? 'var(--accent-gold)' : '#0f1115',
                        fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.02em',
                        cursor: loading ? 'wait' : 'pointer',
                        transition: 'all 0.25s ease',
                        opacity: loading ? 0.7 : 1,
                        boxShadow: loading ? 'none' : '0 4px 20px rgba(212,168,83,0.3)',
                    }}
                    onMouseEnter={e => {
                        if (!loading) {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(212,168,83,0.45)'
                        }
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = loading ? 'none' : '0 4px 20px rgba(212,168,83,0.3)'
                    }}
                >
                    <span style={{ fontSize: '1rem', display: 'inline-block' }}>
                        {loading ? '⏳' : '🔔'}
                    </span>
                    {loading ? t('notifyLoading') : t('notifyMeBtn')}
                </button>
            )}
        </>
    )
}
