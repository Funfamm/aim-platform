'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Footer from '@/components/Footer'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations } from 'next-intl'

declare global {
    interface Window {
        paypal?: {
            Buttons: (config: Record<string, unknown>) => { render: (selector: string) => void; close: () => void }
        }
    }
}

export default function DonatePage() {
    const t = useTranslations('donate')
    const [selectedAmount, setSelectedAmount] = useState<number | null>(50)
    const [customAmount, setCustomAmount] = useState('')
    const [form, setForm] = useState({ name: '', email: '', message: '' })
    const [anonymous, setAnonymous] = useState(false)
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'disabled'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [bgImages, setBgImages] = useState<string[]>([])
    const [currentBg, setCurrentBg] = useState(0)
    const [mounted, setMounted] = useState(false)
    const [showPaypal, setShowPaypal] = useState(false)
    const [paypalReady, setPaypalReady] = useState(false)
    const paypalRef = useRef<HTMLDivElement>(null)
    const paypalButtonsRef = useRef<{ close: () => void } | null>(null)

    // Settings from admin
    const [donationsEnabled, setDonationsEnabled] = useState(true)
    const [minAmount, setMinAmount] = useState(1)
    const [settingsLoaded, setSettingsLoaded] = useState(false)

    const finalAmount = selectedAmount || (customAmount ? parseFloat(customAmount) : 0)

    useEffect(() => { setMounted(true) }, [])

    // Load PayPal JS SDK
    useEffect(() => {
        const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
        if (!clientId || document.getElementById('paypal-sdk')) {
            if (window.paypal) setPaypalReady(true)
            return
        }
        const script = document.createElement('script')
        script.id = 'paypal-sdk'
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`
        script.async = true
        script.onload = () => setPaypalReady(true)
        document.head.appendChild(script)
    }, [])

    // Fetch donation settings
    useEffect(() => {
        fetch('/api/site-settings')
            .then(r => r.json())
            .then(data => {
                if (typeof data.donationsEnabled === 'boolean') setDonationsEnabled(data.donationsEnabled)
                if (typeof data.donationMinAmount === 'number' && data.donationMinAmount > 0) setMinAmount(data.donationMinAmount)
                if (!data.donationsEnabled) setStatus('disabled')
                if (data.requireLoginForDonate) {
                    fetch('/api/auth/session').then(r => r.json()).then(session => {
                        if (!session?.user) window.location.href = '/login'
                    }).catch(() => { window.location.href = '/login' })
                }
            })
            .catch(() => { /* defaults */ })
            .finally(() => setSettingsLoaded(true))
    }, [])

    // Fetch background images
    useEffect(() => {
        fetch('/api/admin/media?page=donate')
            .then(r => r.json())
            .then(data => {
                const urls = data.filter((m: { type: string }) => m.type === 'background').map((m: { url: string }) => m.url)
                if (urls.length > 0) setBgImages(urls)
                else setBgImages(['/images/donate-bg.png'])
            })
            .catch(() => { setBgImages(['/images/donate-bg.png']) })
    }, [])

    useEffect(() => {
        if (bgImages.length <= 1) return
        const timer = setInterval(() => setCurrentBg(p => (p + 1) % bgImages.length), 6000)
        return () => clearInterval(timer)
    }, [bgImages])

    // Render PayPal buttons when showPaypal is true and SDK is ready
    const renderPayPalButtons = useCallback(() => {
        if (!window.paypal || !paypalRef.current) return

        // Clear any old buttons
        if (paypalButtonsRef.current) {
            try { paypalButtonsRef.current.close() } catch { /* ignore */ }
        }
        paypalRef.current.innerHTML = ''

        const currentAmount = finalAmount
        const currentForm = form
        const currentAnonymous = anonymous

        const buttons = window.paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'gold',
                shape: 'rect',
                label: 'donate',
                height: 45,
            },
            createOrder: async () => {
                const res = await fetch('/api/donate/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...currentForm,
                        amount: currentAmount,
                        anonymous: currentAnonymous,
                    }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Failed to create order')
                return data.orderID
            },
            onApprove: async (data: { orderID: string }) => {
                setStatus('sending')
                try {
                    const res = await fetch('/api/donate/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderID: data.orderID }),
                    })
                    if (res.ok) {
                        setStatus('sent')
                    } else {
                        const errData = await res.json()
                        setErrorMsg(errData.error || 'Payment failed')
                        setStatus('error')
                    }
                } catch {
                    setErrorMsg('Payment processing error')
                    setStatus('error')
                }
            },
            onError: (err: Error) => {
                console.error('PayPal error:', err)
                setErrorMsg('Payment failed. Please try again.')
                setStatus('error')
            },
            onCancel: () => {
                setErrorMsg('Payment was canceled. You can try again.')
                setStatus('error')
                setShowPaypal(false)
            },
        })

        buttons.render('#paypal-button-container')
        paypalButtonsRef.current = buttons
    }, [finalAmount, form, anonymous])

    useEffect(() => {
        if (showPaypal && paypalReady) {
            // Small delay to let DOM mount
            const timer = setTimeout(() => renderPayPalButtons(), 100)
            return () => clearTimeout(timer)
        }
    }, [showPaypal, paypalReady, renderPayPalButtons])

    // Validate and show PayPal buttons
    const handleProceedToPayment = () => {
        setErrorMsg('')
        if (!finalAmount || finalAmount <= 0) return
        if (finalAmount < minAmount) {
            setErrorMsg(`${t('errorMinAmount')} $${minAmount}`)
            return
        }
        if (!anonymous && !form.name) {
            setErrorMsg(t('errorNameRequired'))
            return
        }
        if (!form.email) {
            setErrorMsg(t('emailLabel') + ' is required')
            return
        }
        setShowPaypal(true)
    }

    const inputStyle = {
        width: '100%',
        padding: '0.75rem 1rem',
        background: 'rgba(5,5,8,0.8)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        fontSize: '0.9rem',
        outline: 'none',
    }

    const suggestedAmounts = [
        Math.max(minAmount, 10),
        Math.max(minAmount, 25),
        Math.max(minAmount, 50),
        Math.max(minAmount, 100),
        Math.max(minAmount, 250),
        Math.max(minAmount, 500),
    ].filter((v, i, a) => a.indexOf(v) === i)

    return (
        <>
<main id="main-content" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
                {/* Background images from DB */}
                {mounted && bgImages.map((src, i) => (
                    <div key={src} style={{
                        position: 'fixed', inset: 0, zIndex: 0,
                        backgroundImage: `url(${src})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        filter: 'brightness(0.75) saturate(0.9)',
                        opacity: currentBg === i ? 1 : 0,
                        transition: 'opacity 1.5s ease-in-out',
                    }} />
                ))}
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1,
                    background: 'linear-gradient(to bottom, rgba(13,15,20,0.15) 0%, rgba(13,15,20,0.5) 60%, rgba(13,15,20,0.8) 100%)',
                }} />

                <section style={{
                    position: 'relative', zIndex: 2,
                    padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-3xl)',
                    textAlign: 'center',
                }}>
                    <div className="container" style={{ maxWidth: '600px' }}>
                        <ScrollReveal3D direction="up" distance={40}>
                            <span className="text-label">{t('label')}</span>
                            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: 'var(--space-md)', lineHeight: 1.2 }}>
                                {t('title')} <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{t('titleAccent')}</span>
                            </h1>
                            <div className="divider divider-center" />
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: 'var(--space-sm)', lineHeight: 1.7, textAlign: 'center', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                                {t('description')}
                            </p>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: 'var(--space-2xl)', textAlign: 'center', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
                                {t('descSub')}
                            </p>
                        </ScrollReveal3D>

                        <ScrollReveal3D direction="up" delay={150} distance={30}>
                            <div style={{
                                background: 'rgba(10,10,16,0.85)', backdropFilter: 'blur(20px)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)', textAlign: 'left',
                            }}>
                                {/* Donations Disabled State */}
                                {!donationsEnabled && settingsLoaded ? (
                                    <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🚫</div>
                                        <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.3rem' }}>{t('pausedTitle')}</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                                            {t('pausedDesc')}
                                        </p>
                                    </div>
                                ) : status === 'sent' ? (
                                    <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                                        <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-md)' }}>🌟</div>
                                        <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.4rem' }}>{t('thankTitle')}</h3>
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '1rem' }}>
                                            {t('thankDesc')}
                                            {anonymous && <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>🤫 {t('thankPrivate')}</span>}
                                        </p>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                                            {t('thankFooter')}
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{
                                            padding: 'var(--space-md)', background: 'rgba(212,168,83,0.06)',
                                            border: '1px solid rgba(212,168,83,0.1)', borderRadius: 'var(--radius-md)',
                                            marginBottom: 'var(--space-lg)', textAlign: 'center',
                                        }}>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
                                                ✨ &quot;{t('quote')}&quot;
                                            </p>
                                        </div>

                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                            {t('chooseImpact')}
                                        </label>
                                        <div className="grid-3col" style={{ marginBottom: 'var(--space-md)' }}>
                                            {suggestedAmounts.map((amt) => (
                                                <button key={amt} type="button"
                                                    onClick={() => { setSelectedAmount(amt); setCustomAmount(''); setShowPaypal(false) }}
                                                    style={{
                                                        padding: '0.7rem', borderRadius: 'var(--radius-md)',
                                                        border: selectedAmount === amt ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                                                        background: selectedAmount === amt ? 'rgba(212,168,83,0.12)' : 'rgba(5,5,8,0.6)',
                                                        color: selectedAmount === amt ? 'var(--accent-gold)' : 'var(--text-primary)',
                                                        fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s',
                                                    }}>
                                                    ${amt}
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ marginBottom: 'var(--space-md)' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                                {t('customAmount')} {minAmount > 1 && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({t('minLabel')} ${minAmount})</span>}
                                            </label>
                                            <input type="number" min={minAmount} value={customAmount}
                                                onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); setShowPaypal(false) }}
                                                placeholder={t('amountPlaceholder', { min: minAmount })} style={inputStyle} />
                                        </div>

                                        {/* ── Anonymous Donor Toggle ── */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '0.7rem 1rem', marginBottom: 'var(--space-md)',
                                            background: anonymous ? 'rgba(139,92,246,0.08)' : 'rgba(5,5,8,0.4)',
                                            border: `1px solid ${anonymous ? 'rgba(139,92,246,0.2)' : 'var(--border-subtle)'}`,
                                            borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                            onClick={() => setAnonymous(!anonymous)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '1.1rem' }}>{anonymous ? '🤫' : '👤'}</span>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: anonymous ? '#a78bfa' : 'var(--text-secondary)' }}>
                                                        {t('donateAnon')}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                                        {anonymous ? t('anonHidden') : t('anonToggle')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{
                                                width: '40px', height: '22px', borderRadius: '11px',
                                                background: anonymous ? '#8b5cf6' : 'var(--bg-tertiary)',
                                                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                                            }}>
                                                <div style={{
                                                    position: 'absolute', top: '2px',
                                                    left: anonymous ? '20px' : '2px',
                                                    width: '18px', height: '18px', borderRadius: '50%',
                                                    background: anonymous ? '#fff' : 'var(--text-tertiary)',
                                                    transition: 'left 0.2s, background 0.2s',
                                                }} />
                                            </div>
                                        </div>

                                        {/* Name / Email fields — Name hidden when anonymous */}
                                        <div className="form-grid-2col" style={{ marginBottom: 'var(--space-md)' }}>
                                            {!anonymous && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('nameLabel')} *</label>
                                                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required={!anonymous} placeholder={t('namePlaceholder')} style={inputStyle} />
                                                </div>
                                            )}
                                            <div style={anonymous ? { gridColumn: '1 / -1' } : {}}>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('emailLabel')} *</label>
                                                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder={t('emailPlaceholder')} style={inputStyle} />
                                                {anonymous && <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>{t('emailPrivate')}</p>}
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('messageLabel')}</label>
                                            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} placeholder={t('messagePlaceholder')} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }} />
                                        </div>

                                        {(status === 'error' || errorMsg) && (
                                            <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.85rem' }}>
                                                {errorMsg || t('errorDefault')}
                                            </div>
                                        )}

                                        {/* PayPal Buttons or Proceed Button */}
                                        {showPaypal ? (
                                            <div>
                                                {/* Summary */}
                                                <div style={{
                                                    padding: 'var(--space-md)',
                                                    background: 'rgba(212,168,83,0.08)',
                                                    border: '1px solid rgba(212,168,83,0.15)',
                                                    borderRadius: 'var(--radius-md)',
                                                    marginBottom: 'var(--space-md)',
                                                    textAlign: 'center',
                                                }}>
                                                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                        Donating <strong style={{ color: 'var(--accent-gold)', fontSize: '1.2rem' }}>${finalAmount.toFixed(2)}</strong>
                                                        {!anonymous && form.name && <> as <strong>{form.name}</strong></>}
                                                    </p>
                                                </div>

                                                {/* PayPal Button Container */}
                                                <div
                                                    id="paypal-button-container"
                                                    ref={paypalRef}
                                                    style={{ minHeight: '55px', marginBottom: 'var(--space-md)' }}
                                                >
                                                    {!paypalReady && (
                                                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-tertiary)' }}>
                                                            Loading payment options...
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Back button */}
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowPaypal(false); setErrorMsg('') }}
                                                    style={{
                                                        width: '100%', padding: '0.6rem', fontSize: '0.85rem',
                                                        background: 'transparent', border: '1px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)', color: 'var(--text-tertiary)',
                                                        cursor: 'pointer', transition: 'all 0.2s',
                                                    }}
                                                >
                                                    ← Change amount or details
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleProceedToPayment}
                                                disabled={status === 'sending' || !finalAmount || finalAmount < minAmount}
                                                className="btn btn-primary"
                                                style={{
                                                    width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700,
                                                    opacity: finalAmount && finalAmount >= minAmount ? 1 : 0.5,
                                                }}
                                            >
                                                {status === 'sending' ? t('processing') : `${t('donateBtn')} $${finalAmount || '-'}`}
                                            </button>
                                        )}

                                        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-md)' }}>
                                            🔒 Secured by PayPal — {t('donateFooter')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ScrollReveal3D>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
