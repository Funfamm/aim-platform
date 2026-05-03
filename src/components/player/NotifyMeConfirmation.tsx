'use client'

import { useState, useEffect } from 'react'
import type { CtaConfirmationCopy } from './NotifyMeEndCard'

export default function NotifyMeConfirmation({
    copy,
    onClose,
    visible,
}: {
    copy: CtaConfirmationCopy
    onClose: () => void
    visible: boolean
}) {
    const [animateIn, setAnimateIn] = useState(false)

    useEffect(() => {
        if (visible) {
            const t = setTimeout(() => setAnimateIn(true), 50)
            return () => clearTimeout(t)
        }
        const t = setTimeout(() => setAnimateIn(false), 0)
        return () => clearTimeout(t)
    }, [visible])

    // Auto-dismiss after 5 seconds
    useEffect(() => {
        if (!visible) return
        const t = setTimeout(onClose, 5000)
        return () => clearTimeout(t)
    }, [visible, onClose])

    if (!visible) return null

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                opacity: animateIn ? 1 : 0,
                transition: 'opacity 0.4s ease',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    textAlign: 'center',
                    transform: animateIn ? 'scale(1)' : 'scale(0.9)',
                    transition: 'transform 0.5s ease',
                }}
            >
                {/* Animated checkmark */}
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.1))',
                    border: '2px solid rgba(212,168,83,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    animation: animateIn ? 'notifyCheckPop 0.5s ease 0.2s both' : 'none',
                }}>
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#d4a853"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                            opacity: animateIn ? 1 : 0,
                            transition: 'opacity 0.3s ease 0.4s',
                        }}
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>

                {/* Headline */}
                <h3 style={{
                    fontSize: 'clamp(1.2rem, 3.5vw, 1.6rem)',
                    fontWeight: 800,
                    color: '#fff',
                    margin: '0 0 8px',
                    fontFamily: 'var(--font-display, inherit)',
                    opacity: animateIn ? 1 : 0,
                    transform: animateIn ? 'translateY(0)' : 'translateY(12px)',
                    transition: 'all 0.5s ease 0.3s',
                }}>
                    {copy.headline}
                </h3>

                {/* Subtext */}
                <p style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255,255,255,0.6)',
                    margin: '0 0 24px',
                    opacity: animateIn ? 1 : 0,
                    transform: animateIn ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'all 0.5s ease 0.35s',
                }}>
                    {copy.subtext}
                </p>

                {/* Dismiss button */}
                <button
                    onClick={onClose}
                    style={{
                        padding: '10px 28px',
                        borderRadius: '8px',
                        border: '1px solid rgba(212,168,83,0.3)',
                        background: 'rgba(212,168,83,0.08)',
                        color: 'rgba(212,168,83,0.9)',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        opacity: animateIn ? 1 : 0,
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(212,168,83,0.15)'
                        e.currentTarget.style.borderColor = 'rgba(212,168,83,0.5)'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(212,168,83,0.08)'
                        e.currentTarget.style.borderColor = 'rgba(212,168,83,0.3)'
                    }}
                >
                    {copy.button}
                </button>
            </div>

            {/* Keyframe animation for the checkmark pop */}
            <style>{`
                @keyframes notifyCheckPop {
                    0% { transform: scale(0.5); opacity: 0; }
                    60% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
