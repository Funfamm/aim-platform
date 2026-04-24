'use client'

import { useTranslations } from 'next-intl'

interface Props {
    steps: string[]
    currentIndex: number
    onStepClick: (idx: number) => void
}

export default function StepProgress({ steps, currentIndex, onStepClick }: Props) {
    const t = useTranslations('startProject')

    return (
        <div style={{
            display: 'flex',
            gap: '2px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            padding: '2px 0',
        }}>
            {steps.map((step, i) => {
                const isCompleted = i < currentIndex
                const isCurrent = i === currentIndex
                const isClickable = i < currentIndex

                return (
                    <button
                        key={step}
                        type="button"
                        onClick={() => isClickable && onStepClick(i)}
                        disabled={!isClickable}
                        style={{
                            flex: '1 0 auto',
                            minWidth: '0',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 6px',
                            border: 'none',
                            background: 'transparent',
                            cursor: isClickable ? 'pointer' : 'default',
                            opacity: isCurrent ? 1 : isCompleted ? 0.85 : 0.35,
                            transition: 'opacity 0.2s',
                        }}
                    >
                        {/* Dot */}
                        <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            background: isCompleted
                                ? 'rgba(52,211,153,0.15)'
                                : isCurrent
                                ? 'rgba(212,168,83,0.2)'
                                : 'rgba(255,255,255,0.06)',
                            border: `2px solid ${
                                isCompleted ? '#34d399' : isCurrent ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)'
                            }`,
                            color: isCompleted ? '#34d399' : isCurrent ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            transition: 'all 0.2s',
                        }}>
                            {isCompleted ? '✓' : i + 1}
                        </div>

                        {/* Label */}
                        <span style={{
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                            color: isCurrent ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            textAlign: 'center',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '80px',
                        }}>
                            {t(`steps.${step}`)}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
