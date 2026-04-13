'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import dynamic from 'next/dynamic'
import AdminImageUpload from '@/components/AdminImageUpload'

// Dynamically import TipTap editor to avoid SSR issues
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false })

const DRAFT_KEY = 'aim_announcement_draft'

/** Read a saved draft from localStorage (client-side only) */
function loadDraft() {
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem(DRAFT_KEY)
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

const LOCALES: { code: string; name: string; flag: string }[] = [
    { code: 'fr', name: 'French',     flag: '🇫🇷' },
    { code: 'es', name: 'Spanish',    flag: '🇪🇸' },
    { code: 'de', name: 'German',     flag: '🇩🇪' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'hi', name: 'Hindi',      flag: '🇮🇳' },
    { code: 'ko', name: 'Korean',     flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese',    flag: '🇨🇳' },
    { code: 'ru', name: 'Russian',    flag: '🇷🇺' },
    { code: 'ar', name: 'Arabic',     flag: '🇸🇦' },
    { code: 'ja', name: 'Japanese',   flag: '🇯🇵' },
]

type LocaleTranslation = { title: string; message: string; [k: string]: string }
type Translations = Record<string, LocaleTranslation>

export default function AnnouncementsAdminPage() {
    // ── English source — seeded from localStorage draft if present ──
    const draft = typeof window !== 'undefined' ? loadDraft() : null
    const [title, setTitle]     = useState<string>(draft?.title      ?? '')
    const [message, setMessage] = useState<string>(draft?.message    ?? '')
    const [bodyHtml, setBodyHtml] = useState<string>(draft?.bodyHtml ?? '')
    const [imageUrl, setImageUrl] = useState<string>(draft?.imageUrl  ?? '')
    const [link, setLink]       = useState<string>(draft?.link        ?? '')

    // ── Translation state — also restored from draft ──
    const [translating, setTranslating]               = useState(false)
    const [retryingLocales, setRetryingLocales]       = useState<string[]>([])
    const [translations, setTranslations]             = useState<Translations>(draft?.translations ?? {})
    const [missingLocales, setMissingLocales]         = useState<string[]>(draft?.missingLocales ?? [])
    const [translateError, setTranslateError]         = useState<string | null>(null)
    const [expandedLocale, setExpandedLocale]         = useState<string | null>(null)
    const [hasTranslated, setHasTranslated]           = useState<boolean>(draft?.hasTranslated ?? false)

    // ── Broadcast state ──
    const [sending, setSending] = useState(false)
    const [result, setResult]   = useState<{ success?: boolean; error?: string } | null>(null)

    // ── Persist draft to localStorage whenever relevant state changes ──
    useEffect(() => {
        // Only save if there's something meaningful to preserve
        if (!title && !message && !bodyHtml && Object.keys(translations).length === 0) {
            localStorage.removeItem(DRAFT_KEY)
            return
        }
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                title, message, bodyHtml, imageUrl, link, translations, missingLocales, hasTranslated,
            }))
        } catch { /* storage full — non-fatal */ }
    }, [title, message, bodyHtml, imageUrl, link, translations, missingLocales, hasTranslated])

    // ── Derived ──
    const allTranslated = hasTranslated && missingLocales.length === 0
    const canBroadcast  = allTranslated && title.trim() && message.trim() && !sending
    const someRetrying  = retryingLocales.length > 0

    // ─────────────────────────────────────────────────────────────────────────
    // Core translate call — handles both full translate and per-locale retries
    async function callTranslate(onlyLocales?: string[]) {
        const res = await fetch('/api/admin/announcements/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title.trim(),
                message: message.trim(),
                link: link.trim() || undefined,
                ...(onlyLocales ? { onlyLocales } : {}),
            }),
        })
        // Always parse body — even 500 responses return { translations, missing }
        const data = await res.json()
        return data as { translations?: Translations; missing?: string[]; error?: string }
    }

    // Full translate (all locales from scratch)
    async function handleTranslate() {
        if (!title.trim() || !message.trim()) return
        setTranslating(true)
        setTranslateError(null)
        setHasTranslated(false)
        setTranslations({})
        setMissingLocales([])
        try {
            const data = await callTranslate()
            if (data.translations && Object.keys(data.translations).length > 0) {
                setTranslations(data.translations)
                setMissingLocales(data.missing ?? [])
                setHasTranslated(true)
            } else {
                setTranslateError(data.error || 'Translation failed — please try again')
                setMissingLocales(LOCALES.map(l => l.code))
            }
        } catch {
            setTranslateError('Network error — please try again')
            setMissingLocales(LOCALES.map(l => l.code))
        } finally {
            setTranslating(false)
        }
    }

    // Retry a single failed locale
    async function retryLocale(code: string) {
        setRetryingLocales(prev => [...prev, code])
        setTranslateError(null)
        try {
            const data = await callTranslate([code])
            if (data.translations?.[code]) {
                setTranslations(prev => ({ ...prev, [code]: data.translations![code] }))
                setMissingLocales(prev => prev.filter(l => l !== code))
            }
        } catch { /* locale stays red — admin can retry again */ }
        finally { setRetryingLocales(prev => prev.filter(l => l !== code)) }
    }

    // Retry all still-missing locales
    async function retryAllFailed() {
        if (missingLocales.length === 0) return
        setRetryingLocales([...missingLocales])
        setTranslateError(null)
        try {
            const data = await callTranslate(missingLocales)
            if (data.translations) {
                setTranslations(prev => ({ ...prev, ...data.translations }))
                setMissingLocales(data.missing ?? [])
            }
        } catch { /* stay on missing */ }
        finally { setRetryingLocales([]) }
    }

    function updateTranslation(locale: string, field: 'title' | 'message', value: string) {
        setTranslations(prev => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }))
    }

    // Source changed — clear translations to force re-translate
    function onSourceChange(setter: (v: string) => void, val: string) {
        setter(val)
        if (hasTranslated) {
            setTranslations({})
            setMissingLocales([])
            setHasTranslated(false)
        }
    }

    async function handleSend(e: React.FormEvent) {
        e.preventDefault()
        if (!canBroadcast) return
        setSending(true)
        setResult(null)
        try {
            const res = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    message: message.trim(),
                    bodyHtml: bodyHtml || undefined,
                    imageUrl: imageUrl.trim() || undefined,
                    link: link.trim() || undefined,
                    translations,
                }),
            })
            const data = await res.json()
            if (res.ok) {
                setResult({ success: true })
                // Clear form + draft — announcement has been sent
                setTitle(''); setMessage(''); setBodyHtml(''); setImageUrl(''); setLink('')
                setTranslations({}); setMissingLocales([]); setHasTranslated(false)
                localStorage.removeItem(DRAFT_KEY)
            } else {
                setResult({ error: data.error || 'Failed to send' })
            }
        } catch {
            setResult({ error: 'Network error' })
        } finally {
            setSending(false)
        }
    }

    // ── Shared styles ──
    const inp: React.CSSProperties = {
        width: '100%', padding: '11px 14px', borderRadius: '10px',
        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none',
        boxSizing: 'border-box', fontFamily: 'inherit',
    }
    const lbl: React.CSSProperties = {
        display: 'block', fontSize: '0.7rem', fontWeight: 700, marginBottom: '7px',
        color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em',
    }
    const card: React.CSSProperties = {
        background: 'var(--bg-secondary)', borderRadius: '16px',
        border: '1px solid var(--border-subtle)', padding: '24px',
        display: 'flex', flexDirection: 'column', gap: '18px',
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main" style={{ maxWidth: '800px' }}>

                <Link href="/admin" style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '24px' }}>
                    ← Admin Dashboard
                </Link>

                <div style={{ marginBottom: '28px' }}>
                    <h1 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 800, marginBottom: '6px' }}>
                        📣 Send Announcement
                    </h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        Write in English → translate all 10 languages → review → broadcast.
                        Every user receives emails and notifications in <strong>their own language</strong>.
                    </p>
                </div>

                <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* ── STEP 1: English Content ── */}
                    <div style={{ ...card, borderColor: 'rgba(212,168,83,0.2)' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent-gold)', marginBottom: '-4px' }}>
                            Step 1 — Write in English
                        </div>
                        <div>
                            <label style={lbl}>Announcement Title <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                                id="announcement-title"
                                type="text"
                                value={title}
                                onChange={e => onSourceChange(setTitle, e.target.value)}
                                maxLength={100}
                                placeholder="e.g. Season 2 Casting Now Open"
                                required
                                style={inp}
                            />
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>{title.length}/100</div>
                        </div>
                        <div>
                            <label style={lbl}>Summary <span style={{ color: '#ef4444' }}>*</span><span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none' }}> — used in emails &amp; notifications</span></label>
                            <textarea
                                id="announcement-message"
                                value={message}
                                onChange={e => onSourceChange(setMessage, e.target.value)}
                                maxLength={500}
                                rows={3}
                                placeholder="Short summary for emails and push notifications…"
                                required
                                style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                            />
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>{message.length}/500</div>
                        </div>
                        <div>
                            <label style={lbl}>Rich Body <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none' }}>(optional — displayed on website with formatting)</span></label>
                            <RichTextEditor
                                value={bodyHtml}
                                onChange={html => {
                                    setBodyHtml(html)
                                    if (hasTranslated) { setTranslations({}); setMissingLocales([]); setHasTranslated(false) }
                                }}
                                placeholder="Add formatted body content with headings, bold, lists and links…"
                            />
                        </div>
                        <div>
                            <AdminImageUpload
                                value={imageUrl}
                                onChange={url => setImageUrl(url)}
                                category="announcements"
                                label="Banner Image (optional)"
                                hint="Displayed at the top of the announcement on the website. Recommended 1200×628px."
                            />
                        </div>
                        <div>
                            <label style={lbl}>
                                Link <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none' }}>(optional CTA — e.g. /casting)</span>
                            </label>
                            <input
                                id="announcement-link"
                                type="text"
                                value={link}
                                onChange={e => onSourceChange(setLink, e.target.value)}
                                placeholder="/casting or https://…"
                                style={inp}
                            />
                        </div>
                    </div>

                    {/* ── STEP 2: Translate ── */}
                    <div style={{
                        ...card,
                        borderColor: allTranslated
                            ? 'rgba(52,211,153,0.25)'
                            : missingLocales.length > 0 && hasTranslated
                            ? 'rgba(239,68,68,0.2)'
                            : 'var(--border-subtle)',
                    }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px',
                                    color: allTranslated ? '#34d399' : missingLocales.length > 0 && hasTranslated ? '#ef4444' : 'var(--accent-gold)',
                                }}>
                                    Step 2 — Translate All Languages
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {allTranslated
                                        ? `✅ All ${LOCALES.length} languages ready — click any to review or edit`
                                        : missingLocales.length > 0 && hasTranslated
                                        ? `⚠️ ${missingLocales.length} language${missingLocales.length !== 1 ? 's' : ''} failed — retry them below`
                                        : 'AI-translates into all 10 supported languages at once'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {/* Retry all failed — shown when some locales are still missing */}
                                {missingLocales.length > 0 && hasTranslated && (
                                    <button
                                        type="button"
                                        onClick={retryAllFailed}
                                        disabled={someRetrying}
                                        style={{
                                            padding: '9px 18px', fontSize: '0.78rem', fontWeight: 700,
                                            borderRadius: '10px', border: '1px solid rgba(239,68,68,0.35)',
                                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                            cursor: someRetrying ? 'wait' : 'pointer',
                                        }}
                                    >
                                        {someRetrying ? '⏳ Retrying…' : `🔄 Retry ${missingLocales.length} Failed`}
                                    </button>
                                )}
                                {/* Main translate / re-translate button */}
                                <button
                                    type="button"
                                    onClick={handleTranslate}
                                    disabled={translating || !title.trim() || !message.trim()}
                                    style={{
                                        padding: '9px 18px', fontSize: '0.78rem', fontWeight: 700,
                                        borderRadius: '10px', border: '1px solid rgba(212,168,83,0.35)',
                                        background: translating || !title.trim() || !message.trim()
                                            ? 'rgba(212,168,83,0.08)'
                                            : 'linear-gradient(135deg, rgba(212,168,83,0.22), rgba(212,168,83,0.08))',
                                        color: 'var(--accent-gold)',
                                        cursor: translating ? 'wait' : !title.trim() || !message.trim() ? 'not-allowed' : 'pointer',
                                        opacity: !title.trim() || !message.trim() ? 0.5 : 1,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {translating ? '⏳ Translating…' : hasTranslated ? '🔄 Re-Translate All' : '🌐 Translate All Languages'}
                                </button>
                            </div>
                        </div>

                        {translateError && (
                            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '0.82rem' }}>
                                ❌ {translateError}
                            </div>
                        )}

                        {/* Language grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px' }}>
                            {LOCALES.map(loc => {
                                const t = translations[loc.code]
                                const isMissing = missingLocales.includes(loc.code)
                                const isRetrying = retryingLocales.includes(loc.code)
                                const done = !!t && !isMissing
                                const isOpen = expandedLocale === loc.code

                                let statusIcon = '○'
                                let statusColor = 'rgba(255,255,255,0.2)'
                                if (translating || isRetrying) { statusIcon = '⏳'; statusColor = 'rgba(212,168,83,0.6)' }
                                else if (done) { statusIcon = '✅'; statusColor = '#34d399' }
                                else if (isMissing && hasTranslated) { statusIcon = '🔴'; statusColor = '#ef4444' }

                                return (
                                    <div key={loc.code} style={{
                                        borderRadius: '10px', overflow: 'hidden',
                                        border: `1px solid ${done ? 'rgba(52,211,153,0.2)' : isMissing && hasTranslated ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
                                        background: done ? 'rgba(52,211,153,0.04)' : isMissing && hasTranslated ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                                        transition: 'all 0.2s',
                                    }}>
                                        {/* Locale header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
                                            <span style={{ fontSize: '1.1rem' }}>{loc.flag}</span>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{loc.name}</span>
                                            <span style={{ fontSize: '0.65rem', color: statusColor }}>{statusIcon}</span>
                                            {/* Per-locale retry button for failed locales */}
                                            {isMissing && hasTranslated && !isRetrying && (
                                                <button
                                                    type="button"
                                                    onClick={() => retryLocale(loc.code)}
                                                    style={{
                                                        padding: '2px 8px', fontSize: '0.6rem', fontWeight: 700,
                                                        borderRadius: '5px', border: '1px solid rgba(239,68,68,0.3)',
                                                        background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                                        cursor: 'pointer',
                                                    }}
                                                >Retry</button>
                                            )}
                                            {/* Expand/collapse for translated locales */}
                                            {done && (
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedLocale(isOpen ? null : loc.code)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.62rem', padding: '0' }}
                                                >{isOpen ? '▲' : '▼'}</button>
                                            )}
                                        </div>

                                        {/* Editable translation fields */}
                                        {isOpen && done && t && (
                                            <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ paddingTop: '10px' }}>
                                                    <label style={{ ...lbl, marginBottom: '4px' }}>Title</label>
                                                    <input
                                                        type="text"
                                                        value={t.title || ''}
                                                        onChange={e => updateTranslation(loc.code, 'title', e.target.value)}
                                                        style={{ ...inp, fontSize: '0.8rem', padding: '8px 10px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ ...lbl, marginBottom: '4px' }}>Message</label>
                                                    <textarea
                                                        value={t.message || ''}
                                                        onChange={e => updateTranslation(loc.code, 'message', e.target.value)}
                                                        rows={3}
                                                        style={{ ...inp, fontSize: '0.8rem', padding: '8px 10px', resize: 'vertical', lineHeight: 1.5 }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Lock notice */}
                        {!allTranslated && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🔒 Broadcast is locked until all {LOCALES.length} languages are confirmed
                                {missingLocales.length > 0 && hasTranslated && (
                                    <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                        — {missingLocales.length} still missing
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── ENGLISH PREVIEW ── */}
                    {(title || message) && (
                        <div style={{ background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.18)', borderRadius: '12px', padding: '16px 20px' }}>
                            <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '10px' }}>
                                🇬🇧 English Preview
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '20px' }}>📣</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '3px' }}>{title || '—'}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message || '—'}</div>
                                    {link && <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', marginTop: '5px' }}>→ {link}</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STATUS ── */}
                    {result?.success && (
                        <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 600, fontSize: '0.88rem' }}>
                            ✅ Announcement queued — all users will receive it in their own language via email and in-app notification.
                        </div>
                    )}
                    {result?.error && (
                        <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600, fontSize: '0.88rem' }}>
                            ❌ {result.error}
                        </div>
                    )}

                    {/* ── STEP 3: Broadcast ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Checklist */}
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                            {[
                                { label: 'Title written',    done: !!title.trim() },
                                { label: 'Message written',  done: !!message.trim() },
                                { label: `All ${LOCALES.length} languages`, done: allTranslated },
                            ].map(item => (
                                <span key={item.label} style={{ color: item.done ? '#34d399' : 'rgba(255,255,255,0.25)' }}>
                                    {item.done ? '✅' : '○'} {item.label}
                                </span>
                            ))}
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '6px', fontSize: '0.68rem', color: 'var(--text-tertiary)',
                            padding: '7px 14px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                        }}>
                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>ℹ️</span>
                            <span>Only opted-in users are notified. Emails delivered in each user&apos;s language simultaneously.</span>
                        </div>

                        <button
                            type="submit"
                            id="send-announcement-btn"
                            disabled={!canBroadcast}
                            style={{
                                padding: '15px', borderRadius: '12px', border: 'none',
                                cursor: canBroadcast ? 'pointer' : 'not-allowed',
                                fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.02em',
                                background: canBroadcast
                                    ? 'linear-gradient(135deg, var(--accent-gold), #c49b3a)'
                                    : 'rgba(212,168,83,0.15)',
                                color: canBroadcast ? '#0f1115' : 'rgba(212,168,83,0.35)',
                                transition: 'all 0.25s',
                            }}
                        >
                            {sending ? '⏳ Broadcasting…'
                                : allTranslated ? '📣 Broadcast to All Users'
                                : missingLocales.length > 0 && hasTranslated
                                ? `🔴 Retry ${missingLocales.length} Failed Language${missingLocales.length !== 1 ? 's' : ''} First`
                                : '🔒 Translate All Languages First'}
                        </button>

                    </div>
                </form>
            </main>
        </div>
    )
}
