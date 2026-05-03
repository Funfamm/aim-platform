'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * SubtitleProgressBar — Animated progress indicator for subtitle generation.
 *
 * Shows a multi-stage progress bar that advances based on elapsed time
 * and actual completion status. Stages:
 *   1. Downloading video   (0-15%)    ~0-10s
 *   2. Extracting audio    (15-30%)   ~10-20s
 *   3. Transcribing        (30-85%)   ~20-120s (longest phase)
 *   4. Uploading results   (85-95%)   ~finishing
 *   5. Done                (100%)
 */

const STAGES = [
    { label: 'Downloading video…', threshold: 15, icon: '⬇️' },
    { label: 'Extracting audio…', threshold: 30, icon: '🎵' },
    { label: 'Transcribing with AI…', threshold: 85, icon: '🤖' },
    { label: 'Uploading subtitles…', threshold: 95, icon: '☁️' },
    { label: 'Complete!', threshold: 100, icon: '✅' },
]

interface SubtitleProgressBarProps {
    /** 'generating' | 'done' | 'error' | undefined */
    status: string | undefined
    /** Optional: compact mode for inline episode rows */
    compact?: boolean
}

export default function SubtitleProgressBar({ status, compact = false }: SubtitleProgressBarProps) {
    const [progress, setProgress] = useState(0)
    const startTimeRef = useRef<number>(0)

    useEffect(() => {
        if (status === 'done') {
            setProgress(100)
            return
        }
        if (status === 'error' || status !== 'generating') return

        if (startTimeRef.current === 0) startTimeRef.current = Date.now()
        const startTime = startTimeRef.current

        const interval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000

            // Simulate progress based on typical transcription timing
            let p: number
            if (elapsed < 8) {
                // Downloading: 0-15% over ~8s
                p = (elapsed / 8) * 15
            } else if (elapsed < 18) {
                // Extracting audio: 15-30% over ~10s
                p = 15 + ((elapsed - 8) / 10) * 15
            } else if (elapsed < 120) {
                // Transcribing: 30-82% over ~100s (slow log curve)
                const transcribeProgress = Math.log1p(elapsed - 18) / Math.log1p(102)
                p = 30 + transcribeProgress * 52
            } else {
                // Uploading: 82-92% (crawl, waiting for callback)
                p = 82 + Math.min((elapsed - 120) / 60, 1) * 10
            }

            setProgress(Math.min(p, 92)) // Never reach 100 until actually done
        }, 500)

        return () => clearInterval(interval)
    }, [status])

    if (!status || status === 'idle') return null

    if (status === 'error') {
        return (
            <div style={{
                fontSize: compact ? '0.65rem' : '0.72rem',
                color: '#ef4444',
                display: 'flex', alignItems: 'center', gap: '4px',
            }}>
                ❌ Failed — click to retry
            </div>
        )
    }

    const currentStage = STAGES.find(s => progress < s.threshold) || STAGES[STAGES.length - 1]
    const isDone = status === 'done'

    return (
        <div style={{
            width: compact ? '160px' : '100%',
            minWidth: compact ? '140px' : undefined,
        }}>
            {/* Progress bar */}
            <div style={{
                height: compact ? '4px' : '6px',
                borderRadius: '3px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                marginBottom: compact ? '2px' : '4px',
            }}>
                <div style={{
                    height: '100%',
                    borderRadius: '3px',
                    width: `${Math.round(progress)}%`,
                    background: isDone
                        ? 'linear-gradient(90deg, #34d399, #10b981)'
                        : 'linear-gradient(90deg, var(--accent-gold), #f59e0b)',
                    transition: 'width 0.5s ease',
                    boxShadow: isDone ? '0 0 8px rgba(52,211,153,0.4)' : '0 0 6px rgba(212,168,83,0.3)',
                }} />
            </div>

            {/* Stage label */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '4px',
            }}>
                <span style={{
                    fontSize: compact ? '0.6rem' : '0.68rem',
                    color: isDone ? '#34d399' : 'var(--accent-gold)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    animation: isDone ? 'none' : 'pulse 1.5s infinite',
                }}>
                    {currentStage.icon} {currentStage.label}
                </span>
                <span style={{
                    fontSize: compact ? '0.55rem' : '0.62rem',
                    color: 'var(--text-tertiary)',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                }}>
                    {Math.round(progress)}%
                </span>
            </div>
        </div>
    )
}
