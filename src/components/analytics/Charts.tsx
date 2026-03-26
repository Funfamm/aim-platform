'use client'

import { useState } from 'react'

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
    const health = score >= 75 ? { label: 'Excellent', color: '#22c55e' }
        : score >= 50 ? { label: 'Growing', color: 'var(--accent-gold)' }
            : score >= 25 ? { label: 'Building', color: '#f59e0b' }
                : { label: 'Getting Started', color: '#6b7280' }

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={148} height={148} style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                    <linearGradient id="vitalGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--accent-gold)" />
                        <stop offset="100%" stopColor="#c4943a" />
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
    let accum = 0

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
                {segments.map((seg, i) => {
                    const pct = seg.value / total
                    const dash = pct * circumference
                    const gap = circumference - dash
                    const off = -accum * circumference
                    accum += pct
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
    const width = 100
    const pad = 3

    const points = data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (width - pad * 2)
        const y = pad + (1 - v / max) * (100 - pad * 2)
        return { x, y, value: v }
    })
    const pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ')
    const fillD = `${pathD} L${points[points.length - 1].x},${100 - pad} L${points[0].x},${100 - pad} Z`

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)', padding: 'var(--space-lg)',
            position: 'relative',
        }}>
            <svg viewBox={`0 0 ${width} 100`} style={{ width: '100%', height, display: 'block' }}
                onMouseLeave={() => setHoveredIdx(null)}>
                <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0.01} />
                    </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map(pct => (
                    <line key={pct} x1={pad} x2={width - pad}
                        y1={pad + (1 - pct) * (100 - pad * 2)} y2={pad + (1 - pct) * (100 - pad * 2)}
                        stroke="rgba(255,255,255,0.04)" strokeWidth={0.3} />
                ))}
                <path d={fillD} fill="url(#areaGrad)" />
                <path d={pathD} fill="none" stroke="var(--accent-gold)" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, i) => (
                    <g key={i} onMouseEnter={() => setHoveredIdx(i)}>
                        <rect x={p.x - (width / data.length) / 2} y={0} width={width / data.length} height={100} fill="transparent" style={{ cursor: 'pointer' }} />
                        {hoveredIdx === i && (
                            <>
                                <line x1={p.x} x2={p.x} y1={p.y} y2={100 - pad} stroke="rgba(212,168,83,0.3)" strokeWidth={0.4} strokeDasharray="2 2" />
                                <circle cx={p.x} cy={p.y} r={1.8} fill="var(--accent-gold)" stroke="#0a0a0a" strokeWidth={0.8} />
                            </>
                        )}
                    </g>
                ))}
            </svg>
            {hoveredIdx !== null && (
                <div style={{
                    position: 'absolute',
                    left: `${pad + (hoveredIdx / (data.length - 1)) * (100 - pad * 2)}%`,
                    top: '8px',
                    transform: 'translateX(-50%)',
                    background: 'rgba(10,10,10,0.95)', border: '1px solid var(--accent-gold)',
                    borderRadius: 'var(--radius-sm)', padding: '4px 10px',
                    fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold)',
                    whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
                }}>
                    {data[hoveredIdx]} views · {labels[hoveredIdx]}
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                {labels.map((label, i) => (
                    <span key={i} style={{
                        fontSize: '0.58rem', color: hoveredIdx === i ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                        flex: 1, textAlign: 'center', fontWeight: hoveredIdx === i ? 700 : 400,
                        transition: 'all 0.15s',
                    }}>{label}</span>
                ))}
            </div>
        </div>
    )
}

// ─── Hourly Heatmap ───
export function HourlyHeatmap({ data }: { data: number[] }) {
    const max = Math.max(...data, 1)
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px', marginBottom: '4px' }}>
                {data.map((v, i) => {
                    const intensity = v / max
                    return (
                        <div key={i} title={`${i}:00 — ${v} views`} style={{
                            height: '32px', borderRadius: '3px',
                            background: intensity > 0
                                ? `rgba(212,168,83,${0.08 + intensity * 0.55})`
                                : 'rgba(255,255,255,0.02)',
                            border: intensity > 0.7 ? '1px solid rgba(212,168,83,0.25)' : '1px solid transparent',
                            transition: 'all 0.3s', cursor: 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.5rem', fontWeight: 700,
                            color: intensity > 0.3 ? 'var(--accent-gold)' : 'transparent',
                        }}>
                            {v > 0 ? v : ''}
                        </div>
                    )
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {[0, 6, 12, 18, 23].map(h => (
                    <span key={h} style={{ fontSize: '0.5rem', color: 'var(--text-tertiary)' }}>{h}:00</span>
                ))}
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
            color: isUp ? '#22c55e' : '#ef4444',
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
