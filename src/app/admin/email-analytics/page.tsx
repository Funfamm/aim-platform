'use client'

import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import SuppressionTab from './SuppressionTab'
import EmailLogTab from './EmailLogTab'
import ImportTab from './ImportTab'

interface Analytics {
    period: string
    allTime: { totalSent: number; totalSuccess: number; totalFailed: number; totalOpened: number; successRate: number; openRate: number }
    periodStats: { days: number; sent: number; success: number; failed: number; opened: number; successRate: number; openRate: number }
    bounceStats: Record<string, number>
    typeBreakdown: { type: string; count: number }[]
    transportBreakdown: { transport: string; count: number }[]
    chartVolume: { period: string; sent: number; failed: number; opened: number }[]
    healthScore: { score: number; successRate: number; hardBounceRate: number; complaintRate: number; suppressedCount: number; grade: string }
    suppression: { totalActive: number; addedLast30Days: number }
    topFailing: { email: string; failures: number }[]
}

interface ImportResult { success: boolean; total: number; imported: number; skippedDuplicate: number; skippedInvalid: number; errors: string[] }

type TabType = 'overview' | 'suppression' | 'log' | 'import'

export default function EmailAnalyticsPage() {
    const [data, setData] = useState<Analytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<TabType>('overview')
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
    const [csvText, setCsvText] = useState('')
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const loadData = () => {
        setLoading(true)
        fetch(`/api/admin/email-analytics?tz=${new Date().getTimezoneOffset()}&period=${period}`)
            .then(r => r.json())
            .then(d => { setData(d); setLastUpdated(new Date()) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadData() }, [period])

    const maxChartSent = data ? Math.max(...data.chartVolume.map(d => d.sent), 1) : 1
    const hGrade = data?.healthScore?.grade
    const hColor = hGrade === 'excellent' ? '#34d399' : hGrade === 'good' ? '#60a5fa' : hGrade === 'warning' ? '#f59e0b' : '#ef4444'

    async function handleImport() {
        if (!csvText.trim()) return
        setImporting(true)
        setImportResult(null)
        try {
            const res = await fetch('/api/admin/subscribers/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csv: csvText }),
            })
            const data = await res.json()
            setImportResult(data)
        } catch { setImportResult({ success: false, total: 0, imported: 0, skippedDuplicate: 0, skippedInvalid: 0, errors: ['Network error'] }) }
        finally { setImporting(false) }
    }

    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => setCsvText(ev.target?.result as string || '')
        reader.readAsText(file)
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main" style={{ maxWidth: '1000px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>📧 Email Analytics</h1>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', margin: 0 }}>
                            Delivery metrics, open tracking, and subscriber management.
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {lastUpdated && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                Last updated: {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={loadData}
                            disabled={loading}
                            style={{
                                padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                                background: loading ? 'var(--bg-tertiary)' : 'rgba(96,165,250,0.08)',
                                color: loading ? 'var(--text-tertiary)' : '#60a5fa',
                                fontWeight: 600, fontSize: '0.78rem', cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            {loading ? '⏳ Loading…' : '🔄 Refresh'}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '4px' }}>
                    {([['overview','📊 Overview'],['suppression','🛡️ Suppression'],['log','📋 Email Log'],['import','📥 Import']] as const).map(([t, label]) => (
                        <button key={t} onClick={() => setTab(t as TabType)} style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                            fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                            background: tab === t ? 'var(--accent-gold)' : 'transparent',
                            color: tab === t ? '#0f1115' : 'var(--text-secondary)',
                            transition: 'all 0.15s',
                        }}>{label}</button>
                    ))}
                </div>

                {/* Period selector (for overview) */}
                {tab === 'overview' && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
                        {(['daily','weekly','monthly'] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)} style={{
                                padding: '5px 14px', borderRadius: '6px', border: '1px solid var(--border-subtle)',
                                background: period === p ? 'rgba(96,165,250,0.15)' : 'transparent',
                                color: period === p ? '#60a5fa' : 'var(--text-tertiary)',
                                fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', textTransform: 'capitalize',
                            }}>{p}</button>
                        ))}
                    </div>
                )}

                {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>Loading analytics…</div>}

                {!loading && data && tab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Stat Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                            {[
                                { label: 'Total Sent', value: data.periodStats.sent, icon: '📤', color: '#60a5fa' },
                                { label: 'Delivered', value: data.periodStats.success, icon: '✅', color: '#34d399' },
                                { label: 'Failed', value: data.periodStats.failed, icon: '❌', color: '#ef4444' },
                                { label: 'Opened', value: data.periodStats.opened, icon: '👁', color: '#c084fc' },
                                { label: 'Success Rate', value: `${data.periodStats.successRate}%`, icon: '📈', color: '#34d399' },
                                { label: 'Open Rate ~', value: `${data.periodStats.openRate}%`, icon: '📬', color: '#f59e0b' },
                            ].map(s => (
                                <div key={s.label} style={{
                                    padding: '18px 16px', borderRadius: '12px', minHeight: '88px',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                }}>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {s.icon} {s.label}
                                    </div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, marginTop: '8px' }}>
                                        {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Open rate disclaimer */}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', padding: '10px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)', lineHeight: 1.5 }}>
                            ⚠️ Open rates are approximate — some email clients block tracking images or proxy them. Treat as a useful signal, not absolute truth.
                        </div>

                        {/* Health Score */}
                        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-secondary)', border: `1px solid ${hColor}33`, minHeight: '88px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: hColor, marginBottom: '6px' }}>
                                        Reputation Health
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                        <span style={{ fontSize: '2.2rem', fontWeight: 900, color: hColor, lineHeight: 1 }}>{data.healthScore.score}</span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: hColor, opacity: 0.7 }}>/100</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'capitalize', marginTop: '4px' }}>{data.healthScore.grade}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Bounce</span>
                                        <strong style={{ color: data.healthScore.hardBounceRate > 2 ? '#ef4444' : '#34d399', minWidth: '36px', textAlign: 'right' }}>{data.healthScore.hardBounceRate}%</strong>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Complaint</span>
                                        <strong style={{ color: data.healthScore.complaintRate > 0.1 ? '#ef4444' : '#34d399', minWidth: '36px', textAlign: 'right' }}>{data.healthScore.complaintRate}%</strong>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Suppressed</span>
                                        <strong style={{ color: '#f59e0b', minWidth: '36px', textAlign: 'right' }}>{data.healthScore.suppressedCount}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Period summary */}
                        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: '14px' }}>
                            {(() => {
                                const now = new Date()
                                const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                const end = fmt(now)
                                if (period === 'daily') {
                                    const start = new Date(now); start.setDate(start.getDate() - 6)
                                    return `Last 7 Days (${fmt(start)} – ${end})`
                                }
                                if (period === 'weekly') {
                                    const start = new Date(now); start.setDate(start.getDate() - 27)
                                    return `Last 4 Weeks (${fmt(start)} – ${end})`
                                }
                                const start = new Date(now); start.setMonth(start.getMonth() - 2); start.setDate(1)
                                return `Last 3 Months (${fmt(start)} – ${end})`
                            })()}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                                {[
                                    { label: 'Sent', value: data.periodStats.sent, color: '#60a5fa' },
                                    { label: 'Delivered', value: data.periodStats.success, color: '#34d399' },
                                    { label: 'Failed', value: data.periodStats.failed, color: '#ef4444' },
                                    { label: 'Opened', value: data.periodStats.opened, color: '#c084fc' },
                                    { label: 'Success', value: `${data.periodStats.successRate}%`, color: '#34d399' },
                                    { label: 'Open Rate', value: `~${data.periodStats.openRate}%`, color: '#f59e0b' },
                                ].map(s => (
                                    <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{s.label.toLowerCase()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Type breakdown */}
                        {data.typeBreakdown.length > 0 && (
                            <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c084fc', marginBottom: '14px' }}>
                                    By Type ({period === 'daily' ? '7d' : period === 'weekly' ? '30d' : '90d'})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {data.typeBreakdown.map(t => (
                                        <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ width: '110px', fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize', flexShrink: 0 }}>{t.type}</span>
                                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.max(2, (t.count / Math.max(...data.typeBreakdown.map(x => x.count))) * 100)}%`,
                                                    height: '100%', borderRadius: '4px',
                                                    background: 'linear-gradient(90deg, rgba(192,132,252,0.3), rgba(192,132,252,0.6))',
                                                    transition: 'width 0.3s ease',
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>{t.count.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Volume Chart */}
                        {data.chartVolume.length > 0 && (
                            <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: '14px' }}>
                                    Volume ({period})
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '130px' }}>
                                    {data.chartVolume.map(d => (
                                        <div key={d.period} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>{d.sent.toLocaleString()}</div>
                                            <div style={{
                                                width: '100%', maxWidth: '44px',
                                                height: `${Math.max(4, (d.sent / maxChartSent) * 110)}px`,
                                                borderRadius: '4px 4px 0 0',
                                                background: d.failed > 0
                                                    ? 'linear-gradient(180deg, rgba(239,68,68,0.5), rgba(96,165,250,0.5))'
                                                    : 'linear-gradient(180deg, rgba(96,165,250,0.4), rgba(96,165,250,0.7))',
                                                transition: 'height 0.3s ease',
                                            }} />
                                            <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>
                                                {d.period.length > 7 ? d.period.slice(5) : d.period}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'suppression' && <SuppressionTab />}

                {tab === 'log' && <EmailLogTab />}


                {tab === 'import' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Suppression Import */}
                        <div style={{
                            padding: '20px', borderRadius: '12px',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                        }}>
                            <ImportTab />
                        </div>

                        {/* Subscriber CSV Import (existing) */}
                        <div style={{
                            padding: '20px', borderRadius: '12px',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                        }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: '12px' }}>
                                📥 Import Subscribers from CSV
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                                Upload a CSV with <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>email</code> (required) and{' '}
                                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>name</code> (optional) columns. Max 5,000 rows / 2MB.
                            </p>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <label style={{
                                    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                                    background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                                    color: '#60a5fa', fontWeight: 600, fontSize: '0.82rem',
                                }}>
                                    📎 Choose File
                                    <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                                </label>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                                    or paste CSV below
                                </span>
                            </div>

                            <textarea
                                placeholder={'email,name\njohn@example.com,John Doe\njane@example.com,Jane'}
                                value={csvText}
                                onChange={e => setCsvText(e.target.value)}
                                rows={8}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'monospace',
                                    resize: 'vertical',
                                }}
                            />

                            <button
                                onClick={handleImport}
                                disabled={importing || !csvText.trim()}
                                style={{
                                    marginTop: '12px', padding: '10px 24px', borderRadius: '8px',
                                    border: 'none', fontWeight: 700, fontSize: '0.85rem',
                                    cursor: importing || !csvText.trim() ? 'not-allowed' : 'pointer',
                                    background: importing || !csvText.trim()
                                        ? 'rgba(212,168,83,0.15)' : 'linear-gradient(135deg, var(--accent-gold), #c49b3a)',
                                    color: importing || !csvText.trim() ? 'rgba(212,168,83,0.35)' : '#0f1115',
                                }}
                            >
                                {importing ? '⏳ Importing…' : '📥 Import Subscribers'}
                            </button>
                        </div>

                        {importResult && (
                            <div style={{
                                padding: '16px', borderRadius: '12px',
                                background: importResult.success ? 'rgba(52,211,153,0.04)' : 'rgba(239,68,68,0.04)',
                                border: `1px solid ${importResult.success ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)'}`,
                            }}>
                                <div style={{ fontWeight: 700, marginBottom: '8px', color: importResult.success ? '#34d399' : '#ef4444' }}>
                                    {importResult.success ? '✅ Import Complete' : '❌ Import Failed'}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem' }}>
                                    <span>Total rows: <strong>{importResult.total}</strong></span>
                                    <span>Imported: <strong style={{ color: '#34d399' }}>{importResult.imported}</strong></span>
                                    <span>Duplicates: <strong style={{ color: '#f59e0b' }}>{importResult.skippedDuplicate}</strong></span>
                                    <span>Invalid: <strong style={{ color: '#ef4444' }}>{importResult.skippedInvalid}</strong></span>
                                </div>
                                {importResult.errors.length > 0 && (
                                    <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#ef4444' }}>
                                        {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
