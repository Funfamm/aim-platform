'use client'

/**
 * SubtitleEditor — Admin subtitle cue editor (Full Feature Set).
 *
 * T3-A  Import SRT/VTT files  → replaces cue list with parsed result
 * T3-B  Revision history      → loads from /api/admin/subtitles/revisions
 * T3-C  Side-by-side mode     → shows source cues beside translation cues
 * T4-A  Track placement panel → verticalAnchor, horizontalAlign, offset, bg, fontScale
 * T4-B  Per-cue overrides     → each cue can override track placement
 * T4-C  Draggable preview     → drag subtitle text over video preview
 *
 * Quality warnings (inline, existing):
 *   - Text > 84 chars | Duration < 0.8s | Start >= End | Overlap | Empty
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { parseSRT, parseVTT } from '@/lib/subtitle-file-parser'

export type SubtitleCue = { start: number; end: number; text: string }

export type PlacementState = {
    verticalAnchor: string    // bottom|lower_third|middle|upper_third|top
    horizontalAlign: string   // left|center|right
    offsetYPercent: number
    offsetXPercent: number
    safeAreaMarginPx: number
    backgroundStyle: string   // none|shadow|box
    fontScale: number
    cueOverrides: Record<string, Partial<PlacementState>>
}

export type MobilePlacementState = {
    verticalAnchor: string    // bottom|lower_third only (no middle/top for mobile)
    horizontalAlign: string
    offsetYPercent: number
    safeAreaMarginPx: number  // default 20px to account for home indicator
    fontScale: number
}

/** Device preview modes shown in the editor video panel */
type PreviewDevice = 'desktop' | 'portrait' | 'landscape'

const DEFAULT_MOBILE_PLACEMENT: MobilePlacementState = {
    verticalAnchor: 'bottom',
    horizontalAlign: 'center',
    offsetYPercent: 0,
    safeAreaMarginPx: 20,
    fontScale: 0.9,
}

const DEFAULT_PLACEMENT: PlacementState = {
    verticalAnchor: 'bottom',
    horizontalAlign: 'center',
    offsetYPercent: 0,
    offsetXPercent: 0,
    safeAreaMarginPx: 12,
    backgroundStyle: 'shadow',
    fontScale: 1.0,
    cueOverrides: {},
}

const ANCHOR_PRESETS: { id: string; label: string; bottom: string }[] = [
    { id: 'top',          label: '⊤ Top',         bottom: '85%' },
    { id: 'upper_third',  label: '◌ Upper',        bottom: '65%' },
    { id: 'middle',       label: '≡ Middle',        bottom: '45%' },
    { id: 'lower_third',  label: '◎ Lower',        bottom: '20%' },
    { id: 'bottom',       label: '⊥ Bottom',       bottom: '5%'  },
]

interface Props {
    projectId: string
    episodeId?: string | null
    initialSegments: SubtitleCue[]
    currentStatus: string
    filmUrl?: string | null
    onClose: () => void
    onSaved: (newStatus: string) => void
    // Side-by-side: source cues shown when editing a translation track
    sourceSegments?: SubtitleCue[]
    initialPlacement?: Partial<PlacementState>
    initialMobilePlacement?: Partial<MobilePlacementState>
    useSeparateMobilePlacement?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMs = (sec: number) => {
    const h  = Math.floor(sec / 3600)
    const m  = Math.floor((sec % 3600) / 60)
    const s  = Math.floor(sec % 60)
    const ms = Math.round((sec % 1) * 1000)
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
}

const parseTime = (val: string): number => {
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

// ─── TimeInput ────────────────────────────────────────────────────────────────

function TimeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [editing, setEditing] = useState(false)
    const [raw, setRaw] = useState(fmtMs(value))




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

// ─── Revision history panel ───────────────────────────────────────────────────

type Revision = { id: string; savedAt: string; savedByEmail: string; changeSource: string }

// ─── Main Component ───────────────────────────────────────────────────────────

const MAX_HISTORY = 50

export default function SubtitleEditor({
    projectId, episodeId, initialSegments, currentStatus, filmUrl,
    onClose, onSaved, sourceSegments, initialPlacement,
    initialMobilePlacement, useSeparateMobilePlacement: initUseMobile = false,
}: Props) {
    const [cues, setCues] = useState<SubtitleCue[]>(() =>
        initialSegments.map(s => ({ start: s.start, end: s.end, text: s.text }))
    )

    // ── Placement state ─────────────────────────────────────────────────────────
    const [placement, setPlacement] = useState<PlacementState>({
        ...DEFAULT_PLACEMENT,
        ...initialPlacement,
        cueOverrides: (initialPlacement as PlacementState | undefined)?.cueOverrides ?? {},
    })
    const [showPlacement, setShowPlacement] = useState(false)

    // ── Mobile placement state ───────────────────────────────────────────────────
    const [useSeparateMobile, setUseSeparateMobile] = useState(initUseMobile)
    const [mobilePlacement, setMobilePlacement] = useState<MobilePlacementState>({
        ...DEFAULT_MOBILE_PLACEMENT,
        ...initialMobilePlacement,
    })

    // ── Device preview ───────────────────────────────────────────────────────────
    const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop')
    // Track which devices the admin has previewed on (for approval guard)
    const [previewedDevices, setPreviewedDevices] = useState<Set<PreviewDevice>>(new Set(['desktop']))
    const markDevicePreviewed = (d: PreviewDevice) =>
        setPreviewedDevices(prev => { const n = new Set(prev); n.add(d); return n })
    // Preview aids
    const [showSafeZones, setShowSafeZones] = useState(false)
    const [showControlsBar, setShowControlsBar] = useState(false)

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
        pushHistory(next); setCues(next)
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

    // ── Video state ─────────────────────────────────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null)
    const [activeCue, setActiveCue] = useState(-1)

    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return
        const handler = () => {
            const t = vid.currentTime
            const idx = cues.findIndex(c => t >= c.start && t <= c.end)
            setActiveCue(idx)
        }
        vid.addEventListener('timeupdate', handler)
        return () => vid.removeEventListener('timeupdate', handler)
    }, [cues])

    // ── Status / save ───────────────────────────────────────────────────────────
    const [liveStatus, setLiveStatus] = useState(currentStatus)
    const [saving, setSaving] = useState(false)
    const [approving, setApproving] = useState(false)
    const [msg, setMsg] = useState('')
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

    const isApproved = liveStatus === 'approved_source'
    const warningCount = useMemo(() => cues.reduce((acc, _, i) => acc + getWarnings(cues, i).length, 0), [cues])
    const hardErrors = useMemo(() => cues.reduce((acc, _, i) => {
        const w = getWarnings(cues, i)
        return acc + w.filter(x => x === 'invalid' || x === 'empty').length
    }, 0), [cues])

    // ── Revision history ────────────────────────────────────────────────────────
    const [revisions, setRevisions] = useState<Revision[]>([])
    const [showRevisions, setShowRevisions] = useState(false)
    const [loadingRevisions, setLoadingRevisions] = useState(false)

    // ── Phase 4: History clear state ────────────────────────────────────────────
    type ClearAction = 'clear_only' | 'archive_and_clear' | 'reset_and_clear' | 'delete_drafts'
    const [showClearModal, setShowClearModal] = useState(false)
    const [clearAction, setClearAction] = useState<ClearAction>('clear_only')
    const [clearReason, setClearReason] = useState('')
    const [clearing, setClearing] = useState(false)

    const handleClearHistory = async () => {
        setClearing(true)
        try {
            const res = await fetch('/api/admin/subtitles/revisions/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, episodeId, action: clearAction, reason: clearReason || undefined }),
            })
            const d = await res.json() as { ok: boolean; rowsDeleted: number; error?: string; archive?: Revision[] }
            if (!res.ok) throw new Error(d.error || 'Clear failed')
            if (clearAction === 'archive_and_clear' && d.archive) {
                const blob = new Blob([JSON.stringify(d.archive, null, 2)], { type: 'application/json' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `subtitle-revision-archive-${projectId}.json`
                a.click()
            }
            if (clearAction === 'reset_and_clear') {
                window.location.reload()
                return
            }
            setRevisions([])
            setShowClearModal(false)
            setClearReason('')
            setMsg(`✓ History cleared — ${d.rowsDeleted} revision${d.rowsDeleted !== 1 ? 's' : ''} removed`)
            setTimeout(() => setMsg(''), 3500)
        } catch (e: unknown) {
            setMsg(`❌ ${e instanceof Error ? e.message : 'Clear failed'}`)
        }
        setClearing(false)
    }

    const loadRevisions = useCallback(async () => {
        setLoadingRevisions(true)
        try {
            const ep = episodeId ? `&episodeId=${episodeId}` : ''
            const r = await fetch(`/api/admin/subtitles/revisions?projectId=${projectId}${ep}`)
            const d = await r.json() as { revisions: Revision[] }
            setRevisions(d.revisions ?? [])
        } catch { /* non-critical */ }
        setLoadingRevisions(false)
    }, [projectId, episodeId])

    const restoreRevision = async (revisionId: string) => {
        if (!confirm('Restore this revision? Your current unsaved edits will be replaced.')) return
        const r = await fetch('/api/admin/subtitles/revisions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revisionId }),
        })
        if (!r.ok) { setMsg('❌ Failed to restore revision'); return }
        const d = await r.json() as { segments: SubtitleCue[]; placement: Partial<PlacementState>; savedAt: string }
        updateCues(d.segments)
        if (d.placement && Object.keys(d.placement).length > 0) {
            setPlacement(prev => ({ ...prev, ...d.placement }))
        }
        setShowRevisions(false)
        setMsg(`✓ Restored to revision from ${new Date(d.savedAt).toLocaleString()}`)
        setTimeout(() => setMsg(''), 3500)
    }

    const restoreOriginal = () => {
        if (!confirm('Discard all edits and restore the original generated subtitles?')) return
        const orig = historyRef.current[0]
        historyIdxRef.current = 0
        setCues(orig)
    }

    // ── Cue operations ────────────────────────────────────────────────────────

    const updateCue = (idx: number, patch: Partial<SubtitleCue>) => {
        updateCues(cues.map((c, i) => i === idx ? { ...c, ...patch } : c))
    }

    const deleteCue = (idx: number) => updateCues(cues.filter((_, i) => i !== idx))

    const insertAfter = (idx: number) => {
        if (idx < 0) { updateCues([{ start: 0, end: 2, text: '' }]); return }
        const cur = cues[idx]
        const nextCue = cues[idx + 1]
        const newStart = cur.end + 0.05
        const newEnd = nextCue ? Math.min(nextCue.start - 0.05, newStart + 2) : newStart + 2
        updateCues([...cues.slice(0, idx + 1), { start: newStart, end: Math.max(newEnd, newStart + 0.5), text: '' }, ...cues.slice(idx + 1)])
    }

    const splitCue = (idx: number) => {
        const c = cues[idx]
        const mid = (c.start + c.end) / 2
        updateCues([
            ...cues.slice(0, idx),
            { start: c.start, end: mid,       text: c.text.slice(0, Math.ceil(c.text.length / 2)).trim() },
            { start: mid + 0.05, end: c.end,  text: c.text.slice(Math.ceil(c.text.length / 2)).trim() },
            ...cues.slice(idx + 1),
        ])
    }

    const mergeCue = (idx: number) => {
        if (idx >= cues.length - 1) return
        const a = cues[idx]; const b = cues[idx + 1]
        updateCues([...cues.slice(0, idx), { start: a.start, end: b.end, text: `${a.text} ${b.text}`.trim() }, ...cues.slice(idx + 2)])
    }

    // ── Per-cue placement override ────────────────────────────────────────────

    const setCueOverride = (idx: number, patch: Partial<PlacementState> | null) => {
        setPlacement(prev => {
            const next = { ...prev.cueOverrides }
            if (patch === null) { delete next[String(idx)] }
            else { next[String(idx)] = { ...(next[String(idx)] ?? {}), ...patch } }
            return { ...prev, cueOverrides: next }
        })
    }

    const getCuePlacement = (idx: number): PlacementState => {
        const override = placement.cueOverrides[String(idx)]
        return override ? { ...placement, ...override } : placement
    }

    // ── SRT/VTT Import (T3-A) ─────────────────────────────────────────────────

    const importInputRef = useRef<HTMLInputElement>(null)
    const [importPreview, setImportPreview] = useState<SubtitleCue[] | null>(null)
    const [importSource, setImportSource] = useState<'import_srt' | 'import_vtt'>('import_srt')

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const isVtt = file.name.toLowerCase().endsWith('.vtt')
        setImportSource(isVtt ? 'import_vtt' : 'import_srt')
        const reader = new FileReader()
        reader.onload = ev => {
            try {
                const text = ev.target?.result as string
                const parsed = isVtt ? parseVTT(text) : parseSRT(text)
                const normalized: SubtitleCue[] = parsed.map(s => ({ start: s.start, end: s.end, text: s.text }))
                setImportPreview(normalized)
            } catch {
                setMsg('❌ Could not parse file — is it a valid .srt or .vtt?')
            }
        }
        reader.readAsText(file)
        // reset input so same file can be re-selected
        e.target.value = ''
    }

    const confirmImport = () => {
        if (!importPreview) return
        if (cues.length > 0 && !confirm(`Replace ${cues.length} current cues with ${importPreview.length} imported cues?`)) return
        updateCues(importPreview)
        setImportPreview(null)
        setMsg(`✓ Imported ${importPreview.length} cues`)
        setTimeout(() => setMsg(''), 2500)
    }

    // ── Export SRT (T4-F: warn if placement set) ──────────────────────────────

    const exportSrt = () => {
        const hasCustomPlacement = placement.verticalAnchor !== 'bottom' ||
            placement.horizontalAlign !== 'center' || placement.offsetYPercent !== 0 ||
            Object.keys(placement.cueOverrides).length > 0

        if (hasCustomPlacement && !confirm(
            'This track has custom subtitle positioning.\n\n' +
            'SRT format cannot preserve positioning metadata — only text and timing will be exported.\n\n' +
            'Export anyway?'
        )) return

        const fmt = (s: number) => {
            const h = Math.floor(s / 3600)
            const m = Math.floor((s % 3600) / 60)
            const sec = Math.floor(s % 60)
            const ms = Math.round((s % 1) * 1000)
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`
        }
        const srt = cues.map((c, i) => `${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n')
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([srt], { type: 'text/plain' }))
        a.download = `${projectId}-subtitles.srt`
        a.click()
    }

    // ── Save draft ────────────────────────────────────────────────────────────

    const saveDraft = async (changeSource = 'manual_edit') => {
        setSaving(true); setMsg('')
        try {
            const res = await fetch('/api/admin/subtitles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId, episodeId, segments: cues,
                    changeSource,
                    placement: {
                        verticalAnchor: placement.verticalAnchor,
                        horizontalAlign: placement.horizontalAlign,
                        offsetYPercent: placement.offsetYPercent,
                        offsetXPercent: placement.offsetXPercent,
                        safeAreaMarginPx: placement.safeAreaMarginPx,
                        backgroundStyle: placement.backgroundStyle,
                        fontScale: placement.fontScale,
                        cueOverrides: placement.cueOverrides,
                    },
                }),
            })
            const d = await res.json() as { status: string; error?: string }
            if (!res.ok) throw new Error(d.error || 'Save failed')
            setLiveStatus(d.status)
            setLastSavedAt(new Date().toISOString())
            setMsg('✓ Draft saved')
            onSaved(d.status)
            setTimeout(() => setMsg(''), 2500)
        } catch (e: unknown) {
            setMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`)
        }
        setSaving(false)
    }

    const approve = async () => {
        // Phase 3: require the admin to have previewed on mobile before approving
        if (!previewedDevices.has('portrait')) {
            setMsg('⚠️ Please preview on mobile (portrait) before approving.')
            setTimeout(() => setMsg(''), 4000)
            return
        }
        setApproving(true); setMsg('')
        await saveDraft('approve').catch(() => {})
        try {
            const res = await fetch('/api/admin/subtitles', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, episodeId }),
            })
            const d = await res.json() as { error?: string }
            if (!res.ok) throw new Error(d.error || 'Approval failed')
            setLiveStatus('approved_source')
            setLastSavedAt(new Date().toISOString())
            setMsg('✅ Source approved — translation unlocked')
            onSaved('approved_source')
            setTimeout(() => setMsg(''), 3500)
        } catch (e: unknown) {
            setMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`)
        }
        setApproving(false)
    }

    // ── Draggable subtitle preview (T4-C) ─────────────────────────────────────

    const previewRef = useRef<HTMLDivElement>(null)
    const dragState = useRef<{ startY: number; startOffset: number } | null>(null)

    const handlePreviewDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const y = 'touches' in e ? e.touches[0].clientY : e.clientY
        dragState.current = { startY: y, startOffset: placement.offsetYPercent }
        e.preventDefault()
    }

    useEffect(() => {
        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!dragState.current || !previewRef.current) return
            const y = 'touches' in e ? e.touches[0].clientY : e.clientY
            const containerH = previewRef.current.offsetHeight
            const deltaY = dragState.current.startY - y
            const deltaPct = (deltaY / containerH) * 100
            const newOffset = Math.max(-20, Math.min(20, dragState.current.startOffset + deltaPct))
            setPlacement(prev => ({ ...prev, offsetYPercent: Math.round(newOffset * 10) / 10 }))
        }
        const onEnd = () => { dragState.current = null }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('touchmove', onMove, { passive: false })
        window.addEventListener('mouseup', onEnd)
        window.addEventListener('touchend', onEnd)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('touchmove', onMove)
            window.removeEventListener('mouseup', onEnd)
            window.removeEventListener('touchend', onEnd)
        }
    }, [])

    // ── Subtitle preview position (device-aware) ──────────────────────────────

    const getSubtitleBottom = (p: PlacementState | MobilePlacementState): string => {
        const baseMap: Record<string, number> = {
            bottom: 5, lower_third: 20, middle: 45, upper_third: 65, top: 82,
        }
        const base = baseMap[p.verticalAnchor] ?? 5
        const offsetY = 'offsetYPercent' in p ? p.offsetYPercent : 0
        // The live player adds +58px for the controls bar height.
        // Scale proportionally: 58 / playerH ≈ 10.2% of a typical mobile player (~568px).
        // We add this as a percentage of the preview canvas so positioning is WYSIWYG.
        const ctrlBarPct = 10
        return `calc(${base + ctrlBarPct}% + ${offsetY}% + ${p.safeAreaMarginPx}px)`
    }

    // For the preview panel, choose placement based on active device
    const activePlacement: PlacementState | MobilePlacementState =
        previewDevice !== 'desktop' && useSeparateMobile ? mobilePlacement : placement

    // Preview container dimensions per device
    // Portrait: iPhone SE-ish (320×568) — large enough for reliable subtitle placement judging.
    // Desktop: 480×270 (16:9 at comfortable editing width).
    const previewDims: Record<PreviewDevice, { w: number; h: number }> = {
        desktop:  { w: 480, h: 270 },
        portrait: { w: 320, h: 568 },
        landscape: { w: 480, h: 270 },
    }
    const dim = previewDims[previewDevice]

    /**
     * Compute subtitle font size in px from previewWidth — matching the live player's
     * clamp(0.9rem, 2.5vw, 1.15rem) formula translated to preview-canvas space.
     *
     * We intentionally avoid `vw` here because vw measures the browser viewport,
     * not the preview canvas, which would produce wildly wrong sizes.
     */
    const computePreviewFontPx = (fontScale: number, previewWidth: number): string => {
        const BASE_REM = 16 // browser default rem in px
        const minPx   = 0.9  * fontScale * BASE_REM           // 0.9rem in px
        const idealPx = 0.025 * fontScale * previewWidth      // 2.5% of canvas width
        const maxPx   = 1.15 * fontScale * BASE_REM           // 1.15rem in px
        return `${Math.min(maxPx, Math.max(minPx, idealPx)).toFixed(1)}px`
    }


    // ── Styles ────────────────────────────────────────────────────────────────

    const pillStyle = (active: boolean): React.CSSProperties => ({
        padding: '3px 10px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
        border: `1px solid ${active ? 'var(--accent-gold)' : 'transparent'}`,
        background: active ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)',
        color: active ? 'var(--accent-gold)' : 'var(--text-tertiary)', cursor: 'default',
    })

    const btnStyle = (variant: 'default' | 'primary' | 'danger' = 'default'): React.CSSProperties => ({
        padding: '4px 10px', fontSize: '0.72rem', borderRadius: '6px', cursor: 'pointer',
        background: variant === 'primary' ? 'linear-gradient(135deg,#d4a853,#b8862e)'
            : variant === 'danger' ? 'rgba(239,68,68,0.1)'
            : 'rgba(255,255,255,0.06)',
        border: variant === 'primary' ? 'none'
            : variant === 'danger' ? '1px solid rgba(239,68,68,0.2)'
            : '1px solid rgba(255,255,255,0.1)',
        color: variant === 'primary' ? '#000' : variant === 'danger' ? '#f87171' : 'var(--text-secondary)',
        fontWeight: variant === 'primary' ? 700 : 600,
    })

    const activeCueText = activeCue >= 0 ? cues[activeCue]?.text : ''
    const needsMobilePreview = !previewedDevices.has('portrait')

    return (
        <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
            <style>{`
                @media (max-width: 640px) {
                    .aim-editor-video-panel { display: none !important; }
                    .aim-editor-header-actions { flex-wrap: wrap; gap: 4px !important; }
                    .aim-editor-header-actions button { font-size: 0.68rem !important; padding: 4px 8px !important; }
                }
                .aim-placement-btn { transition: all 0.12s; }
                .aim-placement-btn:hover { border-color: rgba(212,168,83,0.5) !important; color: var(--accent-gold) !important; }
                .aim-placement-btn.active { background: rgba(212,168,83,0.12) !important; border-color: var(--accent-gold) !important; color: var(--accent-gold) !important; }
            `}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(13,15,20,0.98)', flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>✏️ Subtitle Editor</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '1px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>{cues.length} cues</span>
                        {warningCount > 0 && <span style={{ color: '#f59e0b' }}>· {warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
                        {hardErrors > 0 && <span style={{ color: '#ef4444' }}>· {hardErrors} error{hardErrors !== 1 ? 's' : ''} (fix before publishing)</span>}
                        {lastSavedAt && <span style={{ color: 'rgba(255,255,255,0.25)' }}>· saved {new Date(lastSavedAt).toLocaleTimeString()}</span>}
                        {sourceSegments && <span style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(212,168,83,0.08)', padding: '0 5px', borderRadius: '4px' }}>↔ Side-by-side mode</span>}
                    </div>
                </div>

                <div style={pillStyle(isApproved)}>
                    {isApproved ? '✓ Approved Source' : liveStatus === 'pending' || liveStatus === 'completed' ? '● Unapproved Draft' : liveStatus}
                </div>

                <div className="aim-editor-header-actions" style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Undo / Redo */}
                    <button onClick={undo} title="Undo (Ctrl+Z)" style={btnStyle()}>↩</button>
                    <button onClick={redo} title="Redo (Ctrl+Y)" style={btnStyle()}>↪</button>

                    {/* Import */}
                    <button onClick={() => importInputRef.current?.click()} title="Import .srt or .vtt" style={btnStyle()}>⬆ Import</button>
                    <input ref={importInputRef} type="file" accept=".srt,.vtt" onChange={handleImportFile} style={{ display: 'none' }} />

                    {/* Export */}
                    <button onClick={exportSrt} style={btnStyle()}>⬇ SRT</button>

                    {/* Placement toggle */}
                    <button
                        onClick={() => setShowPlacement(v => !v)}
                        title="Subtitle placement controls"
                        style={{ ...btnStyle(showPlacement ? 'primary' : 'default'), minWidth: '28px' }}
                    >📐</button>

                    {/* Revisions */}
                    <button
                        onClick={() => { setShowRevisions(v => !v); if (!showRevisions) loadRevisions() }}
                        title="Revision history"
                        style={btnStyle()}
                    >🕓</button>

                    {/* Restore original */}
                    <button onClick={restoreOriginal} title="Restore original generated subtitles" style={btnStyle('danger')}>↺ Orig</button>

                    {/* Save Draft */}
                    <button onClick={() => saveDraft('manual_edit')} disabled={saving}
                        style={{ ...btnStyle('default'), padding: '5px 14px', fontSize: '0.78rem', fontWeight: 700, opacity: saving ? 0.6 : 1 }}
                    >{saving ? 'Saving…' : 'Save Draft'}</button>

                    {/* Approve */}
                    <button onClick={approve} disabled={approving || isApproved || hardErrors > 0}
                        title={hardErrors > 0 ? 'Fix hard errors before approving' : isApproved ? 'Already approved' : needsMobilePreview ? 'Preview on mobile portrait first' : 'Approve source and unlock translation'}
                        style={{
                            padding: '5px 14px', fontSize: '0.78rem', fontWeight: 800, borderRadius: '7px',
                            background: isApproved ? 'rgba(34,197,94,0.12)' : hardErrors > 0 ? 'rgba(239,68,68,0.12)' : needsMobilePreview ? 'rgba(245,158,11,0.12)' : 'linear-gradient(135deg,#d4a853,#b8862e)',
                            border: isApproved ? '1px solid rgba(34,197,94,0.3)' : hardErrors > 0 ? '1px solid rgba(239,68,68,0.2)' : needsMobilePreview ? '1px solid rgba(245,158,11,0.3)' : 'none',
                            cursor: (approving || isApproved || hardErrors > 0) ? 'default' : 'pointer',
                            color: isApproved ? '#4ade80' : hardErrors > 0 ? '#f87171' : needsMobilePreview ? '#fbbf24' : '#000', opacity: approving ? 0.7 : 1,
                        }}
                    >{approving ? 'Approving…' : isApproved ? '✓ Approved' : hardErrors > 0 ? `✗ ${hardErrors} error${hardErrors > 1 ? 's' : ''}` : needsMobilePreview ? '📱 Preview mobile first' : '✓ Approve Source'}</button>

                    <button onClick={onClose} style={{ padding: '5px 10px', fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>✕</button>
                </div>
            </div>

            {/* ── Import preview banner ── */}
            {importPreview && (
                <div style={{ padding: '8px 18px', background: 'rgba(212,168,83,0.1)', borderBottom: '1px solid rgba(212,168,83,0.2)', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', flex: 1 }}>
                        📂 Import preview: <strong>{importPreview.length} cues</strong> ready to replace {cues.length} current cues
                    </span>
                    <button onClick={confirmImport} style={btnStyle('primary')}>Apply Import</button>
                    <button onClick={() => setImportPreview(null)} style={btnStyle('danger')}>Cancel</button>
                </div>
            )}

            {/* ── Status message ── */}
            {msg && (
                <div style={{
                    padding: '6px 18px', fontSize: '0.78rem', flexShrink: 0,
                    background: msg.startsWith('✅') || msg.startsWith('✓') ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: msg.startsWith('✅') || msg.startsWith('✓') ? '#4ade80' : '#f87171',
                }}>{msg}</div>
            )}

            {/* ── Body ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

                {/* LEFT: video preview + placement panel */}
                {filmUrl && (
                    <div className="aim-editor-video-panel" style={{ width: dim.w + 24, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', background: '#000', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

                        {/* Device preview toggle (Phase 3) */}
                        <div style={{ display: 'flex', gap: '2px', padding: '6px 8px', background: 'rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            {(['desktop', 'portrait', 'landscape'] as PreviewDevice[]).map(d => (
                                <button key={d}
                                    onClick={() => { setPreviewDevice(d); markDevicePreviewed(d) }}
                                    style={{
                                        flex: 1, padding: '3px 6px', fontSize: '0.58rem', cursor: 'pointer', borderRadius: '5px',
                                        background: previewDevice === d ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${previewDevice === d ? 'rgba(212,168,83,0.5)' : 'rgba(255,255,255,0.08)'}`,
                                        color: previewDevice === d ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                        fontWeight: previewDevice === d ? 700 : 400,
                                    }}
                                >
                                    {d === 'desktop' ? '🖥 Desktop' : d === 'portrait' ? '📱 Portrait' : '📱 Land.'}
                                    {d === 'portrait' && previewedDevices.has('portrait') && <span style={{ marginLeft: '3px', color: '#4ade80' }}>✓</span>}
                                </button>
                            ))}
                        </div>

                        {/* Video preview with subtitle overlay */}
                        <div ref={previewRef} style={{
                            position: 'relative', width: `${dim.w}px`, height: `${dim.h}px`,
                            background: '#111', flexShrink: 0, margin: '0 auto',
                            border: previewDevice !== 'desktop' ? '2px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
                            borderRadius: previewDevice === 'portrait' ? '16px' : previewDevice === 'landscape' ? '8px' : '4px',
                            overflow: 'hidden',
                        }}>
                            <video ref={videoRef} src={filmUrl} controls controlsList="nodownload" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

                            {/* Safe-zone guide bands — only shown when toggle is on */}
                            {showSafeZones && (() => {
                                // Heights expressed as % of preview canvas
                                const ctrlH = showControlsBar ? 12 : 8     // controls zone at bottom
                                const homeH = previewDevice === 'portrait' ? 5 : 0  // home indicator above controls
                                const safeTop = 100 - ctrlH - homeH - 20  // lower-third safe upper boundary
                                const safeBot = 100 - ctrlH - homeH        // lower-third safe lower boundary
                                return (
                                    <>
                                        {/* Controls blocked zone — red */}
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${ctrlH}%`, background: 'rgba(239,68,68,0.18)', borderTop: '1px dashed rgba(239,68,68,0.6)', pointerEvents: 'none', zIndex: 4 }}>
                                            <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '0.42rem', color: 'rgba(239,68,68,0.9)', fontWeight: 700 }}>Controls</span>
                                        </div>
                                        {/* Home indicator zone — amber (portrait only) */}
                                        {homeH > 0 && (
                                            <div style={{ position: 'absolute', bottom: `${ctrlH}%`, left: 0, right: 0, height: `${homeH}%`, background: 'rgba(245,158,11,0.18)', borderTop: '1px dashed rgba(245,158,11,0.6)', pointerEvents: 'none', zIndex: 4 }}>
                                                <span style={{ position: 'absolute', top: '1px', left: '4px', fontSize: '0.38rem', color: 'rgba(245,158,11,0.9)', fontWeight: 700 }}>Home indicator</span>
                                            </div>
                                        )}
                                        {/* Lower-third safe zone — green */}
                                        <div style={{ position: 'absolute', bottom: `${safeBot}%`, left: 0, right: 0, height: `${safeTop - safeBot + 20}%`, background: 'rgba(34,197,94,0.07)', borderTop: '1px dashed rgba(34,197,94,0.4)', borderBottom: '1px dashed rgba(34,197,94,0.4)', pointerEvents: 'none', zIndex: 3 }}>
                                            <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '0.40rem', color: 'rgba(34,197,94,0.8)', fontWeight: 700 }}>Safe zone</span>
                                        </div>
                                    </>
                                )
                            })()}

                            {/* Mock controls bar — shown when showControlsBar is on */}
                            {showControlsBar && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '12%', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', paddingLeft: '6px', gap: '4px', pointerEvents: 'none', zIndex: 5 }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                                    <div style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 4px' }}>
                                        <div style={{ width: '35%', height: '100%', background: 'var(--accent-gold)', borderRadius: '2px' }} />
                                    </div>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)', marginRight: '6px' }} />
                                </div>
                            )}

                            {/* Subtitle overlay — uses JS-computed px font (NOT vw) */}
                            {activeCueText && (() => {
                                const p = activePlacement
                                const fontPx = computePreviewFontPx(p.fontScale, dim.w)
                                return (
                                    <div
                                        onMouseDown={handlePreviewDragStart}
                                        onTouchStart={handlePreviewDragStart}
                                        style={{
                                            position: 'absolute',
                                            left: p.horizontalAlign === 'left' ? '5%' : p.horizontalAlign === 'right' ? 'auto' : '50%',
                                            right: p.horizontalAlign === 'right' ? '5%' : 'auto',
                                            transform: p.horizontalAlign === 'center' ? 'translateX(-50%)' : 'none',
                                            bottom: getSubtitleBottom(p),
                                            cursor: 'ns-resize',
                                            maxWidth: '90%',
                                            padding: '3px 10px',
                                            borderRadius: '5px',
                                            fontSize: fontPx,
                                            fontWeight: 600,
                                            lineHeight: 1.5,
                                            color: '#fff',
                                            textAlign: p.horizontalAlign as 'left' | 'center' | 'right',
                                            background: 'backgroundStyle' in p && p.backgroundStyle === 'box' ? 'rgba(0,0,0,0.82)' : 'transparent',
                                            textShadow: 'backgroundStyle' in p && p.backgroundStyle === 'shadow'
                                                ? '0 0 4px #000, 0 1px 4px rgba(0,0,0,0.8)' : 'none',
                                            pointerEvents: 'all',
                                            userSelect: 'none',
                                            zIndex: 6,
                                        }}
                                    >
                                        {activeCueText}
                                    </div>
                                )
                            })()}

                            {/* Device label badge */}
                            <div style={{ position: 'absolute', top: 0, right: 0, fontSize: '0.45rem', color: 'rgba(212,168,83,0.7)', padding: '2px 6px', background: 'rgba(0,0,0,0.6)', borderBottomLeftRadius: '6px', zIndex: 7 }}>
                                {previewDevice === 'desktop' ? `${dim.w}×${dim.h} • drag to reposition` : `📱 ${previewDevice} • ${dim.w}×${dim.h}`}
                            </div>
                        </div>

                        {/* Preview aid toggles */}
                        <div style={{ display: 'flex', gap: '6px', padding: '6px 8px', borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.58rem', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={showSafeZones} onChange={e => setShowSafeZones(e.target.checked)} style={{ accentColor: 'var(--accent-gold)' }} />
                                Safe zones
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.58rem', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={showControlsBar} onChange={e => setShowControlsBar(e.target.checked)} style={{ accentColor: 'var(--accent-gold)' }} />
                                Controls bar
                            </label>
                        </div>

                        {/* Placement panel (T4-A) — desktop tab */}
                        {showPlacement && previewDevice === 'desktop' && (
                            <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-gold)' }}>📐 Desktop Placement</div>

                                {/* Vertical preset */}
                                <div>
                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Vertical position</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        {ANCHOR_PRESETS.map(p => (
                                            <button key={p.id} onClick={() => setPlacement(prev => ({ ...prev, verticalAnchor: p.id }))}
                                                className={`aim-placement-btn${placement.verticalAnchor === p.id ? ' active' : ''}`}
                                                style={{ padding: '4px 8px', fontSize: '0.62rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: 'var(--text-secondary)', textAlign: 'left' }}
                                            >{p.label}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Y offset */}
                                <div>
                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Y offset: {placement.offsetYPercent > 0 ? '+' : ''}{placement.offsetYPercent.toFixed(1)}%</div>
                                    <input type="range" min="-20" max="20" step="0.5" value={placement.offsetYPercent}
                                        onChange={e => setPlacement(prev => ({ ...prev, offsetYPercent: parseFloat(e.target.value) }))}
                                        style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
                                    />
                                </div>

                                {/* Horizontal */}
                                <div>
                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Horizontal</div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {(['left', 'center', 'right'] as const).map(a => (
                                            <button key={a} onClick={() => setPlacement(prev => ({ ...prev, horizontalAlign: a }))}
                                                className={`aim-placement-btn${placement.horizontalAlign === a ? ' active' : ''}`}
                                                style={{ flex: 1, padding: '4px', fontSize: '0.6rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: 'var(--text-secondary)' }}
                                            >{a[0].toUpperCase() + a.slice(1)}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Background style */}
                                <div>
                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Background</div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {(['none', 'shadow', 'box'] as const).map(b => (
                                            <button key={b} onClick={() => setPlacement(prev => ({ ...prev, backgroundStyle: b }))}
                                                className={`aim-placement-btn${placement.backgroundStyle === b ? ' active' : ''}`}
                                                style={{ flex: 1, padding: '4px', fontSize: '0.6rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: 'var(--text-secondary)' }}
                                            >{b[0].toUpperCase() + b.slice(1)}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Font scale */}
                                <div>
                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Font size</div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {[0.8, 1.0, 1.2, 1.5].map(s => (
                                            <button key={s} onClick={() => setPlacement(prev => ({ ...prev, fontScale: s }))}
                                                className={`aim-placement-btn${placement.fontScale === s ? ' active' : ''}`}
                                                style={{ flex: 1, padding: '4px', fontSize: '0.6rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: 'var(--text-secondary)' }}
                                            >{s}×</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Safe area margin */}
                                <div>
                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Safe margin: {placement.safeAreaMarginPx}px</div>
                                    <input type="range" min="0" max="40" step="1" value={placement.safeAreaMarginPx}
                                        onChange={e => setPlacement(prev => ({ ...prev, safeAreaMarginPx: parseInt(e.target.value) }))}
                                        style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Placement panel — mobile tab (Phase 2) */}
                        {showPlacement && previewDevice !== 'desktop' && (
                            <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-gold)' }}>📱 Mobile Placement
                                    <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '6px', fontSize: '0.58rem' }}>(independent from desktop)</span>
                                </div>

                                {/* Enable independent mobile */}
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={useSeparateMobile} onChange={e => setUseSeparateMobile(e.target.checked)}
                                        style={{ accentColor: 'var(--accent-gold)' }} />
                                    Use separate mobile positioning
                                </label>

                                {useSeparateMobile && (<>
                                    {/* Quick preset shortcuts — apply a full preset in one click */}
                                    <div>
                                        <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Quick presets</div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={() => setMobilePlacement({ verticalAnchor: 'bottom', horizontalAlign: 'center', offsetYPercent: 0, safeAreaMarginPx: 20, fontScale: 0.9 })}
                                                className="aim-placement-btn"
                                                style={{ flex: 1, padding: '5px 4px', fontSize: '0.56rem', cursor: 'pointer', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '5px', color: '#4ade80', fontWeight: 600 }}
                                            >⊥ Bottom Safe</button>
                                            <button
                                                onClick={() => setMobilePlacement({ verticalAnchor: 'lower_third', horizontalAlign: 'center', offsetYPercent: 0, safeAreaMarginPx: 20, fontScale: 0.9 })}
                                                className="aim-placement-btn"
                                                style={{ flex: 1, padding: '5px 4px', fontSize: '0.56rem', cursor: 'pointer', background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: '5px', color: 'var(--accent-gold)', fontWeight: 600 }}
                                            >◎ Lower Third</button>
                                            <button
                                                onClick={() => { if (confirm('Center placement may overlap video controls on some devices. Apply anyway?')) setMobilePlacement({ verticalAnchor: 'middle' as string, horizontalAlign: 'center', offsetYPercent: 0, safeAreaMarginPx: 12, fontScale: 0.9 }) }}
                                                className="aim-placement-btn"
                                                title="Advanced — may overlap controls on some devices"
                                                style={{ flex: 1, padding: '5px 4px', fontSize: '0.56rem', cursor: 'pointer', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '5px', color: 'rgba(245,158,11,0.7)', fontWeight: 600 }}
                                            >≡ Center ⚠</button>
                                        </div>
                                    </div>

                                    {/* Mobile vertical preset — restricted to bottom/lower_third for safety */}
                                    <div>
                                        <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Mobile vertical (safe zone only)</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            {ANCHOR_PRESETS.filter(p => p.id === 'bottom' || p.id === 'lower_third').map(p => (
                                                <button key={p.id} onClick={() => setMobilePlacement(prev => ({ ...prev, verticalAnchor: p.id }))}
                                                    className={`aim-placement-btn${mobilePlacement.verticalAnchor === p.id ? ' active' : ''}`}
                                                    style={{ padding: '4px 8px', fontSize: '0.62rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: 'var(--text-secondary)', textAlign: 'left' }}
                                                >{p.label}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Mobile Y offset */}
                                    <div>
                                        <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Mobile Y offset: {mobilePlacement.offsetYPercent > 0 ? '+' : ''}{mobilePlacement.offsetYPercent.toFixed(1)}%</div>
                                        <input type="range" min="0" max="12" step="0.5" value={mobilePlacement.offsetYPercent}
                                            onChange={e => setMobilePlacement(prev => ({ ...prev, offsetYPercent: parseFloat(e.target.value) }))}
                                            style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
                                        <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>Clamped 0–12% to stay above controls</div>
                                    </div>

                                    {/* Mobile safe area margin */}
                                    <div>
                                        <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Safe margin: {mobilePlacement.safeAreaMarginPx}px</div>
                                        <input type="range" min="12" max="60" step="2" value={mobilePlacement.safeAreaMarginPx}
                                            onChange={e => setMobilePlacement(prev => ({ ...prev, safeAreaMarginPx: parseInt(e.target.value) }))}
                                            style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
                                        <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>Increase for devices with large home indicators</div>
                                    </div>

                                    {/* Mobile font scale */}
                                    <div>
                                        <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Mobile font size</div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {[0.7, 0.8, 0.9, 1.0].map(s => (
                                                <button key={s} onClick={() => setMobilePlacement(prev => ({ ...prev, fontScale: s }))}
                                                    className={`aim-placement-btn${mobilePlacement.fontScale === s ? ' active' : ''}`}
                                                    style={{ flex: 1, padding: '4px', fontSize: '0.6rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: 'var(--text-secondary)' }}
                                                >{s}×</button>
                                            ))}
                                        </div>
                                    </div>
                                </>)}
                            </div>
                        )}

                        {/* Shortcuts */}
                        <div style={{ padding: '8px 10px', fontSize: '0.58rem', color: 'rgba(255,255,255,0.18)', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>Click a cue row to seek · Active cue highlighted</div>
                            <div><kbd style={{ fontFamily: 'monospace', fontSize: '0.55rem', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', padding: '0 3px' }}>Ctrl+Z</kbd> Undo</div>
                            <div><kbd style={{ fontFamily: 'monospace', fontSize: '0.55rem', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', padding: '0 3px' }}>Ctrl+Y</kbd> Redo</div>
                        </div>
                    </div>
                )}

                {/* CENTER: source cues (side-by-side mode) */}
                {sourceSegments && (
                    <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '8px' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-gold)', padding: '4px 6px', marginBottom: '6px', position: 'sticky', top: 0, background: 'rgba(13,15,20,0.95)', borderRadius: '4px' }}>
                            SOURCE (read-only)
                        </div>
                        {sourceSegments.map((s, i) => (
                            <div key={i} style={{ marginBottom: '4px', padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                                <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', marginBottom: '2px', fontFamily: 'monospace' }}>
                                    {fmtMs(s.start)} → {fmtMs(s.end)}
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>{s.text}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* RIGHT: cue editor */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>

                    {/* Revision history drawer */}
                    {showRevisions && (
                        <div style={{ marginBottom: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-gold)', flex: 1 }}>🕓 Revision History</div>
                                {/* Phase 4: history management actions */}
                                <button onClick={() => setShowClearModal(true)} style={{ padding: '3px 8px', fontSize: '0.6rem', cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '5px', color: '#f87171' }}>🗑 Manage History</button>
                            </div>
                            {loadingRevisions && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Loading…</div>}
                            {!loadingRevisions && revisions.length === 0 && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>No revisions saved yet.</div>}
                            {revisions.map(rev => (
                                <div key={rev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-primary)' }}>{new Date(rev.savedAt).toLocaleString()}</div>
                                        <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>{rev.savedByEmail} · {rev.changeSource.replace(/_/g, ' ')}</div>
                                    </div>
                                    <button onClick={() => restoreRevision(rev.id)} style={btnStyle()}>Restore</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {cues.length === 0 && (
                        <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                            No subtitle cues. Generate subtitles first or import an SRT/VTT file.
                        </div>
                    )}

                    {cues.map((cue, idx) => {
                        const warns = getWarnings(cues, idx)
                        const isActive = idx === activeCue
                        const cuePlacement = placement.cueOverrides[String(idx)]
                        const hasOverride = !!cuePlacement

                        return (
                            <div key={idx} style={{
                                marginBottom: '4px', borderRadius: '8px', transition: 'all 0.12s',
                                border: isActive ? '1px solid rgba(212,168,83,0.5)'
                                    : warns.length > 0 ? '1px solid rgba(245,158,11,0.25)'
                                    : '1px solid rgba(255,255,255,0.06)',
                                background: isActive ? 'rgba(212,168,83,0.05)' : 'rgba(255,255,255,0.02)',
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '28px auto 1fr auto', alignItems: 'center', gap: '6px', padding: '7px 10px' }}>
                                    {/* Seq / seek */}
                                    <button onClick={() => { const vid = videoRef.current; if (vid) { vid.currentTime = cue.start; vid.play().catch(() => {}) } }}
                                        title="Jump to this cue"
                                        style={{ minWidth: '24px', textAlign: 'center', fontSize: '0.6rem', color: isActive ? 'var(--accent-gold)' : 'var(--text-tertiary)', fontWeight: 700, background: 'none', border: 'none', cursor: filmUrl ? 'pointer' : 'default', padding: '2px' }}
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
                                    <textarea value={cue.text} onChange={e => updateCue(idx, { text: e.target.value })} rows={2}
                                        style={{ width: '100%', resize: 'vertical', padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.82rem', lineHeight: 1.5, fontFamily: 'inherit', outline: 'none' }}
                                    />

                                    {/* Actions */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <button onClick={() => splitCue(idx)} title="Split cue at midpoint" style={{ padding: '3px 6px', fontSize: '0.65rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'var(--text-tertiary)' }}>⎯</button>
                                        <button onClick={() => mergeCue(idx)} title="Merge with next" disabled={idx >= cues.length - 1} style={{ padding: '3px 6px', fontSize: '0.65rem', cursor: idx < cues.length - 1 ? 'pointer' : 'not-allowed', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'var(--text-tertiary)', opacity: idx >= cues.length - 1 ? 0.35 : 1 }}>⊔</button>
                                        <button onClick={() => deleteCue(idx)} title="Delete cue" style={{ padding: '3px 6px', fontSize: '0.65rem', cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', color: '#f87171' }}>✕</button>
                                        {/* T4-B: cue override toggle */}
                                        <button
                                            onClick={() => setCueOverride(idx, hasOverride ? null : { verticalAnchor: placement.verticalAnchor })}
                                            title={hasOverride ? 'Remove cue placement override (use track default)' : 'Add cue placement override'}
                                            style={{ padding: '3px 6px', fontSize: '0.6rem', cursor: 'pointer', background: hasOverride ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${hasOverride ? 'rgba(212,168,83,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '4px', color: hasOverride ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}
                                        >📐</button>
                                    </div>
                                </div>

                                {/* Per-cue placement override controls (T4-B) */}
                                {hasOverride && (
                                    <div style={{ padding: '4px 10px 8px', borderTop: '1px solid rgba(212,168,83,0.1)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.58rem', color: 'var(--accent-gold)', minWidth: 'max-content' }}>Cue override:</span>
                                        {ANCHOR_PRESETS.map(p => (
                                            <button key={p.id}
                                                onClick={() => setCueOverride(idx, { verticalAnchor: p.id })}
                                                className={`aim-placement-btn${(cuePlacement as PlacementState)?.verticalAnchor === p.id ? ' active' : ''}`}
                                                style={{ padding: '2px 7px', fontSize: '0.58rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'var(--text-tertiary)' }}
                                            >{p.label}</button>
                                        ))}
                                        {(['left', 'center', 'right'] as const).map(a => (
                                            <button key={a}
                                                onClick={() => setCueOverride(idx, { horizontalAlign: a })}
                                                className={`aim-placement-btn${(cuePlacement as PlacementState)?.horizontalAlign === a ? ' active' : ''}`}
                                                style={{ padding: '2px 7px', fontSize: '0.58rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'var(--text-tertiary)' }}
                                            >{a[0].toUpperCase() + a.slice(1)}</button>
                                        ))}
                                        <button onClick={() => setCueOverride(idx, null)} style={{ padding: '2px 7px', fontSize: '0.58rem', cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', color: '#f87171' }}>Reset to track</button>
                                    </div>
                                )}

                                {/* Warnings */}
                                {warns.length > 0 && (
                                    <div style={{ padding: '2px 10px 6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {warns.map(w => (
                                            <span key={w} style={{ fontSize: '0.58rem', padding: '1px 6px', borderRadius: '999px', background: w === 'invalid' || w === 'empty' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${w === 'invalid' || w === 'empty' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, color: w === 'invalid' || w === 'empty' ? '#f87171' : '#fbbf24' }}>{WARN_LABELS[w]}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Insert below */}
                                <button onClick={() => insertAfter(idx)} title="Insert new cue after this one"
                                    style={{ display: 'block', width: '100%', padding: '2px 0', fontSize: '0.58rem', background: 'none', border: 'none', borderTop: '1px dashed rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', borderRadius: '0 0 8px 8px', transition: 'color 0.15s, background 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-gold)'; e.currentTarget.style.background = 'rgba(212,168,83,0.04)' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'none' }}
                                >+ insert cue below</button>
                            </div>
                        )
                    })}

                    {cues.length === 0 && (
                        <button onClick={() => insertAfter(-1)} style={{ display: 'block', margin: '16px auto', padding: '8px 20px', borderRadius: '8px', background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.8rem' }}>
                            + Add first cue
                        </button>
                    )}

                    <div style={{ height: '80px' }} />
                </div>
            </div>
        </div>

        {/* ── Phase 4: History Clear Confirmation Modal ── */}
        {showClearModal && typeof window !== 'undefined' && createPortal(
            <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ background: '#111318', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px', padding: '24px', maxWidth: '480px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>🗑 Manage Revision History</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
                        Choose an action below. <strong style={{ color: '#f87171' }}>This cannot be undone.</strong> The active subtitle content is preserved unless you choose &ldquo;Reset to approved&rdquo;.
                    </div>

                    {/* Action selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                        {([
                            { id: 'clear_only',       label: 'Clear revision history only',           desc: 'Delete all revision snapshots. Active subtitles unchanged.' },
                            { id: 'archive_and_clear', label: 'Archive and clear',                    desc: 'Download a JSON archive of all revisions, then delete them.' },
                            { id: 'reset_and_clear',  label: 'Reset to last approved + clear',        desc: 'Restore the last approved snapshot as current subtitles, then clear history.' },
                            { id: 'delete_drafts',    label: 'Delete draft revisions only',            desc: 'Only removes manual_edit revisions. Approved snapshots kept.' },
                        ] as { id: ClearAction; label: string; desc: string }[]).map(opt => (
                            <label key={opt.id} style={{ display: 'flex', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', background: clearAction === opt.id ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${clearAction === opt.id ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                                <input type="radio" name="clearAction" value={opt.id} checked={clearAction === opt.id} onChange={() => setClearAction(opt.id)} style={{ accentColor: '#f87171', marginTop: '2px', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>{opt.desc}</div>
                                </div>
                            </label>
                        ))}
                    </div>

                    {/* Reason */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Reason (optional)</div>
                        <input type="text" value={clearReason} onChange={e => setClearReason(e.target.value)}
                            placeholder="Why is history being cleared?"
                            style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: 'var(--text-primary)', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowClearModal(false); setClearReason('') }} style={btnStyle()}>Cancel</button>
                        <button onClick={handleClearHistory} disabled={clearing}
                            style={{ ...btnStyle('danger'), padding: '6px 16px', fontSize: '0.75rem', opacity: clearing ? 0.6 : 1 }}>
                            {clearing ? 'Clearing…' : '🗑 Confirm Clear'}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
        </>
    )
}
