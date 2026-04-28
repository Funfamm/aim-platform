'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

declare global {
    interface Window {
        paypal?: {
            Buttons: (config: Record<string, unknown>) => { render: (selector: string) => void; close: () => void }
        }
    }
}

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    onSubmit: () => void
    isSubmitting: boolean
}

export default function DepositStep({ form, updateField, onSubmit, isSubmitting }: Props) {
    const t = useTranslations('startProject')
    const [paypalReady, setPaypalReady] = useState(false)
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const paypalRef = useRef<HTMLDivElement>(null)
    const paypalButtonsRef = useRef<{ close: () => void } | null>(null)

    const depositAmount = form.agreedProjectTotal
        ? Math.round(form.agreedProjectTotal * 0.4 * 100) / 100
        : 0
    const midpointAmount = form.agreedProjectTotal
        ? Math.round(form.agreedProjectTotal * 0.3 * 100) / 100
        : 0
    const finalAmount = form.agreedProjectTotal
        ? Math.round(form.agreedProjectTotal * 0.3 * 100) / 100
        : 0

    // ── SDK loading state (computed, not set in effect) ─────────────────────
    const [sdkError, setSdkError] = useState('')
    const [sdkLoaded, setSdkLoaded] = useState(false)

    // Load PayPal SDK (may already be loaded by donate page)
    useEffect(() => {
        const isSandbox = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'sandbox'
        const clientId = isSandbox
            ? process.env.NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID
            : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID

        if (!clientId) {
            // Defer state update to avoid set-state-in-effect lint
            queueMicrotask(() => setSdkError('PayPal is not configured. Please contact support.'))
            return
        }

        if (document.getElementById('paypal-sdk')) {
            if (window.paypal) {
                queueMicrotask(() => setSdkLoaded(true))
            } else {
                const timer = setInterval(() => {
                    if (window.paypal) {
                        setSdkLoaded(true)
                        clearInterval(timer)
                    }
                }, 200)
                setTimeout(() => clearInterval(timer), 10000)
            }
            return
        }

        const script = document.createElement('script')
        script.id = 'paypal-sdk'
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`
        script.async = true
        script.onload = () => setSdkLoaded(true)
        script.onerror = () => setSdkError('Failed to load PayPal. Please refresh.')
        document.head.appendChild(script)
    }, [])

    // Sync sdkLoaded/sdkError into component state
    useEffect(() => {
        if (sdkLoaded) setPaypalReady(true)
        if (sdkError) setErrorMsg(sdkError)
    }, [sdkLoaded, sdkError])

    // Keep form data in a ref so PayPal callbacks always read latest values
    const formRef = useRef(form)
    useEffect(() => { formRef.current = form }, [form])

    // Render PayPal buttons — inline in effect to avoid memoization issues
    useEffect(() => {
        if (!paypalReady || depositAmount <= 0 || paymentStatus !== 'idle') return

        const timer = setTimeout(() => {
            if (!window.paypal || !paypalRef.current || !depositAmount) return

            if (paypalButtonsRef.current) {
                try { paypalButtonsRef.current.close() } catch { /* ignore */ }
            }
            paypalRef.current.innerHTML = ''

            const buttons = window.paypal.Buttons({
                style: {
                    layout: 'vertical',
                    color: 'gold',
                    shape: 'rect',
                    label: 'pay',
                    height: 50,
                },
                createOrder: async () => {
                    const f = formRef.current
                    const res = await fetch('/api/project-payments/create-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectRequestId: null,
                            milestone: 'deposit',
                            amount: depositAmount,
                            clientName: f.clientName,
                            email: f.email,
                        }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Failed to create order')
                    return data.orderID
                },
                onApprove: async (data: { orderID: string }) => {
                    setPaymentStatus('processing')
                    try {
                        const res = await fetch('/api/project-payments/capture-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderID: data.orderID }),
                        })
                        const result = await res.json()
                        if (res.ok && result.success) {
                            updateField('depositPayment', {
                                paypalOrderId: data.orderID,
                                paypalCaptureId: result.payment.paypalCaptureId,
                                amount: result.payment.amount || depositAmount,
                            })
                            setPaymentStatus('completed')
                        } else {
                            setErrorMsg(result.error || 'Payment failed')
                            setPaymentStatus('error')
                        }
                    } catch {
                        setErrorMsg('Payment processing error. Please try again.')
                        setPaymentStatus('error')
                    }
                },
                onError: (err: Error) => {
                    console.error('PayPal error:', err)
                    setErrorMsg('PayPal error. Please try again.')
                    setPaymentStatus('error')
                },
                onCancel: () => {
                    setErrorMsg('Payment was cancelled.')
                    setPaymentStatus('idle')
                },
            })

            buttons.render('#deposit-paypal-container')
            paypalButtonsRef.current = buttons
        }, 150)

        return () => clearTimeout(timer)
    }, [paypalReady, depositAmount, paymentStatus, updateField])

    // Already paid — show confirmation and submit button
    if (form.depositPayment || paymentStatus === 'completed') {
        return (
            <section>
                <h2 className="sp-step-title">{t('steps.deposit') || 'Secure Your Project'}</h2>

                <div style={{
                    textAlign: 'center',
                    padding: 'var(--space-2xl) var(--space-lg)',
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto var(--space-lg)',
                        fontSize: '1.8rem',
                    }}>
                        ✅
                    </div>

                    <h3 style={{ fontSize: '1.2rem', color: '#34d399', marginBottom: 'var(--space-sm)' }}>
                        {t('deposit.paymentReceived') || 'Deposit Payment Received'}
                    </h3>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)', marginBottom: 'var(--space-sm)' }}>
                        ${(form.depositPayment?.amount || depositAmount).toFixed(2)}
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-xl)' }}>
                        {t('deposit.readyToSubmit') || 'Your deposit is secured. Submit your project to get started!'}
                    </p>

                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={isSubmitting}
                        className="sp-btn sp-btn-primary"
                        style={{
                            width: '100%',
                            padding: '16px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            opacity: isSubmitting ? 0.6 : 1,
                        }}
                    >
                        {isSubmitting ? `⏳ ${t('buttons.submitting') || 'Submitting...'}` : `🚀 ${t('buttons.submit') || 'Submit Project'}`}
                    </button>

                    <p style={{
                        fontSize: '0.72rem', color: 'var(--text-tertiary)',
                        marginTop: 'var(--space-md)', textAlign: 'center',
                    }}>
                        🔒 {t('deposit.securedNote') || 'Your payment is protected by PayPal Purchase Protection.'}
                    </p>
                </div>
            </section>
        )
    }

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.deposit') || 'Secure Your Project'}</h2>
            <p className="sp-step-subtitle" style={{ marginBottom: 'var(--space-lg)' }}>
                {t('deposit.subtitle') || 'Pay a 40% deposit to confirm your project booking. The remaining balance is invoiced at production milestones.'}
            </p>

            {/* ── Payment Schedule Overview ── */}
            <div style={{
                background: 'rgba(212,168,83,0.04)',
                border: '1px solid rgba(212,168,83,0.15)',
                borderRadius: 'var(--radius-lg)',
                padding: 'clamp(16px, 3vw, 24px)',
                marginBottom: 'var(--space-lg)',
            }}>
                <div style={{
                    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)',
                }}>
                    {t('deposit.scheduleTitle') || 'Payment Schedule'}
                </div>

                {/* Milestone rows */}
                {[
                    { label: t('deposit.milestoneDeposit') || 'Deposit — Due Now', pct: '40%', amount: depositAmount, active: true },
                    { label: t('deposit.milestoneMidpoint') || 'Midpoint — After Rough Cut', pct: '30%', amount: midpointAmount, active: false },
                    { label: t('deposit.milestoneFinal') || 'Final — Before Delivery', pct: '30%', amount: finalAmount, active: false },
                ].map((m, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', marginBottom: i < 2 ? '8px' : 0,
                        borderRadius: 'var(--radius-md)',
                        background: m.active ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${m.active ? 'rgba(212,168,83,0.25)' : 'rgba(255,255,255,0.04)'}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: m.active ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                opacity: m.active ? 1 : 0.3,
                            }} />
                            <span style={{
                                fontSize: '0.82rem',
                                fontWeight: m.active ? 700 : 500,
                                color: m.active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            }}>
                                {m.label}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 600,
                                color: 'var(--text-tertiary)',
                                background: 'rgba(255,255,255,0.04)',
                                padding: '2px 8px', borderRadius: '10px',
                            }}>
                                {m.pct}
                            </span>
                            <span style={{
                                fontSize: '0.9rem',
                                fontWeight: m.active ? 800 : 600,
                                color: m.active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono, monospace)',
                            }}>
                                ${m.amount.toFixed(2)}
                            </span>
                        </div>
                    </div>
                ))}

                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.85rem', fontWeight: 700,
                }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                        {t('deposit.projectTotal') || 'Project Total'}
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
                        ${(form.agreedProjectTotal || 0).toFixed(2)}
                    </span>
                </div>
            </div>

            {/* ── Deposit Due Now card ── */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(212,168,83,0.08), rgba(212,168,83,0.03))',
                border: '1px solid rgba(212,168,83,0.25)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                textAlign: 'center',
                marginBottom: 'var(--space-lg)',
            }}>
                <div style={{
                    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '6px',
                }}>
                    {t('deposit.dueNow') || 'Due Now'}
                </div>
                <div style={{
                    fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-gold)',
                    lineHeight: 1.2, marginBottom: '4px',
                }}>
                    ${depositAmount.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    40% {t('deposit.ofTotal') || 'of'} ${(form.agreedProjectTotal || 0).toFixed(2)}
                </div>
            </div>

            {/* ── Error message ── */}
            {errorMsg && (
                <div style={{
                    marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.82rem',
                }}>
                    {errorMsg}
                </div>
            )}

            {/* ── PayPal Buttons ── */}
            <div
                id="deposit-paypal-container"
                ref={paypalRef}
                style={{ minHeight: '55px', marginBottom: 'var(--space-md)' }}
            >
                {!paypalReady && (
                    <div style={{
                        textAlign: 'center', padding: 'var(--space-lg)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                    }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            border: '3px solid rgba(212,168,83,0.15)',
                            borderTopColor: 'var(--accent-gold)',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                            {t('deposit.loadingPaypal') || 'Loading PayPal...'}
                        </span>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}
                {paymentStatus === 'processing' && (
                    <div style={{
                        textAlign: 'center', padding: 'var(--space-lg)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                    }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            border: '3px solid rgba(52,211,153,0.2)',
                            borderTopColor: '#34d399',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                        <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 600 }}>
                            {t('deposit.processing') || 'Processing payment...'}
                        </span>
                    </div>
                )}
            </div>

            <p style={{
                fontSize: '0.72rem', color: 'var(--text-tertiary)',
                textAlign: 'center', lineHeight: 1.6,
            }}>
                🔒 {t('deposit.securityNote') || 'Payments are securely processed by PayPal. Your financial details are never stored on our servers.'}
            </p>
        </section>
    )
}
