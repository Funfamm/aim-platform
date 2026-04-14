'use client'

import { useState, useEffect, FormEvent } from 'react'
import Footer from '@/components/Footer'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/components/AuthProvider'


export default function ContactPage() {
    const t = useTranslations('contact')
    const locale = useLocale()
    const { user, loading: authLoading } = useAuth()
    // Unified form state — guests use all 4 fields;
    // logged-in users: name & email are read from session, only subject & message go into state
    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
    const [heroImage, setHeroImage] = useState('')
    // Honeypot — must remain empty; bots auto-fill hidden fields
    const [gotcha, setGotcha] = useState('')

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
        // Always resolve identity from session for logged-in users — prevents client spoofing
        const resolvedName = user ? (user.name || '') : form.name
        const resolvedEmail = user ? (user.email || '') : form.email
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: resolvedName, email: resolvedEmail, subject: form.subject, message: form.message, locale, _gotcha: gotcha }),
            })
            if (res.ok) {
                setStatus('sent')
                // Reset only the free-text fields — name/email are always re-derived from session
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
                    zIndex: 1,
                }}>
                    {/* Page Media background image */}
                    {heroImage && (
                        <>
                            <style>{`
                                .contact-bg {
                                    position: fixed;
                                    inset: 0;
                                    background-image: var(--contact-bg-url);
                                    background-size: cover;
                                    background-position: center;
                                    opacity: 0.35;
                                    filter: brightness(0.6);
                                    transition: opacity 0.8s ease;
                                    z-index: 0;
                                    pointer-events: none;
                                }
                                @media (max-width: 768px) {
                                    .contact-bg {
                                        position: absolute;
                                        background-attachment: scroll;
                                    }
                                }
                            `}</style>
                            <div
                                className="contact-bg"
                                style={{ ['--contact-bg-url' as string]: `url(${heroImage})` }}
                            />
                        </>
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
                                        {/* Loading guard — prevents flash of empty fields while auth hydrates */}
                                        {authLoading ? (
                                            <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                                                {t('loading')}
                                            </div>
                                        ) : (
                                        <div className="form-grid-2col" style={{ marginBottom: 'var(--space-md)' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                                    {t('name')}
                                                    {user && <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '0.04em' }}>🔒 {t('autoFilled')}</span>}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={user ? (user.name || '') : form.name}
                                                    onChange={(e) => !user && setForm(prev => ({ ...prev, name: e.target.value }))}
                                                    readOnly={!!user}
                                                    required
                                                    placeholder={t('namePlaceholder')}
                                                    style={{
                                                        ...inputStyle,
                                                        ...(user ? { opacity: 0.65, cursor: 'default', background: 'rgba(255,255,255,0.03)' } : {}),
                                                    }}
                                                    onInvalid={e => (e.target as HTMLInputElement).setCustomValidity(t('validationRequired'))}
                                                    onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                                    {t('email')}
                                                    {user && <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '0.04em' }}>🔒 {t('autoFilled')}</span>}
                                                </label>
                                                <input
                                                    type="email"
                                                    value={user ? (user.email || '') : form.email}
                                                    onChange={(e) => !user && setForm(prev => ({ ...prev, email: e.target.value }))}
                                                    readOnly={!!user}
                                                    required
                                                    placeholder={t('emailPlaceholder')}
                                                    style={{
                                                        ...inputStyle,
                                                        ...(user ? { opacity: 0.65, cursor: 'default', background: 'rgba(255,255,255,0.03)' } : {}),
                                                    }}
                                                    onInvalid={e => (e.target as HTMLInputElement).setCustomValidity(t('validationRequired'))}
                                                    onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                                                />
                                            </div>
                                        </div>
                                        )}
                                        <div style={{ marginBottom: 'var(--space-md)' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('subject')}</label>
                                            <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder={t('subjectPlaceholder')} style={inputStyle}
                                                onInvalid={e => (e.target as HTMLInputElement).setCustomValidity(t('validationRequired'))}
                                                onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                                            />
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
                                                onInvalid={e => (e.target as HTMLTextAreaElement).setCustomValidity(t('validationRequired'))}
                                                onInput={e => (e.target as HTMLTextAreaElement).setCustomValidity('')}
                                            />
                                        </div>
                                        {status === 'error' && (
                                            <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.85rem' }}>
                                                {t('errorMsg')}
                                            </div>
                                        )}
                                        {/* Honeypot — hidden from humans, auto-filled by bots */}
                                        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
                                            <input
                                                type="text"
                                                name="_gotcha"
                                                tabIndex={-1}
                                                autoComplete="off"
                                                value={gotcha}
                                                onChange={e => setGotcha(e.target.value)}
                                            />
                                        </div>
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
