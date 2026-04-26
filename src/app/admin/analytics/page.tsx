'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import VoiceConversation from '@/components/analytics/VoiceConversation'
import { Sparkline, VitalityRing, DonutChart, AreaChart, HourlyHeatmap, TrendArrow, ActivityItem, getRelativeTime } from '@/components/analytics/Charts'

// ── Animated counter hook ──
function useAnimatedCounter(target: number, duration = 1200) {
    const [count, setCount] = useState(0)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (target === 0) { setCount(0); return }
        let start = 0
        const startTime = performance.now()
        const step = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
            start = Math.round(eased * target)
            setCount(start)
            if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
    }, [target, duration])
    return count
}

function getGreeting() {
    const h = new Date().getHours()
    if (h < 5) return '🌙 Late Night'
    if (h < 12) return '☀️ Good Morning'
    if (h < 17) return '🌤️ Good Afternoon'
    if (h < 21) return '🌅 Good Evening'
    return '🌙 Good Night'
}


interface DashboardData {
    projectCount: number
    castingCount: number
    applicationCount: number
    pendingCount: number
    reviewedCount: number
    scriptSubmissionCount: number
    pendingScriptReviews: number
    recentApplications: {
        id: string
        fullName: string
        status: string
        aiScore: number | null
        createdAt: string
        castingCall: {
            roleName: string
            project: { title: string }
        }
    }[]
    recentScriptSubmissions: {
        id: string
        authorName: string
        title: string
        status: string
        createdAt: string
        scriptCallTitle: string | null
    }[]
}

interface AnalyticsData {
    realTime: { onlineNow: number; loggedInNow: number; activeUsers: {name: string}[]; hasMoreUsers: boolean; todayViews: number; yesterdayViews: number }
    traffic: {
        weekViews: number; monthViews: number
        dailyViews: { date: string; views: number }[]
        topPages: { path: string; views: number }[]
        devices: { device: string; count: number }[]
        hourlyViews: number[]
        referrerSources: { source: string; count: number }[]
    }
    content: {
        totalFilmViews: number
        topFilms: { views: number; weekViews: number; project: { title: string; slug: string; coverImage: string | null; trailerUrl?: string | null } }[]
        viewsByPeriod?: { today: number; week: number; month: number; allTime: number }
        trailerStats?: {
            totalTrailers: number
            views: { today: number; week: number; month: number; allTime: number }
            topTrailers: { title: string; views: number }[]
        }
    }
    engagement: {
        totalUsers: number; newUsersMonth: number
        totalApps: number; appsMonth: number
        totalDonations: number; donationsMonth: number
        subscribers: number
        mailingList: number
        trailerCount: number
        trailerViews: number
        conversionRate: number; castingViews: number
    }
    email?: {
        total: number
        today: number
        thisMonth: number
        failedMonth: number
        successRate: number
        byType: { type: string; count: number }[]
    }
    sparklines: { views: number[]; users: number[]; apps: number[] }
    recentActivity: { id: string; path: string; device: string | null; createdAt: string; referrer: string | null }[]
    dashboard?: DashboardData
}

interface Insight {
    type: 'trend' | 'recommendation' | 'alert' | 'win'
    title: string
    description: string
}

interface SystemHealth {
    status: string
    timestamp: string
    responseTime: number
    database: { status: string; latency: number; provider: string; totalRecords: number; tables: Record<string, number> }
    activity: { views24h: number; views1h: number; users24h: number; apps24h: number; requestsPerMinute: number }
    runtime: { platform: string; environment: string; region: string; nodeVersion: string; uptime: number; memory: { heapUsed: number; heapTotal: number; rss: number; external: number; utilization: number } }
    services: { name: string; status: string; latency: number | null }[]
}

type TabType = 'overview' | 'traffic' | 'content' | 'ai' | 'system'

export default function AdminAnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    // Hydration guard — time-dependent UI must wait for client mount
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])
    const [insights, setInsights] = useState<Insight[]>([])
    const [insightsLoading, setInsightsLoading] = useState(false)
    const [insightsError, setInsightsError] = useState('')
    const [activeTab, setActiveTab] = useState<TabType>('overview')
    const [insightsRevealed, setInsightsRevealed] = useState(0)
    const [keyUsed, setKeyUsed] = useState('')

    // Voice state
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
    const speechRef = useRef<SpeechSynthesisUtterance | null>(null)

    // Conversational follow-up
    const [chatInput, setChatInput] = useState('')
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
    const [chatLoading, setChatLoading] = useState(false)

    // Voice conversation mode
    const [voiceModeOpen, setVoiceModeOpen] = useState(false)

    const [livePopoverPos, setLivePopoverPos] = useState<{ top: number; right: number } | null>(null)
    const livePopoverRef = useRef<HTMLDivElement>(null)

    // Close live-users popover on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (livePopoverRef.current && !livePopoverRef.current.contains(e.target as Node)) {
                setLivePopoverPos(null)
            }
        }
        if (livePopoverPos) {
            document.addEventListener('mousedown', handleClick)
            return () => document.removeEventListener('mousedown', handleClick)
        }
    }, [livePopoverPos])

    const [fetchError, setFetchError] = useState('')
    const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
    const [systemLoading, setSystemLoading] = useState(false)

    // Single unified fetch — section=all returns core + traffic + content + dashboard
    const fetchData = useCallback(async () => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout
        try {
            setFetchError('')
            const res = await fetch('/api/admin/analytics', { signal: controller.signal })
            clearTimeout(timeout)
            if (res.status === 401) { window.location.href = '/admin/login'; return }
            const json = await res.json()
            if (!res.ok) {
                setFetchError(json.details || json.error || `Server error ${res.status}`)
                return
            }
            setData(json)
        } catch (err) {
            clearTimeout(timeout)
            if ((err as Error).name === 'AbortError') {
                setFetchError('Request timed out. The analytics API is taking too long to respond.')
            } else {
                setFetchError(err instanceof Error ? err.message : 'Network error')
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(fetchData, 30000)
        return () => clearInterval(interval)
    }, [fetchData])

    const generateInsights = async () => {
        setInsightsLoading(true)
        setInsightsError('')
        setInsightsRevealed(0)
        setChatHistory([])
        stopSpeaking()
        try {
            const res = await fetch('/api/admin/analytics', { method: 'POST' })
            const result = await res.json()
            if (result.error) {
                setInsightsError(result.error)
            } else {
                const items = result.insights || []
                setInsights(items)
                setKeyUsed(result.keyUsed || '')
                // Staggered reveal
                items.forEach((_: Insight, i: number) => {
                    setTimeout(() => setInsightsRevealed(prev => Math.max(prev, i + 1)), 300 + i * 250)
                })
            }
        } catch {
            setInsightsError('Failed to generate insights')
        } finally {
            setInsightsLoading(false)
        }
    }

    // ── Voice functions ──
    const stopSpeaking = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel()
        }
        setIsSpeaking(false)
        setSpeakingIdx(null)
    }

    const speakText = (text: string, idx?: number) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return
        stopSpeaking()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 0.95
        utterance.pitch = 1
        utterance.volume = 1
        // Prefer a natural voice if available
        const voices = window.speechSynthesis.getVoices()
        const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.lang === 'en-US')
        if (preferred) utterance.voice = preferred
        utterance.onstart = () => { setIsSpeaking(true); setSpeakingIdx(idx ?? null) }
        utterance.onend = () => { setIsSpeaking(false); setSpeakingIdx(null) }
        utterance.onerror = () => { setIsSpeaking(false); setSpeakingIdx(null) }
        speechRef.current = utterance
        window.speechSynthesis.speak(utterance)
    }

    const readAllInsights = () => {
        if (isSpeaking) { stopSpeaking(); return }
        const script = insights.map((ins, i) =>
            `Insight ${i + 1}: ${ins.title}. ${ins.description}`
        ).join('. Next insight. ')
        speakText(script)
    }

    // ── Conversational chat ──
    const askFollowUp = async () => {
        if (!chatInput.trim() || chatLoading) return
        const question = chatInput.trim()
        setChatInput('')
        setChatLoading(true)
        setChatHistory(prev => [...prev, { role: 'user', text: question }])
        try {
            const contextSummary = insights.map(ins => `${ins.type.toUpperCase()}: ${ins.title}: ${ins.description}`).join('\n')
            const res = await fetch('/api/admin/analytics/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, context: contextSummary }),
            })
            const result = await res.json()
            const answer = result.answer || 'I could not generate a response.'
            setChatHistory(prev => [...prev, { role: 'ai', text: answer }])
            speakText(answer)
        } catch {
            setChatHistory(prev => [...prev, { role: 'ai', text: 'Failed to get a response. Please try again.' }])
        } finally {
            setChatLoading(false)
        }
    }

    // Compute vitality score
    const computeVitality = (d: AnalyticsData) => {
        const trafficScore = Math.min(d.traffic.monthViews / 5, 30)
        const userScore = Math.min(d.engagement.totalUsers * 3, 25)
        const appScore = Math.min(d.engagement.totalApps * 5, 20)
        const subScore = Math.min(d.engagement.subscribers * 4, 15)
        const contentScore = Math.min(d.content.totalFilmViews * 2, 10)
        return Math.min(Math.round(trafficScore + userScore + appScore + subScore + contentScore), 100)
    }

    const insightColors = {
        trend: { color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', icon: '📈', border: 'rgba(59,130,246,0.15)' },
        recommendation: { color: '#10b981', bg: 'rgba(16,185,129,0.06)', icon: '💡', border: 'rgba(16,185,129,0.15)' },
        alert: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', icon: '⚠️', border: 'rgba(245,158,11,0.15)' },
        win: { color: '#22c55e', bg: 'rgba(34,197,94,0.06)', icon: '🏆', border: 'rgba(34,197,94,0.15)' },
    }

    const deviceColors: Record<string, string> = { mobile: '#3b82f6', desktop: '#10b981', tablet: '#f59e0b', unknown: '#6b7280' }

    // ── System health fetch ──
    const fetchSystemHealth = useCallback(async () => {
        setSystemLoading(true)
        try {
            const res = await fetch('/api/admin/system')
            if (res.ok) setSystemHealth(await res.json())
        } catch { /* silent */ }
        setSystemLoading(false)
    }, [])

    useEffect(() => { if (activeTab === 'system') fetchSystemHealth() }, [activeTab, fetchSystemHealth])

    const formatUptime = (s: number) => {
        const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
        return `${d}d ${h}h ${m}m`
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: '📊' },
        { id: 'traffic', label: 'Traffic', icon: '📈' },
        { id: 'content', label: 'Content', icon: '🎬' },
        { id: 'ai', label: 'AI Insights', icon: '🤖' },
        { id: 'system', label: 'System', icon: '🖥️' },
    ]

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <style>{`
                @media (max-width: 768px) {
                    /* Header */
                    .aa-header-row { flex-direction: column !important; gap: 10px !important; }
                    .aa-header-row h1 { font-size: 1.25rem !important; }
                    .aa-header-indicators { flex-wrap: wrap; }

                    /* Dashboard command strip: 4-col → 2-col */
                    .aa-cmd-strip { grid-template-columns: repeat(2, 1fr) !important; }

                    /* Studio Pulse + Metrics: side-by-side → stacked */
                    .aa-pulse-row { grid-template-columns: 1fr !important; }

                    /* Engagement strip: 5-col → horizontal scroll */
                    .aa-engage-strip {
                        grid-template-columns: repeat(6, 140px) !important;
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch;
                        padding-bottom: 6px;
                        scrollbar-width: none;
                    }
                    .aa-engage-strip::-webkit-scrollbar { display: none; }

                    /* Email stats: 4-col → 2-col */
                    .aa-email-stats { grid-template-columns: repeat(2, 1fr) !important; }

                    /* Funnel + Activity: side-by-side → stacked */
                    .aa-funnel-row { grid-template-columns: 1fr !important; }

                    /* Application list: compact 4-col → simplified */
                    .aa-app-row {
                        grid-template-columns: 1fr auto !important;
                        gap: 6px !important;
                        padding: 10px 12px !important;
                    }
                    .aa-app-score, .aa-app-date { display: none !important; }

                    /* Traffic tab: stats → 3+2 */
                    .aa-traffic-strip { grid-template-columns: repeat(3, 1fr) !important; }

                    /* Chart + Heatmap → stacked */
                    .aa-chart-row { grid-template-columns: 1fr !important; }

                    /* Bottom triple → stacked */
                    .aa-bottom-row { grid-template-columns: 1fr !important; }

                    /* Content strip → stacked */
                    .aa-content-strip { grid-template-columns: 1fr !important; }

                    /* Tab bar text */
                    .aa-tabs button { font-size: 0.68rem !important; padding: 0.5rem 0.3rem !important; }

                    /* Quick actions wrap better */
                    .aa-quick-actions { gap: 6px !important; }
                    .aa-quick-actions a { font-size: 0.7rem !important; padding: 6px 10px !important; }
                }
            `}</style>

            <main className="admin-main">
                {/* ── Cinematic Header ── */}
                <div style={{
                    position: 'relative', marginBottom: 'var(--space-lg)',
                    padding: '24px 28px 20px',
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.06) 0%, rgba(139,92,246,0.04) 50%, rgba(59,130,246,0.03) 100%)',
                    border: '1px solid rgba(212,168,83,0.1)',
                    borderRadius: 'var(--radius-xl, 16px)',
                    overflow: 'hidden',
                }}>
                    {/* Decorative film strip line */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                        background: 'linear-gradient(90deg, transparent, var(--accent-gold), rgba(139,92,246,0.6), var(--accent-gold), transparent)',
                        opacity: 0.5,
                    }} />
                    {/* Subtle animated orb */}
                    <div style={{
                        position: 'absolute', top: '-40px', right: '-20px',
                        width: '160px', height: '160px', borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(212,168,83,0.08) 0%, transparent 70%)',
                        animation: 'orbFloat 8s ease-in-out infinite',
                        pointerEvents: 'none',
                    }} />

                    <div className="aa-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '4px', opacity: 0.9 }}>
                                {mounted ? getGreeting() : '🎬 Welcome'}, Director
                            </div>
                            <h1 style={{
                                fontSize: '1.6rem', fontWeight: 900, margin: 0,
                                background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--accent-gold) 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                letterSpacing: '-0.02em',
                            }}>Studio Command Center</h1>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '4px 0 0', lineHeight: 1.4 }}>
                                Real-time analytics · AI-powered insights · Live monitoring
                            </p>
                        </div>

                        {/* Status indicators */}
                        {data && (
                            <div className="aa-header-indicators" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '5px 14px', borderRadius: 'var(--radius-full)',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--border-subtle)',
                                    fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 500,
                                }}>
                                    ⏱ {mounted ? new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </div>
                                {/* Live logged-in users indicator */}
                                <div ref={livePopoverRef} style={{ position: 'relative' }}>
                                    <button
                                        onClick={(e) => {
                                            if (livePopoverPos) { setLivePopoverPos(null); return }
                                            // Use fixed positioning so the popover escapes overflow:hidden
                                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                                            setLivePopoverPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
                                        }}
                                        title={`${data.realTime.loggedInNow} logged-in user${data.realTime.loggedInNow !== 1 ? 's' : ''} active now`}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '5px 14px', borderRadius: 'var(--radius-full)',
                                            background: data.realTime.loggedInNow > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${data.realTime.loggedInNow > 0 ? 'rgba(34,197,94,0.2)' : 'var(--border-subtle)'}`,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span style={{
                                            width: '7px', height: '7px', borderRadius: '50%',
                                            background: data.realTime.loggedInNow > 0 ? '#22c55e' : '#6b7280',
                                            animation: data.realTime.loggedInNow > 0 ? 'livePulse 2s ease-in-out infinite' : 'none',
                                            boxShadow: data.realTime.loggedInNow > 0 ? '0 0 10px rgba(34,197,94,0.5)' : 'none',
                                            flexShrink: 0,
                                        }} />
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: data.realTime.loggedInNow > 0 ? '#22c55e' : 'var(--text-tertiary)' }}>
                                            {data.realTime.loggedInNow} logged in
                                        </span>
                                        {data.realTime.onlineNow > data.realTime.loggedInNow && (
                                            <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
                                                +{data.realTime.onlineNow - data.realTime.loggedInNow} guests
                                            </span>
                                        )}
                                    </button>

                                    {/* Active users popover — rendered at fixed position to escape overflow:hidden */}
                                    {livePopoverPos && (
                                        <div
                                            style={{
                                                position: 'fixed',
                                                top: livePopoverPos.top,
                                                right: livePopoverPos.right,
                                                minWidth: '240px', maxWidth: '300px',
                                                background: 'var(--bg-card, #1a1d23)',
                                                border: '1px solid rgba(34,197,94,0.25)',
                                                borderRadius: '14px',
                                                boxShadow: '0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(34,197,94,0.08)',
                                                zIndex: 99999,
                                                overflow: 'hidden',
                                                animation: 'slideDown 0.18s ease',
                                            }}
                                        >
                                            {/* Header */}
                                            <div style={{
                                                padding: '10px 14px',
                                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                background: 'rgba(34,197,94,0.04)',
                                            }}>
                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 8px rgba(34,197,94,0.6)', animation: 'livePulse 2s ease-in-out infinite' }} />
                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live now</span>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>last 5 min</span>
                                            </div>

                                            {/* Summary row */}
                                            <div style={{
                                                display: 'flex', gap: '16px',
                                                padding: '10px 14px',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                background: 'rgba(255,255,255,0.01)',
                                            }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{data.realTime.loggedInNow}</div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>logged in</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{data.realTime.onlineNow - data.realTime.loggedInNow}</div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>guests</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{data.realTime.onlineNow}</div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>total</div>
                                                </div>
                                            </div>

                                            {/* User list */}
                                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                                {data.realTime.activeUsers.length === 0 ? (
                                                    <div style={{ padding: '14px', fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                                        No logged-in users right now
                                                    </div>
                                                ) : (
                                                    data.realTime.activeUsers.map((u, i) => (
                                                        <div key={i} style={{
                                                            display: 'flex', alignItems: 'center', gap: '10px',
                                                            padding: '7px 14px',
                                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                        }}>
                                                            <div style={{
                                                                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                                                                background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dark, #b8922e))',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.68rem', fontWeight: 700, color: 'var(--bg-primary, #0f1115)',
                                                            }}>
                                                                {u.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                                                {u.name}
                                                            </span>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
                                                        </div>
                                                    ))
                                                )}

                                                {/* "+N more" row when > 20 users are live */}
                                                {data.realTime.hasMoreUsers && (
                                                    <div style={{
                                                        padding: '8px 14px',
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        background: 'rgba(34,197,94,0.04)',
                                                        borderTop: '1px solid rgba(34,197,94,0.1)',
                                                    }}>
                                                        <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>
                                                            +{data.realTime.loggedInNow - data.realTime.activeUsers.length} more logged in
                                                        </span>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>showing first 20</span>
                                                    </div>
                                                )}

                                                {/* Guests row */}
                                                {data.realTime.onlineNow > data.realTime.loggedInNow && (
                                                    <div style={{
                                                        padding: '7px 14px',
                                                        borderTop: '1px solid rgba(255,255,255,0.05)',
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                    }}>
                                                        <div style={{
                                                            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                                                            background: 'rgba(96,165,250,0.12)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.7rem',
                                                        }}>👤</div>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                            +{data.realTime.onlineNow - data.realTime.loggedInNow} anonymous visitor{data.realTime.onlineNow - data.realTime.loggedInNow !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab bar */}
                <div className="aa-tabs" style={{
                    display: 'flex', gap: '4px', marginBottom: 'var(--space-xl)',
                    background: 'var(--bg-secondary)', padding: '4px',
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                }}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} style={{
                            flex: 1, padding: '0.6rem', border: 'none',
                            borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 600,
                            background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                        }}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                        Initializing command center...
                    </div>
                ) : !data ? (
                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
                        <div style={{ fontWeight: 700, marginBottom: '6px' }}>Failed to load analytics</div>
                        <div style={{ fontSize: '0.8rem', marginBottom: '16px' }}>{fetchError || 'Could not fetch data from the server.'}</div>
                        <button onClick={fetchData} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>Retry</button>
                    </div>
                ) : data && (
                    <>
                        {/* ═══════ OVERVIEW TAB ═══════ */}
                        {activeTab === 'overview' && (
                            <>
                                {/* ── Dashboard Command Strip ── */}
                                {data?.dashboard && (
                                    <>
                                        <div className="aa-cmd-strip" style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-sm)',
                                            marginBottom: 'var(--space-lg)',
                                        }}>
                                            {[
                                                { label: 'Projects', value: data.dashboard.projectCount, icon: '🎬', color: 'var(--accent-gold)', gradient: 'rgba(212,168,83,0.06)' },
                                                { label: 'Open Castings', value: data.dashboard.castingCount, icon: '🎭', color: '#f59e0b', gradient: 'rgba(245,158,11,0.05)' },
                                                { label: 'Applications', value: data.dashboard.applicationCount, icon: '📋', color: '#3b82f6', gradient: 'rgba(59,130,246,0.05)' },
                                                { label: 'Pending Review', value: data.dashboard.pendingCount, icon: '⌛', color: data.dashboard.pendingCount > 0 ? '#ef4444' : '#22c55e', gradient: data.dashboard.pendingCount > 0 ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.04)' },
                                                { label: 'Script Submissions', value: data.dashboard.scriptSubmissionCount, icon: '✍️', color: data.dashboard.pendingScriptReviews > 0 ? '#f59e0b' : '#a855f7', gradient: data.dashboard.pendingScriptReviews > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(168,85,247,0.05)', badge: data.dashboard.pendingScriptReviews > 0 ? data.dashboard.pendingScriptReviews : null },
                                            ].map((stat, idx) => (
                                                <div key={stat.label} className="cmd-card" style={{
                                                    background: `linear-gradient(135deg, ${stat.gradient}, var(--bg-secondary))`,
                                                    border: '1px solid var(--border-subtle)',
                                                    borderRadius: 'var(--radius-lg)',
                                                    padding: '18px 16px',
                                                    textAlign: 'center', position: 'relative', overflow: 'hidden',
                                                    animation: `cardCascade 0.5s ease ${idx * 80}ms both`,
                                                    transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                                                }}>
                                                    <div style={{
                                                        position: 'absolute', top: '-10px', right: '-10px',
                                                        width: '60px', height: '60px', borderRadius: '50%',
                                                        background: `radial-gradient(circle, ${stat.gradient}, transparent)`,
                                                        opacity: 0.8, pointerEvents: 'none',
                                                    }} />
                                                    {'badge' in stat && stat.badge != null && (
                                                        <div style={{
                                                            position: 'absolute', top: '8px', right: '8px',
                                                            background: 'rgba(245,158,11,0.15)',
                                                            border: '1px solid rgba(245,158,11,0.3)',
                                                            color: '#f59e0b', fontSize: '0.55rem', fontWeight: 800,
                                                            padding: '2px 6px', borderRadius: '99px',
                                                        }}>{stat.badge} new</div>
                                                    )}
                                                    <div style={{ fontSize: '1.3rem', marginBottom: '6px', position: 'relative', zIndex: 1 }}>{stat.icon}</div>
                                                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: stat.color, lineHeight: 1, position: 'relative', zIndex: 1 }}>
                                                        <AnimatedNumber value={stat.value} />
                                                    </div>
                                                    <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', fontWeight: 700, marginTop: '6px', position: 'relative', zIndex: 1 }}>{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="aa-quick-actions" style={{
                                            display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)',
                                            flexWrap: 'wrap',
                                        }}>
                                            <Link href="/admin/projects" style={{
                                                padding: '8px 16px', fontSize: '0.78rem', fontWeight: 700,
                                                borderRadius: 'var(--radius-md)', textDecoration: 'none',
                                                background: 'var(--accent-gold)', color: '#0a0a0a',
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                transition: 'all 0.2s',
                                            }}>+ New Project</Link>
                                            <Link href="/admin/applications" style={{
                                                padding: '8px 16px', fontSize: '0.78rem', fontWeight: 700,
                                                borderRadius: 'var(--radius-md)', textDecoration: 'none',
                                                background: data.dashboard.pendingCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${data.dashboard.pendingCount > 0 ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)'}`,
                                                color: data.dashboard.pendingCount > 0 ? '#ef4444' : 'var(--text-secondary)',
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                transition: 'all 0.2s',
                                            }}>📋 Review Applications {data.dashboard.pendingCount > 0 && <span style={{
                                                padding: '1px 7px', borderRadius: 'var(--radius-full)',
                                                background: 'rgba(239,68,68,0.15)', fontSize: '0.68rem',
                                                fontWeight: 800, color: '#ef4444',
                                            }}>{data.dashboard.pendingCount}</span>}</Link>
                                            <Link href="/admin/scripts" style={{
                                                padding: '8px 16px', fontSize: '0.78rem', fontWeight: 700,
                                                borderRadius: 'var(--radius-md)', textDecoration: 'none',
                                                background: data.dashboard.pendingScriptReviews > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${data.dashboard.pendingScriptReviews > 0 ? 'rgba(245,158,11,0.25)' : 'var(--border-subtle)'}`,
                                                color: data.dashboard.pendingScriptReviews > 0 ? '#f59e0b' : 'var(--text-secondary)',
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                transition: 'all 0.2s',
                                            }}>✍️ Review Scripts {data.dashboard.pendingScriptReviews > 0 && <span style={{
                                                padding: '1px 7px', borderRadius: 'var(--radius-full)',
                                                background: 'rgba(245,158,11,0.15)', fontSize: '0.68rem',
                                                fontWeight: 800, color: '#f59e0b',
                                            }}>{data.dashboard.pendingScriptReviews}</span>}</Link>
                                            <Link href="/admin/casting" style={{
                                                padding: '8px 16px', fontSize: '0.78rem', fontWeight: 700,
                                                borderRadius: 'var(--radius-md)', textDecoration: 'none',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid var(--border-subtle)',
                                                color: 'var(--text-secondary)',
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                transition: 'all 0.2s',
                                            }}>🎭 Manage Casting</Link>
                                        </div>

                                        {/* Recent Applications */}
                                        {data.dashboard.recentApplications.length > 0 && (
                                            <div style={{
                                                ...cardStyle,
                                                padding: 0, overflow: 'hidden',
                                                marginBottom: 'var(--space-lg)',
                                            }}>
                                                <div style={{
                                                    padding: '10px 16px',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                }}>
                                                    <div style={{
                                                        fontSize: '0.65rem', textTransform: 'uppercase',
                                                        letterSpacing: '0.1em', color: 'var(--accent-gold)',
                                                        fontWeight: 700,
                                                    }}>Recent Applications</div>
                                                    <Link href="/admin/applications" style={{
                                                        fontSize: '0.68rem', color: 'var(--text-tertiary)',
                                                        textDecoration: 'none', fontWeight: 600,
                                                    }}>View all →</Link>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    {data.dashboard.recentApplications.map((app: DashboardData['recentApplications'][0]) => {
                                                        const statusColors: Record<string, { bg: string; color: string }> = {
                                                            pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
                                                            approved: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
                                                            shortlisted: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
                                                            rejected: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
                                                        }
                                                        const sc = statusColors[app.status] || statusColors.pending
                                                        return (
                                                            <Link key={app.id} href={`/admin/applications/${app.id}`} className="aa-app-row" style={{
                                                                display: 'grid', gridTemplateColumns: '1fr 100px 60px 70px',
                                                                alignItems: 'center', gap: '10px',
                                                                padding: '10px 16px', textDecoration: 'none',
                                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                                transition: 'background 0.15s',
                                                            }}>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {app.fullName}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                                                                        {app.castingCall.roleName} · {app.castingCall.project.title}
                                                                    </div>
                                                                </div>
                                                                <div className="aa-app-score">
                                                                    {app.aiScore ? (
                                                                        <span style={{
                                                                            fontWeight: 700, fontSize: '0.88rem',
                                                                            color: app.aiScore >= 70 ? '#22c55e' : app.aiScore >= 40 ? '#f59e0b' : 'var(--text-tertiary)',
                                                                        }}>{app.aiScore}</span>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>—</span>
                                                                    )}
                                                                </div>
                                                                <span style={{
                                                                    fontSize: '0.62rem', fontWeight: 700,
                                                                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                                    background: sc.bg, color: sc.color,
                                                                    textTransform: 'capitalize', textAlign: 'center',
                                                                }}>{app.status}</span>
                                                                <div className="aa-app-date" style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem', textAlign: 'right' }}>
                                                                    {new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                </div>
                                                            </Link>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Recent Script Submissions */}
                                        {data.dashboard.recentScriptSubmissions.length > 0 && (
                                            <div style={{
                                                ...cardStyle,
                                                padding: 0, overflow: 'hidden',
                                                marginBottom: 'var(--space-xl)',
                                            }}>
                                                <div style={{
                                                    padding: '10px 16px',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            fontSize: '0.65rem', textTransform: 'uppercase',
                                                            letterSpacing: '0.1em', color: '#f59e0b',
                                                            fontWeight: 700,
                                                        }}>✍️ Recent Script Submissions</div>
                                                        {data.dashboard.pendingScriptReviews > 0 && (
                                                            <span style={{
                                                                padding: '1px 7px', borderRadius: 'var(--radius-full)',
                                                                background: 'rgba(245,158,11,0.12)',
                                                                border: '1px solid rgba(245,158,11,0.25)',
                                                                fontSize: '0.6rem', fontWeight: 800, color: '#f59e0b',
                                                            }}>{data.dashboard.pendingScriptReviews} unreviewed</span>
                                                        )}
                                                    </div>
                                                    <Link href="/admin/scripts" style={{
                                                        fontSize: '0.68rem', color: 'var(--text-tertiary)',
                                                        textDecoration: 'none', fontWeight: 600,
                                                    }}>View all →</Link>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    {data.dashboard.recentScriptSubmissions.map((sub) => {
                                                        const isNew = sub.status === 'submitted'
                                                        return (
                                                            <Link key={sub.id} href={`/admin/scripts`} style={{
                                                                display: 'grid', gridTemplateColumns: '1fr auto 70px',
                                                                alignItems: 'center', gap: '10px',
                                                                padding: '10px 16px', textDecoration: 'none',
                                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                                background: isNew ? 'rgba(245,158,11,0.025)' : 'transparent',
                                                                transition: 'background 0.15s',
                                                            }}>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {isNew && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0, display: 'inline-block' }} />}
                                                                        {sub.title}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                                                                        by {sub.authorName}{sub.scriptCallTitle ? ` · ${sub.scriptCallTitle}` : ''}
                                                                    </div>
                                                                </div>
                                                                <span style={{
                                                                    fontSize: '0.62rem', fontWeight: 700,
                                                                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                                    background: isNew ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.08)',
                                                                    color: isNew ? '#f59e0b' : '#6b7280',
                                                                    border: `1px solid ${isNew ? 'rgba(245,158,11,0.2)' : 'transparent'}`,
                                                                    textTransform: 'capitalize', whiteSpace: 'nowrap',
                                                                }}>{isNew ? '🔔 New' : sub.status}</span>
                                                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem', textAlign: 'right' }}>
                                                                    {new Date(sub.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                </div>
                                                            </Link>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ── Studio Pulse + Metrics ── */}
                                <div className="aa-pulse-row" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)', animation: 'cardCascade 0.6s ease 0.2s both' }}>
                                    {/* Vitality Score */}
                                    <div style={{
                                        ...glassCard,
                                        display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl) var(--space-lg)',
                                        background: 'linear-gradient(180deg, rgba(212,168,83,0.06), var(--bg-secondary))',
                                        position: 'relative', overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            position: 'absolute', bottom: '-30px', left: '50%', transform: 'translateX(-50%)',
                                            width: '120px', height: '60px', borderRadius: '50%',
                                            background: 'radial-gradient(ellipse, rgba(212,168,83,0.1), transparent)',
                                            pointerEvents: 'none',
                                        }} />
                                        <div style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-gold)', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                                            ⚡ Studio Pulse
                                        </div>
                                        <VitalityRing score={computeVitality(data)} />
                                    </div>

                                    {/* Stat Cards with Sparklines */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)' }}>
                                        <StatCard label="Page Views" value={data.traffic.monthViews} sublabel={<><TrendArrow current={data.realTime.todayViews} previous={data.realTime.yesterdayViews} /> <span style={{ color: 'var(--text-tertiary)', fontSize: '0.62rem' }}>{data.realTime.todayViews} today</span></>} sparkData={data.sparklines.views} color="var(--accent-gold)" delay={0} />
                                        <StatCard label="Users" value={data.engagement.totalUsers} sublabel={<span style={{ color: '#22c55e', fontSize: '0.65rem', fontWeight: 600 }}>+{data.engagement.newUsersMonth} this month</span>} sparkData={data.sparklines.users} color="#22c55e" delay={1} />
                                        <StatCard label="Applications" value={data.engagement.totalApps} sublabel={<span style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 600 }}>+{data.engagement.appsMonth} this month</span>} sparkData={data.sparklines.apps} color="#3b82f6" delay={2} />
                                        <StatCard label="Subscribers" value={data.engagement.subscribers} sublabel={<span style={{ color: 'var(--text-tertiary)', fontSize: '0.62rem' }}>verified members · {data.engagement.conversionRate}% cast. conv.</span>} sparkData={[]} color="#a855f7" delay={3} />
                                    </div>
                                </div>

                                {/* ── Engagement Metrics Strip ── */}
                                <div className="aa-engage-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)', animation: 'cardCascade 0.6s ease 0.35s both' }}>
                                    {[
                                        { label: 'This Week', value: data.traffic.weekViews, icon: '📅', color: 'var(--accent-gold)', glow: 'rgba(212,168,83,0.08)' },
                                        { label: 'Mailing List', value: data.engagement.mailingList, icon: '📧', color: '#a855f7', glow: 'rgba(168,85,247,0.06)', sublabel: 'newsletter signups' },
                                        { label: 'Casting Views', value: data.engagement.castingViews, icon: '🎭', color: '#f59e0b', glow: 'rgba(245,158,11,0.06)' },
                                        { label: 'Donations', value: data.engagement.totalDonations, icon: '💰', color: '#22c55e', glow: 'rgba(34,197,94,0.06)' },
                                        { label: 'Film Views', value: data.content.totalFilmViews, icon: '🎬', color: '#3b82f6', glow: 'rgba(59,130,246,0.06)' },
                                        { label: 'Trailers', value: data.engagement.trailerCount, icon: '🎞️', color: '#e879f9', glow: 'rgba(232,121,249,0.06)', sublabel: data.engagement.trailerViews > 0 ? `${data.engagement.trailerViews} views/mo` : 'No views yet' },
                                    ].map((stat, i) => (
                                        <div key={stat.label} className="cmd-card" style={{
                                            ...glassCard, padding: '14px 16px',
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            background: `linear-gradient(135deg, ${stat.glow}, var(--bg-secondary))`,
                                            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                                        }}>
                                            <div style={{
                                                width: '38px', height: '38px', borderRadius: '10px',
                                                background: stat.glow, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.1rem', border: `1px solid ${stat.glow}`,
                                                boxShadow: `0 0 12px ${stat.glow}`,
                                            }}>{stat.icon}</div>
                                            <div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>
                                                    <AnimatedNumber value={stat.value} />
                                                </div>
                                                <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginTop: '2px' }}>{stat.label}</div>
                                                {'sublabel' in stat && stat.sublabel && (
                                                    <div style={{ fontSize: '0.52rem', color: stat.color, opacity: 0.7, marginTop: '2px', fontWeight: 600 }}>{stat.sublabel}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Email Delivery Panel ── */}
                                {data.email && (
                                    <div style={{ ...glassCard, marginBottom: 'var(--space-xl)', animation: 'cardCascade 0.6s ease 0.42s both' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                                            <h4 style={{ ...sectionLabel, margin: 0 }}>✉️ Email Delivery</h4>
                                            <span style={{
                                                fontSize: '0.62rem', fontWeight: 800,
                                                padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                                background: data.email.successRate >= 95 ? 'rgba(52,211,153,0.1)' : data.email.successRate >= 80 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                color: data.email.successRate >= 95 ? '#34d399' : data.email.successRate >= 80 ? '#f59e0b' : '#ef4444',
                                                border: `1px solid ${data.email.successRate >= 95 ? 'rgba(52,211,153,0.2)' : data.email.successRate >= 80 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                            }}>
                                                {data.email.successRate}% delivery rate
                                            </span>
                                        </div>

                                        {/* Stats row */}
                                        <div className="aa-email-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                            {[
                                                { label: 'All Time', value: data.email.total, color: '#a855f7' },
                                                { label: 'Today', value: data.email.today, color: 'var(--accent-gold)' },
                                                { label: 'This Month', value: data.email.thisMonth, color: '#3b82f6' },
                                                { label: 'Failed (30d)', value: data.email.failedMonth, color: data.email.failedMonth > 0 ? '#ef4444' : '#34d399' },
                                            ].map(s => (
                                                <div key={s.label} style={{
                                                    background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border-subtle)', padding: '10px 12px', textAlign: 'center',
                                                }}>
                                                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>
                                                        <AnimatedNumber value={s.value} />
                                                    </div>
                                                    <div style={{ fontSize: '0.52rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginTop: '4px' }}>{s.label}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Type breakdown bars */}
                                        {data.email.byType.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '8px' }}>By Type (This Month)</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {(() => {
                                                        const typeColors: Record<string, string> = {
                                                            authentication: '#3b82f6',
                                                            application: '#f59e0b',
                                                            notification: '#22c55e',
                                                            subscribe: '#a855f7',
                                                            general: '#6b7280',
                                                        }
                                                        const typeIcons: Record<string, string> = {
                                                            authentication: '🔐', application: '🎭',
                                                            notification: '🔔', subscribe: '📮', general: '📧',
                                                        }
                                                        const maxCount = Math.max(...data.email!.byType.map(t => t.count), 1)
                                                        return data.email!.byType.map(t => (
                                                            <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '0.75rem', width: '16px', textAlign: 'center' }}>{typeIcons[t.type] || '📧'}</span>
                                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, width: '90px', textTransform: 'capitalize' }}>{t.type}</div>
                                                                <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        height: '100%', borderRadius: '3px',
                                                                        width: `${(t.count / maxCount) * 100}%`,
                                                                        background: typeColors[t.type] || '#6b7280',
                                                                        transition: 'width 0.8s ease',
                                                                    }} />
                                                                </div>
                                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: typeColors[t.type] || '#6b7280', minWidth: '28px', textAlign: 'right' }}>{t.count}</div>
                                                            </div>
                                                        ))
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                        {data.email.total === 0 && (
                                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem', padding: 'var(--space-md)' }}>
                                                📭 No emails logged yet — tracking begins with the next send
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Funnel & Activity ── */}
                                <div className="aa-funnel-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', animation: 'cardCascade 0.6s ease 0.5s both' }}>
                                    {/* Casting Funnel — enhanced */}
                                    <div style={{ ...glassCard, position: 'relative', overflow: 'hidden' }}>
                                        <h4 style={sectionLabel}>🎯 Casting Funnel</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'var(--space-md)' }}>
                                            <FunnelStep label="Casting Page Views" value={data.engagement.castingViews} max={data.engagement.castingViews} color="var(--accent-gold)" step={1} />
                                            <FunnelStep label="Applications Submitted" value={data.engagement.appsMonth} max={data.engagement.castingViews} color="#3b82f6" step={2} />
                                            <FunnelStep label="Reviewed" value={data.dashboard?.reviewedCount || 0} max={data.engagement.castingViews} color="#22c55e" step={3} />
                                        </div>
                                        <div style={{
                                            marginTop: 'var(--space-md)', padding: '8px 12px',
                                            background: 'rgba(212,168,83,0.04)', borderRadius: 'var(--radius-md)',
                                            border: '1px solid rgba(212,168,83,0.08)',
                                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                                        }}>
                                            <span style={{ fontSize: '1rem' }}>📊</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                                {data.engagement.conversionRate}%
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>conversion rate</span>
                                        </div>
                                    </div>

                                    {/* Live Activity Feed — enhanced */}
                                    <div style={{ ...glassCard, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)' }}>
                                            <h4 style={{ ...sectionLabel, margin: 0 }}>⚡ Live Activity</h4>
                                            <span style={{
                                                width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e',
                                                animation: 'livePulse 2s ease-in-out infinite',
                                                boxShadow: '0 0 8px rgba(34,197,94,0.5)',
                                            }} />
                                            <span style={{ fontSize: '0.6rem', color: '#22c55e', fontWeight: 600, marginLeft: '-4px' }}>LIVE</span>
                                        </div>
                                        <div style={{ flex: 1, maxHeight: '240px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {data.recentActivity.length === 0 ? (
                                                <div style={{
                                                    flex: 1, display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    color: 'var(--text-tertiary)', fontSize: '0.8rem',
                                                    padding: 'var(--space-xl)',
                                                }}>
                                                    <span style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.2 }}>🔍</span>
                                                    No recent activity
                                                </div>
                                            ) : data.recentActivity.slice(0, 10).map((item, i) => (
                                                <div key={item.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px',
                                                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                                                    background: i === 0 ? 'rgba(34,197,94,0.04)' : 'transparent',
                                                    border: i === 0 ? '1px solid rgba(34,197,94,0.08)' : '1px solid transparent',
                                                    animation: i === 0 ? 'slideInLeft 0.4s ease' : 'none',
                                                    transition: 'background 0.2s',
                                                }}>
                                                    <div style={{
                                                        width: '26px', height: '26px', borderRadius: '50%',
                                                        background: `hsl(${(item.path.length * 47) % 360}, 50%, 20%)`,
                                                        border: `2px solid hsl(${(item.path.length * 47) % 360}, 60%, 40%)`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.6rem', fontWeight: 700, color: 'white', flexShrink: 0,
                                                    }}>
                                                        {item.device === 'mobile' ? '📱' : '💻'}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {item.path}
                                                        </div>
                                                        {item.referrer && (
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                                                                via {item.referrer}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                                        {getRelativeTime(item.createdAt)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ═══════ TRAFFIC TAB ═══════ */}
                        {activeTab === 'traffic' && (
                            <>
                                {/* Traffic Summary Strip */}
                                <div className="aa-traffic-strip" style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px',
                                    background: 'var(--border-subtle)', borderRadius: 'var(--radius-lg)',
                                    overflow: 'hidden', marginBottom: 'var(--space-lg)',
                                }}>
                                    {[
                                        { label: 'Today', value: data.realTime.todayViews, color: 'var(--accent-gold)' },
                                        { label: 'Yesterday', value: data.realTime.yesterdayViews, color: 'var(--text-secondary)' },
                                        { label: 'This Week', value: data.traffic.weekViews, color: '#3b82f6' },
                                        { label: 'This Month', value: data.traffic.monthViews, color: '#22c55e' },
                                        { label: 'Avg/Day', value: data.traffic.dailyViews.length > 0 ? Math.round(data.traffic.dailyViews.reduce((s, d) => s + d.views, 0) / data.traffic.dailyViews.length) : 0, color: '#a855f7' },
                                    ].map(stat => (
                                        <div key={stat.label} style={{
                                            background: 'var(--bg-secondary)', padding: '10px 12px',
                                            textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value.toLocaleString()}</div>
                                            <div style={{ fontSize: '0.52rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', fontWeight: 600, marginTop: '3px' }}>{stat.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Mosaic: Chart + Heatmap */}
                                <div className="aa-chart-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '6px' }}>7-Day Trend</div>
                                        <AreaChart
                                            data={data.traffic.dailyViews.map(d => d.views)}
                                            labels={data.traffic.dailyViews.map(d => new Date(d.date).toLocaleDateString('en', { weekday: 'short' }))}
                                            height={160}
                                        />
                                    </div>
                                    <div style={{ ...cardStyle, padding: 'var(--space-md)' }}>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '8px' }}>24h Heatmap</div>
                                        <HourlyHeatmap data={data.traffic.hourlyViews} />
                                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>Peak: {data.traffic.hourlyViews.indexOf(Math.max(...data.traffic.hourlyViews))}:00</span>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--accent-gold)', fontWeight: 700 }}>{Math.max(...data.traffic.hourlyViews)} max</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom row: Top Pages + Devices + Sources */}
                                <div className="aa-bottom-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 'var(--space-md)' }}>
                                    {/* Top Pages — compact */}
                                    <div style={{ ...cardStyle, padding: 'var(--space-md)' }}>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '8px' }}>Top Pages</div>
                                        {data.traffic.topPages.length === 0 ? (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-lg)' }}>No data yet</div>
                                        ) : data.traffic.topPages.slice(0, 6).map((page, i) => {
                                            const maxViews = data.traffic.topPages[0]?.views || 1
                                            return (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '5px 0',
                                                    borderBottom: i < Math.min(data.traffic.topPages.length, 6) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                                }}>
                                                    <span style={{
                                                        fontSize: '0.55rem', fontWeight: 900,
                                                        width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: i < 3 ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.03)',
                                                        color: i < 3 ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                    }}>{i + 1}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{page.path}</div>
                                                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: '1px', marginTop: '2px' }}>
                                                            <div style={{
                                                                height: '100%', borderRadius: '1px',
                                                                width: `${(page.views / maxViews) * 100}%`,
                                                                background: `linear-gradient(90deg, var(--accent-gold), rgba(212,168,83,${0.3 + (1 - i / 6) * 0.7}))`,
                                                                transition: 'width 0.6s ease',
                                                            }} />
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '26px', textAlign: 'right' }}>{page.views}</span>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Device Donut — compact */}
                                    <div style={{ ...cardStyle, padding: 'var(--space-md)', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '8px' }}>Devices</div>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <DonutChart segments={data.traffic.devices.map(d => ({
                                                label: d.device || 'unknown',
                                                value: d.count,
                                                color: deviceColors[d.device || 'unknown'] || '#6b7280',
                                            }))} />
                                        </div>
                                    </div>

                                    {/* Referrer Sources as compact list */}
                                    <div style={{ ...cardStyle, padding: 'var(--space-md)' }}>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '8px' }}>Traffic Sources</div>
                                        {data.traffic.referrerSources.length === 0 ? (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-lg)' }}>
                                                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px', opacity: 0.15 }}>🌐</span>
                                                No referrer data
                                            </div>
                                        ) : data.traffic.referrerSources.slice(0, 6).map((ref, i) => {
                                            const maxRef = data.traffic.referrerSources[0]?.count || 1
                                            return (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '5px 0',
                                                    borderBottom: i < Math.min(data.traffic.referrerSources.length, 6) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                                }}>
                                                    <div style={{
                                                        width: '4px', height: '20px', borderRadius: '2px',
                                                        background: `rgba(212,168,83,${0.2 + (1 - i / 6) * 0.6})`,
                                                        flexShrink: 0,
                                                    }} />
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.source}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <div style={{
                                                            width: '40px', height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px',
                                                        }}>
                                                            <div style={{
                                                                height: '100%', borderRadius: '2px',
                                                                width: `${(ref.count / maxRef) * 100}%`,
                                                                background: 'var(--accent-gold)',
                                                            }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-gold)', minWidth: '18px', textAlign: 'right' }}>{ref.count}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ═══════ CONTENT TAB ═══════ */}
                        {activeTab === 'content' && (
                            <>
                                {/* ── Section A: Time-Based View Stats ── */}
                                <div style={{
                                    fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.12em',
                                    color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: '8px',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                }}>🎬 Film View Analytics</div>
                                <div className="aa-content-strip" style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px',
                                    background: 'var(--border-subtle)', borderRadius: 'var(--radius-lg)',
                                    overflow: 'hidden', marginBottom: 'var(--space-lg)',
                                }}>
                                    {[
                                        { label: 'Today', value: data.content.viewsByPeriod?.today ?? 0, color: '#22c55e', icon: '📅' },
                                        { label: 'This Week', value: data.content.viewsByPeriod?.week ?? 0, color: '#3b82f6', icon: '📊' },
                                        { label: 'This Month', value: data.content.viewsByPeriod?.month ?? 0, color: '#a855f7', icon: '📈' },
                                        { label: 'All Time', value: data.content.viewsByPeriod?.allTime ?? data.content.totalFilmViews, color: 'var(--accent-gold)', icon: '🏆' },
                                    ].map((stat) => (
                                        <div key={stat.label} style={{
                                            background: 'var(--bg-secondary)', padding: '16px',
                                            textAlign: 'center', position: 'relative', overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                position: 'absolute', top: '-8px', right: '-8px',
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: `radial-gradient(circle, ${stat.color}08, transparent)`,
                                                pointerEvents: 'none',
                                            }} />
                                            <div style={{ fontSize: '0.7rem', marginBottom: '4px' }}>{stat.icon}</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>
                                                <AnimatedNumber value={stat.value} />
                                            </div>
                                            <div style={{
                                                fontSize: '0.52rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                                                color: 'var(--text-tertiary)', fontWeight: 600, marginTop: '5px',
                                            }}>{stat.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Section B: Trailer Performance (Prominent Gold Card) ── */}
                                {data.content.trailerStats && (
                                    <div style={{
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.06) 0%, rgba(212,168,83,0.02) 50%, rgba(139,92,246,0.03) 100%)',
                                        border: '1px solid rgba(212,168,83,0.2)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: '20px',
                                        marginBottom: 'var(--space-lg)',
                                        position: 'relative', overflow: 'hidden',
                                    }}>
                                        {/* Gold accent line */}
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                            background: 'linear-gradient(90deg, transparent, var(--accent-gold), rgba(139,92,246,0.5), var(--accent-gold), transparent)',
                                        }} />
                                        {/* Decorative orb */}
                                        <div style={{
                                            position: 'absolute', top: '-30px', right: '-20px',
                                            width: '120px', height: '120px', borderRadius: '50%',
                                            background: 'radial-gradient(circle, rgba(212,168,83,0.08), transparent 70%)',
                                            pointerEvents: 'none',
                                        }} />

                                        {/* Header */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px',
                                            position: 'relative', zIndex: 1,
                                        }}>
                                            <div style={{
                                                width: '38px', height: '38px', borderRadius: '10px',
                                                background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(212,168,83,0.08))',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.1rem', flexShrink: 0,
                                                border: '1px solid rgba(212,168,83,0.15)',
                                            }}>🎥</div>
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                                    Trailer Performance
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                                    {data.content.trailerStats.totalTrailers} trailer{data.content.trailerStats.totalTrailers !== 1 ? 's' : ''} published
                                                </div>
                                            </div>
                                            <div style={{
                                                marginLeft: 'auto', textAlign: 'right', position: 'relative', zIndex: 1,
                                            }}>
                                                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-gold)', lineHeight: 1 }}>
                                                    <AnimatedNumber value={data.content.trailerStats.views.allTime} />
                                                </div>
                                                <div style={{ fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                                    total trailer views
                                                </div>
                                            </div>
                                        </div>

                                        {/* Period breakdown */}
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                                            marginBottom: data.content.trailerStats.topTrailers.length > 0 ? '16px' : '0',
                                            position: 'relative', zIndex: 1,
                                        }}>
                                            {[
                                                { label: 'Today', value: data.content.trailerStats.views.today, color: '#22c55e' },
                                                { label: 'This Week', value: data.content.trailerStats.views.week, color: '#3b82f6' },
                                                { label: 'This Month', value: data.content.trailerStats.views.month, color: '#a855f7' },
                                            ].map(p => (
                                                <div key={p.label} style={{
                                                    background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)',
                                                    padding: '10px', textAlign: 'center',
                                                    border: '1px solid rgba(255,255,255,0.04)',
                                                }}>
                                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: p.color, lineHeight: 1 }}>
                                                        {p.value}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                                                        color: 'var(--text-tertiary)', fontWeight: 600, marginTop: '3px',
                                                    }}>{p.label}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Top trailers mini-leaderboard */}
                                        {data.content.trailerStats.topTrailers.length > 0 && (
                                            <div style={{ position: 'relative', zIndex: 1 }}>
                                                <div style={{
                                                    fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                                                    color: 'rgba(212,168,83,0.7)', fontWeight: 700, marginBottom: '6px',
                                                }}>Top Trailers</div>
                                                {data.content.trailerStats.topTrailers.map((t, i) => (
                                                    <div key={i} style={{
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                                                        background: i === 0 ? 'rgba(212,168,83,0.05)' : 'transparent',
                                                    }}>
                                                        <span style={{
                                                            fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-gold)',
                                                            minWidth: '16px',
                                                        }}>{i + 1}.</span>
                                                        <span style={{
                                                            fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)',
                                                            flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                        }}>{t.title}</span>
                                                        <span style={{
                                                            fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-gold)',
                                                        }}>{t.views}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Section C: Film Leaderboard (Enhanced) ── */}
                                <div style={{
                                    fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                                    color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '8px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <span>🎬 Film Leaderboard</span>
                                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.55rem' }}>
                                        {data.content.topFilms.length} film{data.content.topFilms.length !== 1 ? 's' : ''} tracked
                                    </span>
                                </div>
                                {data.content.topFilms.length === 0 ? (
                                    <div style={{
                                        ...cardStyle, padding: 'var(--space-3xl)', textAlign: 'center',
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.02), rgba(59,130,246,0.02))',
                                    }}>
                                        <div style={{
                                            width: '64px', height: '64px', margin: '0 auto var(--space-md)',
                                            borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
                                        }}>🎬</div>
                                        <h3 style={{ fontWeight: 800, marginBottom: '4px', fontSize: '0.95rem' }}>Awaiting First Views</h3>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', maxWidth: '300px', margin: '0 auto', lineHeight: 1.5 }}>
                                            Film performance data will populate here once viewers start watching your content.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {data.content.topFilms.map((film, i) => {
                                            const maxViews = data.content.topFilms[0]?.views || 1
                                            const pct = Math.round((film.views / maxViews) * 100)
                                            const medals = ['🥇', '🥈', '🥉']
                                            const hasTrailer = !!film.project.trailerUrl
                                            return (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px',
                                                    padding: '8px 12px',
                                                    background: 'var(--bg-secondary)',
                                                    border: `1px solid ${i === 0 ? 'rgba(212,168,83,0.15)' : 'var(--border-subtle)'}`,
                                                    borderRadius: 'var(--radius-md)',
                                                    position: 'relative', overflow: 'hidden',
                                                }}>
                                                    {/* Background fill bar */}
                                                    <div style={{
                                                        position: 'absolute', left: 0, top: 0, bottom: 0,
                                                        width: `${pct}%`,
                                                        background: i === 0 ? 'rgba(212,168,83,0.04)' : 'rgba(255,255,255,0.01)',
                                                        transition: 'width 0.8s ease',
                                                    }} />
                                                    {/* Rank */}
                                                    <span style={{
                                                        fontSize: i < 3 ? '1rem' : '0.75rem',
                                                        fontWeight: 900, minWidth: '24px', textAlign: 'center',
                                                        color: i < 3 ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                        position: 'relative', zIndex: 1,
                                                    }}>{i < 3 ? medals[i] : `#${i + 1}`}</span>
                                                    {/* Poster thumbnail */}
                                                    {film.project.coverImage && (
                                                        <div style={{
                                                            width: '48px', height: '28px', borderRadius: '3px', overflow: 'hidden',
                                                            background: '#0a0a0a', flexShrink: 0, position: 'relative', zIndex: 1,
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                                        }}>
                                                            <img src={film.project.coverImage} alt={film.project.title || 'Film cover'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        </div>
                                                    )}
                                                    {/* Title + bar + trailer badge */}
                                                    <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{film.project.title}</span>
                                                            {hasTrailer && (
                                                                <span style={{
                                                                    fontSize: '0.48rem', fontWeight: 700, padding: '1px 5px',
                                                                    borderRadius: 'var(--radius-full)', flexShrink: 0,
                                                                    background: 'rgba(212,168,83,0.12)', color: 'var(--accent-gold)',
                                                                    border: '1px solid rgba(212,168,83,0.2)',
                                                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                                                }}>🎥 Trailer</span>
                                                            )}
                                                        </div>
                                                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: '1px', marginTop: '3px' }}>
                                                            <div style={{
                                                                height: '100%', borderRadius: '1px',
                                                                width: `${pct}%`,
                                                                background: i === 0 ? 'var(--accent-gold)' : 'rgba(59,130,246,0.5)',
                                                                transition: 'width 0.8s ease',
                                                            }} />
                                                        </div>
                                                    </div>
                                                    {/* Views + weekly trend */}
                                                    <div style={{ position: 'relative', zIndex: 1, textAlign: 'right' }}>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: i === 0 ? 'var(--accent-gold)' : 'var(--text-primary)' }}>{film.views}</span>
                                                        <div style={{ fontSize: '0.5rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>views</div>
                                                        {film.weekViews > 0 && (
                                                            <div style={{
                                                                fontSize: '0.5rem', fontWeight: 700, color: '#22c55e',
                                                                marginTop: '2px',
                                                            }}>+{film.weekViews} this week</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ═══════ AI INSIGHTS TAB ═══════ */}
                        {activeTab === 'ai' && (
                            <>
                                {/* Agent Header compact with glow */}
                                <div className="aa-header-row" style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                                    flexWrap: 'wrap',
                                    padding: '12px 16px',
                                    background: 'linear-gradient(135deg, rgba(212,168,83,0.05), rgba(139,92,246,0.05))',
                                    border: `1px solid ${isSpeaking ? 'rgba(212,168,83,0.35)' : 'rgba(212,168,83,0.12)'}`,
                                    borderRadius: 'var(--radius-lg)',
                                    marginBottom: 'var(--space-lg)',
                                    position: 'relative',
                                    boxShadow: isSpeaking ? '0 0 24px rgba(212,168,83,0.12)' : '0 0 20px rgba(212,168,83,0.03)',
                                    transition: 'all 0.3s',
                                }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '10px',
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(139,92,246,0.15))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.1rem', flexShrink: 0,
                                        animation: isSpeaking ? 'livePulse 1.2s ease-in-out infinite' : 'none',
                                    }}>🤖</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            AI Analytics Agent
                                            <span style={{
                                                fontSize: '0.5rem', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                                background: 'rgba(139,92,246,0.1)', color: '#a855f7',
                                                fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                                            }}>{keyUsed || 'Multi-Provider'}</span>
                                            {isSpeaking && <span style={{ fontSize: '0.55rem', color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '0.08em' }}>🔊 SPEAKING…</span>}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>Analyzes traffic, engagement, and content performance · Ask follow-up questions below</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {insights.length > 0 && (
                                            <button
                                                onClick={readAllInsights}
                                                title={isSpeaking ? 'Stop reading' : 'Read insights aloud'}
                                                style={{
                                                    padding: '7px 14px', fontSize: '0.78rem', fontWeight: 700,
                                                    borderRadius: 'var(--radius-md)', border: `1px solid ${isSpeaking ? 'rgba(212,168,83,0.4)' : 'var(--border-subtle)'}`,
                                                    background: isSpeaking ? 'rgba(212,168,83,0.1)' : 'transparent',
                                                    color: isSpeaking ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                    cursor: 'pointer', transition: 'all 0.2s',
                                                }}
                                            >
                                                {isSpeaking ? '⏹ Stop' : '🔊 Read All'}
                                            </button>
                                        )}
                                        {/* VOICE CONVERSATION button */}
                                        <button
                                            onClick={() => setVoiceModeOpen(true)}
                                            style={{
                                                padding: '7px 14px', fontSize: '0.78rem', fontWeight: 700,
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid rgba(212,168,83,0.3)',
                                                background: 'linear-gradient(135deg, rgba(212,168,83,0.1), rgba(139,92,246,0.08))',
                                                color: 'var(--accent-gold)',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                            }}
                                        >
                                            🎙️✨ Voice
                                        </button>
                                        <button
                                            onClick={generateInsights}
                                            disabled={insightsLoading}
                                            className="btn btn-primary"
                                            style={{ fontSize: '0.8rem', fontWeight: 700, padding: '8px 18px' }}
                                        >
                                            {insightsLoading ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span className="loading-spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                                                    Analyzing…
                                                </span>
                                            ) : '⚡ Generate'}
                                        </button>
                                    </div>
                                </div>

                                {insightsError && (
                                    <div style={{
                                        padding: '10px 14px',
                                        background: 'rgba(239,68,68,0.06)',
                                        border: '1px solid rgba(239,68,68,0.15)',
                                        borderRadius: 'var(--radius-md)',
                                        color: '#ef4444', fontSize: '0.8rem',
                                        marginBottom: 'var(--space-md)',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                    }}>
                                        <span>🚨</span> {insightsError}
                                    </div>
                                )}

                                {insights.length === 0 && !insightsLoading && !insightsError ? (
                                    <div className="aa-bottom-row" style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)',
                                    }}>
                                        {[
                                            { icon: '📊', title: 'Traffic Patterns', desc: 'Peak hours, daily trends, visitor growth', color: '#3b82f6' },
                                            { icon: '💡', title: 'Smart Recommendations', desc: 'Content strategy, SEO, and engagement tips', color: '#10b981' },
                                            { icon: '⚠️', title: 'Performance Alerts', desc: 'Anomalies, drops, and opportunities', color: '#f59e0b' },
                                        ].map(card => (
                                            <div key={card.title} style={{
                                                ...cardStyle, padding: 'var(--space-lg)', textAlign: 'center',
                                                background: `linear-gradient(135deg, ${card.color}06, ${card.color}02)`,
                                                border: `1px solid ${card.color}15`,
                                            }}>
                                                <div style={{
                                                    width: '40px', height: '40px', margin: '0 auto 10px',
                                                    borderRadius: '10px', background: `${card.color}10`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1.2rem',
                                                }}>{card.icon}</div>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '3px' }}>{card.title}</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{card.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: insights.length > 2 ? '1fr 1fr' : '1fr', gap: 'var(--space-md)' }}>
                                        {insights.map((insight, i) => {
                                            const config = insightColors[insight.type] || insightColors.recommendation
                                            const isVisible = i < insightsRevealed
                                            const isThisSpeaking = speakingIdx === null && isSpeaking ? false : speakingIdx === null ? false : i === speakingIdx
                                            return (
                                                <div key={i} style={{
                                                    padding: '14px 16px',
                                                    background: config.bg,
                                                    borderRadius: 'var(--radius-lg)',
                                                    borderTop: `1px solid ${isThisSpeaking ? config.color : config.border}`,
                                                    borderRight: `1px solid ${isThisSpeaking ? config.color : config.border}`,
                                                    borderBottom: `1px solid ${isThisSpeaking ? config.color : config.border}`,
                                                    borderLeft: `3px solid ${config.color}`,
                                                    opacity: isVisible ? 1 : 0,
                                                    transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
                                                    transition: 'all 0.4s ease',
                                                    gridColumn: i === 0 && insights.length > 2 ? '1 / -1' : undefined,
                                                    boxShadow: isThisSpeaking ? `0 0 12px ${config.color}20` : 'none',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                                                        <span style={{ fontSize: '0.85rem' }}>{config.icon}</span>
                                                        <span style={{
                                                            fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase',
                                                            letterSpacing: '0.1em', color: config.color,
                                                            padding: '1px 5px', borderRadius: 'var(--radius-full)',
                                                            background: `${config.color}12`,
                                                        }}>{insight.type}</span>
                                                        <div style={{ flex: 1 }} />
                                                        {/* Per-card speak button */}
                                                        <button
                                                            onClick={() => {
                                                                if (isThisSpeaking) { stopSpeaking(); return }
                                                                speakText(`${insight.title}. ${insight.description}`, i)
                                                            }}
                                                            title="Read aloud"
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                color: isThisSpeaking ? config.color : 'var(--text-tertiary)',
                                                                fontSize: '0.85rem', padding: '2px 4px', lineHeight: 1,
                                                                transition: 'color 0.2s',
                                                            }}
                                                        >{isThisSpeaking ? '⏹' : '🔊'}</button>
                                                    </div>
                                                    <h4 style={{ fontSize: '0.88rem', fontWeight: 800, marginBottom: '3px', letterSpacing: '-0.01em' }}>{insight.title}</h4>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{insight.description}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Conversational Follow-up */}
                                {insights.length > 0 && (
                                    <div style={{
                                        marginTop: 'var(--space-xl)',
                                        background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(212,168,83,0.02))',
                                        border: '1px solid rgba(139,92,246,0.12)',
                                        borderRadius: 'var(--radius-lg)',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            padding: '10px 14px', borderBottom: '1px solid rgba(139,92,246,0.08)',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                        }}>
                                            <span style={{ fontSize: '0.9rem' }}>💬</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7' }}>Ask the Agent</span>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>— follow-up questions about your data</span>
                                        </div>

                                        {/* Chat history */}
                                        {chatHistory.length > 0 && (
                                            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                                                {chatHistory.map((msg, i) => (
                                                    <div key={i} style={{
                                                        display: 'flex', gap: '8px',
                                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                                    }}>
                                                        <div style={{
                                                            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            background: msg.role === 'user' ? 'rgba(212,168,83,0.15)' : 'rgba(139,92,246,0.15)',
                                                        }}>{msg.role === 'user' ? '👤' : '🤖'}</div>
                                                        <div style={{
                                                            maxWidth: '80%', padding: '8px 12px',
                                                            borderRadius: 'var(--radius-md)',
                                                            background: msg.role === 'user' ? 'rgba(212,168,83,0.08)' : 'rgba(139,92,246,0.06)',
                                                            border: `1px solid ${msg.role === 'user' ? 'rgba(212,168,83,0.15)' : 'rgba(139,92,246,0.1)'}`,
                                                            fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                                                        }}>
                                                            {msg.text}
                                                            {msg.role === 'ai' && (
                                                                <button onClick={() => speakText(msg.text)} title="Read aloud"
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.7rem', marginLeft: '6px', padding: 0 }}
                                                                >🔊</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {chatLoading && (
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>🤖</div>
                                                        <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 'var(--radius-md)' }}>
                                                            {[0, 150, 300].map(d => <span key={d} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#a855f7', opacity: 0.5, animation: `livePulse 1s ease-in-out ${d}ms infinite` }} />)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Input row */}
                                        <div style={{ padding: '10px 14px', display: 'flex', gap: '8px' }}>
                                            <input
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && askFollowUp()}
                                                placeholder='e.g. "Why is mobile traffic so high?" or "What should I post next?"'
                                                style={{
                                                    flex: 1, padding: '8px 12px',
                                                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                                    fontSize: '0.8rem', outline: 'none',
                                                }}
                                            />
                                            <button
                                                onClick={askFollowUp}
                                                disabled={chatLoading || !chatInput.trim()}
                                                style={{
                                                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                                                    background: chatInput.trim() ? 'var(--accent-gold)' : 'rgba(212,168,83,0.15)',
                                                    color: chatInput.trim() ? '#0a0a0a' : 'var(--text-tertiary)',
                                                    border: 'none', cursor: chatInput.trim() ? 'pointer' : 'default',
                                                    fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s',
                                                }}
                                            >
                                                {chatLoading ? '⏳' : '➡️'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ═══════ SYSTEM DATA CENTER TAB ═══════ */}
                        {activeTab === 'system' && (
                            <>
                                {systemLoading && !systemHealth ? (
                                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                        <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                                        Initializing system diagnostics…
                                    </div>
                                ) : systemHealth ? (
                                    <>
                                        {/* ── System Status Banner ── */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '16px',
                                            padding: '16px 20px', marginBottom: 'var(--space-lg)',
                                            background: systemHealth.status === 'operational'
                                                ? 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))'
                                                : 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))',
                                            border: `1px solid ${systemHealth.status === 'operational' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                            borderRadius: 'var(--radius-lg)',
                                            position: 'relative', overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                                background: systemHealth.status === 'operational'
                                                    ? 'linear-gradient(90deg, transparent, #22c55e, transparent)'
                                                    : 'linear-gradient(90deg, transparent, #ef4444, transparent)',
                                            }} />
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '12px',
                                                background: systemHealth.status === 'operational' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
                                                boxShadow: `0 0 20px ${systemHealth.status === 'operational' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                                            }}>{systemHealth.status === 'operational' ? '✅' : '⚠️'}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 900, color: systemHealth.status === 'operational' ? '#22c55e' : '#ef4444' }}>
                                                    {systemHealth.status === 'operational' ? 'All Systems Operational' : 'System Degraded'}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                                    Last checked: {new Date(systemHealth.timestamp).toLocaleTimeString()} · Response: {systemHealth.responseTime}ms
                                                </div>
                                            </div>
                                            <button onClick={fetchSystemHealth} disabled={systemLoading} style={{
                                                padding: '6px 14px', fontSize: '0.72rem', fontWeight: 700,
                                                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                                                background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                            }}>{systemLoading ? '⏳' : '🔄'} Refresh</button>
                                        </div>

                                        {/* ── Infrastructure Cards ── */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                                            {[
                                                { label: 'Platform', value: systemHealth.runtime.platform, sub: systemHealth.runtime.region, icon: '☁️', color: '#3b82f6' },
                                                { label: 'Uptime', value: formatUptime(systemHealth.runtime.uptime), sub: systemHealth.runtime.nodeVersion, icon: '⏱', color: '#22c55e' },
                                                { label: 'DB Latency', value: `${systemHealth.database.latency}ms`, sub: systemHealth.database.provider, icon: '🗄️', color: systemHealth.database.latency < 50 ? '#22c55e' : systemHealth.database.latency < 200 ? '#f59e0b' : '#ef4444' },
                                                { label: 'Total Records', value: systemHealth.database.totalRecords.toLocaleString(), sub: `${Object.keys(systemHealth.database.tables).length} tables`, icon: '📊', color: 'var(--accent-gold)' },
                                            ].map((card, idx) => (
                                                <div key={card.label} className="cmd-card" style={{
                                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                                    borderRadius: 'var(--radius-lg)', padding: '16px', textAlign: 'center',
                                                    animation: `cardCascade 0.5s ease ${idx * 80}ms both`,
                                                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                                                }}>
                                                    <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{card.icon}</div>
                                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: card.color, lineHeight: 1 }}>{card.value}</div>
                                                    <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', fontWeight: 700, marginTop: '6px' }}>{card.label}</div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{card.sub}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* ── Memory + Activity Row ── */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                                            {/* Memory Monitor */}
                                            <div style={{ ...glassCard, position: 'relative', overflow: 'hidden' }}>
                                                <h4 style={sectionLabel}>🧠 Memory Usage</h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: 'var(--space-md)' }}>
                                                    <VitalityRing score={systemHealth.runtime.memory.utilization} />
                                                    <div style={{ flex: 1 }}>
                                                        {[
                                                            { label: 'Heap Used', val: `${systemHealth.runtime.memory.heapUsed} MB`, max: systemHealth.runtime.memory.heapTotal, color: '#3b82f6' },
                                                            { label: 'RSS', val: `${systemHealth.runtime.memory.rss} MB`, max: systemHealth.runtime.memory.rss, color: '#22c55e' },
                                                            { label: 'External', val: `${systemHealth.runtime.memory.external} MB`, max: systemHealth.runtime.memory.heapTotal, color: '#f59e0b' },
                                                        ].map(m => (
                                                            <div key={m.label} style={{ marginBottom: '8px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: '3px' }}>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                                                                    <span style={{ fontWeight: 700, color: m.color }}>{m.val}</span>
                                                                </div>
                                                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }}>
                                                                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min((parseInt(m.val) / m.max) * 100, 100)}%`, background: m.color, transition: 'width 0.8s ease' }} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 24h Activity */}
                                            <div style={{ ...glassCard }}>
                                                <h4 style={sectionLabel}>⚡ 24h Activity Pulse</h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: 'var(--space-md)' }}>
                                                    {[
                                                        { label: 'Page Views (24h)', value: systemHealth.activity.views24h, color: 'var(--accent-gold)' },
                                                        { label: 'Views (1h)', value: systemHealth.activity.views1h, color: '#3b82f6' },
                                                        { label: 'New Users (24h)', value: systemHealth.activity.users24h, color: '#22c55e' },
                                                        { label: 'Applications (24h)', value: systemHealth.activity.apps24h, color: '#f59e0b' },
                                                    ].map(a => (
                                                        <div key={a.label} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                                                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: a.color, lineHeight: 1 }}><AnimatedNumber value={a.value} /></div>
                                                            <div style={{ fontSize: '0.52rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', fontWeight: 700, marginTop: '4px' }}>{a.label}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(212,168,83,0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(212,168,83,0.08)', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{systemHealth.activity.requestsPerMinute}</span>
                                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginLeft: '4px' }}>req/min avg</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Service Status Grid ── */}
                                        <div style={{ ...glassCard, marginBottom: 'var(--space-lg)', padding: 0, overflow: 'hidden' }}>
                                            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', fontWeight: 700 }}>🔌 Service Status</span>
                                                <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>— {systemHealth.services.filter(s => s.status === 'operational' || s.status === 'configured' || s.status === 'active').length}/{systemHealth.services.length} healthy</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                                                {systemHealth.services.map(svc => {
                                                    const isOk = ['operational', 'configured', 'active'].includes(svc.status)
                                                    return (
                                                        <div key={svc.name} style={{ padding: '14px 16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <span style={{
                                                                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                                                background: isOk ? '#22c55e' : svc.status === 'mock mode' ? '#f59e0b' : '#ef4444',
                                                                boxShadow: `0 0 8px ${isOk ? 'rgba(34,197,94,0.4)' : svc.status === 'mock mode' ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`,
                                                                animation: isOk ? 'livePulse 3s ease-in-out infinite' : 'none',
                                                            }} />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{svc.name}</div>
                                                                <div style={{ fontSize: '0.6rem', color: isOk ? '#22c55e' : svc.status === 'mock mode' ? '#f59e0b' : 'var(--text-tertiary)', fontWeight: 600, textTransform: 'capitalize' }}>{svc.status}{svc.latency !== null ? ` · ${svc.latency}ms` : ''}</div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* ── Database Table Inventory ── */}
                                        <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
                                            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', fontWeight: 700 }}>🗄️ Database Inventory</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                                                {Object.entries(systemHealth.database.tables).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
                                                    const maxCount = Math.max(...Object.values(systemHealth.database.tables))
                                                    return (
                                                        <div key={name} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }}>
                                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.max((count / maxCount) * 100, 3)}%`, background: 'rgba(212,168,83,0.04)', transition: 'height 0.8s ease' }} />
                                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent-gold)', lineHeight: 1, position: 'relative', zIndex: 1 }}>{count.toLocaleString()}</div>
                                                            <div style={{ fontSize: '0.55rem', textTransform: 'capitalize', color: 'var(--text-tertiary)', fontWeight: 600, marginTop: '3px', position: 'relative', zIndex: 1 }}>{name}</div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
                                        <div style={{ fontWeight: 700 }}>Failed to load system data</div>
                                        <button onClick={fetchSystemHealth} className="btn btn-primary" style={{ fontSize: '0.8rem', marginTop: '12px' }}>Retry</button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                <style>{`
                    @keyframes livePulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(1.3); }
                    }
                    @keyframes cardCascade {
                        from { opacity: 0; transform: translateY(16px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes slideInLeft {
                        from { opacity: 0; transform: translateX(-12px); }
                        to { opacity: 1; transform: translateX(0); }
                    }
                    @keyframes orbFloat {
                        0%, 100% { transform: translate(0, 0) scale(1); }
                        33% { transform: translate(-10px, 8px) scale(1.05); }
                        66% { transform: translate(5px, -5px) scale(0.95); }
                    }
                    @keyframes shimmer {
                        0% { background-position: -200% 0; }
                        100% { background-position: 200% 0; }
                    }
                    .cmd-card:hover {
                        transform: translateY(-2px) !important;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,168,83,0.1) !important;
                        border-color: rgba(212,168,83,0.15) !important;
                    }
                `}</style>
            </main>

            {/* \u2500\u2500 VOICE CONVERSATION OVERLAY \u2500\u2500 */}
            {voiceModeOpen && (
                <VoiceConversation
                    onClose={() => setVoiceModeOpen(false)}
                    insightContext={
                        insights.length > 0
                            ? insights.map(ins => `${ins.type.toUpperCase()}: ${ins.title}: ${ins.description}`).join('\n')
                            : 'No insights generated yet. The admin can ask general analytics questions about AIM Studio.'
                    }
                />
            )}
        </div>
    )
}

// Reusable Components

function AnimatedNumber({ value }: { value: number }) {
    const count = useAnimatedCounter(value)
    return <>{count.toLocaleString()}</>
}

function StatCard({ label, value, sublabel, sparkData, color, delay = 0 }: {
    label: string; value: number; sublabel: React.ReactNode; sparkData: number[]; color: string; delay?: number
}) {
    return (
        <div className="cmd-card" style={{
            ...glassCard,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-md) var(--space-lg)',
            animation: `cardCascade 0.5s ease ${0.2 + delay * 0.08}s both`,
            transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
        }}>
            <div>
                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1 }}>
                    <AnimatedNumber value={value} />
                </div>
                <div style={{ marginTop: '4px' }}>{sublabel}</div>
            </div>
            <Sparkline data={sparkData} color={color} width={70} height={28} />
        </div>
    )
}

function FunnelStep({ label, value, max, color, step }: { label: string; value: number; max: number; color: string; step: number }) {
    const pct = max > 0 ? (value / max) * 100 : 0
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: `${color}15`, border: `2px solid ${color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 900, color, flexShrink: 0,
            }}>{step}</div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontWeight: 800, color }}>
                        <AnimatedNumber value={value} />
                    </span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', width: `${Math.max(pct, 2)}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}99)`,
                        borderRadius: '3px',
                        transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                        boxShadow: `0 0 8px ${color}30`,
                    }} />
                </div>
            </div>
        </div>
    )
}

// Also keep the old FunnelBar for backward compat
function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0
    return (
        <div style={{ marginBottom: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 700, color }}>{value}</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${Math.max(pct, 2)}%`,
                    background: color, borderRadius: '4px',
                    transition: 'width 0.8s ease',
                }} />
            </div>
        </div>
    )
}

const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-lg)',
}

const glassCard: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-lg)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
}

const sectionLabel: React.CSSProperties = {
    marginBottom: 'var(--space-md)',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--accent-gold)',
    fontWeight: 700,
}
