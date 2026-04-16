'use client'

/**
 * LangStatusGrid — Admin component that displays per-language subtitle status
 * with Retry buttons for failed/pending languages.
 *
 * Extracted from admin/projects/page.tsx to satisfy SRP.
 * The parent component owns all state + callbacks; this component is purely presentational.
 */

import { LANGUAGE_NAMES, TOTAL_SUBTITLE_LANGS } from '@/lib/subtitle-languages'

export type LangStatusValue = 'completed' | 'reviewed' | 'processing' | 'failed' | 'pending'

export interface LangStatusGridProps {
    /** Raw translations map from the subtitle record — used to infer segment counts */
    translations: Record<string, { start: number; end: number; text: string }[]>
    /** Per-language status map from the DB (langStatus JSON field). May be null for legacy records. */
    langStatus: Record<string, string> | null
    /** Total source transcript segments — used to confirm English source exists */
    sourceSegmentCount: number
    /** Which lang is currently being retried (controls spinner rendering) */
    retryingLang: string | null
    /** Called when admin clicks ↻ Retry for a specific lang code */
    onRetry: (lang: string) => void
}

// ── Visual token map ─────────────────────────────────────────────────────────

const STATUS_STYLES: Record<LangStatusValue, { bg: string; border: string; color: string; icon: string }> = {
    completed:  { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  color: '#10b981',              icon: '✓'  },
    reviewed:   { bg: 'rgba(212,168,83,0.10)',  border: 'rgba(212,168,83,0.30)',  color: 'var(--accent-gold)',   icon: '⭐' },
    processing: { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  color: '#60a5fa',              icon: '⏳' },
    failed:     { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   color: '#ef4444',              icon: '✗'  },
    pending:    { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', color: 'var(--text-tertiary)', icon: '○'  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LangStatusGrid({
    translations,
    langStatus,
    sourceSegmentCount,
    retryingLang,
    onRetry,
}: LangStatusGridProps) {
    const completedCount = Object.keys(translations).length + 1 // +1 for English source

    const languages = [
        { code: 'en', label: 'English', isSource: true },
        ...Object.keys(LANGUAGE_NAMES)
            .filter(c => c !== 'en')
            .map(code => ({ code, label: LANGUAGE_NAMES[code] ?? code, isSource: false })),
    ]

    return (
        <div style={{ padding: 'var(--space-lg) var(--space-xl)', borderBottom: '1px solid var(--border-subtle)' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)' }}>
                    Subtitle Language Status
                </div>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>
                    {completedCount} / {TOTAL_SUBTITLE_LANGS} languages
                </span>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '6px' }}>
                {languages.map(({ code, label, isSource }) => {
                    const hasSubs = isSource
                        ? sourceSegmentCount > 0
                        : !!translations[code]?.length

                    const isRetrying  = retryingLang === code
                    const rawStatus   = langStatus?.[code]
                    const statusKey: LangStatusValue = isRetrying
                        ? 'processing'
                        : ((rawStatus as LangStatusValue | undefined) ?? (hasSubs ? 'completed' : 'pending'))

                    const sc       = STATUS_STYLES[statusKey] ?? STATUS_STYLES.pending
                    const canRetry = !isSource && (statusKey === 'failed' || statusKey === 'pending') && !retryingLang

                    return (
                        <div
                            key={code}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '5px 10px', borderRadius: '8px', gap: '6px',
                                background: sc.bg, border: `1px solid ${sc.border}`,
                            }}
                        >
                            {/* Label + icon */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <span style={{ color: sc.color, fontSize: '0.7rem', flexShrink: 0 }}>{sc.icon}</span>
                                <span style={{
                                    fontSize: '0.75rem', color: sc.color, fontWeight: 600,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {label}
                                </span>
                                {isSource && (
                                    <span style={{ fontSize: '0.55rem', opacity: 0.5, flexShrink: 0 }}>source</span>
                                )}
                                {hasSubs && !isSource && (
                                    <span style={{ fontSize: '0.6rem', opacity: 0.5, flexShrink: 0 }}>
                                        {translations[code]?.length}
                                    </span>
                                )}
                            </div>

                            {/* Retry button */}
                            {canRetry && (
                                <button
                                    onClick={() => onRetry(code)}
                                    style={{
                                        background: 'rgba(239,68,68,0.15)',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        borderRadius: '5px',
                                        color: '#ef4444', fontSize: '0.6rem',
                                        fontWeight: 700, cursor: 'pointer',
                                        padding: '2px 7px', flexShrink: 0,
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)' }}
                                >
                                    ↻ Retry
                                </button>
                            )}

                            {/* Running indicator */}
                            {isRetrying && (
                                <span style={{ fontSize: '0.6rem', color: '#60a5fa', flexShrink: 0 }}>running...</span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
