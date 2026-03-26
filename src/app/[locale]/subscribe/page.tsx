'use client'

import { useState, useEffect, FormEvent } from 'react'
import Footer from '@/components/Footer'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations } from 'next-intl'

const DEFAULT_IMAGES = [
    '/images/notify-bg-1.png',
    '/images/notify-bg-2.png',
    '/images/notify-bg-3.png',
]

export default function SubscribePage() {
    const t = useTranslations('subscribe')
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
    const [bgImages, setBgImages] = useState<string[]>(DEFAULT_IMAGES)
    const [currentBg, setCurrentBg] = useState(0)

    useEffect(() => {
        fetch('/api/admin/media?page=subscribe')
            .then(r => r.json())
            .then(data => {
                const urls = data.filter((m: { type: string }) => m.type === 'background').map((m: { url: string }) => m.url)
                if (urls.length > 0) setBgImages(urls)
            })
            .catch(() => { })
    }, [])

    useEffect(() => {
        if (bgImages.length <= 1) return
        const timer = setInterval(() => {
            setCurrentBg((prev) => (prev + 1) % bgImages.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [bgImages])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setStatus('sending')
        try {
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            if (res.ok) { setStatus('sent'); setEmail('') }
            else setStatus('error')
        } catch { setStatus('error') }
    }

    return (
        <>
<main id="main-content" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
                {/* Rotating background images from DB */}
                {bgImages.map((src, i) => (
                    <div key={src} style={{
                        position: 'fixed', inset: 0, zIndex: 0,
                        backgroundImage: `url(${src})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        filter: 'brightness(0.75) saturate(0.85)',
                        opacity: currentBg === i ? 1 : 0,
                        transition: 'opacity 1.5s ease-in-out',
                    }} />
                ))}
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1,
                    background: 'linear-gradient(to bottom, rgba(13,15,20,0.1) 0%, rgba(13,15,20,0.45) 50%, rgba(13,15,20,0.8) 100%)',
                }} />

                <section style={{
                    position: 'relative', zIndex: 2,
                    minHeight: '100vh', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: 'var(--space-2xl) var(--space-lg)',
                }}>
                    <div className="container" style={{ maxWidth: '500px', textAlign: 'center' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🔔</div>
                            <span className="text-label">{t('label')}</span>
                            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 800, marginBottom: 'var(--space-md)', lineHeight: 1.2 }}>
                                {t('title')} <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{t('titleAccent')}</span>
                            </h1>
                            <div className="divider divider-center" />
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2xl)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                                {t('description')}
                            </p>

                            <div style={{
                                background: 'rgba(10,10,16,0.8)', backdropFilter: 'blur(20px)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)',
                            }}>
                                {status === 'sent' ? (
                                    <div style={{ padding: 'var(--space-lg) 0' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>✅</div>
                                        <h3 style={{ marginBottom: 'var(--space-xs)' }}>{t('subscribedTitle')}</h3>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                                            {t('subscribedDesc')}
                                        </p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit}>
                                        <input
                                            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                            required placeholder={t('emailPlaceholder')}
                                            style={{
                                                width: '100%', padding: '0.75rem 1rem', marginBottom: 'var(--space-md)',
                                                background: 'rgba(5,5,8,0.8)', border: '1px solid var(--border-subtle)',
                                                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                                fontSize: '0.9rem', outline: 'none',
                                            }}
                                        />
                                        {status === 'error' && (
                                            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 'var(--space-sm)' }}>
                                                {t('error')}
                                            </p>
                                        )}
                                        <button type="submit" disabled={status === 'sending'} className="btn btn-primary"
                                            style={{ width: '100%', padding: '0.8rem', fontWeight: 700 }}>
                                            {status === 'sending' ? t('submitting') : t('submitBtn')}
                                        </button>
                                    </form>
                                )}
                            </div>

                            {/* Dot indicators */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: 'var(--space-lg)' }}>
                                {bgImages.map((_, i) => (
                                    <button key={i} onClick={() => setCurrentBg(i)} style={{
                                        width: currentBg === i ? '24px' : '8px', height: '8px',
                                        borderRadius: 'var(--radius-full)',
                                        background: currentBg === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.2)',
                                        border: 'none', cursor: 'pointer', transition: 'all 0.4s ease',
                                    }} />
                                ))}
                            </div>
                        </ScrollReveal3D>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
