'use client'

/**
 * SubtitleEditor — Admin inline subtitle cue editor.
 *
 * Opened after subtitle generation is complete (status: 'completed' or 'pending').
 * Lets admin correct text, timestamps, split/merge/delete/insert cues, then
 *   • Save Draft  → PATCH /api/admin/subtitles (stores edits, keeps status=pending)
 *   • Approve     → PUT  /api/admin/subtitles (sets status=approved_source)
 *
 * Translation is blocked on the parent page until status==='approved_source'.
 *
 * Quality warnings (inline):
 *   - Text > 84 chars per cue
 *   - Duration < 0.8s
 *   - Start >= End
 *   - Overlap with next cue
 *   - Empty text
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

export type SubtitleCue = {
    start: number   // seconds
    end: number
    text: string
}

interface Props {
    projectId: string
    episodeId?: string | null
    initialSegments: SubtitleCue[]
    currentStatus: string  // 'pending' | 'completed' | 'approved_source' | ...
    filmUrl?: string | null
    onClose: () => void
    onSaved: (newStatus: string) => void   // called after save or approve
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMs = (sec: number) => {
    const h  = Math.floor(sec / 3600)
    const m  = Math.floor((sec % 3600) / 60)
    const s  = Math.floor(sec % 60)
    const ms = Math.round((sec % 1) * 1000)
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    const ms3 = String(ms).padStart(3, '0')
    return `${hh}:${mm}:${ss}.${ms3}`
}

const parseTime = (val: string): number => {
    // Accepts HH:MM:SS.mmm or MM:SS.mmm or SS.mmm
    const parts = val.split(':').map(Number)
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return parts[0]
}

type Warning = 'long' | 'fast' | 'overlap' | 'empty' | 'invalid'

function getWarnings(cues: SubtitleCue[], idx: number): Warning[] {
    const c = cues[idx]
    const w: Warning[] = []
    if (!c.text.trim()) w.push('empty')
    if (c.start >= c.end) w.push('invalid')
    if (c.text.length > 84) w.push('long')
    const dur = c.end - c.start
    if (dur > 0 && dur < 0.8) w.push('fast')
    const next = cues[idx + 1]
    if (next && c.end > next.start) w.push('overlap')
    return w
}

const WARN_LABELS: Record<Warning, string> = {
    long:    '⚠ Text too long',
    fast:    '⚠ Too fast to read',
    overlap: '⚠ Overlaps next cue',
    empty:   '⚠ Empty cue',
    invalid: '⚠ Start ≥ End',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TimeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [editing, setEditing] = useState(false)
    const [raw, setRaw] = useState(fmtMs(value))

    useEffect(() => {
        if (!editing) setRaw(fmtMs(value))
    }, [value, editing])

    return (
        <input
            type="text"
            value={editing ? raw : fmtMs(value)}
            onFocus={() => { setEditing(true); setRaw(fmtMs(value)) }}
            onChange={e => setRaw(e.target.value)}
            onBlur={() => {
                setEditing(false)
                const parsed = parseTime(raw)
                if (isFinite(parsed) && parsed >= 0) onChange(parsed)
                else setRaw(fmtMs(value))
            }}
            style={{
                width: '102px', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.72rem',
                padding: '3px 6px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '5px',
                color: 'var(--text-primary)', outline: 'none',
            }}
        />
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MAX_HISTORY = 50

export default function SubtitleEditor({
    projectId, episodeId, initialSegments, currentStatus, filmUrl, onClose, onSaved,
}: Props) {
    const [cues, setCues] = useState<SubtitleCue[]>(() =>
        initialSegments.map(s => ({ start: s.start, end: s.end, text: s.text }))
    )

    // Undo/redo stack
    const historyRef = useRef<SubtitleCue[][]>([initialSegments])
    const historyIdxRef = useRef(0)

    const pushHistory = useCallback((next: SubtitleCue[]) => {
        const h = historyRef.current.slice(0, historyIdxRef.current + 1)
        h.push(next)
        if (h.length > MAX_HISTORY) h.shift()
        historyRef.current = h
        historyIdxRef.current = h.length - 1
    }, [])

    const updateCues = useCallback((next: SubtitleCue[]) => {
        pushHistory(next)
        setCues(next)
    }, [pushHistory])

    const undo = useCallback(() => {
        if (historyIdxRef.current <= 0) return
        historyIdxRef.current--
        setCues(historyRef.current[historyIdxRef.current])
    }, [])

    const redo = useCallback(() => {
        if (historyIdxRef.current >= historyRef.current.length - 1) return
        historyIdxRef.current++
        setCues(historyRef.current[historyIdxRef.current])
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [undo, redo])

    // Status derived from editing
    const [liveStatus, setLiveStatus] = useState(currentStatus)
    const [saving, setSaving] = useState(false)
    const [approving, setApproving] = useState(false)
    const [msg, setMsg] = useState('')

    // Video ref for click-to-seek
    const videoRef = useRef<HTMLVideoElement>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [activeCue, setActiveCue] = useState(-1)

    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return
        const handler = () => {
            const t = vid.currentTime
            setCurrentTime(t)
            const idx = cues.findIndex(c => t >= c.start && t <= c.end)
            setActiveCue(idx)
        }
        vid.addEventListener('timeupdate', handler)
        return () => vid.removeEventListener('timeupdate', handler)
    }, [cues])

    // Warning totals
    const warningCount = useMemo(() =>
        cues.reduce((acc, _, i) => acc + getWarnings(cues, i).length, 0),
    [cues])

    // ── Cue operations ────────────────────────────────────────────────────────

    const updateCue = (idx: number, patch: Partial<SubtitleCue>) => {
        const next = cues.map((c, i) => i === idx ? { ...c, ...patch } : c)
        updateCues(next)
    }

    const deleteCue = (idx: number) => {
        updateCues(cues.filter((_, i) => i !== idx))
    }

    const insertAfter = (idx: number) => {
        if (idx < 0) {
            // Empty array — create the very first cue
            updateCues([{ start: 0, end: 2, text: '' }])
            return
        }
        const cur = cues[idx]
        const nextCue = cues[idx + 1]
        const newStart = cur.end + 0.05
        const newEnd = nextCue ? Math.min(nextCue.start - 0.05, newStart + 2) : newStart + 2
        const newCue: SubtitleCue = { start: newStart, end: Math.max(newEnd, newStart + 0.5), text: '' }
        const next = [...cues.slice(0, idx + 1), newCue, ...cues.slice(idx + 1)]
        updateCues(next)
    }

    const splitCue = (idx: number) => {
        const c = cues[idx]
        const mid = (c.start + c.end) / 2
        const halfText = c.text.slice(0, Math.ceil(c.text.length / 2))
        const restText = c.text.slice(Math.ceil(c.text.length / 2))
        const next = [
            ...cues.slice(0, idx),
            { start: c.start, end: mid,  text: halfText.trim() },
            { start: mid + 0.05, end: c.end, text: restText.trim() },
            ...cues.slice(idx + 1),
        ]
        updateCues(next)
    }

    const mergeCue = (idx: number) => {
        if (idx >= cues.length - 1) return
        const a = cues[idx]
        const b = cues[idx + 1]
        const next = [
            ...cues.slice(0, idx),
            { start: a.start, end: b.end, text: `${a.text} ${b.text}`.trim() },
            ...cues.slice(idx + 2),
        ]
        updateCues(next)
    }

    // ── API calls ─────────────────────────────────────────────────────────────

    const saveDraft = async () => {
        setSaving(true); setMsg('')
        try {
            const res = await fetch('/api/admin/subtitles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, episodeId, segments: cues }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || 'Save failed')
            setLiveStatus(d.status)
            setMsg('✓ Draft saved')
            onSaved(d.status)
            setTimeout(() => setMsg(''), 2500)
        } catch (e) {
            setMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`)
        }
        setSaving(false)
    }

    const approve = async () => {
        setApproving(true); setMsg('')
        // Save any unsaved edits first
        try {
            await fetch('/api/admin/subtitles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, episodeId, segments: cues }),
            })
        } catch { /* best-effort */ }
        try {
            const res = await fetch('/api/admin/subtitles', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, episodeId }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || 'Approval failed')
            setLiveStatus('approved_source')
            setMsg('✅ Source approved — translation unlocked')
            onSaved('approved_source')
            setTimeout(() => setMsg(''), 3500)
        } catch (e) {
            setMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`)
        }
        setApproving(false)
    }

    // ── Export SRT ───────────────────────────────────────────────────────────

    const exportSrt = () => {
        const srt = cues.map((c, i) => {
            const fmt = (s: number) => {
                const h  = Math.floor(s / 3600)
                const m  = Math.floor((s % 3600) / 60)
                const sec = Math.floor(s % 60)
                const ms = Math.round((s % 1) * 1000)
                return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`
            }
            return `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`
        }).join('\n')
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([srt], { type: 'text/plain' }))
        a.download = `${projectId}-subtitles.srt`
        a.click()
    }

    // ─── Styles ───────────────────────────────────────────────────────────────

    const isApproved = liveStatus === 'approved_source'

    const pillStyle = (active: boolean): React.CSSProperties => ({
        padding: '3px 10px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
        border: `1px solid ${active ? 'var(--accent-gold)' : 'transparent'}`,
        background: active ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)',
        color: active ? 'var(--accent-gold)' : 'var(--text-tertiary)',
        cursor: 'default',
    })

    return (
        /* Full-screen overlay */
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', overflowY: 'hidden',
        }}>
            <style>{`
                @media (max-width: 640px) {
                    .aim-editor-video-panel { display: none !important; }
                    .aim-editor-header-actions { flex-wrap: wrap; gap: 4px !important; }
                    .aim-editor-header-actions button { font-size: 0.68rem !important; padding: 4px 8px !important; }
                }
            `}</style>
            {/* ── Header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(13,15,20,0.98)', flexShrink: 0,
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ✏️ Subtitle Editor
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {cues.length} cues
                        {warningCount > 0 && (
                            <span style={{ color: '#f59e0b', marginLeft: '8px' }}>· {warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                </div>

                {/* Status pill */}
                <div style={pillStyle(isApproved)}>
                    {isApproved ? '✓ Approved Source' : liveStatus === 'pending' || liveStatus === 'completed' ? '● Unapproved Draft' : liveStatus}
                </div>

                {/* Actions */}
                <div className="aim-editor-header-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button onClick={undo} title="Undo (Ctrl+Z)"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>↩</button>
                    <button onClick={redo} title="Redo (Ctrl+Y)"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>↪</button>
                    <button onClick={exportSrt}
                        style={{ padding: '4px 10px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>⬇ SRT</button>
                    <button
                        onClick={saveDraft} disabled={saving}
                        style={{
                            padding: '5px 14px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '7px',
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                            cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--text-primary)', opacity: saving ? 0.6 : 1,
                        }}
                    >{saving ? 'Saving…' : 'Save Draft'}</button>
                    <button
                        onClick={approve} disabled={approving || isApproved}
                        title={isApproved ? 'Already approved — edit to re-approve' : 'Approve source and unlock translation'}
                        style={{
                            padding: '5px 16px', fontSize: '0.78rem', fontWeight: 800, borderRadius: '7px',
                            background: isApproved ? 'rgba(34,197,94,0.12)' : 'linear-gradient(135deg,#d4a853,#b8862e)',
                            border: isApproved ? '1px solid rgba(34,197,94,0.3)' : 'none',
                            cursor: (approving || isApproved) ? 'default' : 'pointer',
                            color: isApproved ? '#4ade80' : '#000', opacity: approving ? 0.7 : 1,
                        }}
                    >{approving ? 'Approving…' : isApproved ? '✓ Approved' : '✓ Approve Source'}</button>
                    <button onClick={onClose}
                        style={{ padding: '5px 10px', fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>✕</button>
                </div>
            </div>

            {/* Status message toast */}
            {msg && (
                <div style={{
                    padding: '7px 20px', fontSize: '0.78rem', flexShrink: 0,
                    background: msg.startsWith('✅') || msg.startsWith('✓')
                        ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: msg.startsWith('✅') || msg.startsWith('✓') ? '#4ade80' : '#f87171',
                }}>{msg}</div>
            )}

            {/* ── Body: video preview + cue list ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

                {/* LEFT: video preview — hidden on mobile via .aim-editor-video-panel */}
                {filmUrl && (
                    <div className="aim-editor-video-panel" style={{
                        width: '320px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)',
                        background: '#000', display: 'flex', flexDirection: 'column', padding: '10px',
                    }}>
                        <video
                            ref={videoRef}
                            src={filmUrl}
                            controls
                            controlsList="nodownload"
                            style={{ width: '100%', borderRadius: '8px', background: '#000' }}
                        />
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '6px', textAlign: 'center' }}>
                            Click a cue row to seek · Active cue highlighted
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.18)', lineHeight: 1.5 }}>
                            <div><kbd style={{ fontFamily: 'monospace', fontSize: '0.6rem', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', padding: '0 3px' }}>Ctrl+Z</kbd> Undo</div>
                            <div><kbd style={{ fontFamily: 'monospace', fontSize: '0.6rem', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', padding: '0 3px' }}>Ctrl+Y</kbd> Redo</div>
                        </div>
                    </div>
                )}

                {/* RIGHT: cue editor list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
                    {cues.length === 0 && (
                        <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                            No subtitle cues. Generate subtitles first.
                        </div>
                    )}

                    {cues.map((cue, idx) => {
                        const warns = getWarnings(cues, idx)
                        const isActive = idx === activeCue

                        return (
                            <div key={idx} style={{
                                marginBottom: '4px',
                                borderRadius: '8px',
                                border: isActive
                                    ? '1px solid rgba(212,168,83,0.5)'
                                    : warns.length > 0
                                        ? '1px solid rgba(245,158,11,0.25)'
                                        : '1px solid rgba(255,255,255,0.06)',
                                background: isActive
                                    ? 'rgba(212,168,83,0.05)'
                                    : 'rgba(255,255,255,0.02)',
                                transition: 'all 0.12s',
                            }}>
                                {/* Row: sequence + times + text + actions */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '28px auto 1fr auto',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '7px 10px',
                                }}>
                                    {/* Sequence number — click to seek */}
                                    <button
                                        onClick={() => {
                                            const vid = videoRef.current
                                            if (vid) { vid.currentTime = cue.start; vid.play().catch(() => {}) }
                                        }}
                                        title="Jump to this cue"
                                        style={{
                                            minWidth: '24px', textAlign: 'center', fontSize: '0.6rem',
                                            color: isActive ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                            fontWeight: 700, background: 'none', border: 'none',
                                            cursor: filmUrl ? 'pointer' : 'default', padding: '2px',
                                        }}
                                    >{idx + 1}</button>

                                    {/* Times */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', width: '22px' }}>IN</span>
                                            <TimeInput value={cue.start} onChange={v => updateCue(idx, { start: v })} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', width: '22px' }}>OUT</span>
                                            <TimeInput value={cue.end} onChange={v => updateCue(idx, { end: v })} />
                                        </div>
                                    </div>

                                    {/* Text */}
                                    <textarea
                                        value={cue.text}
                                        onChange={e => updateCue(idx, { text: e.target.value })}
                                        rows={2}
                                        style={{
                                            width: '100%', resize: 'vertical', padding: '5px 8px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px', color: 'var(--text-primary)',
                                            fontSize: '0.82rem', lineHeight: 1.5, fontFamily: 'inherit',
                                            outline: 'none',
                                        }}
                                    />

                                    {/* Cue actions */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <button onClick={() => splitCue(idx)} title="Split cue at midpoint"
                                            style={{ padding: '3px 6px', fontSize: '0.65rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'var(--text-tertiary)' }}>⎯</button>
                                        <button onClick={() => mergeCue(idx)} title="Merge with next cue" disabled={idx >= cues.length - 1}
                                            style={{ padding: '3px 6px', fontSize: '0.65rem', cursor: idx < cues.length - 1 ? 'pointer' : 'not-allowed', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'var(--text-tertiary)', opacity: idx >= cues.length - 1 ? 0.35 : 1 }}>⊔</button>
                                        <button onClick={() => deleteCue(idx)} title="Delete cue"
                                            style={{ padding: '3px 6px', fontSize: '0.65rem', cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', color: '#f87171' }}>✕</button>
                                    </div>
                                </div>

                                {/* Warnings */}
                                {warns.length > 0 && (
                                    <div style={{ padding: '2px 10px 6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {warns.map(w => (
                                            <span key={w} style={{
                                                fontSize: '0.58rem', padding: '1px 6px',
                                                borderRadius: '999px',
                                                background: 'rgba(245,158,11,0.12)',
                                                border: '1px solid rgba(245,158,11,0.2)',
                                                color: '#fbbf24',
                                            }}>{WARN_LABELS[w]}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Insert row below */}
                                <button onClick={() => insertAfter(idx)}
                                    title="Insert new cue after this one"
                                    style={{
                                        display: 'block', width: '100%', padding: '2px 0',
                                        fontSize: '0.58rem', background: 'none',
                                        border: 'none', borderTop: '1px dashed rgba(255,255,255,0.05)',
                                        color: 'rgba(255,255,255,0.15)', cursor: 'pointer',
                                        borderRadius: '0 0 8px 8px',
                                        transition: 'color 0.15s, background 0.15s',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget.style.color = 'var(--accent-gold)'); (e.currentTarget.style.background = 'rgba(212,168,83,0.04)') }}
                                    onMouseLeave={e => { (e.currentTarget.style.color = 'rgba(255,255,255,0.15)'); (e.currentTarget.style.background = 'none') }}
                                >+ insert cue below</button>
                            </div>
                        )
                    })}

                    {/* Insert first cue if empty */}
                    {cues.length === 0 && (
                        <button onClick={() => insertAfter(-1)}
                            style={{ display: 'block', margin: '16px auto', padding: '8px 20px', borderRadius: '8px', background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.8rem' }}>
                            + Add first cue
                        </button>
                    )}

                    {/* Bottom buffer */}
                    <div style={{ height: '80px' }} />
                </div>
            </div>
        </div>
    )
}
