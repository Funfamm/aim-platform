'use client'
import React from 'react'
import { SurveyData, countryFlag, timeAgo } from './types'

// ── Section 1: Metric Cards ──
export function MetricCards({ d }: { d: SurveyData }) {
    const delivered = d.delivery?.sent || 0
    const responseRate = delivered > 0 ? Math.round(d.totalResponses / delivered * 1000) / 10 : 0
    const cards = [
        { value: d.totalResponses, label: 'Total Responses', color: '#d4a853' },
        { value: d.responsesLast24h, label: 'Last 24 Hours', color: '#10b981' },
        { value: d.responsesThisWeek, label: 'This Week', color: '#3b82f6' },
        { value: `${responseRate}%`, label: 'Response Rate', color: '#06b6d4', suffix: ` (${d.totalResponses} of ${delivered})` },
        { value: `${d.convertedCount}`, label: 'Converted to Users', color: '#8b5cf6', suffix: ` (${d.convertedPercentage}%)` },
        { value: d.countriesReached, label: 'Countries Reached', color: '#ec4899' },
    ]
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {cards.map(m => (
                <div key={m.label} className="admin-card" style={{ padding: '18px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: m.color }}>
                        {m.value}
                        {m.suffix && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{m.suffix}</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{m.label}</div>
                </div>
            ))}
        </div>
    )
}

// ── Section 2: Category Breakdown ──
export function CategoryBreakdownChart({ d }: { d: SurveyData }) {
    const maxPct = Math.max(...d.categoryBreakdown.map(c => c.percentage), 1)
    return (
        <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>🎬 Category Breakdown</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.categoryBreakdown.map(c => (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 140, fontSize: '0.82rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{c.label}</div>
                        <div style={{ flex: 1, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #c9a84c, #e8c36a)', width: `${(c.percentage / maxPct) * 100}%`, transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ width: 100, fontSize: '0.78rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>{c.percentage}% ({c.count})</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                {[
                    `Avg. ${d.avgSelectionsPerResponse} categories per response`,
                    `${d.multiSelectionRate}% picked multiple`,
                    `${d.allSelectedRate}% picked All`,
                    d.mostPopularCombination.count > 0 ? `Top combo: ${d.mostPopularCombination.selections.join(' + ')} (${d.mostPopularCombination.count}×)` : '',
                ].filter(Boolean).map(t => (
                    <span key={t} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#d4a853' }}>{t}</span>
                ))}
            </div>
        </div>
    )
}

// ── Section 3: Conversion Funnel ──
export function ConversionFunnel({ d }: { d: SurveyData }) {
    const f = d.funnel
    const steps = [
        { icon: '📬', label: 'Emails Queued', count: f.emailsQueued, pct: 100 },
        { icon: '📧', label: 'Delivered', count: f.emailsSent, pct: f.emailsQueued > 0 ? Math.round(f.emailsSent / f.emailsQueued * 100) : 0 },
        { icon: '📋', label: 'Survey Completed', count: f.surveyCompleted, pct: f.emailsSent > 0 ? Math.round(f.surveyCompleted / f.emailsSent * 100) : 0 },
        { icon: '✅', label: 'Registered', count: f.actuallyRegistered, pct: f.surveyCompleted > 0 ? Math.round(f.actuallyRegistered / f.surveyCompleted * 100) : 0 },
    ]
    return (
        <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>📊 Conversion Funnel</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {steps.map((s, i) => {
                    const width = i === 0 ? 100 : Math.max(5, s.pct)
                    const dropoff = i > 0 ? Math.round(100 - (s.count / (steps[i - 1].count || 1)) * 100) : 0
                    const isLive = d.delivery && (d.delivery.pending > 0 || d.delivery.processing > 0)
                    return (
                        <div key={s.label}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                                <div style={{ width: 140, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{s.label}</div>
                                <div style={{ flex: 1, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 6, background: i === 0 ? '#3b82f6' : i === 1 ? '#c9a84c' : '#10b981', width: `${width}%`, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: '0.75rem', fontWeight: 700, color: '#fff', transition: 'width 0.5s' }}>
                                        {s.count.toLocaleString()}
                                    </div>
                                </div>
                                <div style={{ width: 50, fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>{i === 0 ? '100%' : `${s.pct}%`}</div>
                                {i > 0 && <div style={{ width: 80, fontSize: '0.7rem', color: isLive ? '#f59e0b' : (dropoff > 80 ? '#ef4444' : '#f59e0b'), textAlign: 'right' }}>▼ {dropoff}% drop</div>}
                            </div>
                        </div>
                    )
                })}
            </div>
            {d.delivery && (d.delivery.pending > 0 || d.delivery.processing > 0) && (
                <p style={{ marginTop: 10, fontSize: '0.72rem', color: '#f59e0b', fontStyle: 'italic' }}>📡 Campaign in progress — delivery stats update as emails send</p>
            )}
            {d.avgTimeToConvert !== null && (
                <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    ⏱️ Average time to convert: <strong style={{ color: 'var(--text-primary)' }}>{d.avgTimeToConvert}h</strong>
                </div>
            )}
        </div>
    )
}

// ── Section 4: Genre Conversion Correlation ──
export function GenreConversion({ d }: { d: SurveyData }) {
    return (
        <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>🎯 Genre → Conversion Correlation</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Genre', 'Responses', 'Converted', 'Rate'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                    {d.genreConversionCorrelation.map((g, i) => (
                        <tr key={g.genre} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{i === 0 && g.conversionRate > 0 ? '🏆 ' : ''}{g.genre}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{g.totalSelections}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{g.conversions}</td>
                            <td style={{ padding: '8px 12px', color: i === 0 && g.conversionRate > 0 ? '#d4a853' : 'var(--text-secondary)', fontWeight: i === 0 ? 700 : 400 }}>{g.conversionRate}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 10, fontStyle: 'italic' }}>Shows which audience segment is most likely to register after the survey.</p>
        </div>
    )
}

// ── Section 5: Geographic Stats ──
export function GeographicStats({ d }: { d: SurveyData }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="admin-card" style={{ padding: 'var(--space-lg)' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>🌍 Top Countries</h2>
                {d.topCountries.map(c => (
                    <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: '0.82rem' }}>
                        <span>{countryFlag(c.country)}</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }}>
                            <div style={{ height: '100%', borderRadius: 3, background: '#c9a84c', width: `${c.percentage}%` }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', width: 90, textAlign: 'right' }}>{c.count} ({c.percentage}%)</span>
                    </div>
                ))}
            </div>
            <div className="admin-card" style={{ padding: 'var(--space-lg)' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>🎬 Top Genre by Country</h2>
                {d.genreByCountry.map(c => (
                    <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: '0.82rem' }}>
                        <span>{countryFlag(c.country)}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                        <span style={{ color: 'var(--text-primary)' }}>{c.topGenre}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Section 6: Response Timeline ──
export function ResponseTimeline({ d }: { d: SurveyData }) {
    const maxCount = Math.max(...d.responsesByDay.map(r => r.count), 1)
    const barW = Math.max(2, Math.floor(600 / d.responsesByDay.length) - 2)
    return (
        <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>📈 Response Timeline (30 days)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, padding: '0 4px' }}>
                {d.responsesByDay.map(r => (
                    <div key={r.date} title={`${r.date}: ${r.count}`} style={{ width: barW, flexShrink: 0, borderRadius: '3px 3px 0 0', background: r.count > 0 ? 'linear-gradient(180deg, #e8c36a, #c9a84c)' : 'rgba(255,255,255,0.03)', height: `${Math.max(2, (r.count / maxCount) * 100)}%`, transition: 'height 0.3s' }} />
                ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                {[`First 24h: ${d.velocityFirst24h} responses`, `After 24h: ${d.velocityAfter24h} responses`].map(t => (
                    <span key={t} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#d4a853' }}>{t}</span>
                ))}
            </div>
        </div>
    )
}

// ── Section 7: Peak Hours ──
export function PeakHoursChart({ d }: { d: SurveyData }) {
    const maxH = Math.max(...d.peakHours.map(h => h.count), 1)
    return (
        <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>🕐 Peak Hours (UTC)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                {d.peakHours.map(h => {
                    const isPeak = h.count === maxH && h.count > 0
                    return (
                        <div key={h.hour} title={`${h.hour}:00 UTC — ${h.count} responses`} style={{ flex: 1, borderRadius: '3px 3px 0 0', background: isPeak ? '#d4a853' : 'rgba(201,168,76,0.3)', height: `${Math.max(4, (h.count / maxH) * 100)}%`, transition: 'height 0.3s' }} />
                    )
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {[0, 6, 12, 18, 23].map(h => <span key={h} style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>{h}:00</span>)}
            </div>
        </div>
    )
}

// ── Section 10: Moderation Summary ──
export function ModerationSummary({ d, onFilter }: { d: SurveyData; onFilter: () => void }) {
    return (
        <div className="admin-card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Total flagged: <strong style={{ color: d.flaggedCount > 0 ? '#f59e0b' : 'var(--text-primary)' }}>{d.flaggedCount}</strong> responses — Clean rate: <strong style={{ color: '#10b981' }}>{d.cleanResponseRate}%</strong>
            </div>
            {d.flaggedCount > 0 && (
                <button onClick={onFilter} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>View flagged only ↓</button>
            )}
        </div>
    )
}

// ── Section 12: Delivery Tracker ──
export function DeliveryTracker({ d }: { d: SurveyData }) {
    const del = d.delivery
    if (!del || del.total === 0) return null
    const isLive = del.pending > 0 || del.processing > 0
    const isComplete = !isLive && del.sent > 0
    return (
        <div className="admin-card" style={{ padding: 'var(--space-lg)', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
                {isComplete ? '✅ Campaign Complete' : '📡 Campaign Delivery'}
                {isLive && <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 500, marginLeft: 8 }}>● LIVE</span>}
            </h2>
            {isComplete && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '-8px 0 16px' }}>
                    {del.sent.toLocaleString()} delivered • {del.failed} failed
                </p>
            )}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                    <div style={{ width: `${(del.sent / del.total) * 100}%`, background: '#10b981', transition: 'width 0.5s' }} />
                    <div style={{ width: `${(del.processing / del.total) * 100}%`, background: '#c9a84c' }} />
                    <div style={{ width: `${(del.failed / del.total) * 100}%`, background: '#ef4444' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'center' }}>
                    {del.sent} of {del.total} delivered ({Math.round((del.sent / del.total) * 100)}%)
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
                {[
                    { label: 'Sent', value: del.sent, color: '#10b981' },
                    { label: 'Processing', value: del.processing, color: '#c9a84c' },
                    { label: 'Pending', value: del.pending, color: '#3b82f6' },
                    { label: 'Failed', value: del.failed, color: '#ef4444' },
                    { label: 'Suppressed', value: del.cancelled, color: '#6b7280' },
                ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
            </div>
            {del.log.length > 0 && (
                <div style={{ maxHeight: 160, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <tbody>{del.log.map((e, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '5px 10px', width: 20 }}>{e.success ? '✅' : '❌'}</td>
                                <td style={{ padding: '5px 8px', color: 'var(--text-primary)' }}>{e.to}</td>
                                <td style={{ padding: '5px 8px', color: 'var(--text-tertiary)' }}>{e.transport}</td>
                                <td style={{ padding: '5px 8px', color: 'var(--text-tertiary)', textAlign: 'right' }}>{e.sentAt ? timeAgo(e.sentAt) : '—'}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
