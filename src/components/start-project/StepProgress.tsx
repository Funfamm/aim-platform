'use client'

import { useTranslations } from 'next-intl'
import { useRef, useEffect } from 'react'

interface Props {
    steps: string[]
    currentIndex: number
    onStepClick: (idx: number) => void
}

export default function StepProgress({ steps, currentIndex, onStepClick }: Props) {
    const t = useTranslations('startProject')
    const containerRef = useRef<HTMLDivElement>(null)
    const activeRef = useRef<HTMLButtonElement>(null)

    // Auto-scroll to active step on mobile
    useEffect(() => {
        if (activeRef.current && containerRef.current) {
            const container = containerRef.current
            const el = activeRef.current
            const scrollLeft = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
        }
    }, [currentIndex])

    return (
        <div style={{ position: 'relative' }}>
            {/* Progress bar background */}
            <div style={{
                position: 'absolute',
                top: '18px',
                left: '32px',
                right: '32px',
                height: '2px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '1px',
                zIndex: 0,
            }} />
            {/* Progress bar fill */}
            <div style={{
                position: 'absolute',
                top: '18px',
                left: '32px',
                height: '2px',
                width: `${Math.max(0, (currentIndex / (steps.length - 1)) * (100 - 8))}%`,
                background: 'linear-gradient(90deg, var(--accent-gold), #34d399)',
                borderRadius: '1px',
                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 0,
            }} />

            <div
                ref={containerRef}
                className="sp-progress-wrap"
                style={{ position: 'relative', zIndex: 1 }}
            >
                {steps.map((step, i) => {
                    const isCompleted = i < currentIndex
                    const isCurrent = i === currentIndex
                    const isClickable = i < currentIndex

                    return (
                        <button
                            key={step}
                            ref={isCurrent ? activeRef : undefined}
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
                                padding: '4px 8px 8px',
                                border: 'none',
                                background: 'transparent',
                                cursor: isClickable ? 'pointer' : 'default',
                                opacity: isCurrent ? 1 : isCompleted ? 0.9 : 0.3,
                                transition: 'opacity 0.3s',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            {/* Dot */}
                            <div style={{
                                width: isCurrent ? '32px' : '26px',
                                height: isCurrent ? '32px' : '26px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                background: isCompleted
                                    ? 'rgba(52,211,153,0.15)'
                                    : isCurrent
                                    ? 'rgba(212,168,83,0.15)'
                                    : 'rgba(255,255,255,0.06)',
                                border: `2px solid ${
                                    isCompleted ? '#34d399' : isCurrent ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)'
                                }`,
                                color: isCompleted ? '#34d399' : isCurrent ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: isCurrent ? '0 0 12px rgba(212,168,83,0.2)' : 'none',
                            }}>
                                {isCompleted ? '✓' : i + 1}
                            </div>

                            {/* Label — hide on very small screens, show abbreviated */}
                            <span style={{
                                fontSize: '0.56rem',
                                fontWeight: 700,
                                letterSpacing: '0.03em',
                                color: isCurrent ? 'var(--accent-gold)' : isCompleted ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                                textAlign: 'center',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '72px',
                            }}>
                                {t(`steps.${step}`)}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
