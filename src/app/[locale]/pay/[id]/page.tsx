'use client'
/* eslint-disable react-hooks/set-state-in-effect -- data-fetching and SDK loading effects intentionally set state */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'



interface PaymentInfo {
    projectId: string
    projectTitle: string
    clientName: string
    email: string
    agreedTotal: number
    depositAmount: number
    milestone: string
    alreadyPaid: boolean
    paidAt: string | null
}

type PageState = 'loading' | 'invalid' | 'already-paid' | 'ready' | 'processing' | 'complete'

export default function PayPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const projectId = params.id as string
    const token = searchParams.get('token')

    const [state, setState] = useState<PageState>('loading')
    const [info, setInfo] = useState<PaymentInfo | null>(null)
    const [paypalReady, setPaypalReady] = useState(false)
    const paypalRef = useRef<HTMLDivElement>(null)
    const paypalButtonsRef = useRef<{ close: () => void } | null>(null)
    const [error, setError] = useState('')

    // Fetch payment info
    useEffect(() => {
        if (!projectId || !token) {
            setState('invalid')
            return
        }
        fetch(`/api/pay/${projectId}?token=${token}`)
            .then(r => {
                if (!r.ok) throw new Error('Invalid')
                return r.json()
            })
            .then((data: PaymentInfo) => {
                setInfo(data)
                setState(data.alreadyPaid ? 'already-paid' : 'ready')
            })
            .catch(() => setState('invalid'))
    }, [projectId, token])

    // Load PayPal SDK
    useEffect(() => {
        if (state !== 'ready') return

        const isSandbox = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'sandbox'
        const clientId = isSandbox
            ? process.env.NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID
            : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID

        if (!clientId) { setError('PayPal configuration error'); return }

        if (document.getElementById('paypal-sdk')) {
            if (window.paypal) {
                setPaypalReady(true)
            } else {
                const timer = setInterval(() => {
                    if (window.paypal) { setPaypalReady(true); clearInterval(timer) }
                }, 200)
                setTimeout(() => clearInterval(timer), 10000)
            }
            return
        }
        const script = document.createElement('script')
        script.id = 'paypal-sdk'
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`
        script.async = true
        script.onload = () => setPaypalReady(true)
        script.onerror = () => setError('Failed to load PayPal')
        document.head.appendChild(script)
    }, [state])

    // Render PayPal buttons
    const renderButtons = useCallback(() => {
        if (!paypalReady || !window.paypal || !paypalRef.current || !info) return
        if (paypalButtonsRef.current) paypalButtonsRef.current.close()

        const buttons = window.paypal.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 48 },
            createOrder: async () => {
                const res = await fetch('/api/project-payments/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectRequestId: info.projectId,
                        milestone: 'deposit',
                        amount: info.depositAmount,
                        clientName: info.clientName,
                        email: info.email,
                    }),
                })
                const data = await res.json()
                if (!data.orderID) throw new Error('Failed to create order')
                return data.orderID
            },
            onApprove: async (data: { orderID: string }) => {
                setState('processing')
                try {
                    const res = await fetch('/api/project-payments/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderID: data.orderID }),
                    })
                    const result = await res.json()
                    if (result.success) {
                        setState('complete')
                    } else {
                        setError(result.error || 'Payment capture failed. Please contact support.')
                        setState('ready')
                    }
                } catch {
                    setError('Payment processing error. Please try again.')
                    setState('ready')
                }
            },
            onError: () => {
                setError('PayPal encountered an error. Please try again.')
            },
        })
        buttons.render('#paypal-pay-buttons')
        paypalButtonsRef.current = buttons
    }, [paypalReady, info])

    useEffect(() => { renderButtons() }, [renderButtons])

    // ── Shared styles ──
    const card: React.CSSProperties = {
        maxWidth: '520px', margin: '0 auto', padding: 'clamp(24px, 5vw, 40px)',
        borderRadius: '16px', background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
    }
    const goldText: React.CSSProperties = { color: '#d4a853' }

    // ── Loading ──
    if (state === 'loading') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #0d0d12)' }}>
                <div style={card}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading payment details...</p>
                    </div>
                </div>
            </div>
        )
    }

    // ── Invalid link ──
    if (state === 'invalid') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #0d0d12)' }}>
                <div style={card}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 20px' }}>❌</div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary, #e8e6e3)' }}>Invalid Payment Link</h1>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                            This payment link is invalid or has expired. Please contact us if you need assistance.
                        </p>
                        <Link href="/" style={{ color: '#d4a853', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
                            ← Back to AIM Studio
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // ── Already paid ──
    if (state === 'already-paid' && info) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #0d0d12)' }}>
                <div style={card}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 20px' }}>✅</div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary, #e8e6e3)' }}>Deposit Already Paid</h1>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                            Your deposit of <strong style={goldText}>${info.depositAmount.toFixed(2)}</strong> for <strong>{info.projectTitle}</strong> was paid{info.paidAt ? ` on ${new Date(info.paidAt).toLocaleDateString()}` : ''}.
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '24px' }}>
                            Your project is in progress. You&apos;ll receive updates via email.
                        </p>
                        <Link
                            href={`/my-projects?id=${info.projectId}&token=${token}`}
                            style={{
                                display: 'inline-block', padding: '12px 28px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #d4a853, #c49b3a)', color: '#0f1115',
                                fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none',
                            }}
                        >
                            Track Your Project
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // ── Processing ──
    if (state === 'processing') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #0d0d12)' }}>
                <div style={card}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '16px', animation: 'pulse 1.5s ease-in-out infinite' }}>💳</div>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary, #e8e6e3)' }}>Processing Payment...</h1>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Please wait while we confirm your payment.</p>
                    </div>
                </div>
            </div>
        )
    }

    // ── Complete ──
    if (state === 'complete' && info) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #0d0d12)' }}>
                <div style={card}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 20px' }}>🎉</div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary, #e8e6e3)' }}>Payment Received!</h1>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                            Your deposit of <strong style={goldText}>${info.depositAmount.toFixed(2)}</strong> has been secured. Production will begin shortly.
                        </p>
                        <div style={{
                            padding: '16px', borderRadius: '10px', background: 'rgba(212,168,83,0.06)',
                            border: '1px solid rgba(212,168,83,0.15)', marginBottom: '24px', fontSize: '0.82rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>Project</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary, #e8e6e3)' }}>{info.projectTitle}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>Amount Paid</span>
                                <span style={{ fontWeight: 700, ...goldText }}>${info.depositAmount.toFixed(2)}</span>
                            </div>
                        </div>
                        <Link
                            href={`/my-projects?id=${info.projectId}&token=${token}`}
                            style={{
                                display: 'inline-block', padding: '12px 28px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #d4a853, #c49b3a)', color: '#0f1115',
                                fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none',
                            }}
                        >
                            Track Your Project
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // ── Ready to pay ──
    if (!info) return null

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #0d0d12)', padding: '20px' }}>
            <div style={{ ...card, width: '100%' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                        <span style={goldText}>AIM</span>{' '}
                        <span style={{ color: 'var(--text-primary, #e8e6e3)' }}>Studio</span>
                    </span>
                </div>

                <h1 style={{ fontSize: '1.2rem', fontWeight: 800, textAlign: 'center', marginBottom: '6px', color: 'var(--text-primary, #e8e6e3)' }}>
                    Pay Deposit
                </h1>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px' }}>
                    Secure your project with a 40% deposit
                </p>

                {/* Project summary */}
                <div style={{
                    padding: '18px', borderRadius: '10px',
                    background: 'rgba(212,168,83,0.04)', border: '1px solid rgba(212,168,83,0.12)',
                    marginBottom: '20px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Project</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary, #e8e6e3)' }}>{info.projectTitle}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Project Total</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary, #e8e6e3)' }}>${info.agreedTotal.toFixed(2)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                        <span style={{ fontWeight: 700, ...goldText }}>Deposit Due (40%)</span>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem', ...goldText }}>${info.depositAmount.toFixed(2)}</span>
                    </div>
                </div>

                {/* Milestone breakdown */}
                <div style={{
                    padding: '14px 16px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '24px', fontSize: '0.75rem',
                }}>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '8px', fontSize: '0.65rem' }}>
                        Payment Schedule
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: '#34d399' }}>●</span>
                        <span style={{ color: 'var(--text-primary, #e8e6e3)', fontWeight: 600 }}>Deposit (40%) — ${info.depositAmount.toFixed(2)} — Due now</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>○</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>Midpoint (30%) — ${(Math.round(info.agreedTotal * 0.3 * 100) / 100).toFixed(2)} — After rough cut</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>○</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>Final (30%) — ${(Math.round(info.agreedTotal * 0.3 * 100) / 100).toFixed(2)} — Before delivery</span>
                    </div>
                </div>

                {/* PayPal buttons */}
                {error && (
                    <div style={{
                        padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#f87171', fontSize: '0.82rem', fontWeight: 600,
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <div id="paypal-pay-buttons" ref={paypalRef} style={{ minHeight: '55px', marginBottom: '16px' }}>
                    {!paypalReady && (
                        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                            Loading PayPal...
                        </div>
                    )}
                </div>

                {/* Security note */}
                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                    🔒 Payments secured by PayPal Purchase Protection
                </p>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
        </div>
    )
}
