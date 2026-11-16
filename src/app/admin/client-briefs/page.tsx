'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import {
    DEFAULT_RATES, RATE_LABELS, STEPS, estimate, money, optLabel, question, summarize,
    type Answers, type Rates,
} from '@/lib/client-brief/schema'

interface Brief {
    id: string; token: string; club: string; contactName: string | null; email: string | null; phone: string | null
    answers: Answers; status: string; submittedAt: string | null; lastSeenAt: string | null; adminNotes: string | null
    createdAt: string; updatedAt: string
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
    not_started: { label: 'Not started', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
    in_progress: { label: 'In progress', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    submitted: { label: 'Submitted', bg: 'rgba(16,185,129,0.14)', color: '#34d399' },
}
const FIT = {
    ok: { label: 'Fits their budget', color: '#34d399' },
    warn: { label: 'Stretches their budget', color: '#f59e0b' },
    bad: { label: 'Over budget: offer a phased plan', color: '#f87171' },
}

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', borderRadius: 14, padding: 20 }
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.9rem' }
const btn: React.CSSProperties = { padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }
const btnGold: React.CSSProperties = { ...btn, background: 'var(--accent-gold)', color: '#111', border: '1px solid var(--accent-gold)' }

function linkFor(token: string) {
    return `${typeof window !== 'undefined' ? window.location.origin : 'https://impactaistudio.com'}/brief/${token}`
}
function when(iso: string | null) {
    return iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
}

export default function ClientBriefsPage() {
    const [briefs, setBriefs] = useState<Brief[]>([])
    const [rates, setRates] = useState<Rates>(DEFAULT_RATES)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selected, setSelected] = useState<string | null>(null)
    const [form, setForm] = useState({ club: '', contactName: '', currentSite: '', location: '' })
    const [creating, setCreating] = useState(false)
    const [toast, setToast] = useState('')

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/client-briefs')
            if (!res.ok) throw new Error()
            const data = await res.json()
            setBriefs(data.briefs); setRates(data.rates); setError('')
        } catch { setError('Could not load client briefs.') } finally { setLoading(false) }
    }, [])
    useEffect(() => {
        load()
        const id = new URLSearchParams(window.location.search).get('id')
        if (id) setSelected(id)
        const t = setInterval(load, 30_000) // pick up client autosaves
        return () => clearInterval(t)
    }, [load])
    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t) }, [toast])

    const copy = async (text: string) => {
        try { await navigator.clipboard.writeText(text); setToast('Link copied') } catch { setToast('Copy failed: select the link and copy it') }
    }

    const create = async () => {
        if (!form.club.trim()) return
        setCreating(true)
        const res = await fetch('/api/admin/client-briefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        setCreating(false)
        if (!res.ok) { setToast('Could not create the link'); return }
        const { brief } = await res.json()
        setForm({ club: '', contactName: '', currentSite: '', location: '' })
        setBriefs(b => [brief, ...b]); setSelected(brief.id)
        copy(linkFor(brief.token))
    }

    const current = briefs.find(b => b.id === selected) || null

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>🧾 Client Briefs</h1>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Website briefs from clients. No account needed on their side. Answers save as they type.</p>
                    </div>
                    <a href="/brief/demo" target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }}>Preview the client experience ↗</a>
                </div>

                {/* new link */}
                <section style={{ ...card, marginBottom: 16 }}>
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 12px' }}>New brief link</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        <input style={input} placeholder="Club or business name *" value={form.club} onChange={e => setForm({ ...form, club: e.target.value })} />
                        <input style={input} placeholder="Contact name" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                        <input style={input} placeholder="Current website" value={form.currentSite} onChange={e => setForm({ ...form, currentSite: e.target.value })} />
                        <input style={input} placeholder="City" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
                        <button style={btnGold} onClick={create} disabled={creating || !form.club.trim()}>{creating ? 'Creating…' : 'Create link'}</button>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>The link is copied for you. Send it to the client by WhatsApp or email.</span>
                    </div>
                </section>

                {error && <p style={{ color: '#f87171' }}>{error}</p>}

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }} className="cb-grid">
                    {/* list */}
                    <section style={{ ...card, padding: 10, display: 'grid', gap: 6 }}>
                        {loading && <p style={{ padding: 10, color: 'var(--text-secondary)' }}>Loading…</p>}
                        {!loading && !briefs.length && <p style={{ padding: 10, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No briefs yet. Create a link above.</p>}
                        {briefs.map(b => {
                            const st = STATUS[b.status] || STATUS.not_started
                            const q = estimate(b.answers || {}, rates)
                            return (
                                <button key={b.id} onClick={() => setSelected(b.id)} style={{
                                    textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', color: 'var(--text-primary)',
                                    background: selected === b.id ? 'var(--bg-card-hover)' : 'transparent', border: `1px solid ${selected === b.id ? 'var(--accent-gold)' : 'transparent'}`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                        <b style={{ fontSize: '0.92rem' }}>{b.club}</b>
                                        <span style={{ fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>{b.status === 'not_started' ? '' : money(q.total)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{b.contactName || 'No contact yet'} · {when(b.updatedAt)}</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                                    </div>
                                </button>
                            )
                        })}
                    </section>

                    {/* detail */}
                    <section style={{ minWidth: 0 }}>
                        {current
                            ? <Detail key={current.id} brief={current} rates={rates} onCopy={copy} onChange={load} onDeleted={() => { setSelected(null); load() }} />
                            : <div style={{ ...card, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Pick a brief to see the client&apos;s answers and your quote.</div>}
                    </section>
                </div>

                {/* keyed on the saved rates so the draft resets when they change */}
                <RatesEditor key={JSON.stringify(rates)} rates={rates} onSaved={r => { setRates(r); setToast('Rates saved') }} />

                {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 18px', borderRadius: 10, background: 'var(--bg-card-hover)', border: '1px solid var(--accent-gold)', fontSize: '0.85rem', zIndex: 50 }}>{toast}</div>}
                <style>{`@media (max-width: 900px) { .cb-grid { grid-template-columns: 1fr !important; } }`}</style>
            </main>
        </div>
    )
}

function Detail({ brief, rates, onCopy, onChange, onDeleted }: { brief: Brief; rates: Rates; onCopy: (t: string) => void; onChange: () => void; onDeleted: () => void }) {
    const a = useMemo(() => brief.answers || {}, [brief.answers])
    const q = useMemo(() => estimate(a, rates), [a, rates])
    // mark the first line of each group so the table can print a group header
    const lines = q.lines.map((l, i) => ({ ...l, head: i === 0 || q.lines[i - 1].group !== l.group }))
    const [notes, setNotes] = useState(brief.adminNotes || '')
    const [notesState, setNotesState] = useState('')
    const [armed, setArmed] = useState(false)
    const st = STATUS[brief.status] || STATUS.not_started
    const link = linkFor(brief.token)
    const colors = ['color_primary', 'color_secondary', 'color_accent'].map(k => a[k]).filter(Boolean) as string[]

    const saveNotes = async () => {
        setNotesState('Saving…')
        const res = await fetch(`/api/admin/client-briefs/${brief.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminNotes: notes }) })
        setNotesState(res.ok ? 'Saved' : 'Could not save'); if (res.ok) onChange()
    }
    const del = async () => {
        if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return }
        await fetch(`/api/admin/client-briefs/${brief.id}`, { method: 'DELETE' }); onDeleted()
    }
    const quoteText = () => {
        const lines = [`Quote: ${brief.club}`, '']
        let g = ''
        for (const l of q.lines) { if (l.group !== g) { g = l.group; lines.push(g.toUpperCase()) } lines.push(`- ${l.label}: ${money(l.amount)}`) }
        if (q.rush) lines.push('', `Rush delivery: ${money(q.rush)}`)
        lines.push('', `Total: ${money(q.total)}`, `Monthly care: ${money(q.monthly)}/mo`)
        return lines.join('\n')
    }

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{brief.club}</h2>
                        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {[brief.contactName, brief.email, brief.phone].filter(Boolean).join(' · ') || 'Client has not added contact details yet'}
                        </p>
                        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            Created {when(brief.createdAt)} · Last opened {when(brief.lastSeenAt)}{brief.submittedAt ? ` · Submitted ${when(brief.submittedAt)}` : ''}
                        </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <code style={{ ...input, width: 'auto', flex: '1 1 260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{link}</code>
                    <button style={btn} onClick={() => onCopy(link)}>Copy link</button>
                    <a style={{ ...btn, textDecoration: 'none' }} href={link} target="_blank" rel="noreferrer">Open ↗</a>
                </div>
            </div>

            <div style={card}>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 6 }}>
                    <div><div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Quote range</div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(q.low)} – {money(q.high)}</div></div>
                    <div><div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Monthly care</div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(q.monthly)}</div></div>
                </div>
                <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {q.fit && <b style={{ color: FIT[q.fit].color, marginRight: 8 }}>{FIT[q.fit].label}</b>}
                    Their budget: {typeof a.budget === 'string' && a.budget ? optLabel('budget', a.budget) : 'not given'}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <tbody>
                        {lines.map((l, i) => {
                            return [
                                l.head && <tr key={'g' + i}><td colSpan={2} style={{ padding: '14px 0 6px', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{l.group}</td></tr>,
                                <tr key={i}><td style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{l.label}</td>
                                    <td style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(l.amount)}</td></tr>,
                            ]
                        })}
                        {q.rush > 0 && <tr><td style={{ padding: '7px 0' }}>Rush, launch in {Math.max(0, Math.round(q.weeks || 0))} weeks (+{rates.rush_pct}%)</td><td style={{ textAlign: 'right' }}>{money(q.rush)}</td></tr>}
                        <tr><td style={{ padding: '12px 0 0', fontWeight: 800 }}>Total</td><td style={{ padding: '12px 0 0', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(q.total)}</td></tr>
                    </tbody>
                </table>
                <button style={{ ...btn, marginTop: 14 }} onClick={() => onCopy(quoteText())}>Copy quote</button>
            </div>

            <div style={card}>
                <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 800 }}>Answers</h3>
                {colors.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, margin: '8px 0 4px' }}>
                        {colors.map(c => <span key={c} title={c} style={{ width: 34, height: 34, borderRadius: 8, background: c, border: '1px solid rgba(255,255,255,0.2)' }} />)}
                        {typeof a.style === 'string' && a.style && <span style={{ alignSelf: 'center', fontSize: '0.85rem', marginLeft: 8 }}>Style: <b>{optLabel('style', a.style)}</b></span>}
                    </div>
                )}
                {summarize(a).map(sec => (
                    <div key={sec.title} style={{ marginTop: 14 }}>
                        <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: 6 }}>{sec.title}</div>
                        {sec.rows.length ? sec.rows.map(([qq, v]) => (
                            <div key={qq} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)', gap: 12, padding: '5px 0', fontSize: '0.86rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{qq}</span><span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{v}</span>
                            </div>
                        )) : <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Not answered yet</span>}
                    </div>
                ))}
            </div>

            <div style={card}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 800 }}>Your notes</h3>
                <textarea style={{ ...input, minHeight: 90 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Private notes about this client" />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button style={btn} onClick={saveNotes}>Save notes</button><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{notesState}</span></div>
                    <button style={{ ...btn, color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }} onClick={del}>{armed ? 'Click again to delete for good' : 'Delete brief'}</button>
                </div>
            </div>
        </div>
    )
}

function RatesEditor({ rates, onSaved }: { rates: Rates; onSaved: (r: Rates) => void }) {
    const [draft, setDraft] = useState<Rates>(rates)
    const [state, setState] = useState('')
    const featureQ = question('features')
    const features = featureQ && featureQ.t === 'groups' ? featureQ.groups.flatMap(([, items]) => items) : []
    const save = async () => {
        setState('Saving…')
        const res = await fetch('/api/admin/client-briefs/rates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rates: draft }) })
        if (!res.ok) { setState('Could not save'); return }
        const data = await res.json(); setState(''); onSaved(data.rates)
    }
    const num = (label: string, value: number, onChange: (n: number) => void) => (
        <label key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 100px', gap: 10, alignItems: 'center', fontSize: '0.84rem' }}>
            <span>{label}</span>
            <input type="number" min={0} style={{ ...input, padding: '6px 8px', textAlign: 'right' }} value={value} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} />
        </label>
    )
    const keys = Object.keys(RATE_LABELS) as (keyof typeof RATE_LABELS)[]
    const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px 24px' }
    const sub: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '18px 0 8px' }
    return (
        <details style={{ ...card, marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' }}>Rate card (USD) · used to price every brief</summary>
            <div style={sub}>Build, content and brand</div>
            <div style={grid}>{keys.filter(k => !/^(rush|spread|care)/.test(k)).map(k => num(RATE_LABELS[k], draft[k], n => setDraft({ ...draft, [k]: n })))}</div>
            <div style={sub}>Features</div>
            <div style={grid}>{features.map(([k, l]) => num(l, draft.features[k] ?? 0, n => setDraft({ ...draft, features: { ...draft.features, [k]: n } })))}</div>
            <div style={sub}>Timing and care</div>
            <div style={grid}>{keys.filter(k => /^(rush|spread|care)/.test(k)).map(k => num(RATE_LABELS[k], draft[k], n => setDraft({ ...draft, [k]: n })))}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
                <button style={btnGold} onClick={save}>Save rates</button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{state || `${STEPS.length - 1} sections · ${features.length} priced features`}</span>
            </div>
        </details>
    )
}
