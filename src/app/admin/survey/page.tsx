'use client'

import { useState, useEffect, useCallback } from 'react'

interface CategoryBreakdown {
    key: string
    label: string
    count: number
    percentage: number
}

interface FreeTextItem {
    text: string
    createdAt: string
    country: string | null
}

interface RecentResponse {
    email: string | null
    selections: string[]
    country: string | null
    createdAt: string
}

interface SurveyData {
    totalResponses: number
    responsesLast24h: number
    conversionRate: number
    convertedCount: number
    categoryBreakdown: CategoryBreakdown[]
    freeTextResponses: FreeTextItem[]
    recentResponses: RecentResponse[]
    surveyId: string | null
}

// Country code to flag emoji
function countryFlag(code: string | null): string {
    if (!code || code.length !== 2) return '🌍'
    const offset = 0x1F1E6
    return String.fromCodePoint(
        code.charCodeAt(0) - 65 + offset,
        code.charCodeAt(1) - 65 + offset
    )
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export default function AdminSurveyPage() {
    const [data, setData] = useState<SurveyData | null>(null)
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [sendResult, setSendResult] = useState<string | null>(null)
    const [testEmail, setTestEmail] = useState('')
    const [ftPage, setFtPage] = useState(0)
    const [rrPage, setRrPage] = useState(0)

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/survey')
            if (res.ok) {
                const json = await res.json()
                setData(json)
            }
        } catch {
            // ignore
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const handleSendSurvey = async (test?: boolean) => {
        setSending(true)
        setSendResult(null)
        try {
            const body: Record<string, string> = {}
            if (test && testEmail) body.testEmail = testEmail
            const res = await fetch('/api/admin/survey/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const json = await res.json()
            if (res.ok) {
                setSendResult(test ? `✅ Test email queued to ${testEmail}` : `✅ ${json.queued} emails queued`)
                fetchData()
            } else {
                setSendResult(`❌ ${json.error}${json.lastSentAt ? ` (last sent: ${new Date(json.lastSentAt).toLocaleDateString()})` : ''}`)
            }
        } catch {
            setSendResult('❌ Network error')
        } finally {
            setSending(false)
        }
    }

    const handleExport = () => {
        window.open('/api/admin/survey/export', '_blank')
    }

    if (loading) {
        return <div style={styles.page}><p style={styles.loadingText}>Loading survey data...</p></div>
    }

    const ftPerPage = 20
    const rrPerPage = 50
    const freeTextSlice = data?.freeTextResponses.slice(ftPage * ftPerPage, (ftPage + 1) * ftPerPage) || []
    const recentSlice = data?.recentResponses.slice(rrPage * rrPerPage, (rrPage + 1) * rrPerPage) || []
    const maxBar = Math.max(...(data?.categoryBreakdown.map(c => c.percentage) || [1]))

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1 style={styles.title}>📊 Audience Survey</h1>
                <button onClick={handleExport} style={styles.exportBtn}>Export CSV</button>
            </div>

            {/* ── Metric Cards ── */}
            <div style={styles.metricsRow}>
                <div style={styles.metricCard}>
                    <div style={styles.metricValue}>{data?.totalResponses ?? 0}</div>
                    <div style={styles.metricLabel}>Total Responses</div>
                </div>
                <div style={styles.metricCard}>
                    <div style={styles.metricValue}>{data?.responsesLast24h ?? 0}</div>
                    <div style={styles.metricLabel}>Last 24 Hours</div>
                </div>
                <div style={styles.metricCard}>
                    <div style={styles.metricValue}>
                        {data?.convertedCount ?? 0}
                        <span style={styles.metricPct}> ({data?.conversionRate ?? 0}%)</span>
                    </div>
                    <div style={styles.metricLabel}>Converted to Users</div>
                </div>
            </div>

            {/* ── Category Breakdown ── */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Category Breakdown</h2>
                <div style={styles.barsContainer}>
                    {data?.categoryBreakdown.map(cat => (
                        <div key={cat.key} style={styles.barRow}>
                            <div style={styles.barLabel}>{cat.label}</div>
                            <div style={styles.barTrack}>
                                <div style={{
                                    ...styles.barFill,
                                    width: `${maxBar > 0 ? (cat.percentage / maxBar) * 100 : 0}%`,
                                }} />
                            </div>
                            <div style={styles.barValue}>{cat.count} ({cat.percentage}%)</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Free Text Responses ── */}
            {(data?.freeTextResponses.length ?? 0) > 0 && (
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Open Responses</h2>
                    <div style={styles.freeTextList}>
                        {freeTextSlice.map((item, i) => (
                            <div key={i} style={styles.freeTextItem}>
                                <div style={styles.freeTextQuote}>&ldquo;{item.text}&rdquo;</div>
                                <div style={styles.freeTextMeta}>
                                    {countryFlag(item.country)} {item.country || '??'} &bull; {timeAgo(item.createdAt)}
                                </div>
                            </div>
                        ))}
                    </div>
                    {(data?.freeTextResponses.length ?? 0) > ftPerPage && (
                        <div style={styles.pagination}>
                            <button disabled={ftPage === 0} onClick={() => setFtPage(p => p - 1)} style={styles.pageBtn}>← Prev</button>
                            <span style={styles.pageInfo}>Page {ftPage + 1} of {Math.ceil((data?.freeTextResponses.length ?? 0) / ftPerPage)}</span>
                            <button disabled={(ftPage + 1) * ftPerPage >= (data?.freeTextResponses.length ?? 0)} onClick={() => setFtPage(p => p + 1)} style={styles.pageBtn}>Next →</button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Recent Responses Table ── */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Recent Responses</h2>
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Time</th>
                                <th style={styles.th}>Email</th>
                                <th style={styles.th}>Selections</th>
                                <th style={styles.th}>Country</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentSlice.map((r, i) => (
                                <tr key={i}>
                                    <td style={styles.td}>{timeAgo(r.createdAt)}</td>
                                    <td style={styles.td}>{r.email || '—'}</td>
                                    <td style={styles.td}>{r.selections.join(', ')}</td>
                                    <td style={styles.td}>{countryFlag(r.country)} {r.country || '—'}</td>
                                </tr>
                            ))}
                            {recentSlice.length === 0 && (
                                <tr><td colSpan={4} style={{ ...styles.td, textAlign: 'center' }}>No responses yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {(data?.recentResponses.length ?? 0) > rrPerPage && (
                    <div style={styles.pagination}>
                        <button disabled={rrPage === 0} onClick={() => setRrPage(p => p - 1)} style={styles.pageBtn}>← Prev</button>
                        <span style={styles.pageInfo}>Page {rrPage + 1} of {Math.ceil((data?.recentResponses.length ?? 0) / rrPerPage)}</span>
                        <button disabled={(rrPage + 1) * rrPerPage >= (data?.recentResponses.length ?? 0)} onClick={() => setRrPage(p => p + 1)} style={styles.pageBtn}>Next →</button>
                    </div>
                )}
            </div>

            {/* ── Send Survey Section ── */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>📬 Send Survey Email</h2>
                <div style={styles.sendCard}>
                    <p style={styles.sendInfo}>Send to all active, non-suppressed subscribers.</p>
                    <p style={styles.sendWarning}>⚠️ Send the survey BEFORE the conversion campaign email.</p>

                    <div style={styles.testRow}>
                        <input
                            type="email"
                            placeholder="Test email address"
                            value={testEmail}
                            onChange={e => setTestEmail(e.target.value)}
                            style={styles.testInput}
                        />
                        <button
                            onClick={() => handleSendSurvey(true)}
                            disabled={sending || !testEmail}
                            style={styles.testBtn}
                        >
                            Preview Email
                        </button>
                    </div>

                    <button
                        onClick={() => handleSendSurvey(false)}
                        disabled={sending}
                        style={styles.sendBtn}
                    >
                        {sending ? 'Sending...' : 'Send Survey Email to All Subscribers'}
                    </button>

                    {sendResult && <p style={styles.sendResult}>{sendResult}</p>}
                </div>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        padding: '24px 32px',
        maxWidth: 1100,
    },
    loadingText: {
        color: '#9ca3af',
        fontSize: '1rem',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: 800,
        color: 'var(--text-primary)',
        margin: 0,
    },
    exportBtn: {
        padding: '8px 20px',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 8,
        color: 'var(--accent-gold)',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
    },
    metricsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 32,
    },
    metricCard: {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 24px',
        textAlign: 'center' as const,
    },
    metricValue: {
        fontSize: '2rem',
        fontWeight: 800,
        color: 'var(--accent-gold)',
    },
    metricPct: {
        fontSize: '0.9rem',
        fontWeight: 500,
        color: 'var(--text-secondary)',
    },
    metricLabel: {
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        marginTop: 4,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: '1.1rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        margin: '0 0 16px',
    },
    barsContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 10,
    },
    barRow: {
        display: 'grid',
        gridTemplateColumns: '160px 1fr 100px',
        alignItems: 'center',
        gap: 12,
    },
    barLabel: {
        fontSize: '0.85rem',
        color: 'var(--text-primary)',
        fontWeight: 500,
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    barTrack: {
        height: 20,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 6,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #c9a84c, #e8c36a)',
        borderRadius: 6,
        transition: 'width 0.5s ease',
        minWidth: 2,
    },
    barValue: {
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        textAlign: 'right' as const,
        whiteSpace: 'nowrap' as const,
    },
    freeTextList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 10,
        maxHeight: 400,
        overflowY: 'auto' as const,
    },
    freeTextItem: {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px 18px',
    },
    freeTextQuote: {
        fontSize: '0.9rem',
        color: 'var(--text-primary)',
        lineHeight: 1.5,
        fontStyle: 'italic',
        marginBottom: 6,
    },
    freeTextMeta: {
        fontSize: '0.75rem',
        color: 'var(--text-tertiary, #6b7280)',
    },
    pagination: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginTop: 12,
    },
    pageBtn: {
        padding: '6px 14px',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--text-secondary)',
        fontSize: '0.8rem',
        cursor: 'pointer',
    },
    pageInfo: {
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
    },
    tableWrapper: {
        overflowX: 'auto' as const,
        borderRadius: 10,
        border: '1px solid var(--border)',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        fontSize: '0.85rem',
    },
    th: {
        textAlign: 'left' as const,
        padding: '10px 14px',
        color: 'var(--text-secondary)',
        fontWeight: 600,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
        fontSize: '0.75rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    td: {
        padding: '10px 14px',
        color: 'var(--text-primary)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
    },
    sendCard: {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '24px',
    },
    sendInfo: {
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
        margin: '0 0 8px',
    },
    sendWarning: {
        color: '#f59e0b',
        fontSize: '0.85rem',
        margin: '0 0 20px',
    },
    testRow: {
        display: 'flex',
        gap: 10,
        marginBottom: 14,
    },
    testInput: {
        flex: 1,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        color: 'var(--text-primary)',
        fontSize: '0.9rem',
        outline: 'none',
    },
    testBtn: {
        padding: '10px 20px',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 8,
        color: 'var(--accent-gold)',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
    },
    sendBtn: {
        width: '100%',
        padding: '12px 24px',
        background: 'var(--accent-gold, #c9a84c)',
        color: '#0f1115',
        border: 'none',
        borderRadius: 8,
        fontSize: '0.95rem',
        fontWeight: 700,
        cursor: 'pointer',
    },
    sendResult: {
        marginTop: 12,
        fontSize: '0.9rem',
        color: 'var(--text-primary)',
    },
}
