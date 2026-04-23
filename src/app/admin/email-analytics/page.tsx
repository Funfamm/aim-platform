'use client'

import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

interface Analytics {
    allTime: { totalSent: number; totalSuccess: number; totalFailed: number; totalOpened: number; successRate: number; openRate: number }
    last30Days: { sent: number; success: number; failed: number; opened: number; successRate: number; openRate: number }
    typeBreakdown: { type: string; count: number }[]
    dailyVolume: { date: string; sent: number; failed: number }[]
    recentFailures: { id: string; to: string; subject: string; type: string; error: string | null; sentAt: string }[]
}

// CSV import state
interface ImportResult { success: boolean; total: number; imported: number; skippedDuplicate: number; skippedInvalid: number; errors: string[] }

export default function EmailAnalyticsPage() {
    const [data, setData] = useState<Analytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'overview' | 'failures' | 'import'>('overview')
    const [csvText, setCsvText] = useState('')
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<ImportResult | null>(null)

    useEffect(() => {
        fetch('/api/admin/email-analytics')
            .then(r => r.json())
            .then(setData)
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const maxDailySent = data ? Math.max(...data.dailyVolume.map(d => d.sent), 1) : 1

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
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>📧 Email Analytics</h1>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginBottom: '24px' }}>
                    Delivery metrics, open tracking, and subscriber management.
                </p>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '4px' }}>
                    {(['overview', 'failures', 'import'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            flex: 1, padding: '8px 16px', borderRadius: '8px', border: 'none',
                            fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                            background: tab === t ? 'var(--accent-gold)' : 'transparent',
                            color: tab === t ? '#0f1115' : 'var(--text-secondary)',
                            transition: 'all 0.15s',
                        }}>
                            {t === 'overview' ? '📊 Overview' : t === 'failures' ? '❌ Failures' : '📥 CSV Import'}
                        </button>
                    ))}
                </div>

                {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>Loading analytics…</div>}

                {!loading && data && tab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Stat Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                            {[
                                { label: 'Total Sent', value: data.allTime.totalSent, icon: '📤', color: '#60a5fa' },
                                { label: 'Delivered', value: data.allTime.totalSuccess, icon: '✅', color: '#34d399' },
                                { label: 'Failed', value: data.allTime.totalFailed, icon: '❌', color: '#ef4444' },
                                { label: 'Opened', value: data.allTime.totalOpened, icon: '👁', color: '#c084fc' },
                                { label: 'Success Rate', value: `${data.allTime.successRate}%`, icon: '📈', color: '#34d399' },
                                { label: 'Open Rate ~', value: `${data.allTime.openRate}%`, icon: '📬', color: '#f59e0b' },
                            ].map(s => (
                                <div key={s.label} style={{
                                    padding: '16px', borderRadius: '12px',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                        {s.icon} {s.label}
                                    </div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>
                                        {s.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Open rate disclaimer */}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', padding: '8px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)' }}>
                            ⚠️ Open rates are approximate — some email clients block tracking images or proxy them. Treat as a useful signal, not absolute truth.
                        </div>

                        {/* 30-day summary */}
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: '12px' }}>
                                Last 30 Days
                            </div>
                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                                <span><strong style={{ color: '#60a5fa' }}>{data.last30Days.sent}</strong> sent</span>
                                <span><strong style={{ color: '#34d399' }}>{data.last30Days.success}</strong> delivered</span>
                                <span><strong style={{ color: '#ef4444' }}>{data.last30Days.failed}</strong> failed</span>
                                <span><strong style={{ color: '#c084fc' }}>{data.last30Days.opened}</strong> opened</span>
                                <span>Success <strong style={{ color: '#34d399' }}>{data.last30Days.successRate}%</strong></span>
                                <span>Open ~<strong style={{ color: '#f59e0b' }}>{data.last30Days.openRate}%</strong></span>
                            </div>
                        </div>

                        {/* Type breakdown */}
                        {data.typeBreakdown.length > 0 && (
                            <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c084fc', marginBottom: '12px' }}>
                                    By Type (30d)
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {data.typeBreakdown.map(t => (
                                        <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ width: '100px', fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize' }}>{t.type}</span>
                                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '4px', height: '18px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.max(2, (t.count / Math.max(...data.typeBreakdown.map(x => x.count))) * 100)}%`,
                                                    height: '100%', borderRadius: '4px',
                                                    background: 'linear-gradient(90deg, rgba(192,132,252,0.3), rgba(192,132,252,0.6))',
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: '30px', textAlign: 'right' }}>{t.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Daily Volume Chart */}
                        {data.dailyVolume.length > 0 && (
                            <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: '12px' }}>
                                    Daily Volume (7d)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                                    {data.dailyVolume.map(d => (
                                        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>{d.sent}</div>
                                            <div style={{
                                                width: '100%', maxWidth: '40px',
                                                height: `${Math.max(4, (d.sent / maxDailySent) * 100)}px`,
                                                borderRadius: '4px 4px 0 0',
                                                background: d.failed > 0
                                                    ? 'linear-gradient(180deg, rgba(239,68,68,0.5), rgba(96,165,250,0.5))'
                                                    : 'linear-gradient(180deg, rgba(96,165,250,0.4), rgba(96,165,250,0.7))',
                                            }} />
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>
                                                {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!loading && data && tab === 'failures' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.recentFailures.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                                ✅ No recent failures — all emails delivered successfully.
                            </div>
                        ) : data.recentFailures.map(f => (
                            <div key={f.id} style={{
                                padding: '12px 16px', borderRadius: '10px',
                                background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{f.to}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                        {new Date(f.sentAt).toLocaleString()}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{f.subject}</div>
                                <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>{f.error || 'Unknown error'}</div>
                                <span style={{
                                    display: 'inline-block', marginTop: '4px',
                                    fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase',
                                    padding: '1px 6px', borderRadius: '4px',
                                    background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                }}>{f.type}</span>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'import' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
