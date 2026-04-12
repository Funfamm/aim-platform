'use client'

import { useState } from 'react'

const ALL_LOCALES = ['es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'de', 'ko']
const LOCALE_LABELS: Record<string, string> = {
    es: '🇪🇸 Spanish', fr: '🇫🇷 French', ar: '🇸🇦 Arabic', zh: '🇨🇳 Chinese',
    hi: '🇮🇳 Hindi', pt: '🇧🇷 Portuguese', ru: '🇷🇺 Russian',
    ja: '🇯🇵 Japanese', de: '🇩🇪 German', ko: '🇰🇷 Korean',
}
const TOTAL = ALL_LOCALES.length

/** Optional config to enable the "Retry missing" button */
export interface RetryConfig {
    /** Content type: 'casting' | 'script' | 'project' | 'course' */
    type: 'casting' | 'script' | 'project' | 'course'
    /** DB record id */
    id: string
}

/** Parse the translations JSON string and return which locales are covered */
export function getTranslationCoverage(translationsJson: string | null | undefined): {
    done: string[]
    missing: string[]
    count: number
    total: number
    isComplete: boolean
    isPending: boolean
} {
    if (!translationsJson) {
        return { done: [], missing: ALL_LOCALES, count: 0, total: TOTAL, isComplete: false, isPending: false }
    }
    try {
        const map = JSON.parse(translationsJson) as Record<string, Record<string, string>>
        const done = ALL_LOCALES.filter(l => map[l] && Object.keys(map[l]).length > 0)
        const missing = ALL_LOCALES.filter(l => !done.includes(l))
        return { done, missing, count: done.length, total: TOTAL, isComplete: done.length === TOTAL, isPending: false }
    } catch {
        return { done: [], missing: ALL_LOCALES, count: 0, total: TOTAL, isComplete: false, isPending: false }
    }
}

interface TranslationBadgeProps {
    /** The raw JSON string from the DB (translations or contentTranslations) */
    translationsJson: string | null | undefined
    /** Optional: if true, shows a pulsing dot to indicate translation is still running */
    pending?: boolean
    /** Optional: if provided, shows a "Retry missing" button for incomplete translations */
    retry?: RetryConfig
    style?: React.CSSProperties
}

export default function TranslationBadge({ translationsJson, pending, retry, style }: TranslationBadgeProps) {
    const [showTooltip, setShowTooltip] = useState(false)
    const [retrying, setRetrying] = useState(false)
    const [retryDone, setRetryDone] = useState(false)
    const { done, missing, count, total, isComplete } = getTranslationCoverage(translationsJson)

    const handleRetry = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!retry || retrying || retryDone) return
        setRetrying(true)
        try {
            await fetch('/api/admin/translations/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: retry.type, id: retry.id }),
            })
            setRetryDone(true)
            setTimeout(() => setRetryDone(false), 4000)
        } catch { /* silent */ }
        setRetrying(false)
    }

    if (pending || (!translationsJson && !isComplete)) {
        return (
            <span
                title="Translations pending — AI is still processing"
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.6rem', fontWeight: 700, padding: '3px 9px',
                    borderRadius: '6px', letterSpacing: '0.05em', cursor: 'default',
                    color: '#f59e0b', background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.22)',
                    ...style,
                }}
            >
                <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#f59e0b', display: 'inline-block',
                    animation: 'livePulse 2s ease-in-out infinite',
                }} />
                ⏳ No translations
            </span>
        )
    }

    const color = isComplete ? '#34d399' : count > 0 ? '#f59e0b' : '#ef4444'
    const bg = isComplete ? 'rgba(52,211,153,0.08)' : count > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'
    const border = isComplete ? 'rgba(52,211,153,0.22)' : count > 0 ? 'rgba(245,158,11,0.22)' : 'rgba(239,68,68,0.2)'
    const icon = isComplete ? '✅' : count > 0 ? '⚠️' : '❌'

    return (
        <div style={{ position: 'relative', display: 'inline-flex', ...style }}>
            <span
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.6rem', fontWeight: 700, padding: '3px 9px',
                    borderRadius: '6px', letterSpacing: '0.05em', cursor: 'help',
                    color, background: bg, border: `1px solid ${border}`,
                }}
            >
                {icon} {count}/{total} langs
            </span>

            {/* Tooltip */}
            {showTooltip && (
                <div
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    style={{
                        position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(15,17,25,0.97)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', padding: '10px 12px', zIndex: 9999,
                        minWidth: '200px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                >
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                        Translation Coverage
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {ALL_LOCALES.map(l => (
                            <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{LOCALE_LABELS[l]}</span>
                                <span style={{ fontSize: '0.65rem', color: done.includes(l) ? '#34d399' : '#ef4444' }}>
                                    {done.includes(l) ? '✓' : '✗'}
                                </span>
                            </div>
                        ))}
                    </div>
                    {missing.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.62rem', color: '#f59e0b', marginBottom: retry ? '8px' : 0 }}>
                                ⚠️ {missing.length} language{missing.length !== 1 ? 's' : ''} untranslated
                            </div>
                            {retry && (
                                <button
                                    onClick={handleRetry}
                                    disabled={retrying || retryDone}
                                    style={{
                                        width: '100%', padding: '5px 10px', fontSize: '0.65rem', fontWeight: 700,
                                        borderRadius: '6px', border: 'none', cursor: retrying || retryDone ? 'default' : 'pointer',
                                        background: retryDone ? 'rgba(52,211,153,0.12)' : 'rgba(212,168,83,0.12)',
                                        color: retryDone ? '#34d399' : 'var(--accent-gold)',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {retryDone ? '✓ Queued!' : retrying ? '⏳ Queuing...' : `🔄 Retry ${missing.length} missing`}
                                </button>
                            )}
                        </div>
                    )}
                    {/* Tooltip arrow */}
                    <div style={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        width: 0, height: 0,
                        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                        borderTop: '6px solid rgba(15,17,25,0.97)',
                    }} />
                </div>
            )}
        </div>
    )
}
