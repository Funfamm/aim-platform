'use client'

import { useState, useEffect, useRef } from 'react'
import type { CtaModalCopy } from './NotifyMeEndCard'

export default function NotifyMeModal({
    copy,
    signupTag,
    onClose,
    onSuccess,
    visible,
}: {
    copy: CtaModalCopy
    signupTag: string
    onClose: () => void
    onSuccess: () => void
    visible: boolean
}) {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const [animateIn, setAnimateIn] = useState(false)

    useEffect(() => {
        if (visible) {
            const t = setTimeout(() => {
                setAnimateIn(true)
                inputRef.current?.focus()
            }, 50)
            return () => clearTimeout(t)
        }
        const t = setTimeout(() => setAnimateIn(false), 0)
        return () => clearTimeout(t)
    }, [visible])

    if (!visible) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        const trimmed = email.trim()
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError('Please enter a valid email address.')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/notify-me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: trimmed,
                    signupTag,
                    language: document.documentElement.lang || 'en',
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Something went wrong. Please try again.')
                return
            }

            // Success — whether new signup or already subscribed
            onSuccess()
        } catch {
            setError('Network error. Please check your connection.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                opacity: animateIn ? 1 : 0,
                transition: 'opacity 0.3s ease',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative',
                    background: 'linear-gradient(145deg, rgba(28,28,32,0.98), rgba(18,18,22,0.98))',
                    border: '1px solid rgba(212,168,83,0.2)',
                    borderRadius: '16px',
                    padding: 'clamp(24px, 4vw, 36px)',
                    maxWidth: '420px',
                    width: '90%',
                    textAlign: 'center',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.1)',
                    transform: animateIn ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.96)',
                    transition: 'transform 0.4s ease, opacity 0.3s ease',
                    opacity: animateIn ? 1 : 0,
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                >
                    ✕
                </button>

                {/* Headline */}
                <h3 style={{
                    fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
                    fontWeight: 800,
                    color: '#fff',
                    margin: '0 0 8px',
                    fontFamily: 'var(--font-display, inherit)',
                }}>
                    {copy.headline}
                </h3>

                {/* Subtext */}
                <p style={{
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.5,
                    margin: '0 0 20px',
                }}>
                    {copy.subtext}
                </p>

                {/* Email form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                        ref={inputRef}
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        disabled={loading}
                        style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: error
                                ? '1px solid rgba(255,80,80,0.5)'
                                : '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            fontSize: '0.95rem',
                            outline: 'none',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                        onFocus={e => {
                            e.currentTarget.style.borderColor = 'rgba(212,168,83,0.5)'
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,168,83,0.1)'
                        }}
                        onBlur={e => {
                            e.currentTarget.style.borderColor = error
                                ? 'rgba(255,80,80,0.5)'
                                : 'rgba(255,255,255,0.12)'
                            e.currentTarget.style.boxShadow = 'none'
                        }}
                    />

                    {error && (
                        <p style={{ fontSize: '0.78rem', color: 'rgba(255,80,80,0.9)', margin: 0 }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: 'none',
                            background: loading
                                ? 'rgba(212,168,83,0.5)'
                                : 'linear-gradient(135deg, #d4a853, #c49a3a)',
                            color: '#000',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'transform 0.15s, box-shadow 0.2s',
                            boxShadow: '0 4px 16px rgba(212,168,83,0.25)',
                            width: '100%',
                        }}
                        onMouseEnter={e => {
                            if (!loading) e.currentTarget.style.transform = 'scale(1.02)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)'
                        }}
                    >
                        {loading ? '...' : copy.buttonLabel}
                    </button>
                </form>

                {/* Footnote + Privacy */}
                <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>
                        {copy.footnote}
                    </p>
                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
                        {copy.privacyNote}
                    </p>
                </div>
            </div>
        </div>
    )
}
