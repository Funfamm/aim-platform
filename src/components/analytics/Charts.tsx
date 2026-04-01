'use client'

import { useState, useMemo, useId } from 'react'

// ─── SVG Sparkline ───
export function Sparkline({ data, color = 'var(--accent-gold)', height = 32, width = 80 }: { data: number[]; color?: string; height?: number; width?: number }) {
    if (!data.length || data.every(d => d === 0)) {
        return <div style={{ width, height, opacity: 0.2 }}><svg width={width} height={height}><line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth={1} strokeDasharray="3 3" /></svg></div>
    }
    const max = Math.max(...data, 1)
    const min = Math.min(...data)
    const range = max - min || 1
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - 4 - ((v - min) / range) * (height - 8)
        return `${x},${y}`
    }).join(' ')
    const fillPoints = `0,${height} ${points} ${width},${height}`
    return (
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <polygon points={fillPoints} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - 4 - ((data[data.length - 1] - min) / range) * (height - 8)} r={2.5} fill={color} />
        </svg>
    )
}

// ─── Vitality Score Ring ───
export function VitalityRing({ score }: { score: number }) {
    const radius = 58
    const stroke = 8
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    const health = score >= 75 ? { label: 'Excellent', color: 'var(--color-success)' }
        : score >= 50 ? { label: 'Growing', color: 'var(--accent-gold)' }
            : score >= 25 ? { label: 'Building', color: 'var(--color-warning)' }
                : { label: 'Getting Started', color: 'var(--color-muted)' }

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={148} height={148} style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                    <linearGradient id="vitalGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--accent-gold)" />
                        <stop offset="100%" stopColor="var(--accent-gold-dark)" />
                    </linearGradient>
                    <filter id="vitalGlow">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
                <circle cx={74} cy={74} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
                <circle cx={74} cy={74} r={radius} fill="none" stroke="url(#vitalGrad)" strokeWidth={stroke}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" filter="url(#vitalGlow)"
                    style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }} />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: health.color, lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 600 }}>{health.label}</div>
            </div>
        </div>
    )
}

// ─── Donut Chart ───
export function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
    const size = 120
    const radius = 44
    const strokeWidth = 14
    const circumference = 2 * Math.PI * radius
    const pcts = segments.map(s => s.value / total)
    const offsets = pcts.reduce<number[]>((arr, _, i) => {
        arr.push(i === 0 ? 0 : arr[i - 1] + pcts[i - 1])
        return arr
    }, [])

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
                {segments.map((seg, i) => {
                    const pct = pcts[i]
                    const dash = pct * circumference
                    const gap = circumference - dash
                    const off = -offsets[i] * circumference
                    return <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
                        stroke={seg.color} strokeWidth={strokeWidth} strokeLinecap="round"
                        strokeDasharray={`${dash - 2} ${gap + 2}`}
                        strokeDashoffset={off}
                        style={{ transition: 'all 0.8s ease' }} />
                })}
            </svg>
            <div style={{ flex: 1 }}>
                {segments.map((seg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1, textTransform: 'capitalize' }}>{seg.label}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round((seg.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Area Chart ───
export function AreaChart({ data, labels, height = 180 }: { data: number[]; labels: string[]; height?: number }) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const width = 100
    const pad = 4

    const pts = data.map((v, i) => ({
        x: pad + (i / (data.length - 1)) * (width - pad * 2),
        y: pad + (1 - (v - min) / range) * (100 - pad * 2),
        value: v,
    }))

    // Build smooth cubic bezier path
    function smoothPath(points: { x: number; y: number }[]) {
        if (points.length < 2) return `M${points[0].x},${points[0].y}`
        let d = `M${points[0].x},${points[0].y}`
        for (let i = 1; i < points.length; i++) {
            const cp1x = points[i - 1].x + (points[i].x - points[i - 1].x) / 3
            const cp1y = points[i - 1].y
            const cp2x = points[i].x - (points[i].x - points[i - 1].x) / 3
            const cp2y = points[i].y
            d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i].x},${points[i].y}`
        }
        return d
    }
    const linePath = smoothPath(pts)
    const fillPath = `${linePath} L${pts[pts.length - 1].x},${100 - pad} L${pts[0].x},${100 - pad} Z`

    const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length)
    const peak = Math.max(...data)
    const rawId = useId()
    const gradId = `areaG${rawId.replace(/[^a-z0-9]/gi, '')}`

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)', padding: 'var(--space-lg)',
            position: 'relative',
        }}>
            {/* Summary stats */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>Peak: <strong style={{ color: 'var(--accent-gold)' }}>{peak}</strong></span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>Avg: <strong style={{ color: 'var(--text-secondary)' }}>{avg}</strong></span>
            </div>
            <svg viewBox={`0 0 ${width} 100`} style={{ width: '100%', height, display: 'block' }}
                onMouseLeave={() => setHoveredIdx(null)}>
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.35} />
                        <stop offset="60%" stopColor="var(--accent-gold)" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0.01} />
                    </linearGradient>
                    <filter id="lineGlow">
                        <feGaussianBlur stdDeviation="0.8" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map(pct => (
                    <line key={pct} x1={pad} x2={width - pad}
                        y1={pad + (1 - pct) * (100 - pad * 2)} y2={pad + (1 - pct) * (100 - pad * 2)}
                        stroke="rgba(255,255,255,0.04)" strokeWidth={0.3} strokeDasharray="2 2" />
                ))}
                <path d={fillPath} fill={`url(#${gradId})`} />
                <path d={linePath} fill="none" stroke="var(--accent-gold)" strokeWidth={1.5}
                    strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)" />
                {/* Hit areas and dots */}
                {pts.map((p, i) => (
                    <g key={i} onMouseEnter={() => setHoveredIdx(i)}>
                        <rect x={p.x - (width / data.length) / 2} y={0} width={width / data.length} height={100} fill="transparent" style={{ cursor: 'pointer' }} />
                        {hoveredIdx === i && (
                            <>
                                <line x1={p.x} x2={p.x} y1={pad} y2={100 - pad} stroke="rgba(212,168,83,0.25)" strokeWidth={0.5} strokeDasharray="2 2" />
                                <circle cx={p.x} cy={p.y} r={2.5} fill="var(--accent-gold)" stroke="#0a0a0a" strokeWidth={1} />
                            </>
                        )}
                    </g>
                ))}
            </svg>
            {hoveredIdx !== null && (
                <div style={{
                    position: 'absolute',
                    left: `${pad + (hoveredIdx / (data.length - 1)) * (100 - pad * 2)}%`,
                    top: '28px',
                    transform: 'translateX(-50%)',
                    background: 'rgba(10,10,10,0.96)', border: '1px solid var(--accent-gold)',
                    borderRadius: '6px', padding: '4px 10px',
                    fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-gold)',
                    whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}>
                    {data[hoveredIdx]} views
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '4px' }}>· {labels[hoveredIdx]}</span>
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                {labels.map((label, i) => (
                    <span key={i} style={{
                        fontSize: '0.58rem',
                        color: hoveredIdx === i ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                        flex: 1, textAlign: 'center',
                        fontWeight: hoveredIdx === i ? 700 : 400,
                        transition: 'all 0.15s',
                    }}>{label}</span>
                ))}
            </div>
        </div>
    )
}

// ─── Hourly Heatmap ───
export function HourlyHeatmap({ data }: { data: number[] }) {
    const [hovered, setHovered] = useState<number | null>(null)
    const max = Math.max(...data, 1)
    const total = data.reduce((a, b) => a + b, 0)
    const avg = total / 24
    const peakHour = data.indexOf(max)
    const quietHour = data.indexOf(Math.min(...data))

    function getColor(v: number) {
        const t = v / max
        if (t === 0) return 'rgba(255,255,255,0.025)'
        if (t < 0.3) return `rgba(99,102,241,${0.1 + t * 0.5})`   // indigo — low traffic
        if (t < 0.6) return `rgba(212,168,83,${0.2 + t * 0.6})`   // gold — medium
        return `rgba(251,146,60,${0.4 + t * 0.55})`                 // amber/orange — peak
    }

    function formatHour(h: number) {
        if (h === 0) return '12am'
        if (h === 12) return '12pm'
        return h < 12 ? `${h}am` : `${h - 12}pm`
    }

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px', marginBottom: '4px' }}>
                {data.map((v, i) => {
                    const isPeak = i === peakHour && v > 0
                    return (
                        <div
                            key={i}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                height: '36px', borderRadius: '4px',
                                background: getColor(v),
                                border: isPeak
                                    ? '1px solid rgba(251,146,60,0.6)'
                                    : hovered === i
                                    ? '1px solid rgba(212,168,83,0.5)'
                                    : '1px solid transparent',
                                transition: 'all 0.2s',
                                cursor: 'default',
                                position: 'relative',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {v > avg * 1.5 && (
                                <span style={{
                                    fontSize: '0.45rem', fontWeight: 800,
                                    color: v / max > 0.6 ? '#fff' : 'var(--accent-gold)',
                                }}>{v}</span>
                            )}
                        </div>
                    )
                })}
            </div>
            {/* Tooltip */}
            {hovered !== null && (
                <div style={{
                    position: 'absolute', top: '-32px',
                    left: `${(hovered / 24) * 100}%`,
                    transform: 'translateX(-50%)',
                    background: 'rgba(10,10,10,0.96)', border: '1px solid var(--accent-gold)',
                    borderRadius: '6px', padding: '3px 8px',
                    fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-gold)',
                    whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}>
                    {formatHour(hovered)} · {data[hovered]} views
                </div>
            )}
            {/* Hour axis */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                {[0, 4, 8, 12, 16, 20, 23].map(h => (
                    <span key={h} style={{ fontSize: '0.48rem', color: 'var(--text-tertiary)' }}>{formatHour(h)}</span>
                ))}
            </div>
            {/* Peak / quiet summary */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>
                    🔥 Peak: <strong style={{ color: '#fb923c' }}>{formatHour(peakHour)}</strong> ({max} views)
                </span>
                <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>
                    🌙 Quiet: <strong style={{ color: '#6366f1' }}>{formatHour(quietHour)}</strong>
                </span>
                <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>
                    Avg: <strong style={{ color: 'var(--text-secondary)' }}>{Math.round(avg)}/hr</strong>
                </span>
            </div>
        </div>
    )
}

// ─── Trend Arrow ───
export function TrendArrow({ current, previous }: { current: number; previous: number }) {
    if (previous === 0 && current === 0) return null
    const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0
    const isUp = pct >= 0
    return (
        <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            color: isUp ? 'var(--color-success)' : 'var(--color-error)',
            display: 'inline-flex', alignItems: 'center', gap: '2px',
        }}>
            {isUp ? '↑' : '↓'} {Math.abs(pct)}%
        </span>
    )
}

// ─── Activity Feed Item ───
export function ActivityItem({ item }: { item: { id: string; path: string; device: string | null; createdAt: string; referrer: string | null } }) {
    const deviceIcon = item.device === 'mobile' ? '📱' : item.device === 'tablet' ? '📋' : '💻'
    const ago = getRelativeTime(item.createdAt)
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            fontSize: '0.75rem',
        }}>
            <span style={{ fontSize: '0.65rem', width: '18px', textAlign: 'center' }}>{deviceIcon}</span>
            <span style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 500 }}>{item.path}</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{ago}</span>
        </div>
    )
}

// ─── Helper ───
export function getRelativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}
