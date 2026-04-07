'use client'

import { useState, useEffect, FormEvent } from 'react'
import Footer from '@/components/Footer'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations, useLocale } from 'next-intl'


export default function ContactPage() {
    const t = useTranslations('contact')
    const locale = useLocale()
    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
    const [heroImage, setHeroImage] = useState('')

    useEffect(() => {
        fetch('/api/page-media?page=contact')
            .then(r => r.ok ? r.json() : [])
            .then((items: { url: string; type: string }[]) => {
                const img = items.find(m => m.type === 'background' || m.type === 'image')
                if (img) setHeroImage(img.url)
            })
            .catch(() => { })
    }, [])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setStatus('sending')
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, locale }),
            })
            if (res.ok) {
                setStatus('sent')
                setForm({ name: '', email: '', subject: '', message: '' })
            } else {
                setStatus('error')
            }
        } catch {
            setStatus('error')
        }
    }

    const inputStyle = {
        width: '100%',
        padding: '0.75rem 1rem',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        fontSize: '0.9rem',
        outline: 'none',
    }

    return (
        <>
            <main id="main-content">
                <section style={{
                    padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-5xl)',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Page Media background image */}
                    {heroImage && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: `url(${heroImage})`,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            backgroundAttachment: 'fixed',
                            opacity: 0.35,
                            filter: 'brightness(0.6)',
                            transition: 'opacity 0.8s ease',
                        }} />
                    )}
                    <div className="container" style={{ maxWidth: '600px' }}>
                        <ScrollReveal3D direction="up" distance={40}>
                            <span className="text-label">{t('label')}</span>
                            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: 'var(--space-md)' }}>
                                {t('title')} <span style={{ color: 'var(--accent-gold)' }}>{t('titleAccent')}</span>
                            </h1>
                            <div className="divider divider-center" />
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '1rem', marginBottom: 'var(--space-2xl)' }}>
                                {t('description')}
                            </p>
                        </ScrollReveal3D>

                        <ScrollReveal3D direction="up" delay={150} distance={30}>
                            <div style={{
                                background: 'var(--bg-glass-light)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-xl)',
                                padding: 'var(--space-xl)',
                                backdropFilter: 'blur(20px)',
                                textAlign: 'left',
                            }}>
                                {status === 'sent' ? (
                                    <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>✉️</div>
                                        <h3 style={{ marginBottom: 'var(--space-sm)' }}>{t('sentTitle')}</h3>
                                        <p style={{ color: 'var(--text-tertiary)' }}>{t('sentDesc')}</p>
                                        <button
                                            onClick={() => setStatus('idle')}
                                            className="btn btn-secondary btn-sm"
                                            style={{ marginTop: 'var(--space-lg)' }}
                                        >
                                            {t('sendAnother')}
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit}>
                                        <div className="form-grid-2col" style={{ marginBottom: 'var(--space-md)' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('name')}</label>
                                                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder={t('namePlaceholder')} style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('email')}</label>
                                                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder={t('emailPlaceholder')} style={inputStyle} />
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: 'var(--space-md)' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('subject')}</label>
                                            <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder={t('subjectPlaceholder')} style={inputStyle} />
                                        </div>
                                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('message')}</label>
                                            <textarea
                                                value={form.message}
                                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                                required
                                                rows={5}
                                                placeholder={t('messagePlaceholder')}
                                                style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}
                                            />
                                        </div>
                                        {status === 'error' && (
                                            <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.85rem' }}>
                                                {t('errorMsg')}
                                            </div>
                                        )}
                                        <button type="submit" disabled={status === 'sending'} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700, opacity: status === 'sending' ? 0.7 : 1 }}>
                                            {status === 'sending' ? t('sending') : t('sendMessage')}
                                        </button>
                                    </form>
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
