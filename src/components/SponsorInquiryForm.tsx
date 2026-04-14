'use client'

import { useState, FormEvent } from 'react'
import { useLocale } from 'next-intl'

interface Props {
    hasSponsor: boolean
}

const TIERS = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Custom / Let\'s Talk']

export default function SponsorInquiryForm({ hasSponsor }: Props) {
    const locale = useLocale()
    const [form, setForm] = useState({
        name: '', email: '', company: '', website: '',
        tier: '', message: '',
    })
    const [gotcha, setGotcha] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setStatus('sending')
        const subject = `Sponsorship Inquiry${form.tier ? ` — ${form.tier} Tier` : ''}${form.company ? ` (${form.company})` : ''}`
        const message = [
            form.company && `Company: ${form.company}`,
            form.website && `Website: ${form.website}`,
            form.tier && `Interested Tier: ${form.tier}`,
            '',
            form.message,
        ].filter(Boolean).join('\n')

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name, email: form.email,
                    subject, message, locale,
                    _gotcha: gotcha,
                }),
            })
            setStatus(res.ok ? 'sent' : 'error')
            if (res.ok) setForm({ name: '', email: '', company: '', website: '', tier: '', message: '' })
        } catch {
            setStatus('error')
        }
    }

    const inp: React.CSSProperties = {
        width: '100%', padding: '0.7rem 1rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: '12px',
        color: 'var(--text-primary)', fontSize: '0.88rem',
        fontFamily: 'inherit', outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    }
    const lbl: React.CSSProperties = {
        display: 'block', fontSize: '0.65rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-tertiary)', marginBottom: '5px',
    }

    if (status === 'sent') {
        return (
            <div style={{
                background: 'linear-gradient(145deg, rgba(52,211,153,0.07), rgba(212,168,83,0.04))',
                border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: '28px', padding: 'var(--space-3xl) var(--space-2xl)',
                textAlign: 'center', backdropFilter: 'blur(20px)',
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399', marginBottom: '8px' }}>
                    Inquiry Received!
                </h3>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.75 }}>
                    Thank you for your interest in partnering with AIM Studio. Our team will review your inquiry and be in touch within 48 hours.
                </p>
            </div>
        )
    }

    return (
        <div style={{
            background: 'linear-gradient(145deg, rgba(212,168,83,0.07), var(--bg-glass-light))',
            border: '1px solid rgba(212,168,83,0.14)',
            borderRadius: '28px', padding: 'var(--space-3xl) var(--space-2xl)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            position: 'relative', overflow: 'hidden',
        }}>
            {/* Gold accent lines */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.45), transparent)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.18), transparent)' }} />

            <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                <div style={{ fontSize: '2.8rem', marginBottom: 'var(--space-md)', filter: 'drop-shadow(0 0 20px rgba(212,168,83,0.3))' }}>🤝</div>
                <h3 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.6rem)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                    {hasSponsor ? 'Become a Sponsor' : 'Partner With Us'}
                </h3>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.88rem', maxWidth: '480px', margin: '0 auto', lineHeight: 1.75 }}>
                    Fill out the form below and our partnerships team will be in touch within 48 hours.
                </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Honeypot — must stay empty */}
                <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                    <input tabIndex={-1} autoComplete="off" value={gotcha} onChange={e => setGotcha(e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <label style={lbl}>Your Name *</label>
                        <input
                            id="sp-name" style={inp} required
                            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Jane Smith"
                        />
                    </div>
                    <div>
                        <label style={lbl}>Email Address *</label>
                        <input
                            id="sp-email" style={inp} required type="email"
                            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="jane@company.com"
                        />
                    </div>
                    <div>
                        <label style={lbl}>Company / Organization</label>
                        <input
                            id="sp-company" style={inp}
                            value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                            placeholder="Acme Corp"
                        />
                    </div>
                    <div>
                        <label style={lbl}>Website</label>
                        <input
                            id="sp-website" style={inp} type="url"
                            value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                            placeholder="https://acme.com"
                        />
                    </div>
                </div>

                <div>
                    <label style={lbl}>Interested Sponsorship Tier</label>
                    <select
                        id="sp-tier"
                        style={{ ...inp, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', colorScheme: 'dark' }}
                        value={form.tier}
                        onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
                    >
                        <option value="">Select a tier (optional)</option>
                        {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div>
                    <label style={lbl}>Message *</label>
                    <textarea
                        id="sp-message"
                        style={{ ...inp, minHeight: '110px', resize: 'vertical' }}
                        required
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="Tell us about your organization and what you're hoping to achieve through this partnership..."
                    />
                </div>

                <div style={{ textAlign: 'center', paddingTop: '4px' }}>
                    <button
                        type="submit"
                        disabled={status === 'sending'}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '14px 36px',
                            background: status === 'sending'
                                ? 'rgba(212,168,83,0.3)'
                                : 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dark))',
                            color: 'var(--bg-primary)',
                            borderRadius: '999px', border: 'none', cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                            fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.03em',
                            boxShadow: status === 'sending' ? 'none' : '0 4px 24px rgba(212,168,83,0.32)',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {status === 'sending' ? '⏳ Sending…' : '🤝 Send Inquiry'}
                    </button>
                    {status === 'error' && (
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--error)' }}>
                            Something went wrong. Please try again or email us directly.
                        </p>
                    )}
                </div>
            </form>
        </div>
    )
}
