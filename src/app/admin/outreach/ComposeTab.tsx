'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import AdminImageUpload from '@/components/AdminImageUpload'
import type { ReuseData } from './HistoryTab'
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false })

type OutreachType = 'announcement' | 'survey' | 'campaign'
const CTA_COLORS = [
    { label: 'Gold', value: '#c9a84c' },
    { label: 'Green', value: '#10b981' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Purple', value: '#8b5cf6' },
    { label: 'Red', value: '#ef4444' },
]

// Style constants replaced by CSS classes in outreach.css:
// .outreachInput  → inp
// .outreachLabel  → lbl
// .outreachCard   → card

interface ComposeTabProps {
    initialData?: ReuseData | null
}

export default function ComposeTab({ initialData }: ComposeTabProps) {
    const [outreachType, setOutreachType] = useState<OutreachType>('announcement')
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [bodyHtml, setBodyHtml] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [link, setLink] = useState('')
    const [ctaText, setCtaText] = useState('')
    const [ctaUrl, setCtaUrl] = useState('')
    const [ctaColor, setCtaColor] = useState('#c9a84c')
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<{ success?: boolean; scheduled?: boolean; scheduledAt?: string; error?: string } | null>(null)
    const [testEmail, setTestEmail] = useState('')
    const [sendingTest, setSendingTest] = useState(false)
    const [testResult, setTestResult] = useState<string | null>(null)

    // Scheduling
    const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
    const [scheduledAt, setScheduledAt] = useState('')  // datetime-local string (local time)

    // Audience
    const [notifyGroups, setNotifyGroups] = useState({ members: true, subscribers: false, cast: false })
    const [selectedUsers, setSelectedUsers] = useState<{ id: string; name: string | null; email: string }[]>([])
    const [userSearch, setUserSearch] = useState('')
    const [userResults, setUserResults] = useState<{ id: string; name: string | null; email: string }[]>([])
    const [searchingUsers, setSearchingUsers] = useState(false)

    // Translation
    const [translating, setTranslating] = useState(false)
    const [translations, setTranslations] = useState<Record<string, { title: string; message: string }>>({})
    const [hasTranslated, setHasTranslated] = useState(false)
    const [neededLocales, setNeededLocales] = useState<string[] | null>(null)
    const [recipientEstimate, setRecipientEstimate] = useState<{ members: number; subscribers: number; total: number } | null>(null)
    const [loadingLocales, setLoadingLocales] = useState(false)

    const someAudienceSelected = notifyGroups.members || notifyGroups.subscribers || notifyGroups.cast || selectedUsers.length > 0
    const ctaUrlValid = !ctaUrl.trim() || /^(\/|https:\/\/)/.test(ctaUrl.trim())
    const canSend = title.trim() && message.trim() && !sending && someAudienceSelected && ctaUrlValid

    // ── Draft autosave ──────────────────────────────────────────────────────────
    const DRAFT_KEY = 'outreach_compose_draft'
    const hasMounted = useRef(false)

    // Restore draft on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY)
            if (!raw) return
            const d = JSON.parse(raw)
            if (d.title) setTitle(d.title)
            if (d.message) setMessage(d.message)
            if (d.bodyHtml) setBodyHtml(d.bodyHtml)
            if (d.imageUrl) setImageUrl(d.imageUrl)
            if (d.link) setLink(d.link)
            if (d.outreachType) setOutreachType(d.outreachType)
            if (d.ctaText) setCtaText(d.ctaText)
            if (d.ctaUrl) setCtaUrl(d.ctaUrl)
            if (d.ctaColor) setCtaColor(d.ctaColor)
            if (d.testEmail) setTestEmail(d.testEmail)
        } catch { /* corrupted draft — ignore */ }
        hasMounted.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Load reuse data from history ──────────────────────────────────────────
    useEffect(() => {
        if (!initialData) return
        setTitle(initialData.title)
        setMessage(initialData.message)
        setOutreachType((initialData.type as OutreachType) || 'announcement')
        setBodyHtml(initialData.bodyHtml || '')
        setImageUrl(initialData.imageUrl || '')
        setLink(initialData.link || '')
        setCtaText(initialData.ctaText || '')
        setCtaUrl(initialData.ctaUrl || '')
        setCtaColor(initialData.ctaColor || '#c9a84c')
        if (initialData.translations) {
            setTranslations(initialData.translations as Record<string, { title: string; message: string }>)
            setHasTranslated(true)
        } else {
            setTranslations({})
            setHasTranslated(false)
        }
        setResult(null)
    }, [initialData])

    // Debounced save to localStorage on field changes
    useEffect(() => {
        if (!hasMounted.current) return
        const timer = setTimeout(() => {
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({
                    title, message, bodyHtml, imageUrl, link, outreachType,
                    ctaText, ctaUrl, ctaColor, testEmail,
                }))
            } catch { /* quota exceeded — ignore */ }
        }, 1000)
        return () => clearTimeout(timer)
    }, [title, message, bodyHtml, imageUrl, link, outreachType, ctaText, ctaUrl, ctaColor, testEmail])

    // Check if form has meaningful content (used for unsaved-changes guard)
    const isDirty = useCallback(() => {
        return !!(title.trim() || message.trim() || bodyHtml)
    }, [title, message, bodyHtml])

    // Expose isDirty on window so parent page can query it before tab switch
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__outreachComposeDirty = isDirty
        return () => { delete (window as any).__outreachComposeDirty }
    }, [isDirty])

    // Clear draft after successful send
    const clearDraft = useCallback(() => {
        try { localStorage.removeItem(DRAFT_KEY) } catch {}
    }, [])

    // Auto-set defaults per type
    useEffect(() => {
        if (outreachType === 'survey') {
            setCtaText('Answer in 10 Seconds →')
            setCtaUrl('/survey')
        } else if (outreachType === 'campaign') {
            if (ctaText === 'Answer in 10 Seconds →') setCtaText('')
            if (ctaUrl === '/survey') setCtaUrl('')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outreachType])

    // User search
    useEffect(() => {
        if (!userSearch.trim() || userSearch.trim().length < 2) { setUserResults([]); return }
        setSearchingUsers(true)
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch.trim())}&limit=10`)
                if (res.ok) {
                    const data = await res.json()
                    const ids = new Set(selectedUsers.map(u => u.id))
                    setUserResults((data.users || []).filter((u: { id: string }) => !ids.has(u.id)).map((u: { id: string; name: string | null; email: string }) => ({ id: u.id, name: u.name, email: u.email })))
                }
            } catch {}
            finally { setSearchingUsers(false) }
        }, 300)
        return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userSearch])

    // Fetch needed languages
    useEffect(() => {
        const groups: string[] = []
        if (notifyGroups.members) groups.push('members')
        if (notifyGroups.subscribers) groups.push('subscribers')
        if (notifyGroups.cast) groups.push('cast')
        if (groups.length === 0 && selectedUsers.length === 0) { setNeededLocales(null); setRecipientEstimate(null); return }
        setLoadingLocales(true)
        const params = new URLSearchParams()
        if (groups.length) params.set('groups', groups.join(','))
        if (selectedUsers.length) params.set('userIds', selectedUsers.map(u => u.id).join(','))
        fetch(`/api/admin/announcements/languages?${params}`)
            .then(r => r.json())
            .then(data => {
                setNeededLocales(data.languages ?? [])
                setRecipientEstimate({ members: data.total ?? 0, subscribers: data.subscriberCount ?? 0, total: (data.total ?? 0) + (data.subscriberCount ?? 0) })
            })
            .catch(() => { setNeededLocales(null); setRecipientEstimate(null) })
            .finally(() => setLoadingLocales(false))
    }, [notifyGroups.members, notifyGroups.subscribers, notifyGroups.cast, selectedUsers])

    async function handleTranslate() {
        if (!title.trim() || !message.trim()) return
        setTranslating(true); setTranslations({}); setHasTranslated(false)
        try {
            const res = await fetch('/api/admin/announcements/translate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim(), message: message.trim(), link: link.trim() || undefined, ...(neededLocales?.length ? { onlyLocales: neededLocales } : {}) }),
            })
            const data = await res.json()
            if (data.translations && Object.keys(data.translations).length > 0) { setTranslations(data.translations); setHasTranslated(true) }
        } catch {}
        finally { setTranslating(false) }
    }

    async function handleTestSend() {
        if (!testEmail || !title.trim() || !message.trim() || !ctaUrlValid) return
        setSendingTest(true); setTestResult(null)
        try {
            const res = await fetch('/api/admin/announcements/test', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    testEmail, title: title.trim(), message: message.trim(),
                    bodyHtml: bodyHtml || undefined, imageUrl: imageUrl.trim() || undefined,
                    link: link.trim() || undefined, type: outreachType,
                    ctaText: ctaText.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, ctaColor,
                }),
            })
            const data = await res.json()
            setTestResult(res.ok ? `✅ Test sent to ${testEmail}` : `❌ ${data.error || 'Failed'}`)
        } catch { setTestResult('❌ Network error') }
        finally { setSendingTest(false) }
    }

    // Min datetime = now + 5 min (in local time, for datetime-local input)
    function getMinSchedule() {
        const n = new Date(Date.now() + 5 * 60 * 1000)
        return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    }

    // Detect browser timezone abbreviation e.g. "EDT"
    function getTzLabel() {
        try {
            return Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
                .formatToParts(new Date())
                .find(p => p.type === 'timeZoneName')?.value ?? ''
        } catch { return '' }
    }

    async function handleSend(e?: React.FormEvent) {
        e?.preventDefault()
        if (!canSend) return
        setSending(true); setResult(null)

        // Convert local datetime-local string → UTC ISO string for API
        let scheduledAtUtc: string | undefined
        if (scheduleMode === 'later' && scheduledAt) {
            // datetime-local gives "2026-05-10T09:00" — treat as local, convert to UTC
            const localDate = new Date(scheduledAt)
            scheduledAtUtc = localDate.toISOString()
        }

        try {
            const res = await fetch('/api/admin/announcements', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(), message: message.trim(),
                    bodyHtml: bodyHtml || undefined, imageUrl: imageUrl.trim() || undefined,
                    link: link.trim() || undefined, notifyGroups,
                    specificUserIds: selectedUsers.map(u => u.id),
                    translations, type: outreachType,
                    ctaText: ctaText.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, ctaColor,
                    ...(scheduledAtUtc ? { scheduledAt: scheduledAtUtc } : {}),
                }),
            })
            const data = await res.json()
            if (res.ok) {
                setResult({ success: true, scheduled: data.scheduled, scheduledAt: data.scheduledAt })
                setTitle(''); setMessage(''); setBodyHtml(''); setImageUrl(''); setLink('')
                setCtaText(''); setCtaUrl(''); setTranslations({}); setHasTranslated(false)
                setScheduleMode('now'); setScheduledAt('')
                clearDraft()
            } else { setResult({ error: data.error || 'Failed' }) }
        } catch { setResult({ error: 'Network error' }) }
        finally { setSending(false) }
    }

    const typeCards: { key: OutreachType; icon: string; label: string; desc: string }[] = [
        { key: 'announcement', icon: '📣', label: 'Announcement', desc: 'Broadcast news + in-app notification' },
        { key: 'survey', icon: '📊', label: 'Survey', desc: 'Send survey invitation with auto CTA' },
        { key: 'campaign', icon: '📧', label: 'Campaign', desc: 'Custom email with editable CTA button' },
    ]

    return (
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Type Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {typeCards.map(t => (
                    <button key={t.key} type="button" onClick={() => setOutreachType(t.key)} style={{
                        padding: '16px 14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                        border: outreachType === t.key ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                        background: outreachType === t.key ? 'rgba(212,168,83,0.08)' : 'var(--bg-secondary)',
                        transition: 'all 0.15s',
                    }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{t.icon}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: outreachType === t.key ? 'var(--accent-gold)' : 'var(--text-primary)' }}>{t.label}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>{t.desc}</div>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="outreachCard" style={{ borderColor: 'rgba(212,168,83,0.2)' }}>
                <div className="outreachSectionHeader" style={{ color: 'var(--accent-gold)' }}>
                    Content
                </div>
                <div>
                    <label className="outreachLabel">Title <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Season 2 Casting Now Open" required className="outreachInput" />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>{title.length}/100</div>
                </div>
                <div>
                    <label className="outreachLabel">Message <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={3} placeholder="Short summary for emails..." required className="outreachInput" style={{ resize: 'vertical', lineHeight: 1.6 }} />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>{message.length}/500</div>
                </div>
                <div>
                    <label className="outreachLabel">Rich Body <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                        <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Add formatted body content…" />
                    </div>
                </div>
                <AdminImageUpload value={imageUrl} onChange={setImageUrl} category="announcements" label="Banner Image (optional)" hint="Recommended 1200×628px." />
                {outreachType === 'announcement' && (
                    <div>
                        <label className="outreachLabel">Link <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none' }}>(optional CTA)</span></label>
                        <input type="text" value={link} onChange={e => setLink(e.target.value)} placeholder="/casting or https://…" className="outreachInput" />
                    </div>
                )}
            </div>

            {/* CTA Editor — Campaign & Survey only */}
            {(outreachType === 'campaign' || outreachType === 'survey') && (
                <div className="outreachCard" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
                    <div className="outreachSectionHeader" style={{ color: '#60a5fa' }}>
                        Call-to-Action Button
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                            <label className="outreachLabel">Button Text</label>
                            <input type="text" value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="Watch Now →" className="outreachInput" />
                        </div>
                        <div>
                            <label className="outreachLabel">Button URL</label>
                            <input type="text" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="/survey or https://..." className="outreachInput" disabled={outreachType === 'survey'} />
                    </div>
                    {!ctaUrlValid && (
                        <div className="outreachValidationError" style={{ gridColumn: '1 / -1' }}>
                            ⚠️ URL must start with / or https://
                        </div>
                    )}
                    </div>
                    <div>
                        <label className="outreachLabel">Button Color</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {CTA_COLORS.map(c => (
                                <button key={c.value} type="button" onClick={() => setCtaColor(c.value)} style={{
                                    width: 36, height: 36, borderRadius: '10px', cursor: 'pointer',
                                    background: c.value, border: ctaColor === c.value ? '3px solid white' : '2px solid transparent',
                                    boxShadow: ctaColor === c.value ? `0 0 0 2px ${c.value}` : 'none',
                                    transition: 'all 0.15s',
                                }} title={c.label} />
                            ))}
                        </div>
                    </div>
                    {/* CTA Preview */}
                    {ctaText && (
                        <div style={{ textAlign: 'center', padding: '12px' }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Preview</div>
                            <a href="#" onClick={e => e.preventDefault()} style={{
                                display: 'inline-block', padding: '14px 32px', borderRadius: '8px',
                                background: ctaColor, color: '#fff', fontWeight: 700, fontSize: '0.92rem',
                                textDecoration: 'none', letterSpacing: '0.02em',
                            }}>{ctaText}</a>
                        </div>
                    )}
                </div>
            )}

            {/* Audience */}
            <div className="outreachCard" style={{ borderColor: 'rgba(192,132,252,0.15)' }}>
                <div className="outreachSectionHeader" style={{ color: '#c084fc' }}>
                    📨 Audience
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {([
                        { key: 'members' as const, icon: '👥', label: 'Registered Members', desc: 'Logged-in users with notifications enabled.' },
                        { key: 'subscribers' as const, icon: '📬', label: 'Newsletter Subscribers', desc: 'People who signed up for content updates.' },
                        { key: 'cast' as const, icon: '🎭', label: 'Cast Members', desc: 'Users who applied to casting calls.' },
                    ]).map(g => (
                        <label key={g.key} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '10px 12px',
                            borderRadius: '8px', border: `1px solid ${notifyGroups[g.key] ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.04)'}`,
                            background: notifyGroups[g.key] ? 'rgba(192,132,252,0.06)' : 'transparent', transition: 'all 0.15s',
                        }}>
                            <input type="checkbox" checked={notifyGroups[g.key]} onChange={e => setNotifyGroups(prev => ({ ...prev, [g.key]: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#c084fc', marginTop: 2 }} />
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: notifyGroups[g.key] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{g.icon} {g.label}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{g.desc}</div>
                            </div>
                        </label>
                    ))}
                </div>
                {/* Recipient estimate */}
                {recipientEstimate && recipientEstimate.total > 0 && someAudienceSelected && (
                    <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399' }}>{recipientEstimate.total.toLocaleString()} recipient{recipientEstimate.total !== 1 ? 's' : ''}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                {recipientEstimate.members > 0 && `${recipientEstimate.members} users`}
                                {recipientEstimate.members > 0 && recipientEstimate.subscribers > 0 && ' + '}
                                {recipientEstimate.subscribers > 0 && `${recipientEstimate.subscribers} subscribers`}
                            </div>
                        </div>
                    </div>
                )}
                {loadingLocales && someAudienceSelected && <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>⏳ Counting recipients…</div>}
                {/* Specific Users */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', marginBottom: '8px' }}>🎯 Target Specific Users (optional)</div>
                    <input type="text" placeholder="Search by name or email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="outreachInput" style={{ fontSize: '0.82rem' }} />
                    {searchingUsers && <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', padding: '4px 0' }}>🔍 Searching...</div>}
                    {userResults.length > 0 && (
                        <div style={{ marginTop: '6px', maxHeight: 150, overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                            {userResults.map(u => (
                                <button key={u.id} type="button" onClick={() => { setSelectedUsers(p => [...p, u]); setUserResults(p => p.filter(r => r.id !== u.id)); setUserSearch('') }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.82rem', textAlign: 'left' }}>
                                    <span style={{ fontWeight: 600 }}>{u.name || 'No name'}</span>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{u.email}</span>
                                    <span style={{ marginLeft: 'auto', color: '#60a5fa', fontSize: '0.7rem' }}>+ Add</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedUsers.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {selectedUsers.map(u => (
                                <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                                    {u.name || u.email}
                                    <button type="button" onClick={() => setSelectedUsers(p => p.filter(s => s.id !== u.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>×</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Translation */}
            {neededLocales && neededLocales.length > 0 && (
                <div className="outreachCard" style={{ borderColor: hasTranslated ? 'rgba(52,211,153,0.25)' : 'var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div className="outreachSectionHeader" style={{ color: hasTranslated ? '#34d399' : 'var(--accent-gold)' }}>
                                {hasTranslated ? `✅ ${neededLocales.length} Languages Translated` : `🌐 Translate ${neededLocales.length} Languages`}
                            </div>
                        </div>
                        <button type="button" onClick={handleTranslate} disabled={translating || !title.trim() || !message.trim()} style={{
                            padding: '9px 18px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '10px',
                            border: '1px solid rgba(212,168,83,0.35)',
                            background: translating ? 'rgba(212,168,83,0.08)' : 'linear-gradient(135deg, rgba(212,168,83,0.22), rgba(212,168,83,0.08))',
                            color: 'var(--accent-gold)', cursor: translating ? 'wait' : 'pointer',
                        }}>
                            {translating ? '⏳ Translating…' : hasTranslated ? '🔄 Re-Translate' : '🌐 Translate'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Schedule ─────────────────────────────────────────────────── */}
            <div className="outreachCard" style={{ borderColor: scheduleMode === 'later' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)' }}>
                <div className="outreachSectionHeader" style={{ color: scheduleMode === 'later' ? '#818cf8' : 'var(--text-secondary)', marginBottom: '12px' }}>
                    ⏰ Delivery
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    {(['now', 'later'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setScheduleMode(m)} style={{
                            padding: '8px 18px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                            border: scheduleMode === m ? '1.5px solid #818cf8' : '1px solid rgba(255,255,255,0.08)',
                            background: scheduleMode === m ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)',
                            color: scheduleMode === m ? '#818cf8' : 'var(--text-secondary)', transition: 'all 0.15s',
                        }}>
                            {m === 'now' ? '⚡ Send Now' : '📅 Schedule'}
                        </button>
                    ))}
                </div>

                {scheduleMode === 'later' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                min={getMinSchedule()}
                                className="outreachInput"
                                style={{ flex: 1, maxWidth: 260 }}
                                required={scheduleMode === 'later'}
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                🌐 {getTzLabel()}
                            </span>
                        </div>
                        {scheduledAt && (
                            <div style={{ fontSize: '0.72rem', color: '#818cf8' }}>
                                📅 Will send: {new Date(scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ({getTzLabel()})
                            </div>
                        )}
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                            Time is shown in your local timezone. The cron job fires every 5 minutes — delivery may be up to 5 min after the scheduled time.
                        </div>
                    </div>
                )}
            </div>

            {result?.success && (
                <div style={{ padding: '14px 18px', borderRadius: '10px', background: result.scheduled ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${result.scheduled ? 'rgba(99,102,241,0.25)' : 'rgba(16,185,129,0.2)'}`, color: result.scheduled ? '#818cf8' : '#10b981', fontWeight: 600, fontSize: '0.88rem' }}>
                    {result.scheduled
                        ? <>📅 Scheduled! Will send on {new Date(result.scheduledAt!).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ({getTzLabel()})</>
                        : <>✅ {outreachType === 'survey' ? 'Survey' : outreachType === 'campaign' ? 'Campaign' : 'Announcement'} queued for delivery!</>
                    }
                </div>
            )}
            {result?.error && (
                <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600, fontSize: '0.88rem' }}>❌ {result.error}</div>
            )}

            {/* Test + Send */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="email" placeholder="Test email..." value={testEmail} onChange={e => setTestEmail(e.target.value)} className="outreachInput" style={{ flex: 1, maxWidth: 280 }} />
                <button type="button" disabled={!testEmail || sendingTest || !title.trim() || !message.trim()} onClick={handleTestSend} style={{ padding: '11px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.82rem', cursor: sendingTest ? 'wait' : 'pointer' }}>
                    {sendingTest ? '⏳ Sending…' : '📧 Send Test'}
                </button>
                {testResult && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: testResult.startsWith('✅') ? '#10b981' : '#ef4444' }}>{testResult}</span>}
            </div>

            <button type="submit" disabled={!canSend || (scheduleMode === 'later' && !scheduledAt)} style={{
                padding: '15px', borderRadius: '12px', border: 'none',
                cursor: (canSend && !(scheduleMode === 'later' && !scheduledAt)) ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '0.95rem',
                background: (canSend && !(scheduleMode === 'later' && !scheduledAt))
                    ? scheduleMode === 'later' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, var(--accent-gold), #c49b3a)'
                    : 'rgba(212,168,83,0.15)',
                color: (canSend && !(scheduleMode === 'later' && !scheduledAt)) ? (scheduleMode === 'later' ? '#fff' : '#0f1115') : 'rgba(212,168,83,0.35)', transition: 'all 0.25s',
            }}>
                {sending ? '⏳ Processing…' : scheduleMode === 'later'
                    ? `📅 Schedule ${outreachType === 'survey' ? 'Survey' : outreachType === 'campaign' ? 'Campaign' : 'Announcement'}`
                    : `📡 Send ${outreachType === 'survey' ? 'Survey' : outreachType === 'campaign' ? 'Campaign' : 'Announcement'}`
                }
            </button>
        </form>
    )
}
