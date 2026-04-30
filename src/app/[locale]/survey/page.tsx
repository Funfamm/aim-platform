'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
    { key: 'action', emoji: '🎬' },
    { key: 'drama', emoji: '💔' },
    { key: 'documentary', emoji: '🌍' },
    { key: 'horror', emoji: '😱' },
    { key: 'romance', emoji: '💛' },
    { key: 'shorts', emoji: '✂️' },
    { key: 'all', emoji: '🌐' },
] as const

type PageState = 'survey' | 'thankyou' | 'already_responded'

export default function SurveyPage() {
    const t = useTranslations('surveyPage')
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const sid = searchParams.get('sid')

    const [selections, setSelections] = useState<string[]>([])
    const [freeText, setFreeText] = useState('')
    const [pageState, setPageState] = useState<PageState>('survey')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [surveyId, setSurveyId] = useState<string | null>(sid)

    // Fetch active survey ID if not in URL
    useEffect(() => {
        if (!surveyId) {
            fetch('/api/admin/survey')
                .then(r => r.json())
                .then(data => { if (data.surveyId) setSurveyId(data.surveyId) })
                .catch(() => {})
        }
    }, [surveyId])

    const toggleCategory = (key: string) => {
        if (key === 'all') {
            if (selections.includes('all')) {
                setSelections([])
            } else {
                setSelections(CATEGORIES.map(c => c.key))
            }
            return
        }

        setSelections(prev => {
            const next = prev.includes(key)
                ? prev.filter(s => s !== key)
                : [...prev, key]

            // If user deselects any individual card, remove 'all'
            if (prev.includes('all') && !next.includes(key)) {
                return next.filter(s => s !== 'all')
            }

            // If all individual cards are selected, add 'all'
            const individualKeys = CATEGORIES.filter(c => c.key !== 'all').map(c => c.key)
            const allIndividualSelected = individualKeys.every(k => next.includes(k))
            if (allIndividualSelected && !next.includes('all')) {
                return [...next, 'all']
            }

            return next
        })
    }

    const handleSubmit = async () => {
        if (selections.length === 0 || loading) return
        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/survey/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    surveyId,
                    selections,
                    freeText: freeText.trim() || null,
                    email: null, // Will be decoded server-side from token if needed
                    token,
                    locale: document.documentElement.lang || 'en',
                }),
            })

            const data = await res.json()

            if (res.status === 409 && data.error === 'already_responded') {
                setPageState('already_responded')
                return
            }

            if (!res.ok) {
                setError(t('error'))
                return
            }

            setPageState('thankyou')
        } catch {
            setError(t('error'))
        } finally {
            setLoading(false)
        }
    }

    // ── Already responded state ──
    if (pageState === 'already_responded') {
        return (
            <div style={styles.pageWrapper}>
                <div style={styles.container}>
                    <div style={styles.checkmark}>✓</div>
                    <p style={styles.alreadyText}>{t('alreadyResponded')}</p>
                </div>
            </div>
        )
    }

    // ── Thank you state ──
    if (pageState === 'thankyou') {
        const registerUrl = `/register?utm_source=survey_completion${token ? `&token=${encodeURIComponent(token)}` : ''}`
        return (
            <div style={styles.pageWrapper}>
                <div style={styles.container}>
                    <div style={styles.checkmark}>✓</div>
                    <h1 style={styles.thankTitle}>{t('thankYouTitle')}</h1>
                    <p style={styles.thankMessage}>{t('thankYouMessage')}</p>

                    <div style={styles.divider} />

                    <div style={styles.convertSection}>
                        <p style={styles.convertEmoji}>🎬</p>
                        <h2 style={styles.convertTitle}>{t('convertTitle')}</h2>
                        <p style={styles.convertMessage}>{t('convertMessage')}</p>
                        <Link href={registerUrl} style={styles.convertButton}>
                            {t('convertButton')} →
                        </Link>
                        <Link href="/" style={styles.skipLink}>
                            {t('convertSkip')}
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // ── Survey form state ──
    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                <h1 style={styles.title}>{t('title')}</h1>
                <p style={styles.subtitle}>{t('subtitle')}</p>

                <div style={styles.questionSection}>
                    <h2 style={styles.question}>{t('question')}</h2>
                    <p style={styles.selectAll}>{t('selectAll')}</p>

                    <div style={styles.grid}>
                        {CATEGORIES.map(cat => {
                            const isSelected = selections.includes(cat.key)
                            return (
                                <button
                                    key={cat.key}
                                    onClick={() => toggleCategory(cat.key)}
                                    style={{
                                        ...styles.card,
                                        ...(isSelected ? styles.cardSelected : {}),
                                    }}
                                    aria-pressed={isSelected}
                                    id={`survey-category-${cat.key}`}
                                >
                                    <span style={styles.emoji}>{cat.emoji}</span>
                                    <span style={{
                                        ...styles.cardLabel,
                                        ...(isSelected ? styles.cardLabelSelected : {}),
                                    }}>
                                        {t(`categories.${cat.key}`)}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div style={styles.freeTextSection}>
                    <label htmlFor="survey-freetext" style={styles.freeTextLabel}>
                        {t('optional')}
                    </label>
                    <textarea
                        id="survey-freetext"
                        value={freeText}
                        onChange={e => setFreeText(e.target.value.slice(0, 500))}
                        style={styles.textarea}
                        rows={3}
                        maxLength={500}
                    />
                </div>

                {error && <p style={styles.errorText}>{error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={selections.length === 0 || loading}
                    style={{
                        ...styles.submitButton,
                        ...(selections.length === 0 || loading ? styles.submitDisabled : {}),
                    }}
                    id="survey-submit"
                >
                    {loading ? (
                        <span style={styles.spinner}>
                            <span style={styles.spinnerDot} />
                            {t('submitting')}
                        </span>
                    ) : (
                        t('submit')
                    )}
                </button>
            </div>
        </div>
    )
}

// ── Inline styles (cinema dark theme) ──

const styles: Record<string, React.CSSProperties> = {
    pageWrapper: {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0c10 0%, #0f1115 40%, #12141a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
    },
    container: {
        maxWidth: 640,
        width: '100%',
        textAlign: 'center' as const,
    },
    title: {
        fontSize: '2rem',
        fontWeight: 800,
        color: '#e8e6e3',
        margin: '0 0 12px',
        letterSpacing: '-0.5px',
        lineHeight: 1.2,
    },
    subtitle: {
        fontSize: '1rem',
        color: '#9ca3af',
        margin: '0 0 40px',
        lineHeight: 1.6,
    },
    questionSection: {
        marginBottom: 32,
    },
    question: {
        fontSize: '1.2rem',
        fontWeight: 700,
        color: '#e8e6e3',
        margin: '0 0 6px',
    },
    selectAll: {
        fontSize: '0.85rem',
        color: '#6b7280',
        margin: '0 0 20px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12,
    },
    card: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '16px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        outline: 'none',
        color: '#9ca3af',
        fontSize: '0.9rem',
        fontWeight: 500,
    },
    cardSelected: {
        borderColor: '#c9a84c',
        background: 'rgba(201,168,76,0.08)',
        boxShadow: '0 0 0 1px rgba(201,168,76,0.2)',
    },
    emoji: {
        fontSize: '1.8rem',
        lineHeight: 1,
    },
    cardLabel: {
        color: '#9ca3af',
        transition: 'color 0.2s',
    },
    cardLabelSelected: {
        color: '#c9a84c',
        fontWeight: 600,
    },
    freeTextSection: {
        textAlign: 'left' as const,
        marginBottom: 24,
    },
    freeTextLabel: {
        display: 'block',
        fontSize: '0.9rem',
        color: '#9ca3af',
        marginBottom: 8,
    },
    textarea: {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '12px 14px',
        color: '#e8e6e3',
        fontSize: '0.95rem',
        resize: 'vertical' as const,
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box' as const,
    },
    submitButton: {
        width: '100%',
        padding: '14px 32px',
        background: '#c9a84c',
        color: '#0f1115',
        border: 'none',
        borderRadius: 10,
        fontSize: '1rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s',
        letterSpacing: '0.3px',
    },
    submitDisabled: {
        opacity: 0.4,
        cursor: 'not-allowed',
    },
    spinner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    spinnerDot: {
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: '2px solid rgba(15,17,21,0.3)',
        borderTopColor: '#0f1115',
        animation: 'spin 0.6s linear infinite',
    },
    errorText: {
        color: '#ef4444',
        fontSize: '0.9rem',
        marginBottom: 12,
    },
    checkmark: {
        fontSize: '3rem',
        color: '#10b981',
        marginBottom: 16,
    },
    alreadyText: {
        fontSize: '1.1rem',
        color: '#9ca3af',
        lineHeight: 1.6,
    },
    thankTitle: {
        fontSize: '1.8rem',
        fontWeight: 800,
        color: '#e8e6e3',
        margin: '0 0 12px',
    },
    thankMessage: {
        fontSize: '1rem',
        color: '#9ca3af',
        margin: '0 0 32px',
        lineHeight: 1.6,
    },
    divider: {
        borderTop: '1px solid rgba(255,255,255,0.08)',
        margin: '0 0 32px',
    },
    convertSection: {
        textAlign: 'center' as const,
    },
    convertEmoji: {
        fontSize: '2rem',
        margin: '0 0 12px',
    },
    convertTitle: {
        fontSize: '1.2rem',
        fontWeight: 700,
        color: '#e8e6e3',
        margin: '0 0 8px',
    },
    convertMessage: {
        fontSize: '0.95rem',
        color: '#9ca3af',
        margin: '0 0 20px',
        lineHeight: 1.6,
    },
    convertButton: {
        display: 'inline-block',
        padding: '14px 32px',
        background: '#c9a84c',
        color: '#0f1115',
        borderRadius: 10,
        fontSize: '1rem',
        fontWeight: 700,
        textDecoration: 'none',
        letterSpacing: '0.3px',
        marginBottom: 12,
    },
    skipLink: {
        display: 'block',
        fontSize: '0.85rem',
        color: '#6b7280',
        textDecoration: 'none',
        marginTop: 8,
    },
}
