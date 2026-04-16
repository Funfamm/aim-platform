'use client'

/**
 * src/components/admin/PublishGateModal.tsx — Publish confirmation gate (SRP / OCP fix).
 *
 * Previously inlined inside AdminProjectsPage, making that component responsible
 * for both page logic and modal rendering.
 *
 * This component has ONE responsibility: render the translation-incomplete warning
 * and surface two decisions (complete first / override) to the caller via callbacks.
 *
 * The parent never reaches into this component's internals — it's closed for modification,
 * open for extension (UI changes here don't touch page.tsx).
 */

import { TOTAL_SUBTITLE_LANGS } from '@/config/subtitles'

interface Props {
    /** Whether the modal is visible. */
    isOpen: boolean
    /** Number of languages currently translated (0..TOTAL_SUBTITLE_LANGS). */
    translatedCount: number
    /** Disable the "Publish Anyway" button while the save request is in-flight. */
    saving: boolean
    /** Called when admin chooses to go back and complete translations. */
    onCancel: () => void
    /** Called when admin explicitly overrides and wants to publish anyway. */
    onConfirm: () => void
}

export default function PublishGateModal({
    isOpen,
    translatedCount,
    saving,
    onCancel,
    onConfirm,
}: Props) {
    if (!isOpen) return null

    const missing = TOTAL_SUBTITLE_LANGS - translatedCount
    const pct = Math.round((translatedCount / TOTAL_SUBTITLE_LANGS) * 100)

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1100,
                background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'var(--space-xl)',
            }}
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-gate-title"
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-xl)',
                    width: '100%', maxWidth: '480px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,158,11,0.1)',
                    animation: 'fadeIn 0.15s ease',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: 'var(--space-lg)' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                    }}>⚠️</div>
                    <div>
                        <h3
                            id="publish-gate-title"
                            style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}
                        >
                            Translation Incomplete
                        </h3>
                        <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, marginTop: '3px' }}>
                            {translatedCount} of {TOTAL_SUBTITLE_LANGS} languages translated
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{
                    background: 'rgba(245,158,11,0.05)',
                    border: '1px solid rgba(245,158,11,0.15)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)',
                    marginBottom: 'var(--space-lg)',
                    fontSize: '0.875rem', lineHeight: 1.65,
                    color: 'var(--text-secondary)',
                }}>
                    Publishing with only{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{translatedCount}/{TOTAL_SUBTITLE_LANGS} languages</strong>{' '}
                    means{' '}
                    <strong style={{ color: '#ef4444' }}>
                        {missing} language{missing !== 1 ? 's' : ''} will have no subtitles
                    </strong>{' '}
                    for viewers who speak those languages.
                    <div style={{
                        marginTop: '10px', paddingTop: '10px',
                        borderTop: '1px solid rgba(245,158,11,0.1)',
                        fontSize: '0.78rem', color: 'var(--text-tertiary)',
                    }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Recommended:</strong>{' '}
                        Close this dialog, use the <strong>CC</strong> button on the project card to complete all translations, then publish.
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', marginBottom: '6px',
                        fontSize: '0.68rem', color: 'var(--text-tertiary)',
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                        <span>Translation Progress</span>
                        <span>{pct}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: '3px',
                            background: translatedCount === 0
                                ? 'rgba(239,68,68,0.5)'
                                : 'linear-gradient(90deg, #f59e0b, #e8c547)',
                            width: `${pct}%`,
                            transition: 'width 0.3s ease',
                        }} />
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                        id="publish-gate-cancel"
                        onClick={onCancel}
                        className="btn btn-ghost btn-sm"
                        style={{ fontWeight: 600 }}
                    >
                        Complete Translations First
                    </button>
                    <button
                        id="publish-gate-override"
                        onClick={onConfirm}
                        disabled={saving}
                        className="btn btn-sm"
                        style={{
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444', fontWeight: 700,
                        }}
                    >
                        {saving ? 'Publishing...' : 'Publish Anyway'}
                    </button>
                </div>
            </div>
        </div>
    )
}
