'use client'

import { useState, useEffect } from 'react'

/* ─── Types ─── */
export interface CtaEndCardCopy {
    eyebrow: string
    headlineRegular: string
    headlineItalic: string
    subtext: string
    buttonLabel: string
    footnote: string
}

export interface CtaModalCopy {
    headline: string
    subtext: string
    buttonLabel: string
    footnote: string
    privacyNote: string
}

export interface CtaConfirmationCopy {
    headline: string
    subtext: string
    button: string
}

export interface CtaConfig {
    id: string
    signupTag: string
    notificationType: string
    status: string
    isPostRelease: boolean
    triggerSecondsFromEnd: number
    endCard: CtaEndCardCopy
    modal: CtaModalCopy | null
    confirmation: CtaConfirmationCopy | null
    watchNowUrl: string | null
    translations: Record<string, Record<string, string>> | null
}

/* ─── NotifyMeEndCard ─── */
// Overlay that appears near the end of a video. Shows CTA copy
// with a glassmorphism backdrop. Triggers either a modal (active CTA)
// or a Watch Now redirect (post-release CTA).

export default function NotifyMeEndCard({
    config,
    onNotifyClick,
    onWatchNow,
    onDismiss,
    visible,
}: {
    config: CtaConfig
    onNotifyClick: () => void
    onWatchNow?: () => void
    onDismiss?: () => void
    visible: boolean
}) {
    const [animateIn, setAnimateIn] = useState(false)

    useEffect(() => {
        if (visible) {
            // Small delay for mount → animate transition
            const t = setTimeout(() => setAnimateIn(true), 50)
            return () => clearTimeout(t)
        }
        const t = setTimeout(() => setAnimateIn(false), 0)
        return () => clearTimeout(t)
    }, [visible])

    if (!visible) return null

    const { endCard, isPostRelease } = config

    const handleClick = () => {
        if (isPostRelease && onWatchNow) {
            onWatchNow()
        } else {
            onNotifyClick()
        }
    }

    return (
        <div
            className="notify-endcard-overlay"
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                opacity: animateIn ? 1 : 0,
                transition: 'opacity 0.6s ease',
                pointerEvents: animateIn ? 'auto' : 'none',
                padding: '24px',
                textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
        >
            {/* Dismiss button — lets user close the end card and resume controls */}
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        width: '36px', height: '36px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        fontSize: '18px',
                        transition: 'background 0.2s, color 0.2s',
                        zIndex: 10,
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                        e.currentTarget.style.color = '#fff'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                    }}
                >
                    ✕
                </button>
            )}
            <div style={{
                fontSize: '0.65rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(212,168,83,0.9)',
                fontWeight: 700,
                marginBottom: '12px',
                transform: animateIn ? 'translateY(0)' : 'translateY(12px)',
                transition: 'transform 0.6s ease 0.1s, opacity 0.6s ease 0.1s',
                opacity: animateIn ? 1 : 0,
            }}>
                {endCard.eyebrow}
            </div>

            {/* Headline */}
            <h2 style={{
                fontSize: 'clamp(1.3rem, 4vw, 2.2rem)',
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.2,
                margin: '0 0 8px',
                fontFamily: 'var(--font-display, inherit)',
                transform: animateIn ? 'translateY(0)' : 'translateY(16px)',
                transition: 'transform 0.6s ease 0.15s, opacity 0.6s ease 0.15s',
                opacity: animateIn ? 1 : 0,
            }}>
                {endCard.headlineRegular}
                {endCard.headlineItalic && (
                    <> <em style={{ fontStyle: 'italic', color: 'rgba(212,168,83,1)' }}>
                        {endCard.headlineItalic}
                    </em></>
                )}
            </h2>

            {/* Subtext */}
            <p style={{
                fontSize: 'clamp(0.8rem, 2vw, 0.95rem)',
                color: 'rgba(255,255,255,0.7)',
                maxWidth: '420px',
                lineHeight: 1.5,
                margin: '0 0 24px',
                transform: animateIn ? 'translateY(0)' : 'translateY(12px)',
                transition: 'transform 0.6s ease 0.2s, opacity 0.6s ease 0.2s',
                opacity: animateIn ? 1 : 0,
            }}>
                {endCard.subtext}
            </p>

            {/* CTA Button */}
            <button
                onClick={handleClick}
                style={{
                    padding: '12px 32px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #d4a853, #c49a3a)',
                    color: '#000',
                    fontSize: 'clamp(0.85rem, 2vw, 1rem)',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.6s ease 0.25s',
                    boxShadow: '0 4px 24px rgba(212,168,83,0.3)',
                    transform: animateIn ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.95)',
                    opacity: animateIn ? 1 : 0,
                    letterSpacing: '0.02em',
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)'
                    e.currentTarget.style.boxShadow = '0 6px 32px rgba(212,168,83,0.5)'
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = '0 4px 24px rgba(212,168,83,0.3)'
                }}
            >
                {endCard.buttonLabel}
            </button>

            {/* Footnote */}
            {endCard.footnote && (
                <p style={{
                    fontSize: '0.7rem',
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: '14px',
                    transform: animateIn ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'transform 0.6s ease 0.3s, opacity 0.6s ease 0.3s',
                    opacity: animateIn ? 1 : 0,
                }}>
                    {endCard.footnote}
                </p>
            )}
        </div>
    )
}
