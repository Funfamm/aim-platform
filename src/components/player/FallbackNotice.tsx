'use client'

import { useEffect, useState } from 'react'

interface FallbackNoticeProps {
    /** The language code that was unavailable e.g. 'fr' */
    lang: string
    /** Human-readable language name e.g. 'Français' */
    langName: string
}

/**
 * Auto-dismissing 3-second toast shown when the user's preferred subtitle
 * language is not available for a title, and English has been loaded instead.
 */
export default function FallbackNotice({ lang, langName }: FallbackNoticeProps) {
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        const t = setTimeout(() => setVisible(false), 3500)
        return () => clearTimeout(t)
    }, [])

    if (!visible) return null

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                background: 'rgba(13, 15, 20, 0.92)',
                border: '1px solid rgba(212, 168, 83, 0.35)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '0.78rem',
                color: 'rgba(255,255,255,0.8)',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                animation: 'fadeInDown 0.25s ease',
                pointerEvents: 'none',
            }}
        >
            <span style={{ color: 'var(--accent-gold)', marginRight: '6px' }}>⚠</span>
            Subtitles not yet available in <strong style={{ color: 'var(--accent-gold)' }}>{langName}</strong> — showing English
        </div>
    )
}
